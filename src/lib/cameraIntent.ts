/**
 * Natural Language Camera & Vision Intent Evaluator
 * Detects Roman Urdu & English camera commands and vision requests.
 */

export type CameraIntentAction = 'ENABLE_CAMERA' | 'DISABLE_CAMERA' | 'VISION_REQUEST' | 'NONE';

export interface CameraIntentResult {
  action: CameraIntentAction;
  isVisionQuery: boolean;
  cleanPrompt?: string;
  reason: string;
}

export function evaluateCameraIntent(message: string, isCameraActive: boolean = false): CameraIntentResult {
  if (!message || typeof message !== 'string') {
    return { action: 'NONE', isVisionQuery: false, reason: 'Empty message' };
  }

  const lower = message.toLowerCase().trim();

  // Disable Camera patterns
  const disablePatterns = [
    'camera off karo',
    'camera off krdo',
    'camera band karo',
    'turn off camera',
    'disable camera',
    'close camera',
    'stop camera',
    'camera stop karo',
  ];

  if (disablePatterns.some((pattern) => lower.includes(pattern))) {
    return {
      action: 'DISABLE_CAMERA',
      isVisionQuery: false,
      reason: 'Explicit owner command to disable camera',
    };
  }

  // Vision Request patterns (wants Maryam to look, observe, or describe something)
  const visionPatterns = [
    'mujhe dekho',
    'ye dekho',
    'yeh dekho',
    'dekho maine',
    'dekho mera',
    'dekho meri',
    'kya pehna',
    'look at me',
    'see this',
    'what am i wearing',
    'how do i look',
    'kaise lag raha',
    'kaisa lag raha',
    'check this out',
    'look at this',
    'can you see me',
    'see me',
    'dekh sakti',
    'dekh sakte',
    'dikh raha',
    'dikh rahi',
    'kya dekh',
    'kya dikh',
    'what do you see',
    'can you see',
    'do you see',
    'mujhe dekh pa rahi',
    'dekh pa rahi',
    'mujhe dekh sakti',
    'haath',
    'hath',
    'hand',
    'holding',
    'pakda',
    'pakdi',
    'camera se',
    'dekh kar',
    'dekh ke',
    'dekho aur',
    'kya hai',
    'kya h',
    'kya cheez',
    'mobile',
    'phone',
    'chehra',
    'face',
  ];

  let isVision = visionPatterns.some((pattern) => lower.includes(pattern));

  // If camera is already active, any query with visual keywords or 'batao' / 'kya' / 'dekho' is a vision query
  if (!isVision && isCameraActive) {
    const contextualVisionKeywords = ['batao', 'dikh', 'kya', 'kaisa', 'kaisi', 'rang', 'color', 'look', 'show'];
    if (contextualVisionKeywords.some((kw) => lower.includes(kw))) {
      isVision = true;
    }
  }

  // Enable Camera patterns
  const enablePatterns = [
    'camera on karo',
    'camera on krdo',
    'camera chalao',
    'camera open karo',
    'camera start karo',
    'turn on camera',
    'enable camera',
    'open camera',
    'start camera',
    'camera kholo',
  ];

  const isEnable = enablePatterns.some((pattern) => lower.includes(pattern));

  if (isEnable) {
    return {
      action: 'ENABLE_CAMERA',
      isVisionQuery: isVision || true, // When owner says camera on, also capture current view
      reason: 'Explicit owner command to enable camera',
    };
  }

  if (isVision) {
    return {
      action: 'VISION_REQUEST',
      isVisionQuery: true,
      reason: 'Owner asked Maryam to look at him or an object',
    };
  }

  return { action: 'NONE', isVisionQuery: false, reason: 'No camera command detected' };
}
