import type {
  ImportedPatchDraftRecord,
  PatchDraftRecord,
  PatchDraftSafetyReviewTargetKind,
} from "../../shared/types";

/** Adapts an imported patch draft for rule-based safety review (no AI). */
export function importedRecordToPatchDraftRecord(
  record: ImportedPatchDraftRecord,
): PatchDraftRecord {
  return {
    id: record.id,
    generatedAt: record.importedAt,
    modelName: `Imported: ${record.source}`,
    providerType: "ollama-compatible",
    baseUrl: "",
    roleMode: record.draftType,
    mappingKey: "patch-draft",
    userQuestion: record.userQuestion,
    contextPackGeneratedAt: record.contextAtImport.codeContextPackExisted
      ? "at-import"
      : "",
    selectedFileCount: record.likelyFilesAreas.length,
    warningCount: record.riskPhraseCount,
    truncated: record.truncatedImport,
    draftText: record.draftText,
    previewExcerpt: record.previewExcerpt,
    recommendation:
      record.riskPhraseCount > 0
        ? "Review imported draft risk phrases before proceeding"
        : null,
    promptCharCount: 0,
    truncatedResponse: record.truncatedImport,
    includeCodeAiResponseExcerpt: false,
    includeBuilderPlanDecisionExcerpt: false,
    includeImplementationReviewExcerpt: false,
  };
}

export function buildReviewTargetLabel(
  kind: PatchDraftSafetyReviewTargetKind,
  imported?: ImportedPatchDraftRecord | null,
  nttcModel?: string | null,
): string {
  if (kind === "imported-patch-draft" && imported) {
    return `Imported Patch Draft from ${imported.source}`;
  }
  if (kind === "nttc-patch-draft") {
    return nttcModel ? `NTTC Patch Draft (${nttcModel})` : "NTTC Patch Draft";
  }
  return kind === "imported-patch-draft"
    ? "Imported Patch Draft"
    : "NTTC Patch Draft";
}
