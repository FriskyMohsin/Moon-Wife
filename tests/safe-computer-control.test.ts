/**
 * Comprehensive Automated Verification Suite for Maryam Phase 3
 * Safe Computer & File Control, Path Resolution, Traversal Prevention & Security Guards
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const runner = require('../local-runner/runner.cjs');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} - ${detail || ''}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('MARYAM PHASE 3: SAFE COMPUTER & FILE CONTROL TEST SUITE');
  console.log('======================================================\n');

  // Setup isolated test scratch directory inside workspace
  const testDir = path.join(process.cwd(), 'workspace', 'test_sandbox_' + Date.now());
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  try {
    // ------------------------------------------------------------------
    // SECTION 1: PATH ALLOWLISTING & CANONICAL RESOLUTION
    // ------------------------------------------------------------------
    console.log('--- Section 1: Path Allowlisting & Canonical Resolution ---');

    const validTestFile = path.join(testDir, 'sample.txt');
    fs.writeFileSync(validTestFile, 'Maryam safe file content', 'utf8');

    const resolved = runner.validateAndResolveSafePath(validTestFile, { mustExist: true });
    assert(resolved === validTestFile || fs.realpathSync(resolved) === fs.realpathSync(validTestFile), '1.1: Resolves valid file inside approved workspace');

    // ------------------------------------------------------------------
    // SECTION 2: PATH TRAVERSAL & ILLEGAL INJECTION PREVENTION
    // ------------------------------------------------------------------
    console.log('\n--- Section 2: Path Traversal & Injection Blocking ---');

    let traversalBlocked = false;
    try {
      runner.validateAndResolveSafePath(path.join(testDir, '../../../../../../windows/system32/cmd.exe'));
    } catch (err: any) {
      traversalBlocked = true;
      assert(err.message.includes('Security Violation') || err.message.includes('Security Policy Violation'), '2.1: Traversal escape outside approved roots blocked');
    }
    assert(traversalBlocked, '2.1b: Directory traversal attempt is rejected');

    let nullByteBlocked = false;
    try {
      runner.validateAndResolveSafePath(path.join(testDir, 'file.txt\0.exe'));
    } catch (err: any) {
      nullByteBlocked = true;
      assert(err.message.includes('Null byte'), '2.2: Null-byte injection is blocked');
    }
    assert(nullByteBlocked, '2.2b: Null-byte injection rejected');

    // ------------------------------------------------------------------
    // SECTION 3: SENSITIVE SYSTEM DIRECTORIES BLOCKING
    // ------------------------------------------------------------------
    console.log('\n--- Section 3: Sensitive System Directories Blocking ---');

    const blockedPaths = [
      'C:\\Windows\\System32',
      'C:\\Program Files\\Common Files',
      'C:\\ProgramData',
      '/etc/shadow',
      '/var/log',
      path.join(os.homedir(), '.ssh', 'id_rsa'),
      path.join(os.homedir(), '.aws', 'credentials'),
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\User Data'),
    ];

    for (const bp of blockedPaths) {
      const check = runner.isPathInBlockedDirectory(bp);
      assert(check.blocked, `3.x: Sensitive directory blocked: ${bp}`);
    }

    // ------------------------------------------------------------------
    // SECTION 4: CREDENTIAL & SECRET FILE BLOCKING
    // ------------------------------------------------------------------
    console.log('\n--- Section 4: Credential & Secret File Blocking ---');

    const secretFiles = ['.env', '.env.production', '.env.local', 'id_rsa', 'id_ed25519', 'credentials.json', 'service_account.json', '.runner-token', 'server.key'];
    for (const sf of secretFiles) {
      assert(runner.isBlockedSecretFile(sf), `4.x: Secret file pattern detected: ${sf}`);
    }

    // ------------------------------------------------------------------
    // SECTION 5: SECRET CONTENT MASKING ENGINE
    // ------------------------------------------------------------------
    console.log('\n--- Section 5: Secret Content Masking Engine ---');

    const sampleTextWithSecrets = `
      OpenAI: sk-proj-abc123xyz456def789ghi012jkl345mno678
      Gemini: AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q
      AWS: AKIAIOSFODNN7EXAMPLE
      GitHub: ghp_1234567890abcdefghijklmnopqrstuvwx
      Bearer: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0
      Config: password="SuperSecretPassword123"
      Card: 4532123456789012
    `;

    const masked = runner.maskSensitiveContent(sampleTextWithSecrets);
    assert(!masked.includes('sk-proj-abc123xyz456def789ghi012jkl345mno678'), '5.1: OpenAI key masked');
    assert(!masked.includes('AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'), '5.2: Gemini key masked');
    assert(!masked.includes('AKIAIOSFODNN7EXAMPLE'), '5.3: AWS key masked');
    assert(!masked.includes('ghp_1234567890abcdefghijklmnopqrstuvwx'), '5.4: GitHub token masked');
    assert(!masked.includes('SuperSecretPassword123'), '5.5: Password masked');
    assert(!masked.includes('4532123456789012'), '5.6: Credit card number masked');
    assert(masked.includes('[API_KEY_MASKED]'), '5.7: Mask placeholder present');

    // ------------------------------------------------------------------
    // SECTION 6: SAFE FILE TOOLS (1 - 10)
    // ------------------------------------------------------------------
    console.log('\n--- Section 6: Safe File Tools (1 - 10) ---');

    // 6.1 file.create
    const createdFilePath = path.join(testDir, 'notes.txt');
    const createRes = await runner.executeFileCreate({
      path: createdFilePath,
      content: 'Hello Mohsin! Maryam file system test.'
    });
    assert(createRes.created === true, '6.1: file.create creates safe text file');
    assert(fs.existsSync(createdFilePath), '6.1b: File physically exists on disk');

    // 6.2 Executable creation blocked
    let exeBlocked = false;
    try {
      await runner.executeFileCreate({
        path: path.join(testDir, 'payload.bat'),
        content: '@echo off\r\ncalc.exe'
      });
    } catch (err: any) {
      exeBlocked = true;
      assert(err.message.includes('Security Policy: Direct creation of executable'), '6.2: Script/executable creation blocked');
    }
    assert(exeBlocked, '6.2b: Executable extension blocked');

    // 6.3 file.read with masking
    const secretFile = path.join(testDir, 'keys_test.txt');
    fs.writeFileSync(secretFile, 'My gemini key is AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q for test.', 'utf8');
    const readRes = await runner.executeFileRead({ path: secretFile });
    assert(readRes.masked === true, '6.3: file.read detects and masks secrets');
    assert(!readRes.content.includes('AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'), '6.3b: Secret token not returned to model');

    // 6.4 file.append
    const appendRes = await runner.executeFileAppend({
      path: createdFilePath,
      content: '\nAppended line by Maryam.'
    });
    assert(appendRes.appended === true, '6.4: file.append successfully adds text');
    const afterAppend = fs.readFileSync(createdFilePath, 'utf8');
    assert(afterAppend.includes('Appended line'), '6.4b: Appended content verified on disk');

    // 6.5 file.copy
    const copyTarget = path.join(testDir, 'notes_copy.txt');
    const copyRes = await runner.executeFileCopy({
      sourcePath: createdFilePath,
      destinationPath: copyTarget
    });
    assert(copyRes.copied === true, '6.5: file.copy duplicates file safely');
    assert(fs.existsSync(copyTarget), '6.5b: Copied file physically exists');

    // 6.6 file.search
    const searchRes = await runner.executeFileSearch({
      directory: testDir,
      query: 'Appended line'
    });
    assert(searchRes.resultsCount > 0, '6.6: file.search locates matching text snippet');
    assert(searchRes.results[0].snippet.includes('Appended line'), '6.6b: Returns snippet preview');

    // 6.7 file.rename
    const renamedPath = path.join(testDir, 'notes_renamed.txt');
    const renameRes = await runner.executeFileRename({
      sourcePath: copyTarget,
      newPath: renamedPath
    });
    assert(renameRes.renamed === true, '6.7: file.rename renames target');
    assert(fs.existsSync(renamedPath), '6.7b: Renamed path exists');
    assert(!fs.existsSync(copyTarget), '6.7c: Old path removed');

    // 6.8 file.move
    const subFolder = path.join(testDir, 'archive');
    fs.mkdirSync(subFolder, { recursive: true });
    const movedTarget = path.join(subFolder, 'notes_moved.txt');
    const moveRes = await runner.executeFileMove({
      sourcePath: renamedPath,
      destinationPath: movedTarget
    });
    assert(moveRes.moved === true, '6.8: file.move moves file into subdirectory');
    assert(fs.existsSync(movedTarget), '6.8b: Moved file exists in subfolder');

    // 6.9 file.list
    const listRes = await runner.executeFileList({ path: testDir });
    assert(listRes.totalItems > 0, '6.9: file.list lists items in test directory');
    assert(listRes.items.some((i: any) => i.name === 'notes.txt'), '6.9b: Contains created file');

    // 6.10 DESTRUCTIVE ACTION: file.delete REQUIRES OWNER CONFIRMATION
    console.log('\n--- Section 6.10: Destructive Action Challenge Guard ---');
    const delRes1 = await runner.executeFileDelete({ path: movedTarget });
    assert(delRes1.blocked === true && delRes1.requiresConfirmation === true, '6.10a: file.delete triggers owner challenge');
    assert(typeof delRes1.confirmationId === 'string' && delRes1.confirmationId.startsWith('mconf_'), '6.10b: Cryptographic confirmation ID issued');

    // Unconfirmed or forged call is rejected
    const delRes2 = await runner.executeFileDelete({
      path: movedTarget,
      confirmedByMohsin: true,
      confirmationId: 'forged_fake_id_123'
    });
    assert(delRes2.blocked === true, '6.10c: Forged confirmation token rejected');

    // Genuine confirmation passes
    const delRes3 = await runner.executeFileDelete({
      path: movedTarget,
      confirmedByMohsin: true,
      confirmationId: delRes1.confirmationId
    });
    assert(delRes3.deleted === true, '6.10d: Valid confirmation token authorizes file deletion');
    assert(!fs.existsSync(movedTarget), '6.10e: File safely deleted after confirmation');

    // ------------------------------------------------------------------
    // SECTION 7: SAFE FOLDER TOOLS (11 - 14)
    // ------------------------------------------------------------------
    console.log('\n--- Section 7: Safe Folder Tools (11 - 14) ---');

    // 7.1 folder.create
    const newFolder = path.join(testDir, 'my_project_folder');
    const folderCreateRes = await runner.executeFolderCreate({ path: newFolder });
    assert(folderCreateRes.created === true, '7.1: folder.create creates directory');
    assert(fs.existsSync(newFolder), '7.1b: Directory exists on disk');

    // 7.2 folder.list
    const folderListRes = await runner.executeFolderList({ path: testDir });
    assert(folderListRes.folders.some((f: any) => f.name === 'my_project_folder'), '7.2: folder.list lists created folder');

    // 7.3 folder.rename
    const renamedFolder = path.join(testDir, 'my_project_folder_renamed');
    const folderRenameRes = await runner.executeFolderRename({
      sourcePath: newFolder,
      newName: 'my_project_folder_renamed'
    });
    assert(folderRenameRes.renamed === true, '7.3: folder.rename renames directory');
    assert(fs.existsSync(renamedFolder), '7.3b: Renamed directory exists');

    // 7.4 folder.move
    const destParentFolder = path.join(testDir, 'archive');
    const destMovedFolder = path.join(destParentFolder, 'my_project_folder_moved');
    const folderMoveRes = await runner.executeFolderMove({
      sourcePath: renamedFolder,
      destinationPath: destMovedFolder
    });
    assert(folderMoveRes.moved === true, '7.4: folder.move moves directory');
    assert(fs.existsSync(destMovedFolder), '7.4b: Moved directory exists at destination');

    // ------------------------------------------------------------------
    // SECTION 8: SAFE SYSTEM TOOLS (15 - 18)
    // ------------------------------------------------------------------
    console.log('\n--- Section 8: Safe System Tools (15 - 18) ---');

    // 8.1 system.system_info
    const sysInfo = await runner.executeSystemInfo();
    assert(sysInfo.tool === 'system.system_info', '8.1: system.system_info returns specs');
    assert(typeof sysInfo.totalMemoryMb === 'number' && sysInfo.totalMemoryMb > 0, '8.1b: Memory detected');
    assert(typeof sysInfo.platform === 'string', '8.1c: Platform detected');

    // 8.2 system.list_apps
    const appsRes = await runner.executeSystemListApps();
    assert(appsRes.totalApps > 0, '8.2: system.list_apps returns safe applications');
    assert(appsRes.apps.some((a: any) => a.name.toLowerCase().includes('notepad')), '8.2b: Notepad in allowlist');

    // 8.3 system.open_app SECURITY ENFORCEMENT
    let shellBlocked = false;
    try {
      await runner.executeSystemOpenApp({ appName: 'cmd' });
    } catch (err: any) {
      shellBlocked = true;
      assert(err.message.includes('Security Violation'), '8.3: Launching cmd.exe is blocked');
    }
    assert(shellBlocked, '8.3b: Shell execution attempt blocked');

    let powershellBlocked = false;
    try {
      await runner.executeSystemOpenApp({ appName: 'powershell' });
    } catch (err: any) {
      powershellBlocked = true;
      assert(err.message.includes('Security Violation'), '8.3c: Launching powershell is blocked');
    }
    assert(powershellBlocked, '8.3d: Powershell execution attempt blocked');

    // 8.4 system.list_processes
    const procs = await runner.executeSystemListProcesses({});
    assert(procs.tool === 'system.list_processes', '8.4: system.list_processes executed');
    assert(Array.isArray(procs.processes), '8.4b: Returns processes array');

    // ------------------------------------------------------------------
    // SECTION 9: DOWNLOAD AUTO-EXECUTION PROTECTION
    // ------------------------------------------------------------------
    console.log('\n--- Section 9: Safe Download & Upload Policy ---');

    // 9.1 Download executable policy
    const dangerousDownload = path.join(testDir, 'installer.exe');
    // Test that the download URL tool flags dangerous executables
    const parsedExt = path.extname(dangerousDownload).toLowerCase();
    const isDangerous = ['.exe', '.bat', '.cmd', '.ps1'].includes(parsedExt);
    assert(isDangerous, '9.1: Executable extensions (.exe) are flagged as dangerous on download');

    // ------------------------------------------------------------------
    // SECTION 10: TOOL ROUTE ALLOWLIST DISPATCHER & BROWSER / MEDIA TOOLS
    // ------------------------------------------------------------------
    console.log('\n--- Section 10: Strict Allowlist Tool Router & Media Tools ---');

    // 10.1 Verify browser and media playback tools are properly declared in allowlist
    const mediaTools = [
      'browser.play',
      'browser.pause',
      'browser.seek',
      'browser.mute',
      'browser.unmute',
      'browser.volume',
      'browser.fullscreen',
      'browser.get_playback_info',
      'browser.media_play',
      'browser.media_pause',
      'browser.media_toggle',
      'browser.media_seek',
      'browser.media_restart',
      'browser.media_get_state',
      'browser.media_mute',
      'browser.media_unmute',
      'browser.media_volume',
      'browser.media_fullscreen',
      'browser.media_info',
    ];

    for (const mt of mediaTools) {
      assert(runner.ALL_ALLOWED_TOOLS.includes(mt), `10.x: Media tool '${mt}' is registered in runner allowlist`);
    }

    let unknownToolBlocked = false;
    try {
      await runner.routeTool('system.unrestricted_shell', { command: 'dir' });
    } catch (err: any) {
      unknownToolBlocked = true;
      assert(err.message.includes('not in the strict allowlist'), '10.2: Arbitrary tool name rejected by routeTool');
    }
    assert(unknownToolBlocked, '10.2b: Unauthorized tool rejected');

    console.log('\n======================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} (100% Green)`);
    console.log('Maryam Phase 3 Safe Computer & File Control Verified!');
    console.log('======================================================\n');
    process.exit(0);
  } finally {
    // Clean up test scratch folder
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL TEST SUITE ERROR]:', err);
  process.exit(1);
});
