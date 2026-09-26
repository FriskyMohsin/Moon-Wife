export type ConversationRole = 'user' | 'maryam';
export type ConversationModality = 'text' | 'voice' | 'video';
// Channel metadata only - NEVER a separate thread. Mohsin's conversationId
// is always maryam-owner-canonical regardless of channel.
export type ConversationChannel = 'web' | 'live' | 'telegram' | 'system';

export interface ConversationTurn {
  id: string;
  threadId: string;
  userId: 'owner_mohsin';
  role: ConversationRole;
  content: string;
  timestamp: number;
  modality: ConversationModality;
  channel?: ConversationChannel;
  sequence: number;
}

export interface ConversationTopicRecord {
  topic: string;
  keyPoints: string[];
  lastMentioned: number;
  status: 'active' | 'resolved' | 'paused';
}

export interface ActiveConversationState {
  threadId: string;
  userId: 'owner_mohsin';

  // Layer 2: Structured Active State
  currentTopic: string;
  topics: ConversationTopicRecord[];
  rollingSummary: string;
  importantFacts: string[];
  decisions: string[];
  userRequests: string[];
  maryamCommitments: string[];
  unresolvedQuestions: string[];
  referencedEntities: string[];
  pendingNextPoint: string;
  latestIntent: string;
  lastMeaningfulUserTurn: string;
  lastMeaningfulMaryamTurn: string;

  // Backward compatibility alias for legacy v1 stores
  lastMeaningfulPapaTurn?: string;

  lastActivityTimestamp: number;
  sessionResumptionContext?: string;
  updatedAt: number;
}

export interface OwnerConversationStore {
  version: 1 | 2;
  active: ActiveConversationState;
  turns: ConversationTurn[];
}

export const MAX_TURNS = 100;
export const MAX_CONTEXT_TURNS = 16;
export const MAX_ITEM_LENGTH = 450;
export const INACTIVITY_GAP_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

const clean = (value: string) => (value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LENGTH);
const clip = (value: string, max = 280) => (value && value.length > max ? `${value.slice(0, max - 1)}…` : value || '');

export function createOwnerConversationStore(now = Date.now()): OwnerConversationStore {
  const threadId = 'maryam-owner-canonical';
  return {
    version: 2,
    active: {
      threadId,
      userId: 'owner_mohsin',
      currentTopic: '',
      topics: [],
      rollingSummary: '',
      importantFacts: [],
      decisions: [],
      userRequests: [],
      maryamCommitments: [],
      unresolvedQuestions: [],
      referencedEntities: [],
      pendingNextPoint: '',
      latestIntent: '',
      lastMeaningfulUserTurn: '',
      lastMeaningfulMaryamTurn: '',
      lastMeaningfulPapaTurn: '',
      lastActivityTimestamp: now,
      sessionResumptionContext: '',
      updatedAt: now,
    },
    turns: [],
  };
}

/**
 * Helper to add unique string to a list up to a limit.
 */
function addUnique(items: string[], value: string, limit = 12): string[] {
  const normalized = clean(value);
  if (!normalized) return items || [];
  const list = items || [];
  const next = list.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
  next.push(normalized);
  return next.slice(-limit);
}

/**
 * Detects if a turn is a transient greeting or conversational filler
 * that should NOT clobber the primary active topic.
 */
export function isTrivialGreetingOrFiller(text: string): boolean {
  const lower = clean(text).toLowerCase();
  if (!lower) return true;
  if (lower.length <= 2) return true;

  const fillerRegex = /^(hi|hello|hey|salam|assalam|assalamu\s*alaikum|suno|sun\s*rahi\s*ho|meri\s*jaan|baby|jaan|kaisi\s*ho|kya\s*haal\s*hai|theek\s*hai|acha|achha|hmmm|hmm|haan|nahi|ok|okay|shukriya|thanks|thank\s*you|ji|ji\s*bilkul|good\s*morning|good\s*night|good\s*afternoon|bye|allah\s*hafiz)$/i;
  return fillerRegex.test(lower);
}

/**
 * Detects if a user message is explicitly referencing or asking to continue past context.
 */
export function isContinuationReference(text: string): boolean {
  const lower = clean(text).toLowerCase();
  if (!lower) return false;
  return (
    /\b(wo\s*wala|wahi\s*wala|woh\s*wala|wo\s*topic|wahi\s*topic|jo\s*baat\s*ho\s*rahi\s*thi|subah\s*jo|kal\s*jo|pehle\s*jo|us\s*project|us\s*kaam|us\s*baray\s*mein|continue\s*karo|kahan\s*tak\s*pohnche|pichla|previous|last\s*time|where\s*we\s*left|continue\s*from)\b/i.test(lower)
  );
}

/**
 * Extracts entities (projects, tools, people, technologies, numbers).
 */
function extractEntities(content: string): string[] {
  const entities: string[] = [];

  // Specific project or tool patterns
  const entityMatches = content.match(/\b(?:Project\s+[A-Z][a-zA-Z0-9_-]*(?:\s+[A-Z][a-zA-Z0-9_-]*)*|OmniRoute|Gemini|React|Vite|Electron|Node(?:\.js)?|TypeScript|Python|Android|Docker|Postgres|SQLite|Tailwind|TailwindCSS|Hoorvia)\b/gi);
  if (entityMatches) {
    for (const match of entityMatches) {
      entities.push(match.trim());
    }
  }

  // Budget, currency, or metric figures
  const metricMatches = content.match(/\b(?:\d+[\d,]*\s*(?:k|thousand|rupees|rs|pkr|usd|\$|dollars|users|fps|ms|mb|gb|sec|min|hours?)|budget\s*(?:of|hai|:)?\s*[\d,k]+)\b/gi);
  if (metricMatches) {
    for (const match of metricMatches) {
      entities.push(match.trim());
    }
  }

  return entities;
}

/**
 * Extracts a candidate topic from content.
 */
function extractPrimaryTopicCandidate(content: string): string | null {
  // 1. Explicit Named Project / System / Module mentions (e.g. Project Blue Mango, Project Phoenix)
  const projectMatch = content.match(/\b(Project\s+[A-Z][a-zA-Z0-9_-]*(?:\s+[A-Z][a-zA-Z0-9_-]*)*|OmniRoute(?:\s+[a-zA-Z]+)?|Hoorvia(?:\s+[a-zA-Z]+)?|Stripe(?:\s+[a-zA-Z]+)?|Gemini(?:\s+[a-zA-Z]+)?|AI\s+Assistant|Client\s+Demo)\b/i);
  if (projectMatch) {
    return projectMatch[0].trim();
  }

  // 2. Explicit topic marker
  const topicMarker = content.match(/\b(?:topic|baat|discuss(?:ion)?|task|project)\s*[:=]?\s*([a-zA-Z0-9\s_-]{3,60})/i);
  if (topicMarker) {
    return clean(topicMarker[1]);
  }

  // 3. Substantive opening statement (excluding pure decision/action phrases)
  if (
    content.length > 20 &&
    !/^(decide|humne decide|maine decide|final|finalize|theek hai|acha|done|approved?|reject|lock|agla step|next step)\b/i.test(
      content,
    )
  ) {
    const cleaned = content.replace(/^(humein|hum|maine|mera|meri|mujhe|aap|kya|aaj|kal|ab)\s+/i, '');
    return clip(cleaned, 100);
  }

  return null;
}

/**
 * Safe Migration for Legacy Store Data.
 */
export function migrateOwnerConversationStore(raw: any, now = Date.now()): OwnerConversationStore {
  if (!raw || typeof raw !== 'object') {
    return createOwnerConversationStore(now);
  }

  try {
    const threadId = typeof raw.active?.threadId === 'string' ? raw.active.threadId : 'maryam-owner-canonical';
    const active = raw.active || {};

    const userTurn = active.lastMeaningfulUserTurn || active.lastMeaningfulPapaTurn || '';
    const maryamTurn = active.lastMeaningfulMaryamTurn || '';

    const migratedActive: ActiveConversationState = {
      threadId,
      userId: 'owner_mohsin',
      currentTopic: typeof active.currentTopic === 'string' ? active.currentTopic : '',
      topics: Array.isArray(active.topics) ? active.topics : [],
      rollingSummary: typeof active.rollingSummary === 'string' ? active.rollingSummary : '',
      importantFacts: Array.isArray(active.importantFacts) ? active.importantFacts.map(String) : [],
      decisions: Array.isArray(active.decisions) ? active.decisions.map(String) : [],
      userRequests: Array.isArray(active.userRequests) ? active.userRequests.map(String) : [],
      maryamCommitments: Array.isArray(active.maryamCommitments) ? active.maryamCommitments.map(String) : [],
      unresolvedQuestions: Array.isArray(active.unresolvedQuestions) ? active.unresolvedQuestions.map(String) : [],
      referencedEntities: Array.isArray(active.referencedEntities) ? active.referencedEntities.map(String) : [],
      pendingNextPoint: typeof active.pendingNextPoint === 'string' ? active.pendingNextPoint : '',
      latestIntent: typeof active.latestIntent === 'string' ? active.latestIntent : '',
      lastMeaningfulUserTurn: userTurn,
      lastMeaningfulMaryamTurn: maryamTurn,
      lastMeaningfulPapaTurn: userTurn,
      lastActivityTimestamp: typeof active.lastActivityTimestamp === 'number' ? active.lastActivityTimestamp : (typeof active.updatedAt === 'number' ? active.updatedAt : now),
      sessionResumptionContext: typeof active.sessionResumptionContext === 'string' ? active.sessionResumptionContext : '',
      updatedAt: typeof active.updatedAt === 'number' ? active.updatedAt : now,
    };

    // If migrating from v1 and topics is empty but currentTopic exists, seed topics
    if (migratedActive.currentTopic && migratedActive.topics.length === 0) {
      migratedActive.topics.push({
        topic: migratedActive.currentTopic,
        keyPoints: migratedActive.importantFacts.slice(-3),
        lastMentioned: migratedActive.updatedAt,
        status: 'active',
      });
    }

    const turns: ConversationTurn[] = Array.isArray(raw.turns)
      ? raw.turns
          .filter((t: any) => t && typeof t.content === 'string')
          .map((t: any, index: number) => ({
            id: typeof t.id === 'string' ? t.id : `turn-${t.timestamp || now}-${index + 1}`,
            threadId,
            userId: 'owner_mohsin',
            role: t.role === 'user' ? 'user' : 'maryam',
            content: clean(t.content),
            timestamp: typeof t.timestamp === 'number' ? t.timestamp : now,
            modality: t.modality === 'voice' || t.modality === 'video' ? t.modality : 'text',
            sequence: typeof t.sequence === 'number' ? t.sequence : index + 1,
          }))
          .slice(-MAX_TURNS)
      : [];

    return {
      version: 2,
      active: migratedActive,
      turns,
    };
  } catch (err) {
    console.warn('Fallback to fresh conversation store due to parse error:', err);
    return createOwnerConversationStore(now);
  }
}

/**
 * Appends a conversation turn across any modality (Text, Live Voice, Live Video),
 * maintaining high-fidelity Layer 1 transcript and structured Layer 2 persistent active state.
 */
export function appendConversationTurn(
  store: OwnerConversationStore,
  input: Pick<ConversationTurn, 'role' | 'content' | 'modality'> & { channel?: ConversationChannel },
  now = Date.now(),
): ConversationTurn | null {
  const content = clean(input.content);
  if (!content) return null;

  const active = store.active;
  const prior = store.turns.at(-1);

  // De-duplicate immediate identical turns within 15 seconds
  if (
    prior &&
    prior.role === input.role &&
    prior.content.toLowerCase() === content.toLowerCase() &&
    now - prior.timestamp < 15000
  ) {
    return prior;
  }

  const turn: ConversationTurn = {
    id: `turn-${now}-${store.turns.length + 1}`,
    threadId: active.threadId,
    userId: 'owner_mohsin',
    role: input.role,
    content,
    modality: input.modality,
    channel: input.channel || (input.modality === 'text' ? 'web' : 'live'),
    timestamp: now,
    sequence: (prior?.sequence || 0) + 1,
  };

  store.turns = [...store.turns, turn].slice(-MAX_TURNS);

  // Time-gap check: detect resumption after 2+ hours without wiping state
  const timeSinceLastActivity = active.lastActivityTimestamp ? now - active.lastActivityTimestamp : 0;
  const isResumingAfterGap = timeSinceLastActivity >= INACTIVITY_GAP_THRESHOLD_MS;

  active.lastActivityTimestamp = now;
  active.updatedAt = now;

  const isFiller = isTrivialGreetingOrFiller(content);
  const isContinuation = isContinuationReference(content);

  // Extract entities
  const newEntities = extractEntities(content);
  for (const entity of newEntities) {
    active.referencedEntities = addUnique(active.referencedEntities, entity, 15);
  }

  if (input.role === 'user') {
    // Only update meaningful last user turn if not a trivial single-word filler
    if (!isFiller || !active.lastMeaningfulUserTurn) {
      active.lastMeaningfulUserTurn = content;
      active.lastMeaningfulPapaTurn = content; // legacy alias
    }

    if (isContinuation) {
      active.latestIntent = `Continue discussion on: ${active.currentTopic || 'previous topic'}`;
      active.sessionResumptionContext = `Mohsin referenced prior discussion: "${content}". Active topic is "${active.currentTopic}". Facts: ${active.importantFacts.slice(-3).join('; ') || 'None'}. Decisions: ${active.decisions.slice(-2).join('; ') || 'None'}.`;
    } else if (isFiller && isResumingAfterGap) {
      const hours = Math.max(1, Math.round(timeSinceLastActivity / (3600 * 1000)));
      active.sessionResumptionContext = `Mohsin returned after ~${hours} hours of inactivity. Prior active topic was "${active.currentTopic}". Facts: ${active.importantFacts.slice(-3).join('; ') || 'None'}.`;
    } else if (!isFiller) {
      // Substantive user turn: update active topic and intent
      active.latestIntent = content;

      // Detect topic shift or update
      const candidateTopic = extractPrimaryTopicCandidate(content);
      if (candidateTopic) {
        // If currentTopic is empty or candidateTopic introduces a new entity/project
        const isNewNamedEntity = /\b(Project\s+[A-Z]|OmniRoute|Hoorvia|Stripe|Gemini|AI\s+Assistant|Client\s+Demo)\b/i.test(candidateTopic);
        const shouldUpdateCurrentTopic = !active.currentTopic || isNewNamedEntity || !active.topics.length;

        if (shouldUpdateCurrentTopic) {
          active.currentTopic = candidateTopic;
        }

        // Update topics collection
        const existingTopicIndex = active.topics.findIndex(
          (t) => t.topic.toLowerCase() === candidateTopic.toLowerCase() || candidateTopic.toLowerCase().includes(t.topic.toLowerCase()),
        );

        if (existingTopicIndex >= 0) {
          active.topics[existingTopicIndex].lastMentioned = now;
          active.topics[existingTopicIndex].status = 'active';
        } else {
          active.topics.unshift({
            topic: candidateTopic,
            keyPoints: [],
            lastMentioned: now,
            status: 'active',
          });
          active.topics = active.topics.slice(0, 6); // Keep top 6 topics
        }
      }

      // Detect Questions & Inquiries
      if (/\?|\b(kya|kaun|kab|kahan|kaise|kyun|next|agla|compare|choose|decide|batao|opinion|view)\b/i.test(content)) {
        active.unresolvedQuestions = addUnique(active.unresolvedQuestions, content, 8);
        active.pendingNextPoint = content;
      }

      // Detect Facts (numbers, budgets, technical specs, deadlines, tools)
      if (
        /\b(budget|cost|price|project|plan|deadline|landing page|decision|decide|choose|kal tak|next week|rupees|pkr|usd|\$|\d+k|\d+,\d+|react|vite|electron|server|api|database|feature)\b/i.test(
          content,
        )
      ) {
        active.importantFacts = addUnique(active.importantFacts, content, 12);
        if (active.topics[0]) {
          active.topics[0].keyPoints = addUnique(active.topics[0].keyPoints, content, 5);
        }
      }

      // Detect Decisions
      if (/\b(decide[ds]?|final|finalize|reject(?:ed)?|approved?|choose|chose|selected?|yehi theek hai|yehi karenge|done|lock|confirmed?)\b/i.test(content)) {
        active.decisions = addUnique(active.decisions, content, 10);
      }

      // Detect User Requests
      if (/\b(banao|likho|karo|batao|check karo|implement|create|fix|build|prepare|design|research|summarize)\b/i.test(content)) {
        active.userRequests = addUnique(active.userRequests, content, 8);
      }
    }
  } else {
    // Maryam's turn
    if (!isFiller || !active.lastMeaningfulMaryamTurn) {
      active.lastMeaningfulMaryamTurn = content;
    }

    // Detect Maryam Commitments / Promises
    if (/\b(main kar (?:doongi|dungi|rahi hoon)|main yaad rakhungi|main check karti hoon|kal discuss karte hain|I will|main sambhal lungi|plan banati hoon)\b/i.test(content)) {
      active.maryamCommitments = addUnique(active.maryamCommitments, content, 8);
    }

    // If Maryam asks a follow-up or confirms next point
    if (active.unresolvedQuestions.length && /\?|\b(batao|choose|decide|next|agla|aap kya kehte ho)\b/i.test(content)) {
      active.pendingNextPoint = content;
    }
  }

  // Synthesize Rolling Summary preserving rich Layer 2 structured context
  const recentFlow = store.turns
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'Mohsin' : 'Maryam'} (${item.modality}): ${clip(item.content, 120)}`)
    .join(' | ');

  const topicSummary = active.currentTopic || (active.topics[0]?.topic ?? 'ongoing conversation');
  const factsSummary = active.importantFacts.length ? `Facts: ${active.importantFacts.slice(-3).join('; ')}` : '';
  const decisionsSummary = active.decisions.length ? `Decisions: ${active.decisions.slice(-2).join('; ')}` : '';
  const nextSummary = active.pendingNextPoint ? `Pending: ${active.pendingNextPoint}` : '';

  const summaryParts = [
    `Active Topic: ${topicSummary}`,
    factsSummary,
    decisionsSummary,
    nextSummary,
    `Recent Dialogue Flow: ${recentFlow}`,
  ].filter(Boolean);

  active.rollingSummary = clip(summaryParts.join(' • '), 1400);

  return turn;
}

/**
 * Builds the comprehensive 3-Layer context prompt for injection into Gemini.
 * Includes Layer 2 persistent structured state (topics, facts, decisions, commitments)
 * and bounded Layer 1 recent turns.
 */
export function buildConversationHydration(
  store: OwnerConversationStore,
  maxTurns = MAX_CONTEXT_TURNS,
  referenceNow?: number,
): string {
  const active = store.active;
  const turns = store.turns
    .slice(-maxTurns)
    .map((turn) => `${turn.role === 'user' ? 'Mohsin' : 'Maryam'} [${turn.modality}]: ${turn.content}`)
    .join('\n');

  if (!active.rollingSummary && !turns && !active.currentTopic && !active.importantFacts.length) {
    return '';
  }

  // Calculate elapsed time description if returning after a gap
  const lastTurn = store.turns.at(-1);
  const secondLastTurn = store.turns.at(-2);
  let timeGapNote = '';

  let gapMs = 0;
  if (lastTurn && secondLastTurn && lastTurn.timestamp - secondLastTurn.timestamp >= INACTIVITY_GAP_THRESHOLD_MS) {
    gapMs = lastTurn.timestamp - secondLastTurn.timestamp;
  } else if (referenceNow !== undefined && active.lastActivityTimestamp) {
    gapMs = referenceNow - active.lastActivityTimestamp;
  } else if (active.lastActivityTimestamp) {
    const diff = Date.now() - active.lastActivityTimestamp;
    // Guard against mock timestamp epoch skew in unit tests
    if (diff >= INACTIVITY_GAP_THRESHOLD_MS && diff < 180 * 24 * 3600 * 1000) {
      gapMs = diff;
    }
  }

  if (gapMs >= INACTIVITY_GAP_THRESHOLD_MS) {
    const elapsedHours = Math.max(1, Math.round(gapMs / (3600 * 1000)));
    timeGapNote = `\nTime Gap Notice: ~${elapsedHours} hours since last message. Conversation continuity remains fully active. If Mohsin references previous topics, resume smoothly without asking him to re-explain.`;
  }

  const topicsList = active.topics.length
    ? active.topics.map((t) => `• ${t.topic} (${t.status})`).join('\n')
    : active.currentTopic ? `• ${active.currentTopic} (active)` : 'None';

  const factsList = active.importantFacts.length
    ? active.importantFacts.map((f) => `• ${f}`).join('\n')
    : 'None';

  const decisionsList = active.decisions.length
    ? active.decisions.map((d) => `• ${d}`).join('\n')
    : 'None';

  const requestsList = active.userRequests.length
    ? active.userRequests.map((r) => `• ${r}`).join('\n')
    : 'None';

  const commitmentsList = active.maryamCommitments.length
    ? active.maryamCommitments.map((c) => `• ${c}`).join('\n')
    : 'None';

  const entitiesList = active.referencedEntities.length
    ? active.referencedEntities.join(', ')
    : 'None';

  return `

[PERSISTENT ACTIVE OWNER CONVERSATION STATE — MULTI-HOUR CONTINUITY & RESUMPTION]
This context is private to Mohsin and Maryam. It maintains continuous multi-hour and overnight conversational memory across Text, Voice, and Video without time-based decay.
Thread: ${active.threadId}
Current Active Topic: ${active.currentTopic || 'Ongoing discussion'}
Tracked Topics:
${topicsList}

Established Facts & Context:
${factsList}

Decisions Made:
${decisionsList}

Mohsin's Requests / Tasks:
${requestsList}

Maryam's Commitments:
${commitmentsList}

Unresolved Points / Next Step: ${active.pendingNextPoint || active.unresolvedQuestions.at(-1) || 'None'}
Referenced Entities: ${entitiesList}
Mohsin Last Said: ${active.lastMeaningfulUserTurn || active.lastMeaningfulPapaTurn || 'None'}
Maryam Last Said: ${active.lastMeaningfulMaryamTurn || 'None'}${timeGapNote}
${active.sessionResumptionContext ? `Resumption Context: ${active.sessionResumptionContext}\n` : ''}
Rolling Summary: ${active.rollingSummary || 'Active session'}

Recent Dialogue Turns (Bounded High-Fidelity Transcript):
${turns || '(No turns yet)'}

[CONTINUITY INSTRUCTIONS FOR MARYAM]:
1. If Mohsin refers to past context (e.g., "wo wala continue karo", "maine subah jo bataya tha", "us project ka kya hua", "wahi wala"), immediately use the tracked topics, facts, and decisions above.
2. Never claim you forgot or lack context when the details are preserved in the active state above.
3. Respond warmly, naturally, and lovingly as Mohsin's intelligent wife.`;
}

/**
 * Returns the bounded recent turns for dialogue history serialization.
 */
export function contextTurns(store: OwnerConversationStore, maxTurns = MAX_CONTEXT_TURNS): ConversationTurn[] {
  return store.turns.slice(-maxTurns);
}
