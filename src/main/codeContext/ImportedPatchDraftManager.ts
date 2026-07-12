import {
  IMPORTED_PATCH_DRAFT_SOURCES,
  IMPORTED_PATCH_DRAFT_TYPES,
} from "../../shared/importedPatchDraftConstants";
import { scanImportedPatchDraftText } from "../../shared/scanImportedPatchDraft";
import type {
  ImportedPatchDraftContextSnapshot,
  ImportedPatchDraftRecord,
  ImportedPatchDraftSource,
  ImportedPatchDraftState,
  ImportedPatchDraftType,
} from "../../shared/types";
import type { SafetyGate } from "../safety/SafetyGate";

const MAX_DRAFT_CHARS = 80_000;
const MAX_SAVED_CHARS = 40_000;
const MAX_PREVIEW_CHARS = 900;

function makeId(): string {
  return `imported-patch-draft-${Date.now().toString(36)}`;
}

function isSource(value: unknown): value is ImportedPatchDraftSource {
  return (
    typeof value === "string" &&
    (IMPORTED_PATCH_DRAFT_SOURCES as string[]).includes(value)
  );
}

function isDraftType(value: unknown): value is ImportedPatchDraftType {
  return (
    typeof value === "string" &&
    (IMPORTED_PATCH_DRAFT_TYPES as string[]).includes(value)
  );
}

/** Stage 67: manual outside patch draft import (text only; no apply; no AI). */
export class ImportedPatchDraftManager {
  private source: ImportedPatchDraftSource = "Cursor";
  private draftType: ImportedPatchDraftType = "Patch draft";
  private draftText = "";
  private saved: ImportedPatchDraftRecord | null = null;
  private statusMessage: string | null =
    "Paste an outside patch draft here. NTTC will not apply it.";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): ImportedPatchDraftState {
    return {
      source: this.source,
      draftType: this.draftType,
      draftText: this.draftText,
      saved: this.saved,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): ImportedPatchDraftRecord | null {
    return this.saved;
  }

  setSource(source: unknown): void {
    if (isSource(source)) this.source = source;
  }

  setDraftType(draftType: unknown): void {
    if (isDraftType(draftType)) this.draftType = draftType;
  }

  setDraft(text: unknown): void {
    if (typeof text !== "string") return;
    this.draftText =
      text.length > MAX_DRAFT_CHARS
        ? text.slice(0, MAX_DRAFT_CHARS)
        : text;
  }

  saveImported(input: {
    userQuestion: string;
    contextAtImport: ImportedPatchDraftContextSnapshot;
    allowSecretOverride?: boolean;
  }):
    | { ok: true; record: ImportedPatchDraftRecord }
    | { ok: false; message: string; scan: ReturnType<typeof scanImportedPatchDraftText> } {
    const trimmed = this.draftText.trim();
    if (!trimmed) {
      this.statusMessage = "Paste an imported patch draft before saving.";
      return {
        ok: false,
        message: this.statusMessage,
        scan: scanImportedPatchDraftText(""),
      };
    }

    const scan = scanImportedPatchDraftText(trimmed);
    if (scan.blockedBySecrets && !input.allowSecretOverride) {
      this.safetyGate.log(
        "blocked",
        "Imported patch draft possible secret detected",
        `Blocked save: ${scan.possibleSecrets.length} secret-like pattern(s). Remove secrets before saving.`,
      );
      this.statusMessage =
        "Possible secret detected in pasted text. Remove secret-like content before saving an imported patch draft.";
      return { ok: false, message: this.statusMessage, scan };
    }

    if (scan.riskPhrases.length > 0) {
      this.safetyGate.log(
        "warning",
        "Imported patch draft risk phrases detected",
        scan.riskPhrases.join(", "),
      );
    }

    const truncatedImport = trimmed.length > MAX_SAVED_CHARS;
    const draftText = truncatedImport
      ? `${trimmed.slice(0, MAX_SAVED_CHARS - 1)}…`
      : trimmed;
    const previewExcerpt =
      draftText.length > MAX_PREVIEW_CHARS
        ? `${draftText.slice(0, MAX_PREVIEW_CHARS - 1)}…`
        : draftText;

    const record: ImportedPatchDraftRecord = {
      id: makeId(),
      importedAt: new Date().toISOString(),
      source: this.source,
      draftType: this.draftType,
      userQuestion: input.userQuestion.trim().slice(0, 4000),
      draftText,
      previewExcerpt,
      riskPhrases: scan.riskPhrases,
      likelyFilesAreas: scan.likelyFilesAreas,
      riskPhraseCount: scan.riskPhrases.length,
      truncatedImport,
      contextAtImport: input.contextAtImport,
    };

    this.saved = record;
    this.statusMessage = `Imported Patch Draft saved (${record.source} · ${record.draftType}). Draft only — NTTC did not apply it.`;
    this.safetyGate.log(
      "success",
      "Imported patch draft saved",
      `${record.source} · ${record.draftType} · ${draftText.length} chars · ${record.riskPhraseCount} risk phrase(s).`,
    );
    return { ok: true, record };
  }

  clearImported(): void {
    this.saved = null;
    this.statusMessage =
      "Imported Patch Draft cleared. Paste a new outside draft when ready.";
    this.safetyGate.log("info", "Imported patch draft cleared", "Saved import removed.");
  }

  clearDraftBuffer(): void {
    this.draftText = "";
    this.statusMessage = "Import draft textarea cleared.";
  }

  restoreSaved(record: ImportedPatchDraftRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    this.source = isSource(record.source) ? record.source : "Other";
    this.draftType = isDraftType(record.draftType) ? record.draftType : "Unknown";
    this.statusMessage = `Previous Imported Patch Draft restored (${record.source}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.draftText = "";
    this.source = "Cursor";
    this.draftType = "Patch draft";
    this.statusMessage =
      "Paste an outside patch draft here. NTTC will not apply it.";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Imported patch draft copy blocked",
        "Save an Imported Patch Draft first.",
      );
      this.statusMessage = "Save an Imported Patch Draft before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Imported patch draft copied",
      `${this.saved.source} · ${this.saved.draftType}.`,
    );
    this.statusMessage = "Imported Patch Draft copied to clipboard.";
  }
}
