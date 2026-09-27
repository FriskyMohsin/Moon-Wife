/**
 * Pari AI — image generation (user's own Gemini key) + Social Content Studio.
 *
 * Phase 1 studio: NO auto-posting anywhere. Returns a ready-to-post pack
 * {imageUrl, caption, hashtags} the user copies into Instagram/TikTok/
 * Facebook themselves.
 *
 * Honest failure: if the user's key cannot access image generation
 * (no billing, model not available, permission denied), we return HTTP 402
 * {error:'no_image_access'} — never a silent failure, never a fake image.
 */
import { GoogleGenAI } from '@google/genai';
import { generateTextWithUserKey, extractJsonPayload } from './pariStore';
import { saveUserFile } from './pariFiles';
import { resolveModelKeyForUser } from './pariRouter';

export const PARI_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';

export class PariImageAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PariImageAccessError';
  }
}

function isImageAccessDenied(err: any): boolean {
  const s = `${err?.message || ''} ${err?.status || ''} ${JSON.stringify(err || '').slice(0, 500)}`.toLowerCase();
  return /40[13]|permission|billing|not billed|not available|not found|unsupported|quota|invalid api key/.test(s);
}

/**
 * Generate one image with the user's key. Returns the download URL
 * (served by GET /api/hoorvia/client/files/:id, userId-checked).
 * Throws PariImageAccessError when the key lacks image access.
 */
export async function generateImageForUser(
  userId: string,
  prompt: string,
  modelOverride?: string
): Promise<{ imageUrl: string; fileId: string; filename: string }> {
  const cleanPrompt = (prompt || '').trim().slice(0, 2000);
  if (!cleanPrompt) throw new Error('Prompt is required.');

  const resolved = resolveModelKeyForUser(userId, modelOverride || PARI_IMAGE_MODEL);
  if (!resolved) {
    throw new PariImageAccessError(
      'No API key on file. Connect your own Gemini API key first — image generation uses your key.'
    );
  }

  let imageBase64: string | null = null;
  let mimeType = 'image/png';
  try {
    const ai = new GoogleGenAI({ apiKey: resolved.apiKey });
    const response = await ai.models.generateContent({
      model: resolved.model,
      contents: [{ role: 'user', parts: [{ text: cleanPrompt }] }],
      config: { responseModalities: ['Image', 'Text'] } as any,
    });
    const parts = (response as any)?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p?.inlineData?.data) {
        imageBase64 = p.inlineData.data;
        mimeType = p.inlineData.mimeType || 'image/png';
        break;
      }
    }
    if (!imageBase64) {
      const textBits = parts
        .map((p: any) => p?.text || '')
        .join(' ')
        .slice(0, 300);
      throw new Error(`Model returned no image data. ${textBits}`);
    }
  } catch (err: any) {
    if (err instanceof PariImageAccessError) throw err;
    if (isImageAccessDenied(err)) {
      throw new PariImageAccessError(
        'Your API key cannot access image generation (it may need billing enabled on your Google Cloud project, or the image model may not be available for your key). Text chat and other features still work — image generation will unlock once your key has image access.'
      );
    }
    throw err;
  }

  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const filename = `pari-image-${Date.now().toString(36)}.${ext}`;
  const meta = saveUserFile(userId, filename, Buffer.from(imageBase64, 'base64'), mimeType, 'png');
  return { imageUrl: `/api/hoorvia/client/files/${meta.id}`, fileId: meta.id, filename };
}

export type StudioPlatform = 'instagram' | 'tiktok' | 'facebook';

const STUDIO_SYSTEM = `You write social-media copy. Output ONLY a JSON object {"caption": string, "hashtags": [string]} with no prose or fences.
Rules:
- caption: platform-appropriate, no cringe, no emoji spam.
- hashtags: plain words WITHOUT the # sign, lowercase where natural.`;

function studioPrompt(topic: string, platform: StudioPlatform): string {
  const t = JSON.stringify(topic);
  if (platform === 'instagram') {
    return `Write an Instagram post for this topic: ${t}. Caption: warm, 1-3 short paragraphs, ends with a soft question. Then 12-20 relevant hashtags.`;
  }
  if (platform === 'tiktok') {
    return `Write a TikTok caption for this topic: ${t}. Keep it punchy: hook line + 1 short line. Then 5-8 trending-style hashtags.`;
  }
  return `Write a Facebook post for this topic: ${t}. Friendly, 2-4 sentences, conversational. Then 3-6 hashtags.`;
}

export interface StudioPack {
  imageUrl: string;
  fileId: string;
  caption: string;
  hashtags: string[];
  platform: StudioPlatform;
}

/**
 * Phase 1 studio pack: image (user's key) + platform-aware caption/hashtags
 * (user's key). Nothing is posted anywhere — the user copies the pack.
 */
export async function buildStudioPack(
  userId: string,
  topic: string,
  platform: StudioPlatform
): Promise<StudioPack> {
  const cleanTopic = (topic || '').trim().slice(0, 500);
  if (!cleanTopic) throw new Error('Topic is required.');
  if (!['instagram', 'tiktok', 'facebook'].includes(platform)) {
    throw new Error('Platform must be instagram, tiktok, or facebook.');
  }

  const image = await generateImageForUser(
    userId,
    `Social media ${platform} post image about: ${cleanTopic}. Eye-catching, high quality, no text overlays, no watermark.`
  );

  const resolved = resolveModelKeyForUser(userId);
  if (!resolved) throw new Error('No API key on file.');
  const copyText = await generateTextWithUserKey(resolved.apiKey, resolved.model, studioPrompt(cleanTopic, platform), STUDIO_SYSTEM);
  const parsed = copyText ? extractJsonPayload(copyText) : null;
  const caption =
    typeof parsed?.caption === 'string' && parsed.caption.trim()
      ? parsed.caption.trim().slice(0, 2200)
      : cleanTopic;
  const hashtags = Array.isArray(parsed?.hashtags)
    ? parsed.hashtags
        .map((h: any) => String(h || '').replace(/^#+/, '').trim())
        .filter((h: string) => h.length > 0)
        .slice(0, 30)
    : [];

  return { imageUrl: image.imageUrl, fileId: image.fileId, caption, hashtags, platform };
}
