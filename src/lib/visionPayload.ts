export const VISION_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function normalizeVisionImageMimeType(mimeType: unknown): (typeof VISION_IMAGE_MIME_TYPES)[number] {
  return VISION_IMAGE_MIME_TYPES.includes(mimeType as (typeof VISION_IMAGE_MIME_TYPES)[number])
    ? mimeType as (typeof VISION_IMAGE_MIME_TYPES)[number]
    : 'image/jpeg';
}
