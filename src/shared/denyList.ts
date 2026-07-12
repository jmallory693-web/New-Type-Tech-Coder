/**
 * Safety Gate deny-list and scan allow-list helpers.
 */

export const DENY_DIRECTORY_NAMES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".turbo",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  "System Volume Information",
  "$Recycle.Bin",
  "Windows",
] as const;

/** File name patterns that must never be read or written. */
export const DENY_FILE_NAME_PATTERNS: RegExp[] = [
  /^\.env(\..+)?$/i,
  /.*\.(pem|key|p12|pfx|jks)$/i,
  /.*(secret|secrets|credentials|api[_-]?key).*/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
];

/** Lockfiles: presence by name only; do not read contents in Stage 3. */
export const READ_ONLY_FILE_NAMES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock",
  "composer.lock",
] as const;

export const SYSTEM_PATH_PREFIXES_WIN = [
  "c:\\windows",
  "c:\\program files",
  "c:\\program files (x86)",
  "c:\\programdata",
] as const;

/** Known folders to report if present at project root (or shallow). */
export const INTERESTING_FOLDER_NAMES = [
  "src",
  "app",
  "pages",
  "components",
  "tests",
  "test",
  "__tests__",
  "public",
  "electron",
  "renderer",
  "main",
  "shared",
] as const;

/** Config files detected by name only (contents not read unless separately allowed). */
export const CONFIG_FILE_NAME_PATTERNS: RegExp[] = [
  /^package\.json$/i,
  /^tsconfig(\..+)?\.json$/i,
  /^jsconfig\.json$/i,
  /^vite\.config\.[cm]?[jt]s$/i,
  /^vitest\.config\.[cm]?[jt]s$/i,
  /^webpack\.config\.[cm]?[jt]s$/i,
  /^next\.config\.[cm]?[jt]s$/i,
  /^nuxt\.config\.[cm]?[jt]s$/i,
  /^electron\.builder\.[cm]?[jt]s$/i,
  /^electron-builder\.(yml|yaml|json)$/i,
  /^\.eslintrc(\..+)?$/i,
  /^eslint\.config\.[cm]?[jt]s$/i,
  /^\.prettierrc(\..+)?$/i,
  /^prettier\.config\.[cm]?[jt]s$/i,
  /^tailwind\.config\.[cm]?[jt]s$/i,
  /^postcss\.config\.[cm]?[jt]s$/i,
  /^babel\.config\.[cm]?[jt]s$/i,
  /^\.babelrc(\..+)?$/i,
  /^pyproject\.toml$/i,
  /^requirements(\..+)?\.txt$/i,
  /^Pipfile$/i,
  /^setup\.py$/i,
  /^Cargo\.toml$/i,
  /^go\.mod$/i,
  /^composer\.json$/i,
  /^Gemfile$/i,
];

/** Text files the scanner may read (size-capped). */
export const READABLE_TEXT_FILE_NAMES = [
  "package.json",
  "readme",
  "readme.md",
  "readme.txt",
] as const;

export const MAX_SCAN_FILE_BYTES = 256 * 1024;
export const MAX_TOP_LEVEL_ENTRIES = 200;

export function getDenyListSummary(): string[] {
  return [
    "node_modules and dependency caches",
    ".git internals",
    ".env and secret/key files",
    "system directories (Windows, Program Files, etc.)",
    "build output folders (dist, build, out, .next)",
    "package lock files (presence only; contents not read)",
  ];
}

export function isDenyDirectoryName(name: string): boolean {
  const lower = name.toLowerCase();
  return (DENY_DIRECTORY_NAMES as readonly string[]).some((d) => d.toLowerCase() === lower);
}

export function isLockFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return (READ_ONLY_FILE_NAMES as readonly string[]).some((d) => d.toLowerCase() === lower);
}

export function isSensitiveFileName(name: string): boolean {
  return DENY_FILE_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function isConfigFileName(name: string): boolean {
  return CONFIG_FILE_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function isInterestingFolderName(name: string): boolean {
  const lower = name.toLowerCase();
  return (INTERESTING_FOLDER_NAMES as readonly string[]).some((d) => d.toLowerCase() === lower);
}

export function isAllowedReadableTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (READABLE_TEXT_FILE_NAMES as readonly string[]).includes(lower);
}
