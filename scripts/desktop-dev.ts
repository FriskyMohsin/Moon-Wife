/**
 * Maryam V15.1 Desktop Dev Launcher (`npm run desktop:dev`)
 * Builds Electron main & preload bundles and launches the Electron desktop app against the active dev server.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as esbuild from 'esbuild';

async function buildElectron(): Promise<void> {
  const distElectronDir = path.join(process.cwd(), 'dist-electron');
  if (!fs.existsSync(distElectronDir)) {
    fs.mkdirSync(distElectronDir, { recursive: true });
  }

  console.log('[Desktop Launcher] Compiling Electron TypeScript sources...');
  await esbuild.build({
    entryPoints: [
      path.join(process.cwd(), 'electron/main.ts'),
      path.join(process.cwd(), 'electron/preload.ts'),
    ],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outdir: distElectronDir,
    outExtension: { '.js': '.cjs' },
    external: ['electron'],
    sourcemap: true,
  });
  console.log('[Desktop Launcher] Electron build complete.');
}

async function isPortOpen(port: number): Promise<boolean> {
  try {
    const net = await import('net');
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  await buildElectron();

  let serverProcess: ChildProcess | null = null;
  const isServerRunning = await isPortOpen(5173);

  if (!isServerRunning) {
    console.log('[Desktop Launcher] Starting backend dev server (tsx server.ts)...');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    serverProcess = spawn(npxCmd, ['tsx', 'server.ts'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: '5173' },
    });

    // Wait for server to become responsive
    let retries = 20;
    while (retries > 0) {
      await new Promise((res) => setTimeout(res, 600));
      if (await isPortOpen(5173)) break;
      retries--;
    }
  } else {
    console.log('[Desktop Launcher] Dev server already active on port 5173.');
  }

  console.log('[Desktop Launcher] Launching Electron Desktop Window...');
  const electronBinary = path.join(
    process.cwd(),
    'node_modules/.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron'
  );
  const mainScript = path.join(process.cwd(), 'dist-electron/main.cjs');

  const electronProcess = spawn(
    electronBinary,
    [mainScript],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_DEV_SERVER_URL: 'http://localhost:5173',
      },
    }
  );

  electronProcess.on('close', (code) => {
    console.log(`[Desktop Launcher] Electron exited with code ${code}`);
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(code || 0);
  });
}

start().catch((err) => {
  console.error('[Desktop Launcher] Error starting desktop application:', err);
  process.exit(1);
});
