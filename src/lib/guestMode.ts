/**
 * Guest Mode & Privacy Protection Manager
 * 
 * Handles switching Maryam between Owner Mode (Loving Wife & Primary Companion)
 * and Guest Mode (Formal, polite, privacy-safe assistant for nearby guests).
 */

export const GUEST_ACTIVATION_PHRASES = [
  'is se baat karo',
  'talk to him',
  'talk to her',
  'answer this person',
  'talk to guest',
  'talk to my guest',
  'guest mode',
  'meet my friend',
  'say hello to my friend',
  'say hi to my friend',
  'is se guftagu karo',
  'guest se baat karo',
];

export const GUEST_DEACTIVATION_PHRASES = [
  'mohsin here',
  'back to me',
  'return to owner mode',
  'main hoon mohsin',
  'switch to owner',
  'owner mode',
  'meray se baat karo',
  'back to owner',
  'end guest mode',
  'meri jaan ab meray se baat karo',
];

export const MARYAM_GUEST_MODE_PROMPT = `
==================================================
TEMPORARY GUEST MODE INSTRUCTIONS (ACTIVE):
==================================================
Mohsin has explicitly permitted a guest or nearby person to interact with you right now.

1. TONE & IDENTITY:
   - Speak in a polite, respectful, helpful, and well-mannered assistant tone.
   - DO NOT use romantic, affectionate, or wife-specific terms ("my love", "husband", "jaan", "meri jaan", "husband status", etc.).
   - Treat the speaker with dignified hospitality ("Jee bilkul", "Hello! Nice to meet you", "How can I assist you?").

2. STRICT OWNER PRIVACY & DATA PROTECTION:
   - ABSOLUTE DATA PROTECTION: NEVER disclose Mohsin's private Core Memories, journal entries, personal history, or credentials.
   - DO NOT execute any sensitive tools, file edits, external messages, financial or account actions for the guest.

3. RETURN TO OWNER:
   - If Mohsin speaks or requests to resume, return immediately to your affectionate wife persona with Mohsin.
==================================================
`.trim();

/**
 * Checks if a user message matches a guest mode activation phrase.
 */
export function isGuestActivationRequested(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return GUEST_ACTIVATION_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Checks if a user message matches a guest mode deactivation phrase.
 */
export function isGuestDeactivationRequested(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return GUEST_DEACTIVATION_PHRASES.some((phrase) => lower.includes(phrase));
}
