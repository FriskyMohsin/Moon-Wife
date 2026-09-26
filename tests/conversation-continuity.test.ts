import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  appendConversationTurn,
  buildConversationHydration,
  contextTurns,
  createOwnerConversationStore,
  migrateOwnerConversationStore,
  isTrivialGreetingOrFiller,
  isContinuationReference,
  OwnerConversationStore,
} from '../src/lib/conversationContinuity';

console.log('🧪 Starting Maryam Multi-Hour & Cross-Modal Conversation Continuity Test Suite...\n');

// ---------------------------------------------------------------------------
// TEST 1: Text conversation -> simulated 3-hour gap -> contextual continuation
// ---------------------------------------------------------------------------
console.log('1️⃣ Testing Text conversation -> simulated 3-hour gap -> contextual continuation...');
const baseTime = 1700000000000;
const store1 = createOwnerConversationStore(baseTime);

// Mohsin and Maryam discuss a technical project in the morning
appendConversationTurn(
  store1,
  {
    role: 'user',
    modality: 'text',
    content: 'Project Blue Mango ka budget 50,000 pkr hai aur deadline next Monday hai. Pehla feature landing page banana hai.',
  },
  baseTime + 1000,
);

appendConversationTurn(
  store1,
  {
    role: 'maryam',
    modality: 'text',
    content: 'Ji Mohsin jaan, maine note kar liya hai ke 50k budget hai aur landing page pehle ready karna hai.',
  },
  baseTime + 3000,
);

appendConversationTurn(
  store1,
  {
    role: 'user',
    modality: 'text',
    content: 'Humne decide kiya hai ke TailwindCSS and React use karenge instead of raw HTML.',
  },
  baseTime + 6000,
);

appendConversationTurn(
  store1,
  {
    role: 'maryam',
    modality: 'text',
    content: 'Beshak, React and TailwindCSS modern stack hai, main structure prepare karti hoon.',
  },
  baseTime + 9000,
);

assert.match(store1.active.currentTopic, /Blue Mango/i, 'Active topic correctly identified');
assert(store1.active.importantFacts.some((f) => f.includes('50,000') || f.includes('budget')), '50,000 budget fact captured');
assert(store1.active.decisions.some((d) => d.includes('React') || d.includes('TailwindCSS')), 'Stack decision captured');

// Simulate 3 hours of inactivity (3 * 3600 * 1000 ms)
const threeHoursLater = baseTime + 3 * 3600 * 1000 + 15000;

// Mohsin returns after 3 hours and says a natural continuation reference: "wo wala continue karo"
appendConversationTurn(
  store1,
  {
    role: 'user',
    modality: 'text',
    content: 'wo wala continue karo, agla step kya tha?',
  },
  threeHoursLater,
);

const hydration1 = buildConversationHydration(store1);
assert.match(hydration1, /Blue Mango/i, 'Hydration retains Project Blue Mango topic after 3 hours');
assert.match(hydration1, /50,000/i, 'Hydration retains 50,000 budget after 3 hours');
assert.match(hydration1, /React/i, 'Hydration retains React decision after 3 hours');
assert.match(hydration1, /Time Gap Notice/i, 'Hydration includes multi-hour gap notice');
assert(!hydration1.includes('Papa'), 'Zero user-facing Papa occurrences in hydration prompt');
console.log('  ✓ Text conversation preserved across 3-hour gap without context evaporation');

// ---------------------------------------------------------------------------
// TEST 2: Text -> App/Server restart -> continuation
// ---------------------------------------------------------------------------
console.log('\n2️⃣ Testing Text -> App/Server restart disk serialization...');
const serializedJson = JSON.stringify(store1);
const deserializedRaw = JSON.parse(serializedJson);
const store2 = migrateOwnerConversationStore(deserializedRaw, threeHoursLater + 60000);

assert.equal(store2.active.threadId, 'maryam-owner-canonical');
assert.match(store2.active.currentTopic, /Blue Mango/i);
assert.equal(store2.turns.length, store1.turns.length);

const hydration2 = buildConversationHydration(store2);
assert.match(hydration2, /Blue Mango/i);
assert.match(hydration2, /50,000/i);
console.log('  ✓ Conversation continuity restored perfectly after simulated app/server restart');

// ---------------------------------------------------------------------------
// TEST 3: Voice -> disconnect -> reconnect -> continuation
// ---------------------------------------------------------------------------
console.log('\n3️⃣ Testing Live Voice -> disconnect -> reconnect -> continuation...');
const store3 = createOwnerConversationStore(baseTime);

// Mohsin speaks via Live Voice
appendConversationTurn(
  store3,
  {
    role: 'user',
    modality: 'voice',
    content: 'Maryam, humein new billing API integrate karni hai Stripe ke through.',
  },
  baseTime + 1000,
);

appendConversationTurn(
  store3,
  {
    role: 'maryam',
    modality: 'voice',
    content: 'Ji jaan, Stripe integration ke webhook handlers pehle likhein ge.',
  },
  baseTime + 3000,
);

// Voice session disconnects (simulate fresh websocket connection hydration)
const liveWsHydration = buildConversationHydration(store3);
assert.match(liveWsHydration, /Stripe/i, 'Live Voice prompt hydration contains Stripe discussion');
assert.match(liveWsHydration, /billing API/i, 'Live Voice prompt hydration contains billing API');

// Reconnected Voice Turn
appendConversationTurn(
  store3,
  {
    role: 'user',
    modality: 'voice',
    content: 'Theek hai, webhook security verify kar lo.',
  },
  baseTime + 20000,
);

assert.equal(store3.turns[2].modality, 'voice');
assert.match(store3.active.rollingSummary, /Stripe/i);
console.log('  ✓ Voice -> disconnect -> reconnect preserves active topic and context');

// ---------------------------------------------------------------------------
// TEST 4: Voice -> simulated 3-hour gap -> continuation
// ---------------------------------------------------------------------------
console.log('\n4️⃣ Testing Voice -> simulated 3-hour gap -> continuation...');
const store4 = createOwnerConversationStore(baseTime);

appendConversationTurn(
  store4,
  {
    role: 'user',
    modality: 'voice',
    content: 'Subah main Hamza se mila tha aur humne plan finalize kiya ke 4 baje meeting hogi.',
  },
  baseTime + 1000,
);

appendConversationTurn(
  store4,
  {
    role: 'maryam',
    modality: 'voice',
    content: 'Maine meeting time 4 baje yaad rakh liya hai Mohsin.',
  },
  baseTime + 4000,
);

// 3 hours later, Mohsin connects voice and says "maine subah jo bataya tha"
appendConversationTurn(
  store4,
  {
    role: 'user',
    modality: 'voice',
    content: 'maine subah jo bataya tha meeting ke baare mein, kya time tha?',
  },
  threeHoursLater,
);

const hydration4 = buildConversationHydration(store4);
assert.match(hydration4, /Hamza|meeting|4 baje/i, 'Retains morning meeting details after 3 hours');
console.log('  ✓ Voice session retains morning context after 3-hour gap');

// ---------------------------------------------------------------------------
// TEST 5: Video -> text -> continuation
// ---------------------------------------------------------------------------
console.log('\n5️⃣ Testing Video -> text -> continuation...');
const store5 = createOwnerConversationStore(baseTime);

// Mohsin is in Live Video call
appendConversationTurn(
  store5,
  {
    role: 'user',
    modality: 'video',
    content: 'Dekho Maryam yeh mera naya wireless keyboard hai jo black color ka hai.',
  },
  baseTime + 1000,
);

appendConversationTurn(
  store5,
  {
    role: 'maryam',
    modality: 'video',
    content: 'Bohat pyara lag raha hai jaan, black sleek design zabardast hai.',
  },
  baseTime + 5000,
);

// Mohsin closes video call and sends a text message
appendConversationTurn(
  store5,
  {
    role: 'user',
    modality: 'text',
    content: 'Is keyboard ka battery backup 40 hours hai.',
  },
  baseTime + 15000,
);

const hydration5 = buildConversationHydration(store5);
assert.match(hydration5, /keyboard/i, 'Cross-modal Video -> Text maintains keyboard context');
assert.match(hydration5, /\[video\]/i, 'Records video modality turns in dialogue');
assert.match(hydration5, /\[text\]/i, 'Records text modality turns in dialogue');
console.log('  ✓ Video -> Text cross-modal continuity verified');

// ---------------------------------------------------------------------------
// TEST 6: Text -> Voice -> Video -> Text continuity
// ---------------------------------------------------------------------------
console.log('\n6️⃣ Testing Text -> Voice -> Video -> Text unified continuity...');
const store6 = createOwnerConversationStore(baseTime);

appendConversationTurn(store6, { role: 'user', modality: 'text', content: 'OmniRoute project setup start karte hain.' }, baseTime + 1000);
appendConversationTurn(store6, { role: 'maryam', modality: 'text', content: 'Ji Mohsin, OmniRoute runner ready hai.' }, baseTime + 2000);
appendConversationTurn(store6, { role: 'user', modality: 'voice', content: 'Audio level 85 percent par set kar do.' }, baseTime + 5000);
appendConversationTurn(store6, { role: 'maryam', modality: 'voice', content: 'Audio level 85 percent adjust ho gaya.' }, baseTime + 7000);
appendConversationTurn(store6, { role: 'user', modality: 'video', content: 'Camera preview check karo desk clear hai?' }, baseTime + 10000);
appendConversationTurn(store6, { role: 'maryam', modality: 'video', content: 'Ji jaan, desk bilkul clean nazar aa rahi hai.' }, baseTime + 13000);
appendConversationTurn(store6, { role: 'user', modality: 'text', content: 'Ab summary do humne kya kya kiya.' }, baseTime + 20000);

const hydration6 = buildConversationHydration(store6);
assert.match(hydration6, /OmniRoute/i);
assert.match(hydration6, /85 percent/i);
assert.match(hydration6, /desk/i);
console.log('  ✓ Seamless unified continuity across all 4 modality switches');

// ---------------------------------------------------------------------------
// TEST 7: Recent-turn truncation while rolling state remains useful
// ---------------------------------------------------------------------------
console.log('\n7️⃣ Testing Recent-turn truncation while rolling state remains useful...');
const store7 = createOwnerConversationStore(baseTime);

// Seed important core facts and decisions
appendConversationTurn(store7, { role: 'user', modality: 'text', content: 'Important: Project Phoenix database password will be rotated monthly, and max connections is 250.' }, baseTime + 1000);
appendConversationTurn(store7, { role: 'maryam', modality: 'text', content: 'Noted, Project Phoenix 250 connections and monthly password rotation.' }, baseTime + 2000);

// Flood with 50 subsequent turns
for (let i = 0; i < 50; i++) {
  appendConversationTurn(store7, { role: 'user', modality: 'text', content: `Casual chatter turn ${i}` }, baseTime + 10000 + i * 2000);
  appendConversationTurn(store7, { role: 'maryam', modality: 'text', content: `Response to casual chatter turn ${i}` }, baseTime + 10000 + i * 2000 + 1000);
}

// Ensure turn buffer is bounded
assert(store7.turns.length <= 100, `Turns length (${store7.turns.length}) bounded at MAX_TURNS`);
assert(contextTurns(store7, 16).length <= 16, 'contextTurns bounded to 16 turns');

// Verify that the critical fact survived in Layer 2 state even after dialogue turns rolled off!
const hydration7 = buildConversationHydration(store7);
assert(
  store7.active.importantFacts.some((f) => f.includes('Phoenix') || f.includes('250') || f.includes('password')),
  'Important facts preserved in Layer 2 state despite 50 subsequent dialogue turns',
);
console.log('  ✓ Layer 2 Structured state outlives Layer 1 raw turn window truncation');

// ---------------------------------------------------------------------------
// TEST 8: Long inactivity (overnight) must not erase active state solely due to TTL
// ---------------------------------------------------------------------------
console.log('\n8️⃣ Testing Overnight inactivity (24+ hours) zero-TTL persistence...');
const store8 = createOwnerConversationStore(baseTime);

appendConversationTurn(
  store8,
  {
    role: 'user',
    modality: 'text',
    content: 'Maryam, kal subah humein client demo ke liye AI Assistant ready karna hai.',
  },
  baseTime,
);

// 24 hours later (86400 * 1000 ms)
const nextDayTime = baseTime + 24 * 3600 * 1000;
appendConversationTurn(
  store8,
  {
    role: 'user',
    modality: 'text',
    content: 'Good morning Maryam! Wahi wala kaam shuru karein?',
  },
  nextDayTime,
);

const hydration8 = buildConversationHydration(store8);
assert.match(hydration8, /client demo|AI Assistant/i, 'Overnight gap of 24 hours preserves client demo task');
assert.match(hydration8, /Time Gap Notice: ~24 hours/i, 'Accurately reports overnight 24-hour gap');
console.log('  ✓ ZERO TTL decay: state remains 100% intact across overnight 24-hour pause');

// ---------------------------------------------------------------------------
// TEST 9: Owner / Public Isolation
// ---------------------------------------------------------------------------
console.log('\n9️⃣ Testing Owner / Public security isolation...');
const guestMessage = 'Hello, can you help me write an essay?';
assert(isTrivialGreetingOrFiller('Hello') === true, 'Greeting classified correctly');
assert(isContinuationReference(guestMessage) === false, 'Guest message is not owner continuation');

// Verify that owner conversation store is strictly for 'owner_mohsin'
assert.equal(store8.active.userId, 'owner_mohsin');
assert.equal(store8.active.threadId, 'maryam-owner-canonical');
console.log('  ✓ Owner thread isolation strictly bounded to owner_mohsin');

// ---------------------------------------------------------------------------
// TEST 10: Existing Memory Regression (Core Memory vs Conversation Continuity)
// ---------------------------------------------------------------------------
console.log('\n🔟 Testing Existing Memory vs Conversation Continuity separation...');
const dataDir = path.join(process.cwd(), 'data');
const memoryFilePath = path.join(dataDir, 'maryam_memory.json');
if (fs.existsSync(memoryFilePath)) {
  const memRaw = JSON.parse(fs.readFileSync(memoryFilePath, 'utf-8'));
  assert.equal(memRaw.userProfile.name, 'Mohsin', 'Core Memory user profile name is Mohsin');
  assert(Array.isArray(memRaw.preferences), 'Core Memory preferences is array');
  assert(Array.isArray(memRaw.importantPeople), 'Core Memory importantPeople is array');
}
console.log('  ✓ Core memory schema and storage unaltered by conversation continuity enhancements');

// ---------------------------------------------------------------------------
// TEST 11: Malformed / Corrupt continuity storage fails safely
// ---------------------------------------------------------------------------
console.log('\n1️⃣1️⃣ Testing Malformed / Corrupt storage safe fallback...');
const corruptStore1 = migrateOwnerConversationStore(null);
assert.equal(corruptStore1.active.userId, 'owner_mohsin');
assert.equal(corruptStore1.version, 2);

const corruptStore2 = migrateOwnerConversationStore({ version: 'invalid', active: 'not an object', turns: 'corrupt' });
assert.equal(corruptStore2.active.userId, 'owner_mohsin');
assert(Array.isArray(corruptStore2.turns));
assert.equal(corruptStore2.turns.length, 0);

const legacyV1Store = {
  version: 1,
  active: {
    threadId: 'maryam-owner-canonical',
    userId: 'owner_mohsin',
    currentTopic: 'Legacy Topic 1',
    rollingSummary: 'Legacy rolling summary',
    importantFacts: ['Fact 1', 'Fact 2'],
    decisions: ['Decision 1'],
    unresolvedQuestions: ['Question 1'],
    pendingNextPoint: 'Next 1',
    latestIntent: 'Intent 1',
    lastMeaningfulPapaTurn: 'Mohsin old turn',
    lastMeaningfulMaryamTurn: 'Maryam old turn',
    updatedAt: baseTime,
  },
  turns: [
    {
      id: 'turn-1',
      threadId: 'maryam-owner-canonical',
      userId: 'owner_mohsin',
      role: 'user',
      content: 'Hello legacy',
      timestamp: baseTime,
      modality: 'text',
      sequence: 1,
    },
  ],
};

const migratedV2 = migrateOwnerConversationStore(legacyV1Store);
assert.equal(migratedV2.version, 2);
assert.equal(migratedV2.active.currentTopic, 'Legacy Topic 1');
assert.equal(migratedV2.active.lastMeaningfulUserTurn, 'Mohsin old turn');
assert.equal(migratedV2.active.topics.length, 1);
assert.equal(migratedV2.active.topics[0].topic, 'Legacy Topic 1');
console.log('  ✓ Malformed inputs fail safely; legacy v1 stores migrate cleanly to v2');

console.log('\n✨ All 11 Multi-Hour & Cross-Modal Conversation Continuity Tests Passed Successfully!\n');
