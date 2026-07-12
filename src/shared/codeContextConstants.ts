/** Stage 52: Code Context Pack — preview/copy only (no AI calls). */

export const CODE_CONTEXT_PREVIEW_NOTE =
  "This only prepares a context pack. Generating preview does not send anything to AI.";

/** Stage 54: Local AI receives only the approved pack after user confirmation. */
export const CODE_CONTEXT_AI_SEND_NOTE =
  "This sends only the previewed Code Context Pack. The AI cannot browse your project or edit files.";

/** Stage 58: Patch Draft Mode — draft output only; NTTC does not apply patches. */
export const PATCH_DRAFT_SEND_NOTE =
  "Patch Draft Mode can suggest changes, but NTTC will not edit files or apply patches.";

export const CODE_CONTEXT_ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".html",
  ".mjs",
  ".cjs",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);

export const CODE_CONTEXT_BLOCKED_EXTENSIONS = new Set([
  ".env",
  ".pem",
  ".key",
  ".crt",
  ".pfx",
  ".p12",
  ".sqlite",
  ".db",
  ".zip",
  ".exe",
  ".dll",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".bin",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

/** Extra deny dirs for code context (includes `.nttc/`). */
export const CODE_CONTEXT_DENY_DIRECTORY_NAMES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "release",
  "out",
  ".next",
  ".vite",
  "coverage",
  ".cache",
  ".nttc",
] as const;

export const DEFAULT_CODE_CONTEXT_MAX_LINES_PER_FILE = 200;
export const DEFAULT_CODE_CONTEXT_MAX_TOTAL_CHARS = 40_000;
export const CODE_CONTEXT_MAX_LISTED_FILES = 50;
export const CODE_CONTEXT_MAX_INCLUDED_FILES = 10;
export const CODE_CONTEXT_MAX_FILE_BYTES = 256 * 1024;
export const CODE_CONTEXT_BINARY_PROBE_BYTES = 8192;

export const CODE_CONTEXT_SECRET_PATTERNS: RegExp[] = [
  /\bAPI_KEY\b/i,
  /\bSECRET\b/i,
  /\bTOKEN\b/i,
  /\bPASSWORD\b/i,
  /\bPRIVATE KEY\b/i,
  /BEGIN RSA PRIVATE KEY/i,
  /BEGIN OPENSSH PRIVATE KEY/i,
  /\bAWS_ACCESS_KEY\b/i,
  /\bAWS_SECRET\b/i,
  /\bDATABASE_URL\b/i,
  /\bAUTH_SECRET\b/i,
  /\bCLIENT_SECRET\b/i,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bsk-[A-Za-z0-9]{8,}/i,
  /\.env\b/i,
];

export function isCodeContextAllowedExtension(ext: string): boolean {
  return CODE_CONTEXT_ALLOWED_EXTENSIONS.has(ext.toLowerCase());
}

export function isCodeContextBlockedExtension(ext: string): boolean {
  return CODE_CONTEXT_BLOCKED_EXTENSIONS.has(ext.toLowerCase());
}

export function isCodeContextDenyDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  return CODE_CONTEXT_DENY_DIRECTORY_NAMES.some(
    (deny) => deny.toLowerCase() === lower,
  );
}
