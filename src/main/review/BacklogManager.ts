import type {
  BacklogFilters,
  BacklogItem,
  BacklogItemType,
  BacklogPriority,
  BacklogReviewReport,
  BacklogState,
  BacklogStatus,
  ProjectInfo,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

export const BACKLOG_ITEM_TYPES: BacklogItemType[] = [
  "Bug",
  "UX issue",
  "Safety concern",
  "Feature idea",
  "Packaging issue",
  "Documentation issue",
  "Other",
];

export const BACKLOG_PRIORITIES: BacklogPriority[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

export const BACKLOG_STATUSES: BacklogStatus[] = [
  "Open",
  "In review",
  "Fixed",
  "Won’t fix",
  "Later",
];

export const MAX_BACKLOG_ITEMS = 80;
const MAX_TITLE_CHARS = 200;
const MAX_NOTES_CHARS = 20_000;
const MAX_STAGE_CHARS = 80;
const MAX_PREVIEW_CHARS = 2_500;
const CURRENT_STAGE_DEFAULT = "Stage 21";

const RISKY_PHRASE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "delete files", pattern: /\bdelete\s+files?\b/i },
  { label: "rm -rf", pattern: /\brm\s+-rf\b/i },
  { label: "reset --hard", pattern: /\breset\s+--hard\b/i },
  { label: "clean -fd", pattern: /\bclean\s+-fd\b/i },
  { label: "npm install", pattern: /\bnpm\s+i(nstall)?\b/i },
  { label: "deploy", pattern: /\bdeploy\b/i },
  { label: "publish", pattern: /\bpublish\b/i },
  { label: "push to GitHub", pattern: /\bpush\s+to\s+github\b/i },
  { label: "enable live Qwen", pattern: /\benable\s+live\s+qwen\b/i },
  { label: "add edit mode", pattern: /\badd\s+edit\s+mode\b/i },
  { label: "arbitrary terminal", pattern: /\barbitrary\s+terminal\b/i },
  { label: "custom command input", pattern: /\bcustom\s+command\s+(input|typing)\b/i },
  { label: "bypass Safety Gate", pattern: /\bbypass\s+safety\s+gate\b/i },
  { label: "disable safety", pattern: /\bdisable\s+safety\b/i },
];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function detectBacklogRiskyPhrases(text: string): string[] {
  const found: string[] = [];
  for (const rule of RISKY_PHRASE_PATTERNS) {
    if (rule.pattern.test(text) && !found.includes(rule.label)) {
      found.push(rule.label);
    }
  }
  return found;
}

export function defaultBacklogFilters(): BacklogFilters {
  return {
    status: "All",
    priority: "All",
    type: "All",
    projectPath: "All",
  };
}

export function filterBacklogItems(
  items: BacklogItem[],
  filters: BacklogFilters,
): BacklogItem[] {
  return items.filter((item) => {
    if (filters.status !== "All" && item.status !== filters.status) return false;
    if (filters.priority !== "All" && item.priority !== filters.priority) {
      return false;
    }
    if (filters.type !== "All" && item.type !== filters.type) return false;
    if (filters.projectPath === "Unassigned") {
      if (item.projectPath) return false;
    } else if (filters.projectPath !== "All") {
      if ((item.projectPath ?? "") !== filters.projectPath) return false;
    }
    return true;
  });
}

export function backlogOpenCriticalSafetyCount(items: BacklogItem[]): number {
  return items.filter(
    (item) =>
      item.status === "Open" &&
      item.priority === "Critical" &&
      item.type === "Safety concern",
  ).length;
}

export function backlogOpenCriticalOrHighCount(items: BacklogItem[]): number {
  return items.filter(
    (item) =>
      (item.status === "Open" || item.status === "In review") &&
      (item.priority === "Critical" || item.priority === "High"),
  ).length;
}

export function backlogOpenCount(items: BacklogItem[]): number {
  return items.filter(
    (item) => item.status === "Open" || item.status === "In review",
  ).length;
}

export function buildBacklogReviewReport(input: {
  items: BacklogItem[];
  project: ProjectInfo | null;
}): BacklogReviewReport {
  const items = input.items;
  const openItems = items.filter(
    (i) => i.status === "Open" || i.status === "In review",
  );
  const openCount = openItems.length;
  const criticalHighCount = backlogOpenCriticalOrHighCount(items);
  const safetyConcernCount = items.filter(
    (i) =>
      i.type === "Safety concern" &&
      (i.status === "Open" || i.status === "In review"),
  ).length;
  const packagingIssueCount = items.filter(
    (i) =>
      i.type === "Packaging issue" &&
      (i.status === "Open" || i.status === "In review"),
  ).length;

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
  }

  const priorityRank: Record<BacklogPriority, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };
  const topOpen = [...openItems]
    .sort((a, b) => {
      const pr = priorityRank[a.priority] - priorityRank[b.priority];
      if (pr !== 0) return pr;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 12);

  let suggestedFocus =
    "No open backlog items. Continue normal inspect/review workflow.";
  if (backlogOpenCriticalSafetyCount(items) > 0) {
    suggestedFocus =
      "Resolve open Critical Safety concern(s) before proceeding with builder work.";
  } else if (criticalHighCount > 0) {
    suggestedFocus =
      "Review open Critical/High backlog items before asking a builder for new changes.";
  } else if (packagingIssueCount > 0) {
    suggestedFocus =
      "Address open Packaging issue(s) so the double-click packaged app stays trustworthy.";
  } else if (openCount > 0) {
    suggestedFocus =
      "Triage open backlog items by priority; keep changes small and reviewable.";
  }

  const lines: string[] = [
    "# New Type Tech Coder - Backlog Review Report",
    "",
    "## Summary",
    "",
    `- **Open / in-review items:** ${openCount}`,
    `- **Open Critical/High items:** ${criticalHighCount}`,
    `- **Open Safety concerns:** ${safetyConcernCount}`,
    `- **Open Packaging issues:** ${packagingIssueCount}`,
    `- **Total backlog items:** ${items.length}`,
    input.project
      ? `- **Current selected project:** ${input.project.displayName} (${input.project.normalizedPath})`
      : "- **Current selected project:** None",
    "",
    "## Items by Type",
    "",
  ];

  for (const type of BACKLOG_ITEM_TYPES) {
    lines.push(`- **${type}:** ${byType[type] ?? 0}`);
  }

  lines.push("", "## Items by Status", "");
  for (const status of BACKLOG_STATUSES) {
    lines.push(`- **${status}:** ${byStatus[status] ?? 0}`);
  }

  lines.push("", "## Safety Concerns (open / in review)", "");
  const safetyOpen = items.filter(
    (i) =>
      i.type === "Safety concern" &&
      (i.status === "Open" || i.status === "In review"),
  );
  if (safetyOpen.length === 0) {
    lines.push("- None.", "");
  } else {
    for (const item of safetyOpen.slice(0, 20)) {
      lines.push(
        `- **[${item.priority}] ${item.title}** (${item.status}) — ${item.notes.slice(0, 180)}${item.notes.length > 180 ? "…" : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("## Packaging Issues (open / in review)", "");
  const packagingOpen = items.filter(
    (i) =>
      i.type === "Packaging issue" &&
      (i.status === "Open" || i.status === "In review"),
  );
  if (packagingOpen.length === 0) {
    lines.push("- None.", "");
  } else {
    for (const item of packagingOpen.slice(0, 20)) {
      lines.push(
        `- **[${item.priority}] ${item.title}** (${item.status}) — ${item.notes.slice(0, 180)}${item.notes.length > 180 ? "…" : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("## Top Open Items", "");
  if (topOpen.length === 0) {
    lines.push("- None.", "");
  } else {
    for (const item of topOpen) {
      lines.push(
        `- **[${item.priority}] ${item.title}** — ${item.type} · ${item.status}${item.projectName ? ` · ${item.projectName}` : ""}${item.relatedStage ? ` · ${item.relatedStage}` : ""}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Suggested Next Maintenance Focus",
    "",
    suggestedFocus,
    "",
    "## App Note",
    "",
    "Backlog items are text-only notes stored in app-owned history. New Type Tech Coder does not execute them or modify selected project files.",
    "",
  );

  const markdownReport = lines.join("\n");
  return {
    generatedAt: new Date().toISOString(),
    markdownReport,
    previewExcerpt: markdownReport.split("\n").slice(0, 28).join("\n"),
    openCount,
    criticalHighCount,
    safetyConcernCount,
    packagingIssueCount,
    suggestedFocus,
  };
}

function isBacklogType(value: unknown): value is BacklogItemType {
  return (
    typeof value === "string" &&
    (BACKLOG_ITEM_TYPES as string[]).includes(value)
  );
}

function isPriority(value: unknown): value is BacklogPriority {
  return (
    typeof value === "string" &&
    (BACKLOG_PRIORITIES as string[]).includes(value)
  );
}

function isStatus(value: unknown): value is BacklogStatus {
  return (
    typeof value === "string" && (BACKLOG_STATUSES as string[]).includes(value)
  );
}

function normalizeItem(raw: BacklogItem): BacklogItem {
  return {
    id: raw.id,
    title: raw.title ?? "",
    type: raw.type,
    priority: raw.priority,
    status: raw.status,
    notes: raw.notes ?? "",
    projectName: raw.projectName ?? null,
    projectPath: raw.projectPath ?? null,
    relatedStage: raw.relatedStage ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    riskyPhrases: Array.isArray(raw.riskyPhrases) ? raw.riskyPhrases : [],
    hasRiskySuggestions: Boolean(raw.hasRiskySuggestions),
    charCount: raw.charCount ?? (raw.notes?.length ?? 0),
    truncated: Boolean(raw.truncated),
  };
}

function emptyState(): BacklogState {
  const filters = defaultBacklogFilters();
  return {
    draftTitle: "",
    draftType: "Bug",
    draftPriority: "Medium",
    draftStatus: "Open",
    draftNotes: "",
    draftRelatedStage: CURRENT_STAGE_DEFAULT,
    items: [],
    selectedId: null,
    selected: null,
    filters,
    filteredItems: [],
    lastReport: null,
    statusMessage:
      "Track bugs, UX issues, safety concerns, and feature ideas here. Text only — nothing will be executed.",
    capNote: null,
  };
}

function withDerived(state: BacklogState): BacklogState {
  const selected =
    state.selectedId == null
      ? null
      : state.items.find((i) => i.id === state.selectedId) ?? null;
  return {
    ...state,
    selectedId: selected?.id ?? null,
    selected: selected ? { ...selected } : null,
    filteredItems: filterBacklogItems(state.items, state.filters),
  };
}

/**
 * Stage 21: Bug Log / Improvement Backlog.
 * App-owned text notes only. Never executes notes or writes into selected projects.
 */
export class BacklogManager {
  private state: BacklogState = emptyState();

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): BacklogState {
    const derived = withDerived(this.state);
    return {
      ...derived,
      items: derived.items.map((i) => ({ ...i })),
      filteredItems: derived.filteredItems.map((i) => ({ ...i })),
      selected: derived.selected ? { ...derived.selected } : null,
      lastReport: derived.lastReport ? { ...derived.lastReport } : null,
      filters: { ...derived.filters },
    };
  }

  getItems(): BacklogItem[] {
    return this.state.items.map((i) => ({ ...i }));
  }

  getLastReport(): BacklogReviewReport | null {
    return this.state.lastReport ? { ...this.state.lastReport } : null;
  }

  /** Restore global backlog from app history (text-only). */
  restoreFromHistory(input: {
    items: BacklogItem[] | null | undefined;
    selectedId?: string | null;
    lastReport?: BacklogReviewReport | null;
  }): void {
    const items = (input.items ?? [])
      .map(normalizeItem)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_BACKLOG_ITEMS);
    const selectedId =
      input.selectedId && items.some((i) => i.id === input.selectedId)
        ? input.selectedId
        : items[0]?.id ?? null;
    this.state = withDerived({
      ...this.state,
      items,
      selectedId,
      lastReport: input.lastReport ?? null,
      capNote:
        (input.items?.length ?? 0) > MAX_BACKLOG_ITEMS
          ? `History restored the newest ${MAX_BACKLOG_ITEMS} backlog items.`
          : null,
      statusMessage:
        items.length > 0
          ? `Restored ${items.length} backlog item(s) from app history. Text only — not executed.`
          : this.state.statusMessage,
    });
  }

  setDraftTitle(title: unknown): BacklogState {
    const next =
      typeof title === "string" ? title.slice(0, MAX_TITLE_CHARS) : "";
    this.state = { ...this.state, draftTitle: next };
    return this.getState();
  }

  setDraftType(type: unknown): BacklogState {
    if (!isBacklogType(type)) {
      this.safetyGate.log(
        "warning",
        "Backlog type change blocked",
        "Unknown backlog item type.",
      );
      return this.getState();
    }
    this.state = { ...this.state, draftType: type };
    return this.getState();
  }

  setDraftPriority(priority: unknown): BacklogState {
    if (!isPriority(priority)) {
      this.safetyGate.log(
        "warning",
        "Backlog priority change blocked",
        "Unknown backlog priority.",
      );
      return this.getState();
    }
    this.state = { ...this.state, draftPriority: priority };
    return this.getState();
  }

  setDraftStatus(status: unknown): BacklogState {
    if (!isStatus(status)) {
      this.safetyGate.log(
        "warning",
        "Backlog status change blocked",
        "Unknown backlog status.",
      );
      return this.getState();
    }
    this.state = { ...this.state, draftStatus: status };
    return this.getState();
  }

  setDraftNotes(notes: unknown): BacklogState {
    const next =
      typeof notes === "string" ? notes.slice(0, MAX_NOTES_CHARS * 2) : "";
    this.state = { ...this.state, draftNotes: next.slice(0, 80_000) };
    return this.getState();
  }

  setDraftRelatedStage(stage: unknown): BacklogState {
    const next =
      typeof stage === "string" ? stage.trim().slice(0, MAX_STAGE_CHARS) : "";
    this.state = { ...this.state, draftRelatedStage: next };
    return this.getState();
  }

  setFilters(partial: Partial<BacklogFilters> | unknown): BacklogState {
    const incoming =
      partial && typeof partial === "object"
        ? (partial as Partial<BacklogFilters>)
        : {};
    this.state = withDerived({
      ...this.state,
      filters: {
        ...this.state.filters,
        ...incoming,
      },
    });
    return this.getState();
  }

  select(itemId: unknown): BacklogState {
    if (typeof itemId !== "string") return this.getState();
    const item = this.state.items.find((i) => i.id === itemId);
    if (!item) {
      this.state = {
        ...this.state,
        statusMessage: "Backlog item not found.",
      };
      return this.getState();
    }
    this.state = withDerived({
      ...this.state,
      selectedId: item.id,
      draftTitle: item.title,
      draftType: item.type,
      draftPriority: item.priority,
      draftStatus: item.status,
      draftNotes: item.notes,
      draftRelatedStage: item.relatedStage ?? "",
      statusMessage: `Viewing backlog item: ${item.title}`,
    });
    return this.getState();
  }

  saveNew(input: { project: ProjectInfo | null }): BacklogState {
    const title = this.state.draftTitle.trim();
    if (!title) {
      this.state = {
        ...this.state,
        statusMessage: "Enter a title before saving a backlog item.",
      };
      this.safetyGate.log(
        "warning",
        "Backlog item save blocked",
        "Title is empty.",
      );
      return this.getState();
    }

    const notesRaw = this.state.draftNotes.trim();
    const truncated = notesRaw.length > MAX_NOTES_CHARS;
    const notes = notesRaw.slice(0, MAX_NOTES_CHARS);
    const scanText = `${title}\n${notes}`;
    const riskyPhrases = detectBacklogRiskyPhrases(scanText);
    const now = new Date().toISOString();
    const relatedStage =
      this.state.draftRelatedStage.trim().slice(0, MAX_STAGE_CHARS) || null;

    const record: BacklogItem = {
      id: makeId(),
      title: title.slice(0, MAX_TITLE_CHARS),
      type: this.state.draftType,
      priority: this.state.draftPriority,
      status: this.state.draftStatus,
      notes,
      projectName: input.project?.displayName ?? null,
      projectPath: input.project?.normalizedPath ?? null,
      relatedStage,
      createdAt: now,
      updatedAt: now,
      riskyPhrases,
      hasRiskySuggestions: riskyPhrases.length > 0,
      charCount: notes.length,
      truncated,
    };

    let items = [record, ...this.state.items];
    let capNote: string | null = null;
    if (items.length > MAX_BACKLOG_ITEMS) {
      items = items.slice(0, MAX_BACKLOG_ITEMS);
      capNote = `Kept the newest ${MAX_BACKLOG_ITEMS} backlog items (older ones dropped).`;
    }

    if (riskyPhrases.length > 0) {
      this.safetyGate.log(
        "warning",
        "Risky backlog phrases detected",
        `Backlog item flagged: ${riskyPhrases.join(", ")}. Not executed.`,
      );
    }

    this.state = withDerived({
      ...this.state,
      items,
      selectedId: record.id,
      draftTitle: "",
      draftNotes: "",
      draftRelatedStage: CURRENT_STAGE_DEFAULT,
      draftType: "Bug",
      draftPriority: "Medium",
      draftStatus: "Open",
      capNote,
      statusMessage: [
        "Backlog item created (text only — not executed).",
        truncated
          ? `Notes truncated to ${MAX_NOTES_CHARS} characters.`
          : null,
        riskyPhrases.length > 0
          ? `Risk warnings: ${riskyPhrases.join(", ")}`
          : null,
        !input.project ? "No project selected — item saved without project link." : null,
      ]
        .filter(Boolean)
        .join(" "),
    });

    this.safetyGate.log(
      "success",
      "Backlog item created",
      `Created “${record.title}” (${record.type} / ${record.priority} / ${record.status}).`,
    );
    return this.getState();
  }

  updateSelected(input: { project: ProjectInfo | null }): BacklogState {
    const selected = this.state.selected;
    if (!selected) {
      this.state = {
        ...this.state,
        statusMessage: "Select a backlog item to update, or Save to create a new one.",
      };
      this.safetyGate.log(
        "warning",
        "Backlog item update blocked",
        "No backlog item selected.",
      );
      return this.getState();
    }

    const title = this.state.draftTitle.trim();
    if (!title) {
      this.state = {
        ...this.state,
        statusMessage: "Enter a title before updating a backlog item.",
      };
      this.safetyGate.log(
        "warning",
        "Backlog item update blocked",
        "Title is empty.",
      );
      return this.getState();
    }

    const notesRaw = this.state.draftNotes.trim();
    const truncated = notesRaw.length > MAX_NOTES_CHARS;
    const notes = notesRaw.slice(0, MAX_NOTES_CHARS);
    const scanText = `${title}\n${notes}`;
    const riskyPhrases = detectBacklogRiskyPhrases(scanText);
    const relatedStage =
      this.state.draftRelatedStage.trim().slice(0, MAX_STAGE_CHARS) || null;

    const keepProjectLink = Boolean(selected.projectPath);
    const updated: BacklogItem = {
      ...selected,
      title: title.slice(0, MAX_TITLE_CHARS),
      type: this.state.draftType,
      priority: this.state.draftPriority,
      status: this.state.draftStatus,
      notes,
      relatedStage,
      updatedAt: new Date().toISOString(),
      riskyPhrases,
      hasRiskySuggestions: riskyPhrases.length > 0,
      charCount: notes.length,
      truncated: selected.truncated || truncated,
      projectName: keepProjectLink
        ? selected.projectName
        : input.project?.displayName ?? selected.projectName,
      projectPath: keepProjectLink
        ? selected.projectPath
        : input.project?.normalizedPath ?? selected.projectPath,
    };

    const items = this.state.items.map((i) =>
      i.id === updated.id ? updated : i,
    );

    if (riskyPhrases.length > 0) {
      this.safetyGate.log(
        "warning",
        "Risky backlog phrases detected",
        `Updated backlog item flagged: ${riskyPhrases.join(", ")}. Not executed.`,
      );
    }

    this.state = withDerived({
      ...this.state,
      items,
      selectedId: updated.id,
      statusMessage: [
        "Backlog item updated (text only — not executed).",
        truncated
          ? `Notes truncated to ${MAX_NOTES_CHARS} characters.`
          : null,
        riskyPhrases.length > 0
          ? `Risk warnings: ${riskyPhrases.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    });

    this.safetyGate.log(
      "success",
      "Backlog item updated",
      `Updated “${updated.title}” (${updated.type} / ${updated.priority} / ${updated.status}).`,
    );
    return this.getState();
  }

  delete(itemId: unknown): BacklogState {
    if (typeof itemId !== "string") return this.getState();
    const existing = this.state.items.find((i) => i.id === itemId);
    if (!existing) {
      this.state = {
        ...this.state,
        statusMessage: "Backlog item not found.",
      };
      return this.getState();
    }

    const items = this.state.items.filter((i) => i.id !== itemId);
    const selectedId =
      this.state.selectedId === itemId ? items[0]?.id ?? null : this.state.selectedId;

    this.state = withDerived({
      ...this.state,
      items,
      selectedId,
      statusMessage: `Deleted backlog item “${existing.title}” from app storage. Project files were not changed.`,
      draftTitle: selectedId ? this.state.draftTitle : "",
      draftNotes: selectedId ? this.state.draftNotes : "",
    });

    this.safetyGate.log(
      "info",
      "Backlog item deleted",
      `Deleted “${existing.title}” from app-owned backlog. Nothing executed; project files unchanged.`,
    );
    return this.getState();
  }

  recordCopied(itemId?: string | null): BacklogState {
    const target =
      (itemId
        ? this.state.items.find((i) => i.id === itemId)
        : null) ?? this.state.selected;
    if (!target) {
      this.state = {
        ...this.state,
        statusMessage: "Nothing to copy — select or save a backlog item first.",
      };
      this.safetyGate.log(
        "warning",
        "Backlog item copy blocked",
        "No backlog item selected.",
      );
      return this.getState();
    }

    this.safetyGate.log(
      "info",
      "Backlog item copied",
      `Copied “${target.title}” (${target.type} / ${target.priority}).`,
    );
    this.state = {
      ...this.state,
      statusMessage: "Backlog item copied to clipboard (text only).",
    };
    return this.getState();
  }

  generateReport(input: { project: ProjectInfo | null }): BacklogState {
    const report = buildBacklogReviewReport({
      items: this.state.items,
      project: input.project,
    });
    this.state = {
      ...this.state,
      lastReport: report,
      statusMessage: `Backlog Review Report generated (${report.openCount} open/in-review; ${report.criticalHighCount} critical/high).`,
    };
    this.safetyGate.log(
      "success",
      "Backlog report generated",
      report.suggestedFocus,
    );
    return this.getState();
  }

  recordReportCopied(): BacklogState {
    if (!this.state.lastReport) {
      this.state = {
        ...this.state,
        statusMessage: "Generate a Backlog Review Report first.",
      };
      this.safetyGate.log(
        "warning",
        "Backlog report copy blocked",
        "No backlog report generated yet.",
      );
      return this.getState();
    }
    this.safetyGate.log(
      "info",
      "Backlog report copied",
      "Backlog Review Report copied to clipboard.",
    );
    this.state = {
      ...this.state,
      statusMessage: "Backlog Review Report copied to clipboard.",
    };
    return this.getState();
  }

  formatItemForCopy(item: BacklogItem): string {
    return [
      `# ${item.title}`,
      "",
      `- Type: ${item.type}`,
      `- Priority: ${item.priority}`,
      `- Status: ${item.status}`,
      `- Project: ${item.projectName ?? "(none)"}`,
      `- Stage/version: ${item.relatedStage ?? "(none)"}`,
      `- Created: ${item.createdAt}`,
      `- Updated: ${item.updatedAt}`,
      item.hasRiskySuggestions
        ? `- Risk warnings: ${item.riskyPhrases.join(", ")}`
        : "- Risk warnings: none",
      "",
      "## Notes",
      "",
      item.notes || "(empty)",
      "",
    ].join("\n");
  }

  previewNotes(notes: string): string {
    if (notes.length <= MAX_PREVIEW_CHARS) return notes;
    return `${notes.slice(0, MAX_PREVIEW_CHARS)}\n…`;
  }
}
