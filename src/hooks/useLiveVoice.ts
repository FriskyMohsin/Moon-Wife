import { useState, useRef, useEffect, useCallback } from 'react';
import { GeminiLiveAudioManager } from '../lib/audioManager';

export type LiveSessionState = 'IDLE' | 'REQUESTING_MIC' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';

type AuthToken = string;

interface UseLiveVoiceOptions {
  auth: AuthToken;
  voice: string;
  aiName: string;
  hasBYOK: boolean;
  wsPath?: string;
}

/**
 * Reusable live voice call hook — extracted from HoorviaDashboard.
 * Powers inline voice calls anywhere (e.g. owner home) without
 * mounting the full dashboard.
 */
export function useLiveVoice({ auth: token, voice, aiName, hasBYOK, wsPath = '/api/hoorvia/live-ws' }: UseLiveVoiceOptions) {
  const [liveState, setLiveState] = useState<LiveSessionState>('IDLE');
  const [liveStatus, setLiveStatus] = useState<string>(`Tap the call button and just talk to ${aiName}.`);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const [connectedLiveModel, setConnectedLiveModel] = useState<string | null>(null);

  const audioManagerRef = useRef<GeminiLiveAudioManager | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const durationTimerRef = useRef<any>(null);

  const stopLiveSession = useCallback((notifyUser: boolean = true, source: string = 'user_action') => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (liveWsRef.current) {
      const activeWs = liveWsRef.current;
      liveWsRef.current = null;
      try {
        if (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING) {
          activeWs.close(1000, source);
        }
      } catch {}
    }
    if (audioManagerRef.current) {
      try {
        audioManagerRef.current.destroy();
      } catch {}
      audioManagerRef.current = null;
    }
    setAudioLevel(0);
    setLiveState((prev) => (prev === 'ERROR' ? 'ERROR' : 'IDLE'));
    if (notifyUser) {
      setLiveStatus('Voice call ended.');
    }
  }, []);

  const startLiveSession = useCallback(async () => {
    setLiveError(null);

    if (!hasBYOK) {
      setLiveState('ERROR');
      setLiveError(`Add your Gemini API key in Settings → Keys before calling ${aiName}.`);
      return;
    }

    setLiveState('REQUESTING_MIC');
    setLiveStatus('Requesting microphone access...');

    const audioManager = new GeminiLiveAudioManager({
      onAudioData: (base64Pcm) => {
        if (liveWsRef.current && liveWsRef.current.readyState === WebSocket.OPEN) {
          liveWsRef.current.send(
            JSON.stringify({
              type: 'realtime_input',
              mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm }],
            })
          );
        }
      },
      onVoiceStateChange: (state) => {
        if (state === 'Speaking') setLiveState('SPEAKING');
        else if (state === 'Listening') setLiveState('LISTENING');
      },
      onAudioLevel: (level) => setAudioLevel(level),
      onUserSpeechDetected: () => {},
      onError: (err) => console.error('[Live Audio Manager error]', err),
    });

    audioManager.setGuestMode(true);
    audioManagerRef.current = audioManager;

    try {
      const micStarted = await audioManager.startMicrophone();
      if (!micStarted) {
        setMicPermission('denied');
        setLiveState('ERROR');
        setLiveError('Microphone permission is required. Please allow microphone access in your browser settings.');
        stopLiveSession(false, 'mic_permission_failed');
        return;
      }
      setMicPermission('granted');
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicPermission(isDenied ? 'denied' : 'unavailable');
      setLiveState('ERROR');
      setLiveError(
        isDenied
          ? 'Microphone permission is required. Please allow microphone access in your browser settings.'
          : 'No microphone found or device is unavailable.'
      );
      stopLiveSession(false, 'mic_error');
      return;
    }

    setLiveState('CONNECTING');
    setLiveStatus(`Connecting your call with ${aiName} (${voice})...`);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${wsPath}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = () => {
        setLiveStatus(`Call connecting with ${aiName}...`);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ready') {
            setConnectedLiveModel(data.model);
            setLiveState('LISTENING');
            setLiveStatus(`Live with ${aiName} (${data.voice || voice}) • ${data.model || ''}`);
            setLiveDuration(0);
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
            durationTimerRef.current = setInterval(() => {
              setLiveDuration((prev) => prev + 1);
            }, 1000);
          } else if (data.type === 'audio' && data.audio) {
            setLiveState('SPEAKING');
            audioManagerRef.current?.playChunk(data.audio, data.mimeType);
          } else if (data.type === 'interrupted') {
            audioManagerRef.current?.bargeIn();
            setLiveState('LISTENING');
          } else if (data.type === 'turnComplete') {
            setLiveState('LISTENING');
          } else if (data.type === 'error') {
            setLiveState('ERROR');
            setLiveError(data.message || 'Voice call encountered an issue.');
            stopLiveSession(false, 'server_error');
          }
        } catch (err) {
          console.error('[Live WS parse error]', err);
        }
      };

      ws.onerror = (e) => console.error('[CLIENT_WS_ERROR]', e);

      ws.onclose = (event) => {
        if (liveWsRef.current === ws) {
          stopLiveSession(false, `ws_onclose_code_${event.code}`);
        }
      };
    } catch (err: any) {
      setLiveState('ERROR');
      setLiveError(err.message || 'Failed to start the voice call.');
      stopLiveSession(false, 'init_exception');
    }
  }, [token, voice, aiName, hasBYOK, wsPath, stopLiveSession]);

  const toggleLive = useCallback(() => {
    if (liveState === 'CONNECTING' || liveState === 'LISTENING' || liveState === 'SPEAKING') {
      stopLiveSession(true, 'user_toggle_end');
    } else {
      startLiveSession();
    }
  }, [liveState, startLiveSession, stopLiveSession]);

  useEffect(() => {
    return () => {
      if (liveWsRef.current) {
        stopLiveSession(false, 'unmount');
      }
    };
  }, [stopLiveSession]);

  const isLive = liveState === 'CONNECTING' || liveState === 'LISTENING' || liveState === 'SPEAKING';

  return {
    liveState,
    liveStatus,
    liveError,
    micPermission,
    audioLevel,
    liveDuration,
    connectedLiveModel,
    isLive,
    toggleLive,
    stopLiveSession,
  };
}
