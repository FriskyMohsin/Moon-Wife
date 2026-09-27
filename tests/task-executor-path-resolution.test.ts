/**
 * tests/task-executor-path-resolution.test.ts
 *
 * Regression coverage for the proven production defect:
 *   detectFileIntent()/detectFolderIntent() derived the Windows destination from
 *   the *server's* os.homedir(). In Azure (Linux) that produced /root/... which
 *   the Windows Runner security guard correctly blocked, so every filesystem task
 *   failed in production while working on Windows localhost.
 *
 * Rules locked in here:
 *  1. An explicit absolute Windows path is authoritative and preserved verbatim.
 *  2. It is never rewritten against os.homedir() and never gets mixed separators.
 *  3. With no explicit destination, a non-Windows host must fail closed with
 *     TARGET_PATH_REQUIRED rather than inventing a container path.
 *  4. A Windows host keeps its original home-derived behaviour (localhost).
 */

import assert from 'node:assert';
import { executeTaskInstructions, setTaskToolExecutor } from '../src/lib/taskExecutor';
import type { ScheduledTask } from '../src/types/taskManagement';

const OWNER_TASK: Partial<ScheduledTask> = {
  task_name: 'Create regression test file',
  owner_user_id: 'usr_mohsin_owner',
  approval_mode: 'automatic',
};

function setPlatform(value: string): void {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

function fileTask(instructions: string): ScheduledTask {
  return {
    task_id: 'task_test_path',
    task_name: OWNER_TASK.task_name!,
    instructions,
    owner_user_id: OWNER_TASK.owner_user_id!,
    status: 'QUEUED',
    approval_mode: OWNER_TASK.approval_mode as ScheduledTask['approval_mode'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as ScheduledTask;
}

const realPlatform = process.platform;

async function main(): Promise<void> {
  // Drive the executor directly so the dispatched path is observable.
  const dispatched: string[] = [];
  let lastWritten = '';
  const recordingExecutor = async (tool: string, params: any) => {
    if (tool === 'file.create') {
      dispatched.push(params.path);
      lastWritten = params.content;
      return { path: params.path, created: true };
    }
    if (tool === 'file.read') return { content: lastWritten };
    throw new Error(`unexpected tool ${tool}`);
  };

  // --- 1. Explicit Windows path survives on a LINUX host -------------------
  setPlatform('linux');
  const res1 = await executeTaskInstructions(
    fileTask('Create the file C:\\Users\\HP\\Downloads\\maryam-task-regression-test.txt with the exact content: Maryam production task execution works.'),
    recordingExecutor
  );
  assert.deepStrictEqual(dispatched, ['C:\\Users\\HP\\Downloads\\maryam-task-regression-test.txt']);
  assert.strictEqual(res1.success, true, res1.result_summary);
  assert.strictEqual(res1.output?.output_path, 'C:\\Users\\HP\\Downloads\\maryam-task-regression-test.txt');
  console.log('PASS  explicit Windows path preserved verbatim on linux host');

  // --- 2. Forward slashes in the instruction are normalised, not mixed -----
  dispatched.length = 0;
  await executeTaskInstructions(
    fileTask('Create the file C:/Users/HP/Downloads/slash-form.txt with the exact content: Maryam production task execution works.'),
    recordingExecutor
  );
  assert.deepStrictEqual(dispatched, ['C:\\Users\\HP\\Downloads\\slash-form.txt']);
  console.log('PASS  forward-slash instruction normalised to a pure Windows path');

  // --- 3. No explicit path on a LINUX host fails closed -------------------
  setPlatform('linux');
  dispatched.length = 0;
  const res3 = await executeTaskInstructions(fileTask('Create a text file report.txt in Downloads'), recordingExecutor);
  assert.strictEqual(res3.success, false);
  assert.strictEqual(res3.error, 'TARGET_PATH_REQUIRED');
  assert.deepStrictEqual(dispatched, [], 'nothing may be dispatched to the Runner');
  assert.strictEqual(res3.output?.output_path, null);
  assert.ok(!String(res3.result_summary).includes('/root'), 'must not invent a container path');
  console.log('PASS  non-windows host without explicit path -> TARGET_PATH_REQUIRED');

  // --- 4. Windows host keeps the original home-derived behaviour -----------
  setPlatform('win32');
  dispatched.length = 0;
  const res4 = await executeTaskInstructions(fileTask('Create a text file report.txt in Downloads'), recordingExecutor);
  assert.strictEqual(res4.success, true, res4.result_summary);
  assert.ok(
    /^C:\\Users\\HP\\Downloads\\report\.txt$/.test(dispatched[0]),
    `unexpected windows-home path: ${dispatched[0]}`
  );
  console.log('PASS  windows host still resolves homedir-relative destinations');

  // --- 5. Explicit folder path is preserved too ----------------------------
  setPlatform('linux');
  // Separate array: assert.deepStrictEqual narrows via `asserts actual is T`.
  const folderPaths: string[] = [];
  const folderExecutor = async (tool: string, params: any) => {
    if (tool === 'folder.create') {
      folderPaths.push(params.path);
      return { path: params.path, created: true };
    }
    if (tool === 'folder.list') return { entries: [] };
    throw new Error(`unexpected tool ${tool}`);
  };
  const res5 = await executeTaskInstructions(
    {
      task_id: 'task_test_folder',
      task_name: 'Create project folder',
      instructions: 'Create the folder C:\\Users\\HP\\Projects\\maryam-regression',
      owner_user_id: 'usr_mohsin_owner',
      status: 'QUEUED',
      approval_mode: 'automatic',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as ScheduledTask,
    folderExecutor
  );
  assert.deepStrictEqual(folderPaths, ['C:\\Users\\HP\\Projects\\maryam-regression']);
  assert.ok(!String(res5.output?.output_path || '').includes('/root'));
  console.log('PASS  explicit Windows folder path preserved verbatim on linux host');

  Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true });
  console.log('\nALL TASK PATH RESOLUTION TESTS PASSED');
}

main().catch((err) => {
  Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true });
  console.error('TASK PATH TEST FAILED: ' + (err?.message || err));
  process.exit(1);
});
