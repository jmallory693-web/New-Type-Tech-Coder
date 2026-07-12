/** Stage 67: scan pasted imported patch drafts for secrets and risk phrases. */

import { CODE_CONTEXT_SECRET_PATTERNS } from "./codeContextConstants";

export const IMPORTED_PATCH_DRAFT_RISK_PHRASES: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "apply patch", pattern: /\bapply\s+(the\s+)?patch\b/i },
  { label: "edit mode", pattern: /\bedit\s+mode\b|\benable\s+edit\s+mode\b/i },
  { label: "AI file access", pattern: /\bai\s+file\s+access\b|\binvisible\s+file\s+access\b/i },
  { label: "command runner", pattern: /\bcommand\s+runner\b|\brun\s+commands?\b/i },
  { label: "arbitrary terminal", pattern: /\barbitrary\s+terminal\b/i },
  { label: "custom commands", pattern: /\bcustom\s+commands?\b|\btype\s+a\s+command\b/i },
  { label: "live Qwen", pattern: /\blive\s+qwen\b|\benable\s+live\s+qwen\b/i },
  { label: "provider security", pattern: /\bprovider\s+security\b|\bweaken\s+provider\b/i },
  { label: "preload", pattern: /\bpreload\b/i },
  { label: "main process", pattern: /\bmain\s+process\b/i },
  { label: "Safety Gate", pattern: /\bsafety\s+gate\b|\bbypass\s+safety\b/i },
  { label: "backup/restore", pattern: /\bbackup\b|\brestore\b/i },
  { label: "package scripts", pattern: /\bpackage\.json\b|\bpackage\s+scripts?\b/i },
  { label: "install packages", pattern: /\binstall\s+packages?\b|\bnpm\s+i(nstall)?\b/i },
  { label: "deploy", pattern: /\bdeploy\b/i },
  { label: "publish", pattern: /\bpublish\b/i },
  { label: "reset", pattern: /\breset\s+--hard\b|\bgit\s+reset\b/i },
  { label: "clean", pattern: /\bgit\s+clean\b|\bclean\s+-fd\b/i },
  { label: "delete", pattern: /\bdelete\s+(files?|folders?)\b|\brm\s+-rf\b/i },
  { label: "remove", pattern: /\bremove\s+(files?|folders?|checks?)\b/i },
  { label: "disable checks", pattern: /\bdisable\s+(typecheck|lint|test|check)\b/i },
  { label: "bypass confirmation", pattern: /\bbypass\s+confirm\b|\bwithout\s+confirm\b/i },
  { label: "bypass Safety Backup", pattern: /\bbypass\s+(safety\s+)?backup\b/i },
  { label: "source-wide refactor", pattern: /\bsource-wide\s+refactor\b|\bfull\s+rewrite\b/i },
  { label: "broad rewrite", pattern: /\bbroad\s+rewrite\b|\brewrite\s+everything\b/i },
];

export interface ImportedPatchDraftScanResult {
  riskPhrases: string[];
  likelyFilesAreas: string[];
  possibleSecrets: string[];
  blockedBySecrets: boolean;
}

function matchLabels(
  text: string,
  rules: Array<{ label: string; pattern: RegExp }>,
): string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text) && !found.includes(rule.label)) {
      found.push(rule.label);
    }
  }
  return found;
}

function extractLikelyFilesAreas(text: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /`([^`]+\.(?:ts|tsx|js|jsx|json|md|css|mjs|cjs))`/gi,
    /\b(?:src|dist|dist-electron|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md)\b/gi,
    /\b[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx)\b/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const p = (m[1] ?? m[0]).replace(/\\/g, "/");
      if (p.length > 2 && p.length < 120) paths.add(p);
    }
  }
  return [...paths].slice(0, 25);
}

function detectPossibleSecrets(text: string): string[] {
  const found: string[] = [];
  for (const pattern of CODE_CONTEXT_SECRET_PATTERNS) {
    if (pattern.test(text)) {
      found.push(pattern.source.slice(0, 40));
    }
  }
  return [...new Set(found)];
}

export function scanImportedPatchDraftText(text: string): ImportedPatchDraftScanResult {
  const riskPhrases = matchLabels(text, IMPORTED_PATCH_DRAFT_RISK_PHRASES);
  const likelyFilesAreas = extractLikelyFilesAreas(text);
  const possibleSecrets = detectPossibleSecrets(text);
  return {
    riskPhrases,
    likelyFilesAreas,
    possibleSecrets,
    blockedBySecrets: possibleSecrets.length > 0,
  };
}
