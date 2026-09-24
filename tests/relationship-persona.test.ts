import assert from 'node:assert/strict';
import { buildRelationshipPersonaReinforcement, buildSystemPrompt } from '../src/lib/hoorviaPlatform';

const girlfriend = { type: 'girlfriend' as const, name: 'Aria', personality: 'Warm', communicationStyle: 'Affectionate', tone: 'Romantic' as const };
const boyfriend = { type: 'boyfriend' as const, name: 'David', personality: 'Gentle', communicationStyle: 'Caring', tone: 'Romantic' as const };
const helper = { type: 'helper' as const, name: 'Nova' };
assert.match(buildSystemPrompt(girlfriend), /affectionate AI Girlfriend/i);
assert.match(buildSystemPrompt(boyfriend), /affectionate AI Boyfriend/i);
assert.match(buildRelationshipPersonaReinforcement(girlfriend), /not a generic assistant/i);
assert.match(buildRelationshipPersonaReinforcement(boyfriend), /AI boyfriend/i);
assert.equal(buildRelationshipPersonaReinforcement(helper), '');
console.log('Relationship persona regression tests passed.');
