import path from 'path';
import fs from 'fs';

/**
 * Runtime Data Root Resolver for Maryam / Hoorvia Platform.
 * Supports Azure App Service durable mount (/home/data) via MARYAM_DATA_DIR
 * while gracefully falling back to ./data in local development.
 */
export function getDataDir(): string {
  const customDir = process.env.MARYAM_DATA_DIR;
  if (customDir && customDir.trim().length > 0) {
    const resolved = path.resolve(customDir.trim());
    if (!fs.existsSync(resolved)) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
      } catch (_) {}
    }
    return resolved;
  }
  const defaultDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch (_) {}
  }
  return defaultDir;
}

/**
 * Resolve a named data file inside the active durable data directory.
 */
export function resolveDataPath(...subpaths: string[]): string {
  const dir = getDataDir();
  const fullPath = path.join(dir, ...subpaths);
  const parentDir = path.dirname(fullPath);
  if (!fs.existsSync(parentDir)) {
    try {
      fs.mkdirSync(parentDir, { recursive: true });
    } catch (_) {}
  }
  return fullPath;
}
