import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import {
  validateSessionToken,
  getUserById,
  getUserGeminiModelAndKey,
  getBYOKCredentialStatus,
  getCompanionProfile,
  saveCompanionProfile,
  getUserCompanionMemories,
  buildSystemPrompt,
  getEncryptedCredential,
  recordUserUsage,
  recordUserApiRequest,
  LIVE_COMPATIBLE_MODELS,
  getCompatibleLiveModelForUser,
  sanitizeErrorMessageForPublicUser,
} from './hoorviaPlatform';
import { ApiAuditLog } from './hoorviaTypes';
import {
  createRealtimeAudioInput,
  decodedBase64ByteLength,
  extractModelAudioChunks,
} from './liveAudioProtocol';

export function registerHoorviaLiveWs(server: HttpServer) {
  // Legacy hook maintained for compatibility if needed
}

export async function handleHoorviaLiveWsConnection(
  clientWs: WebSocket,
  req: any,
  preValidatedAuth?: any
) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token') || (req.headers['x-hoorvia-token'] as string);

  // Safe client error listener attached immediately
  clientWs.on('error', (err) => {
    console.error('[CLIENT_WS_ERROR]', err?.message || err);
  });

  if (!token && !preValidatedAuth) {
    console.warn('[Hoorvia Live WS] Rejected: Missing auth token');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Authentication token is required to start Live Voice session.',
          code: 'UNAUTHORIZED',
        })
      );
      clientWs.close(4401, 'Unauthorized');
    }
    return;
  }

  const authUser = preValidatedAuth || validateSessionToken(token);
  if (!authUser) {
    console.warn('[Hoorvia Live WS] Rejected: Invalid or expired auth token');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED',
        })
      );
      clientWs.close(4401, 'Session Expired');
    }
    return;
  }

  const userId = authUser.userId;
  const userObj = getUserById(userId);
  const userName = userObj?.name || 'User';
  const companion = getCompanionProfile(userId) || saveCompanionProfile(userId, {});

  console.log(`[PUBLIC_ROUTE_SELECTED] User: ${userId} (${userName}) Companion: ${companion.name}`);

  // 1. BYOK Credential Resolution - Strictly User's own key
  const isOwner = authUser.role === 'owner';
  const byokStatus = getBYOKCredentialStatus(userId);
  const userModelAndKey = byokStatus.apiKey && byokStatus.model
    ? { apiKey: byokStatus.apiKey, model: byokStatus.model }
    : null;

  // For public users, their own validated BYOK API key is strictly required
  if (!isOwner && (!userModelAndKey || !userModelAndKey.apiKey)) {
    const isDecryptFailed = byokStatus.code === 'DECRYPT_FAILED';
    const userMessage = isDecryptFailed
      ? 'Stored provider credential can no longer be decrypted. Please reconnect your API key.'
      : (byokStatus.userFacingMessage || 'Your own API key is required to activate your companion. Please connect your Google Gemini API key in Provider Settings.');
    const errorCode = isDecryptFailed ? 'RECONNECT_REQUIRED' : (byokStatus.code || 'MISSING_BYOK_KEY');
    const closeCode = isDecryptFailed ? 4403 : 4402;

    console.warn(`[Hoorvia Live WS] User ${userId} BYOK error: ${errorCode}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: userMessage,
          code: errorCode,
        })
      );
      clientWs.close(closeCode, userMessage);
    }
    return;
  }

  const effectiveApiKey = isOwner
    ? userModelAndKey?.apiKey || process.env.GEMINI_API_KEY
    : userModelAndKey?.apiKey;

  if (!effectiveApiKey) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message:
            'Your own API key is required to activate your companion. Please connect your Google Gemini API key in Provider Settings.',
          code: 'MISSING_API_KEY',
        })
      );
      clientWs.close(4402, 'Missing API Key');
    }
    return;
  }

  // 2. Discover / Select Live-Compatible Model
  const cred = getEncryptedCredential(userId);
  const available = cred?.availableModels || [];
  const candidateLiveModels: string[] = [];

  for (const m of LIVE_COMPATIBLE_MODELS) {
    if (available.includes(m)) {
      candidateLiveModels.push(m);
    }
  }
  for (const m of LIVE_COMPATIBLE_MODELS) {
    if (!candidateLiveModels.includes(m)) {
      candidateLiveModels.push(m);
    }
  }

  // 3. Companion Prompt & Voice Configuration
  const publicVoice = companion.voice || 'Aoede';
  const publicLang = companion.language || 'English';
  const memories = getUserCompanionMemories(userId, companion.id);

  const companionSysPrompt =
    (companion.systemPrompt || buildSystemPrompt(companion)) +
    (memories.length > 0
      ? `\n\nREMEMBERED FACTS ABOUT USER (${userName}):\n` +
        memories.map((m) => `- [${m.category.toUpperCase()}] ${m.fact}`).join('\n')
      : '') +
    `\n\nLive Voice Communication Rules:
1. Speak in ${publicLang} naturally and fluently.
2. Keep spoken turns concise, conversational, and direct (1-3 sentences).
3. Do not output markdown or code blocks in spoken audio mode.`;

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  let liveSession: any = null;
  let selectedLiveModel = candidateLiveModels[0] || 'gemini-3.8-live';
  let isConnected = false;
  const sessionStartTime = Date.now();
  let audioInputFrames = 0;
  let audioOutputFrames = 0;
  let clientAudioChunksSent = 0;
  let clientAudioBytesSent = 0;
  let geminiInputChunks = 0;
  let geminiInputBytes = 0;
  let geminiOutputAudioChunks = 0;
  let geminiOutputAudioBytes = 0;
  let browserAudioChunksForwarded = 0;
  let browserAudioBytesForwarded = 0;
  let connectRetries = 0;
  let connectionError: any = null;
  const earlyMessageQueue: any[] = [];

  // Register client message listener IMMEDIATELY so early frames or pings are never dropped
  clientWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'ping') {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'pong',
              clientTime: msg.clientTime || msg.t,
              serverTime: Date.now(),
            })
          );
        }
        return;
      }

      if (!isConnected || !liveSession) {
        // Buffer early audio chunks before session handshake finishes
        if (msg.type === 'audio' || msg.type === 'realtime_input' || msg.type === 'text') {
          earlyMessageQueue.push(msg);
          if (earlyMessageQueue.length > 100) earlyMessageQueue.shift();
        }
        return;
      }

      if (msg.type === 'realtime_input' && msg.mediaChunks && liveSession) {
        audioInputFrames++;
        for (const chunk of msg.mediaChunks) {
          const byteLength = decodedBase64ByteLength(chunk.data || '');
          clientAudioChunksSent++;
          clientAudioBytesSent += byteLength;
          console.log(`[PUBLIC_LIVE_CLIENT_AUDIO] chunks=${clientAudioChunksSent} bytes=${clientAudioBytesSent}`);
          try {
            // Match Maryam's proven SDK contract. A bare array has no `audio`
            // property, so the SDK can serialize an empty realtime-input frame.
            liveSession.sendRealtimeInput(createRealtimeAudioInput(chunk.data, chunk.mimeType));
            geminiInputChunks++;
            geminiInputBytes += byteLength;
            console.log(`[PUBLIC_LIVE_GEMINI_INPUT] chunks=${geminiInputChunks} bytes=${geminiInputBytes}`);
          } catch (e) {
            console.warn('[Hoorvia Live WS] Realtime input send error:', e);
          }
        }
      } else if (msg.type === 'audio' && msg.audio && liveSession) {
        audioInputFrames++;
        const byteLength = decodedBase64ByteLength(msg.audio);
        clientAudioChunksSent++;
        clientAudioBytesSent += byteLength;
        try {
          liveSession.sendRealtimeInput(createRealtimeAudioInput(msg.audio));
          geminiInputChunks++;
          geminiInputBytes += byteLength;
          console.log(`[PUBLIC_LIVE_GEMINI_INPUT] chunks=${geminiInputChunks} bytes=${geminiInputBytes}`);
        } catch (e) {
          console.warn('[Hoorvia Live WS] Audio chunk send error:', e);
        }
      } else if (msg.type === 'interrupt' || msg.type === 'interrupted') {
        console.log('[Hoorvia Live WS] User barge-in interrupt received');
      } else if (msg.type === 'text' && msg.text && liveSession) {
        liveSession.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: msg.text }],
            },
          ],
          turnComplete: true,
        });
      }
    } catch (err) {
      console.error('[Hoorvia Live WS] Error processing client message:', err);
    }
  });

  // Handle Client WebSocket Close
  clientWs.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : '';
    console.log(`[CLIENT_WS_CLOSE] code=${code} reason=${reasonStr} user=${userId}`);
    if (liveSession) {
      try {
        liveSession.close();
      } catch {
        // Ignore
      }
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - sessionStartTime) / 1000));
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // Record live usage duration
    recordUserUsage(userId, true, durationMinutes);

    // Record API audit log with full live diagnostics
    recordUserApiRequest(
      userId,
      true,
      companion.name,
      selectedLiveModel,
      'live_voice',
      undefined,
      {
        retryCount: connectRetries,
        liveDiagnostics: {
          liveModel: selectedLiveModel,
          micPermission: 'granted',
          wsConnectionState: 'connected',
          sessionStarted: true,
          audioInputFrames,
          audioOutputFrames,
          clientAudioChunksSent,
          clientAudioBytesSent,
          geminiInputChunks,
          geminiInputBytes,
          geminiOutputAudioChunks,
          geminiOutputAudioBytes,
          browserAudioChunksForwarded,
          browserAudioBytesForwarded,
          durationSeconds,
          finalResult: 'SUCCESS',
          disconnectReason: `Client Session Ended (code ${code})`,
        },
      }
    );
  });

  // 4. Attempt connection with controlled retry + Live model failover
  for (const modelCandidate of candidateLiveModels.slice(0, 3)) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        connectRetries++;
        const delayMs = attempt === 1 ? 600 : 1200;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Check if client socket was closed during retry backoff
      if (clientWs.readyState === WebSocket.CLOSED || clientWs.readyState === WebSocket.CLOSING) {
        console.log(`[Hoorvia Live WS] Client disconnected before upstream connect finished (user ${userId})`);
        return;
      }

      try {
        console.log(
          `[Hoorvia Live WS] Connecting user ${userId} to Live model ${modelCandidate} (attempt ${attempt + 1})`
        );

        liveSession = await ai.live.connect({
          model: modelCandidate,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: publicVoice },
              },
            },
            systemInstruction: companionSysPrompt,
          },
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              const msgTypeKeys = Object.keys(message || {}).join(',');
              console.log(`[GEMINI_MESSAGE_RECEIVED] type=${msgTypeKeys}`);

              if (message.serverContent) {
                console.log('[GEMINI_SERVER_CONTENT]');
              }
              if (message.serverContent?.modelTurn) {
                console.log('[GEMINI_MODEL_TURN_RECEIVED]');
              }

                // Gemini Live audio is raw 24kHz PCM in modelTurn inlineData.
                for (const { data: audio, mimeType } of extractModelAudioChunks(message)) {
                  const byteLength = decodedBase64ByteLength(audio);
                  audioOutputFrames++;
                  geminiOutputAudioChunks++;
                  geminiOutputAudioBytes += byteLength;
                  clientWs.send(JSON.stringify({ type: 'audio', audio, mimeType }));
                  browserAudioChunksForwarded++;
                  browserAudioBytesForwarded += byteLength;
                  console.log(`[PUBLIC_LIVE_OUTPUT] geminiChunks=${geminiOutputAudioChunks} geminiBytes=${geminiOutputAudioBytes} browserChunks=${browserAudioChunksForwarded} browserBytes=${browserAudioBytesForwarded} mime=${mimeType}`);
                }

              // Interruption detection
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
              }

              // Turn completion
              if (message.serverContent?.turnComplete) {
                clientWs.send(JSON.stringify({ type: 'turnComplete' }));
              }
            },
            onerror: (err: any) => {
              console.error(`[GOOGLE_WS_ERROR] Live session error for user ${userId}:`, err?.message || err);
              const sanitized = sanitizeErrorMessageForPublicUser(err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'error',
                    message: sanitized.userMessage,
                  })
                );
              }
            },
            onclose: (closeEvent: any) => {
              console.log(
                `[GOOGLE_WS_CLOSE] code=${closeEvent?.code || 'normal'} reason=${closeEvent?.reason || ''} user=${userId}`
              );
              isConnected = false;
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'closed' }));
              }
            },
          },
        });

        selectedLiveModel = modelCandidate;
        isConnected = true;
        console.log(`[GOOGLE_LIVE_CONNECTED] Model: ${selectedLiveModel} for user ${userId}`);
        break;
      } catch (err: any) {
        connectionError = err;
        const errStr = typeof err === 'string' ? err : err?.message || JSON.stringify(err || '');
        console.warn(
          `[Hoorvia Live WS] Connect failed on model ${modelCandidate} attempt ${attempt + 1}:`,
          errStr
        );

        const is503 =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('temporarily unavailable');

        if (!is503) {
          // Not a temporary 503, try next live model candidate immediately
          break;
        }
      }
    }

    if (isConnected) break;
  }

  if (!isConnected || !liveSession) {
    const errStr = connectionError?.message || '';
    const is503 =
      errStr.includes('503') ||
      errStr.includes('UNAVAILABLE') ||
      errStr.includes('high demand') ||
      errStr.includes('temporarily unavailable');

    const userErrorMessage = is503
      ? 'Live Voice is temporarily unavailable. Please try again shortly.'
      : 'Live Voice is not available with your current AI provider/model access.';

    console.error(`[Hoorvia Live WS] Live connection failed for user ${userId}:`, userErrorMessage);

    recordUserApiRequest(
      userId,
      false,
      companion.name,
      selectedLiveModel,
      'live_voice',
      connectionError?.message || userErrorMessage,
      {
        retryCount: connectRetries,
        originalStatus: is503 ? '503 UNAVAILABLE' : connectionError?.status || 'FAIL',
        liveDiagnostics: {
          liveModel: selectedLiveModel,
          micPermission: 'granted',
          wsConnectionState: 'failed',
          sessionStarted: false,
          retryCount: connectRetries,
          finalResult: 'FAILED',
          disconnectReason: userErrorMessage,
        },
      }
    );

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: userErrorMessage,
        })
      );
      clientWs.close(4403, 'Live Connection Failed');
    }
    return;
  }

  // Connection Succeeded - Forward setupComplete / ready to client
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(
      JSON.stringify({
        type: 'ready',
        setupComplete: true,
        companionName: companion.name,
        voice: publicVoice,
        language: publicLang,
        model: selectedLiveModel,
      })
    );
    console.log(`[SETUP_COMPLETE_FORWARDED] Model: ${selectedLiveModel} to user ${userId}`);
  }

  // Flush any early buffered audio chunks to Google Live session
  while (earlyMessageQueue.length > 0) {
    const msg = earlyMessageQueue.shift();
    if (msg?.type === 'audio' && msg.audio && liveSession) {
      audioInputFrames++;
      try {
        liveSession.sendRealtimeInput(createRealtimeAudioInput(msg.audio));
        geminiInputChunks++;
        geminiInputBytes += decodedBase64ByteLength(msg.audio);
      } catch (err) {
        console.warn('[Hoorvia Live WS] Buffered audio send error:', err);
      }
    } else if (msg?.type === 'realtime_input' && msg.mediaChunks && liveSession) {
      audioInputFrames++;
      for (const chunk of msg.mediaChunks) {
        try {
          liveSession.sendRealtimeInput(createRealtimeAudioInput(chunk.data, chunk.mimeType));
          geminiInputChunks++;
          geminiInputBytes += decodedBase64ByteLength(chunk.data || '');
        } catch (err) {
          console.warn('[Hoorvia Live WS] Buffered realtime input send error:', err);
        }
      }
    }
  }
}
