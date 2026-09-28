/**
 * Pari AI — ambient module declarations for file-generation deps that ship
 * without TypeScript types. Keeps `tsc --noEmit` clean without @types packages.
 */
declare module 'epub-gen';

/**
 * Build-stamped globals injected by vite.config.ts `define` at build time.
 * Used for the visible dev build tag on the dashboard (removed before go-live).
 */
declare const __PARI_BUILD_COMMIT__: string;
declare const __PARI_BUILD_TIME__: string;
