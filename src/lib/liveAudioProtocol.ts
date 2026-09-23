/** Transport-only Live Voice helpers; no user, companion, or session data. */
export interface LiveAudioChunk {
  data: string;
  mimeType: string;
}

export function createRealtimeAudioInput(data: string, mimeType = 'audio/pcm;rate=16000') {
  return { audio: { data, mimeType } };
}

export function extractModelAudioChunks(message: any): LiveAudioChunk[] {
  const parts = message?.serverContent?.modelTurn?.parts;
  if (!Array.isArray(parts)) return [];
  return parts.flatMap((part: any) => {
    const data = part?.inlineData?.data;
    return typeof data === 'string' && data.length > 0
      ? [{ data, mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000' }]
      : [];
  });
}

/** Base64 text length includes transport expansion; this reports PCM bytes. */
export function decodedBase64ByteLength(base64: string): number {
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
