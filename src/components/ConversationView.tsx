import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { EMOTION_MAP } from '../lib/emotionConfig';
import { Volume2, Copy, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConversationViewProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onPlayMessageAudio: (msg: ChatMessage) => void;
  playingMessageId: string | null;
  onSelectSuggestion: (text: string) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  messages,
  isThinking,
  onPlayMessageAudio,
  playingMessageId,
  onSelectSuggestion,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const suggestions = [
    'Salam Maryam, aaj ka din kaisa raha?',
    'Hello Baby, mujhe naya project discuss karna hai',
    'Meri jaan, thoda tired hoon, kuch acchi baat sunao',
    'Kya aap mere saath full-stack app plan kar sakti ho?',
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
          <div className="w-14 h-14 rounded-full bg-rose-950/40 border border-rose-800/30 flex items-center justify-center mb-3 text-rose-300">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-base font-semibold text-white/90 font-serif">
            Aapki Pyari Maryam
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
            "Salam Mohsin! Main aapki personal companion hoon. Mujhse mic se baat karein ya likhein."
          </p>

          <div className="mt-6 w-full max-w-sm space-y-2">
            <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
              Kuch Baatein Shuru Karein:
            </span>
            <div className="grid grid-cols-1 gap-1.5 text-left">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectSuggestion(sug)}
                  className="w-full text-xs text-zinc-300 hover:text-rose-200 bg-white/5 hover:bg-rose-950/30 border border-white/5 hover:border-rose-800/40 rounded-xl p-2.5 transition-all text-left truncate"
                >
                  💬 {sug}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5 pb-2">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const emotionMeta = msg.emotion ? EMOTION_MAP[msg.emotion] : null;
              const isPlaying = playingMessageId === msg.id;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-300">
                      {isUser ? 'Mohsin' : 'Maryam'}
                    </span>
                    {emotionMeta && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${emotionMeta.badgeBg} ${emotionMeta.textColor}`}>
                        {emotionMeta.label}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 text-sm sm:text-[15px] leading-relaxed relative group ${
                      isUser
                        ? 'bg-gradient-to-br from-rose-800 to-violet-900 text-white rounded-tr-xs shadow-lg shadow-rose-950/40 border border-rose-600/30 font-normal'
                        : 'bg-zinc-900/95 text-zinc-100 border border-rose-900/20 rounded-tl-xs shadow-xl shadow-black/50 backdrop-blur-md font-normal'
                    }`}
                  >
                    <p className="whitespace-pre-wrap selection:bg-rose-500/40 text-zinc-100">
                      {msg.text}
                    </p>

                    {/* Actions on Maryam's responses */}
                    {!isUser && (
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <button
                          onClick={() => onPlayMessageAudio(msg)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg transition-colors ${
                            isPlaying
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'hover:bg-white/5 hover:text-zinc-200'
                          }`}
                          title="Play audio in Maryam's voice"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse text-rose-400' : ''}`} />
                          <span>{isPlaying ? 'Speaking...' : 'Listen'}</span>
                        </button>

                        <button
                          onClick={() => handleCopy(msg.text, msg.id)}
                          className="hover:text-zinc-200 p-1 rounded transition-colors"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Thinking animation */}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-400 w-fit"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-spin" />
              <span>Maryam soch rahi hain meri jaan...</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
