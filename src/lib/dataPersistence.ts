import fs from 'fs';
import path from 'path';

// Per-file write mutex promise chain to ensure serial execution
const writeQueues = new Map<string, Promise<any>>();

/**
 * Enqueues an operation to run sequentially for a given file path.
 */
function enqueueFileWrite<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const currentQueue = writeQueues.get(filePath) || Promise.resolve();
  const nextQueue = currentQueue.then(operation, operation);
  writeQueues.set(filePath, nextQueue);
  return nextQueue;
}

/**
 * Atomically writes JSON data to disk using temporary file swapping and fsync.
 * Automatically generates a .lkg (last-known-good) snapshot.
 */
export async function writeJsonAtomicAsync<T>(filePath: string, data: T): Promise<void> {
  return enqueueFileWrite(filePath, async () => {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }

    const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    const lkgPath = `${filePath}.lkg`;
    const serialized = JSON.stringify(data, null, 2);

    // 1. Write to temporary file in the same directory
    const fd = await fs.promises.open(tmpPath, 'w');
    try {
      await fd.writeFile(serialized, 'utf-8');
      await fd.sync(); // ensure physical flush to disk
    } finally {
      await fd.close();
    }

    // 2. Atomically swap temp file to destination
    await fs.promises.rename(tmpPath, filePath);

    // 3. Maintain Last-Known-Good snapshot asynchronously
    try {
      await fs.promises.writeFile(lkgPath, serialized, 'utf-8');
    } catch (_) {}
  });
}

/**
 * Synchronous atomic JSON write for initialization or process exit checkpoints.
 */
export function writeJsonAtomicSync<T>(filePath: string, data: T): void {
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const lkgPath = `${filePath}.lkg`;
  const serialized = JSON.stringify(data, null, 2);

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, serialized, 'utf-8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tmpPath, filePath);

  try {
    fs.writeFileSync(lkgPath, serialized, 'utf-8');
  } catch (_) {}
}

/**
 * Safely reads JSON from disk with automatic Last-Known-Good (.lkg) snapshot fallback.
 * Prevents corrupted files from causing complete data loss or unhandled server crashes.
 */
export function readJsonSafeSync<T>(filePath: string, fallback: T): T {
  const lkgPath = `${filePath}.lkg`;

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.trim().length > 0) {
        return JSON.parse(raw) as T;
      }
    } catch (primaryErr) {
      console.warn(`[DataPersistence] Primary JSON corrupt for ${filePath}, attempting LKG recovery...`, primaryErr);
    }
  }

  // Attempt recovery from Last-Known-Good snapshot
  if (fs.existsSync(lkgPath)) {
    try {
      const lkgRaw = fs.readFileSync(lkgPath, 'utf-8');
      if (lkgRaw.trim().length > 0) {
        const recovered = JSON.parse(lkgRaw) as T;
        console.log(`[DataPersistence] Successfully recovered state from LKG for ${filePath}`);
        // Restore recovered state to primary file
        try {
          writeJsonAtomicSync(filePath, recovered);
        } catch (_) {}
        return recovered;
      }
    } catch (lkgErr) {
      console.error(`[DataPersistence] LKG snapshot also failed for ${filePath}:`, lkgErr);
    }
  }

  return fallback;
}
