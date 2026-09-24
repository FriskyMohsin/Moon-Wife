import assert from 'node:assert/strict';
import { appendConversationTurn, buildConversationHydration, contextTurns, createOwnerConversationStore } from '../src/lib/conversationContinuity';

const store = createOwnerConversationStore(1);
appendConversationTurn(store, { role: 'user', modality: 'text', content: 'Project Blue Mango ka budget 47,000 hai aur pehla kaam landing page banana hai.' }, 2);
appendConversationTurn(store, { role: 'maryam', modality: 'text', content: 'Theek hai, Blue Mango ke landing page scope ko next decide karte hain.' }, 3);
appendConversationTurn(store, { role: 'user', modality: 'voice', content: 'Next humein pricing compare karni hai, kya monthly ya annual?' }, 4);
assert.equal(store.active.threadId, 'maryam-owner-canonical');
assert.equal(store.turns[2].modality, 'voice');
assert.match(store.active.rollingSummary, /Blue Mango/);
assert.match(store.active.pendingNextPoint, /pricing/i);
assert.match(buildConversationHydration(store), /47,000/);
assert.equal(contextTurns(store, 2).length, 2);
for (let i = 0; i < 100; i++) appendConversationTurn(store, { role: 'maryam', modality: 'video', content: `bounded turn ${i}` }, 10 + i);
assert.equal(store.turns.length, 80);
assert.doesNotMatch(JSON.stringify(store), /base64|audio\/pcm|image\/jpeg/i);
console.log('Conversation continuity regression tests passed.');
