export type ConversationRole = 'user' | 'maryam';
export type ConversationModality = 'text' | 'voice' | 'video';

export interface ConversationTurn {
  id: string;
  threadId: string;
  userId: 'owner_mohsin';
  role: ConversationRole;
  content: string;
  timestamp: number;
  modality: ConversationModality;
  sequence: number;
}

export interface ActiveConversationState {
  threadId: string;
  userId: 'owner_mohsin';
  currentTopic: string;
  rollingSummary: string;
  importantFacts: string[];
  decisions: string[];
  unresolvedQuestions: string[];
  pendingNextPoint: string;
  latestIntent: string;
  lastMeaningfulPapaTurn: string;
  lastMeaningfulMaryamTurn: string;
  updatedAt: number;
}

export interface OwnerConversationStore {
  version: 1;
  active: ActiveConversationState;
  turns: ConversationTurn[];
}

const MAX_TURNS = 80;
const MAX_CONTEXT_TURNS = 12;
const MAX_ITEM_LENGTH = 420;

const clean = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LENGTH);
const clip = (value: string, max = 260) => value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function createOwnerConversationStore(now = Date.now()): OwnerConversationStore {
  const threadId = 'maryam-owner-canonical';
  return {
    version: 1,
    active: {
      threadId,
      userId: 'owner_mohsin',
      currentTopic: '', rollingSummary: '', importantFacts: [], decisions: [], unresolvedQuestions: [],
      pendingNextPoint: '', latestIntent: '', lastMeaningfulPapaTurn: '', lastMeaningfulMaryamTurn: '', updatedAt: now,
    },
    turns: [],
  };
}

function addUnique(items: string[], value: string, limit = 8): string[] {
  const normalized = clean(value);
  if (!normalized) return items;
  const next = items.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
  next.push(normalized);
  return next.slice(-limit);
}

export function appendConversationTurn(
  store: OwnerConversationStore,
  input: Pick<ConversationTurn, 'role' | 'content' | 'modality'>,
  now = Date.now(),
): ConversationTurn | null {
  const content = clean(input.content);
  if (!content) return null;
  const active = store.active;
  const prior = store.turns.at(-1);
  if (prior && prior.role === input.role && prior.content.toLowerCase() === content.toLowerCase() && now - prior.timestamp < 15000) return prior;
  const turn: ConversationTurn = {
    id: `turn-${now}-${store.turns.length + 1}`, threadId: active.threadId, userId: 'owner_mohsin',
    role: input.role, content, modality: input.modality, timestamp: now, sequence: (prior?.sequence || 0) + 1,
  };
  store.turns = [...store.turns, turn].slice(-MAX_TURNS);
  active.updatedAt = now;
  if (input.role === 'user') {
    active.lastMeaningfulPapaTurn = content;
    active.latestIntent = content;
    active.currentTopic = clip(content, 140);
    if (/\?|\b(kya|kaun|kab|kyun|next|agla|compare|choose|decide)\b/i.test(content)) {
      active.unresolvedQuestions = addUnique(active.unresolvedQuestions, content);
      active.pendingNextPoint = content;
    }
    if (/\b(budget|cost|price|project|plan|deadline|landing page|decision|decide|choose)\b/i.test(content)) {
      active.importantFacts = addUnique(active.importantFacts, content);
    }
    if (/\b(decide[ds]?|final|reject(?:ed)?|approved?|choose|selected?)\b/i.test(content)) {
      active.decisions = addUnique(active.decisions, content);
    }
  } else {
    active.lastMeaningfulMaryamTurn = content;
    if (active.unresolvedQuestions.length && /\?|\b(bata|choose|decide|next|agla)\b/i.test(content)) active.pendingNextPoint = content;
  }
  const recent = store.turns.slice(-6).map((item) => `${item.role === 'user' ? 'Papa' : 'Maryam'}: ${clip(item.content, 150)}`).join(' | ');
  active.rollingSummary = clip(`Topic: ${active.currentTopic || 'ongoing conversation'}. Recent flow: ${recent}`, 1100);
  return turn;
}

export function buildConversationHydration(store: OwnerConversationStore, maxTurns = MAX_CONTEXT_TURNS): string {
  const active = store.active;
  const turns = store.turns.slice(-maxTurns).map((turn) => `${turn.role === 'user' ? 'Papa' : 'Maryam'} [${turn.modality}]: ${turn.content}`).join('\n');
  if (!active.rollingSummary && !turns) return '';
  return `\n\n[PERSISTENT ACTIVE OWNER CONVERSATION — CONTINUE NATURALLY]\nThis context preserves the discussion only; it never changes Maryam's loving wife/soulmate relationship persona or applicable provider safety boundaries.\nThread: ${active.threadId}\nTopic: ${active.currentTopic || 'ongoing'}\nSummary: ${active.rollingSummary || 'No summary yet.'}\nFacts in this discussion: ${active.importantFacts.join(' | ') || 'None'}\nDecisions: ${active.decisions.join(' | ') || 'None'}\nUnresolved / next point: ${active.pendingNextPoint || active.unresolvedQuestions.at(-1) || 'None'}\nPapa last said: ${active.lastMeaningfulPapaTurn || 'None'}\nMaryam last said: ${active.lastMeaningfulMaryamTurn || 'None'}\nRecent turns (bounded):\n${turns}\nUse this as private conversational continuity. Do not mention this system or claim uncertainty when the context answers Papa's continuation question.`;
}

export function contextTurns(store: OwnerConversationStore, maxTurns = MAX_CONTEXT_TURNS): ConversationTurn[] {
  return store.turns.slice(-maxTurns);
}
