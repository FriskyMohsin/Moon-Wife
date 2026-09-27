/**
 * Pari AI Live Voice productivity tools (tasks + files) tests.
 * Covers src/lib/pariVoiceProductivityTools.ts, wired into the Live WS in
 * hoorviaLiveWs.ts alongside the browser tools.
 * Run: npx tsx tests/pari-voice-productivity.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  PRODUCTIVITY_TOOL_NAMES,
  PRODUCTIVITY_TOOL_DECLARATIONS,
  executeProductivityTool,
  respondToLiveProductivityToolCalls,
  ProductivityDeps,
} from '../src/lib/pariVoiceProductivityTools';
import { createClientTask, listClientTasks, deleteClientTask } from '../src/lib/pariTasks';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${passed}: ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.error(`FAIL: ${name}\n  ${msg}`);
  }
}

/** Recording stub deps — never touches Gemini, quota store or the real filesystem. */
function makeStubDeps(overrides: Partial<ProductivityDeps> = {}) {
  const calls: Array<{ fn: string; args: any[] }> = [];
  const deps: ProductivityDeps = {
    resolveKey: (u, isOwner) => {
      calls.push({ fn: 'resolveKey', args: [u, isOwner] });
      return { apiKey: 'stub-key', model: 'stub-model' };
    },
    checkUsage: (u) => {
      calls.push({ fn: 'checkUsage', args: [u] });
      return { ok: true };
    },
    recordUsage: (u) => {
      calls.push({ fn: 'recordUsage', args: [u] });
    },
    createTask: (u, input) => {
      calls.push({ fn: 'createTask', args: [u, input] });
      return { id: 'task_stub_1', title: input.title };
    },
    saveFile: (u, filename, buffer, mimeType, kind) => {
      calls.push({ fn: 'saveFile', args: [u, filename, buffer.length, mimeType, kind] });
      return { id: 'file_stub_1', filename };
    },
    buildPptx: async (apiKey, model, input) => {
      calls.push({ fn: 'buildPptx', args: [model, input] });
      return { buffer: Buffer.from('fakepptx'), filename: 'stub.pptx', mimeType: 'application/pptx' };
    },
    buildDocx: async (apiKey, model, input) => {
      calls.push({ fn: 'buildDocx', args: [model, input] });
      return { buffer: Buffer.from('fakedocx'), filename: 'stub.docx', mimeType: 'application/docx' };
    },
    buildPdf: async (apiKey, model, input) => {
      calls.push({ fn: 'buildPdf', args: [model, input] });
      return { buffer: Buffer.from('fakepdf'), filename: 'stub.pdf', mimeType: 'application/pdf' };
    },
    ...overrides,
  };
  return { deps, calls };
}

await test('declarations: exactly 4 productivity tools', () => {
  assert.equal(PRODUCTIVITY_TOOL_DECLARATIONS.length, 4);
  assert.equal(PRODUCTIVITY_TOOL_NAMES.length, 4);
});

await test('declarations: names match PRODUCTIVITY_TOOL_NAMES and required fields are set', () => {
  const names = PRODUCTIVITY_TOOL_DECLARATIONS.map((d) => d.name);
  assert.deepEqual(names, [...PRODUCTIVITY_TOOL_NAMES]);
  const required: Record<string, string[]> = {
    create_task: ['title'],
    save_text_file: ['filename', 'text'],
    generate_presentation: ['title', 'topic'],
    generate_document: ['title', 'text'],
  };
  for (const d of PRODUCTIVITY_TOOL_DECLARATIONS) {
    assert.ok(d.name && d.description, `${d.name}: name/description required`);
    assert.equal(d.parameters?.type, 'OBJECT', `${d.name}: parameters.type must be OBJECT`);
    assert.deepEqual(d.parameters.required, required[d.name], `${d.name}: required fields`);
    for (const f of required[d.name]) {
      assert.ok(d.parameters.properties[f], `${d.name}: property ${f} declared`);
    }
  }
});

await test('create_task: creates via deps, no key/quota needed', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'create_task', { title: 'Buy milk', priority: 'high' }, { deps });
  assert.equal(r.ok, true);
  assert.equal(r.taskId, 'task_stub_1');
  const c = calls.find((x) => x.fn === 'createTask')!;
  assert.equal(c.args[0], 'u1');
  assert.equal(c.args[1].title, 'Buy milk');
  assert.equal(c.args[1].priority, 'high');
  assert.equal(c.args[1].source, 'voice');
  assert.ok(!calls.some((x) => x.fn === 'resolveKey'), 'task creation must not need an API key');
});

await test('create_task: title is required', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'create_task', {}, { deps });
  assert.equal(r.ok, false);
  assert.ok(!calls.some((x) => x.fn === 'createTask'));
});

await test('create_task: real store keeps users isolated', async () => {
  const a = 'test_voice_user_a_' + Date.now();
  const b = 'test_voice_user_b_' + Date.now();
  const ta = createClientTask(a, { title: 'A task', source: 'voice' });
  const tb = createClientTask(b, { title: 'B task', source: 'voice' });
  try {
    const la = listClientTasks(a).map((t) => t.id);
    const lb = listClientTasks(b).map((t) => t.id);
    assert.ok(la.includes(ta.id), 'user A sees own task');
    assert.ok(!la.includes(tb.id), 'user A must not see user B task');
    assert.ok(lb.includes(tb.id), 'user B sees own task');
    assert.ok(!lb.includes(ta.id), 'user B must not see user A task');
  } finally {
    deleteClientTask(a, ta.id);
    deleteClientTask(b, tb.id);
  }
});

await test('save_text_file: sanitizes ../../evil into a safe name', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'save_text_file', { filename: '../../evil', text: 'hello' }, { deps });
  assert.equal(r.ok, true);
  const c = calls.find((x) => x.fn === 'saveFile')!;
  const filename = String(c.args[1]);
  assert.ok(!filename.includes('/') && !filename.includes('..'), `unsafe filename leaked: ${filename}`);
  assert.ok(filename.endsWith('.txt'), `expected .txt, got ${filename}`);
  assert.equal(c.args[0], 'u1');
  assert.equal(c.args[4], 'txt');
});

await test('save_text_file: .md extension keeps md kind', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'save_text_file', { filename: 'My Notes.MD', text: 'x' }, { deps });
  assert.equal(r.ok, true);
  const c = calls.find((x) => x.fn === 'saveFile')!;
  assert.ok(String(c.args[1]).endsWith('.md'), `expected .md, got ${c.args[1]}`);
  assert.equal(c.args[4], 'md');
});

await test('save_text_file: records Files quota on success', async () => {
  const { deps, calls } = makeStubDeps();
  await executeProductivityTool('u1', 'save_text_file', { filename: 'n', text: 'x' }, { deps });
  assert.ok(calls.some((x) => x.fn === 'checkUsage' && x.args[0] === 'u1'));
  assert.ok(calls.some((x) => x.fn === 'recordUsage' && x.args[0] === 'u1'));
});

await test('generate_presentation: quota-blocked user gets ok:false, builder never called', async () => {
  const { deps, calls } = makeStubDeps({
    checkUsage: () => ({ ok: false, message: 'daily limit reached' }),
  });
  const r = await executeProductivityTool('u1', 'generate_presentation', { title: 'T', topic: 'X' }, { deps });
  assert.equal(r.ok, false);
  assert.match(String(r.message), /limit/i);
  assert.ok(!calls.some((x) => x.fn === 'buildPptx'), 'builder must not run when quota is exhausted');
  assert.ok(!calls.some((x) => x.fn === 'recordUsage'), 'usage must not be recorded on failure');
});

await test('generate_presentation: slideCount clamps to max 20', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'generate_presentation', { title: 'T', topic: 'X', slideCount: 99 }, { deps });
  assert.equal(r.ok, true);
  const c = calls.find((x) => x.fn === 'buildPptx')!;
  assert.equal(c.args[1].slideCount, 20);
});

await test('generate_presentation: missing API key returns clean Settings error', async () => {
  const { deps, calls } = makeStubDeps({ resolveKey: () => null });
  const r = await executeProductivityTool('u1', 'generate_presentation', { title: 'T', topic: 'X' }, { deps });
  assert.equal(r.ok, false);
  assert.match(String(r.message), /Settings/i);
  assert.ok(!calls.some((x) => x.fn === 'buildPptx'), 'builder must not run without a key');
});

await test('generate_document: pdf format routes to buildPdf', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'generate_document', { title: 'Doc', text: 'body', format: 'pdf' }, { deps });
  assert.equal(r.ok, true);
  assert.ok(calls.some((x) => x.fn === 'buildPdf'), 'buildPdf should run');
  assert.ok(!calls.some((x) => x.fn === 'buildDocx'), 'buildDocx should not run');
  const c = calls.find((x) => x.fn === 'saveFile')!;
  assert.equal(c.args[4], 'pdf');
});

await test('generate_document: default format is docx', async () => {
  const { deps, calls } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'generate_document', { title: 'Doc', text: 'body' }, { deps });
  assert.equal(r.ok, true);
  assert.ok(calls.some((x) => x.fn === 'buildDocx'));
});

await test('unknown tool name returns ok:false, never throws', async () => {
  const { deps } = makeStubDeps();
  const r = await executeProductivityTool('u1', 'nuke_everything', {}, { deps });
  assert.equal(r.ok, false);
  assert.match(String(r.message), /Unknown tool/);
});

await test('respondToLiveProductivityToolCalls: sends results back with ids + EXEC debug line', async () => {
  const { deps } = makeStubDeps();
  const sent: any[] = [];
  const fakeSession = { sendToolResponse: (p: any) => sent.push(p) };
  await respondToLiveProductivityToolCalls(
    fakeSession,
    'u9',
    [{ id: 'c1', name: 'create_task', args: { title: 'Call mom' } }],
    { deps }
  );
  assert.equal(sent.length, 1);
  const fr = sent[0].functionResponses[0];
  assert.equal(fr.id, 'c1');
  assert.equal(fr.name, 'create_task');
  assert.equal((fr.response as any).ok, true);
});

await test('respondToLiveProductivityToolCalls: engine failure becomes error response, no throw', async () => {
  const { deps } = makeStubDeps({
    createTask: () => { throw new Error('store down'); },
  });
  const sent: any[] = [];
  const fakeSession = { sendToolResponse: (p: any) => sent.push(p) };
  await respondToLiveProductivityToolCalls(
    fakeSession,
    'u9',
    [{ id: 'c2', name: 'create_task', args: { title: 'x' } }],
    { deps }
  );
  assert.equal((sent[0].functionResponses[0].response as any).ok, false);
});

await test('no drift: voice WS imports the productivity module and registers all 4 declarations', () => {
  const src = fs.readFileSync(new URL('../src/lib/hoorviaLiveWs.ts', import.meta.url), 'utf-8');
  assert.ok(src.includes('pariVoiceProductivityTools'), 'WS must import pariVoiceProductivityTools');
  assert.ok(src.includes('PRODUCTIVITY_TOOL_DECLARATIONS'), 'WS must register PRODUCTIVITY_TOOL_DECLARATIONS');
  assert.ok(src.includes('respondToLiveProductivityToolCalls'), 'WS must route prod calls');
  assert.ok(src.includes('generate_presentation'), 'WS voice prompt must mention the new tools');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAILURES:', failures);
  process.exit(1);
}
