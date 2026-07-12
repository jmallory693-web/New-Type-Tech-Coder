/** Stage 71: rule-based file/area extraction from patch draft text (no file reads). */

const FILE_PATH_PATTERNS = [
  /`([^`]+\.(?:ts|tsx|js|jsx|json|md|css|mjs|cjs))`/gi,
  /\b(?:src|dist|dist-electron|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|mjs|cjs)\b/gi,
  /\bApp\.tsx\b/gi,
  /\bmain\/index\.ts\b/gi,
];

const AREA_TOPIC_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Settings tab", pattern: /\bsettings\s+tab\b/i },
  { label: "Reports tab", pattern: /\breports\s+tab\b/i },
  { label: "IPC", pattern: /\bipc\b|\bipcmain\b|\bpreload\b/i },
  { label: "HistoryStore", pattern: /\bhistory\s*store\b|\bhistorystore\b/i },
  { label: "Project Memory", pattern: /\bproject\s+memory\b|\bNTTC_PLAN\b/i },
  { label: "Safety Gate", pattern: /\bsafety\s+gate\b|\bsafetygate\b/i },
  { label: "Provider security", pattern: /\bprovider\s+security\b|\bproviderregistry\b/i },
  { label: "Code Context Pack", pattern: /\bcode\s+context\s+pack\b/i },
  { label: "Patch Draft Mode", pattern: /\bpatch\s+draft\b/i },
  { label: "src/shared", pattern: /\bsrc\/shared\b/i },
  { label: "src/main/review", pattern: /\bsrc\/main\/review\b/i },
  { label: "src/renderer", pattern: /\bsrc\/renderer\b/i },
];

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").trim();
}

export function extractProposedFilesAreas(text: string): string[] {
  const found = new Set<string>();
  const source = text ?? "";
  for (const pattern of FILE_PATH_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(source)) !== null) {
      const raw = match[1] ?? match[0];
      if (raw && raw.length < 140) {
        found.add(normalizePath(raw));
      }
    }
  }
  for (const topic of AREA_TOPIC_PATTERNS) {
    if (topic.pattern.test(source)) {
      found.add(topic.label);
    }
  }
  return [...found].slice(0, 30);
}

export function intersectAreas(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((v) => v.toLowerCase()));
  return a.filter((item) => setB.has(item.toLowerCase()));
}

export function onlyInFirst(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((v) => v.toLowerCase()));
  return a.filter((item) => !setB.has(item.toLowerCase()));
}

export function draftMentionsBroadCentralFiles(text: string): boolean {
  return /\bApp\.tsx\b.*\b(main\/index\.ts|main\s+process)\b|\b(main\/index\.ts|main\s+process)\b.*\bApp\.tsx\b|\bgiant\s+file\b|\bone\s+giant\b|\bdump\s+all\s+logic\b/i.test(
    text,
  );
}

export function draftMentionsModularSplit(text: string): boolean {
  return /\bfocused\s+module\b|\bsmall\s+focused\b|\bsplit\s+(into|logic)\b|\bclear\s+module\s+boundar/i.test(
    text,
  );
}
