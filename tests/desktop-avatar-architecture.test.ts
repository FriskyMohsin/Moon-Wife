import { LipSyncEngine, globalLipSyncEngine } from '../src/avatar/LipSyncEngine';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runDesktopAvatarTests() {
  console.log('🧪 Starting Maryam V15.1 Desktop & Avatar Architecture Test Suite...\n');

  // Test 1: LipSyncEngine Amplitude Mapping & EMA Smoothing
  console.log('1️⃣ Testing LipSyncEngine...');
  const engine = new LipSyncEngine({
    attackAlpha: 0.7,
    decayAlpha: 0.2,
    silenceThreshold: 0.02,
    gain: 2.0,
  });

  // Test silence when not speaking
  const silenceState = engine.processAudioLevel(0.01, false);
  assert(silenceState.mouthOpen === 0, 'Mouth remains closed when silence threshold or not speaking');
  assert(silenceState.isSpeaking === false, 'isSpeaking reflects parameter accurately');

  // Test speech audio input processing
  const speechState1 = engine.processAudioLevel(0.5, true);
  assert(speechState1.isSpeaking === true, 'isSpeaking is true during speech');
  assert(speechState1.mouthOpen > 0, 'Mouth opens in response to incoming audio amplitude');
  assert(speechState1.smoothedAmplitude > 0, 'Smoothed amplitude is calculated');

  // Test fast attack and subsequent decay
  const speechState2 = engine.processAudioLevel(0.8, true);
  assert(speechState2.mouthOpen >= speechState1.mouthOpen, 'Higher amplitude increases mouth opening');

  // Test decay when speech returns to silence
  const decayedState = engine.processAudioLevel(0.0, true);
  assert(decayedState.mouthOpen < speechState2.mouthOpen, 'Mouth open decays smoothly on audio drops');

  // Test reset
  engine.reset();
  const resetState = engine.getState(false);
  assert(resetState.mouthOpen === 0, 'Reset returns mouth to 0.0 resting position');

  // Test 2: Avatar Component Architecture & Exports
  console.log('\n2️⃣ Testing Avatar Stage Subsystem Modules...');
  const avatarTypesPath = path.join(process.cwd(), 'src/avatar/types.ts');
  assert(fs.existsSync(avatarTypesPath), 'src/avatar/types.ts exists');
  const avatarTypesContent = fs.readFileSync(avatarTypesPath, 'utf8');
  assert(avatarTypesContent.includes('AvatarState'), 'AvatarState type exported');
  assert(avatarTypesContent.includes('LipSyncState'), 'LipSyncState type exported');
  assert(avatarTypesContent.includes('IAvatarAdapter'), 'IAvatarAdapter interface exported');

  const avatarStagePath = path.join(process.cwd(), 'src/avatar/AvatarStage.tsx');
  assert(fs.existsSync(avatarStagePath), 'src/avatar/AvatarStage.tsx exists');
  const avatarStageContent = fs.readFileSync(avatarStagePath, 'utf8');
  assert(avatarStageContent.includes('visibilitychange'), 'AvatarStage implements resource throttling on visibility change');
  assert(avatarStageContent.includes('requestAnimationFrame'), 'AvatarStage drives lip-sync loop via requestAnimationFrame');

  const layeredAdapterPath = path.join(process.cwd(), 'src/avatar/adapters/LayeredCharacterAdapter.tsx');
  assert(fs.existsSync(layeredAdapterPath), 'LayeredCharacterAdapter.tsx exists');
  const layeredAdapterContent = fs.readFileSync(layeredAdapterPath, 'utf8');
  assert(layeredAdapterContent.includes('Maryam can see you'), 'LayeredCharacterAdapter displays subtle "Maryam can see you" vision indicator');
  assert(!layeredAdapterContent.includes('mouthScaleY'), 'Static PNG adapter contains ZERO procedural mouth deformation overlay');
  assert(!layeredAdapterContent.includes('isBlinking'), 'Static PNG adapter contains ZERO fake eyelid/blink overlay');
  assert(!layeredAdapterContent.includes('AnimatePresence'), 'Static PNG adapter renders Maryam artwork cleanly without synthetic face parts');

  const live2dAdapterPath = path.join(process.cwd(), 'src/avatar/adapters/Live2DAdapter.tsx');
  assert(fs.existsSync(live2dAdapterPath), 'Live2DAdapter.tsx exists');

  // Test 3: Desktop Shell & Collapsible Panels
  console.log('\n3️⃣ Testing Desktop Shell & UI Components...');
  const desktopShellPath = path.join(process.cwd(), 'src/components/desktop/DesktopShell.tsx');
  assert(fs.existsSync(desktopShellPath), 'src/components/desktop/DesktopShell.tsx exists');
  const desktopShellContent = fs.readFileSync(desktopShellPath, 'utf8');

  // Strict Invariant: NO Camera PIP / Self-View
  const papaPipPath = path.join(process.cwd(), 'src/components/desktop/PapaCameraPIP.tsx');
  assert(!fs.existsSync(papaPipPath), 'Self-view PIP component is cleanly REMOVED BY DESIGN');
  assert(!desktopShellContent.includes('PapaCameraPIP'), 'DesktopShell contains NO self-view PIP component');
  assert(!desktopShellContent.includes('videoRef'), 'DesktopShell contains NO self-view video preview element');

  // Strict Invariant: ZERO User-Facing "Papa" occurrences in Desktop UI & Avatar modules
  console.log('\n  Checking zero user-facing "Papa" occurrences in Desktop & Avatar...');
  const desktopFilesToCheck = [
    'src/components/desktop/DesktopShell.tsx',
    'src/components/desktop/DesktopHeader.tsx',
    'src/components/desktop/CollapsibleSidebar.tsx',
    'src/components/desktop/CollapsibleConversationPanel.tsx',
    'src/components/desktop/FloatingControlsBar.tsx',
    'src/avatar/AvatarStage.tsx',
    'src/avatar/adapters/LayeredCharacterAdapter.tsx',
    'src/avatar/adapters/Live2DAdapter.tsx',
  ];

  for (const relPath of desktopFilesToCheck) {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(!/\b[Pp][Aa][Pp][Aa]\b/.test(content), `${relPath} contains ZERO occurrences of "Papa"`);
    }
  }

  const desktopHeaderPath = path.join(process.cwd(), 'src/components/desktop/DesktopHeader.tsx');
  assert(fs.existsSync(desktopHeaderPath), 'src/components/desktop/DesktopHeader.tsx exists');
  const headerContent = fs.readFileSync(desktopHeaderPath, 'utf8');
  assert(headerContent.includes('WebkitAppRegion'), 'DesktopHeader provides Electron window drag region');

  const sidebarPath = path.join(process.cwd(), 'src/components/desktop/CollapsibleSidebar.tsx');
  assert(fs.existsSync(sidebarPath), 'src/components/desktop/CollapsibleSidebar.tsx exists');

  const convPanelPath = path.join(process.cwd(), 'src/components/desktop/CollapsibleConversationPanel.tsx');
  assert(fs.existsSync(convPanelPath), 'src/components/desktop/CollapsibleConversationPanel.tsx exists');

  const controlsBarPath = path.join(process.cwd(), 'src/components/desktop/FloatingControlsBar.tsx');
  assert(fs.existsSync(controlsBarPath), 'src/components/desktop/FloatingControlsBar.tsx exists');

  // Test 4: Electron Security Invariants
  console.log('\n4️⃣ Testing Electron Shell Security Configuration...');
  const electronMainPath = path.join(process.cwd(), 'electron/main.ts');
  assert(fs.existsSync(electronMainPath), 'electron/main.ts exists');
  const electronMainContent = fs.readFileSync(electronMainPath, 'utf8');
  assert(electronMainContent.includes('contextIsolation: true'), 'Electron security: contextIsolation is true');
  assert(electronMainContent.includes('nodeIntegration: false'), 'Electron security: nodeIntegration is false');
  assert(electronMainContent.includes('sandbox: true'), 'Electron security: sandbox is true');
  assert(electronMainContent.includes('requestSingleInstanceLock'), 'Electron single instance lock enforced');
  assert(electronMainContent.includes('setPermissionRequestHandler'), 'Electron explicit media permission handlers configured');
  assert(electronMainContent.includes('setWindowOpenHandler'), 'Electron safe external URL handler configured');

  const electronPreloadPath = path.join(process.cwd(), 'electron/preload.ts');
  assert(fs.existsSync(electronPreloadPath), 'electron/preload.ts exists');
  const preloadContent = fs.readFileSync(electronPreloadPath, 'utf8');
  assert(preloadContent.includes('contextBridge.exposeInMainWorld'), 'Electron preload uses contextBridge safely');

  const desktopDevScriptPath = path.join(process.cwd(), 'scripts/desktop-dev.ts');
  assert(fs.existsSync(desktopDevScriptPath), 'scripts/desktop-dev.ts exists');

  console.log('\n✨ All Desktop & Avatar Architecture Tests Passed Successfully!\n');
}

runDesktopAvatarTests().catch((err) => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
