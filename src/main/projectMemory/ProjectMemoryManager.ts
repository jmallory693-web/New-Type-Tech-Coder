import fs from "node:fs";
import path from "node:path";
import type {
  ProjectMemoryPreview,
  ProjectMemorySavedRecord,
  ProjectMemoryState,
} from "../../shared/types";
import { PROJECT_MEMORY_SAFETY_NOTE } from "../../shared/projectMemoryConstants";
import type { SafetyGate } from "../safety/SafetyGate";
import {
  buildProjectMemoryPreview,
  type ProjectMemoryInput,
} from "./buildProjectMemoryFiles";

export class ProjectMemoryManager {
  private preview: ProjectMemoryPreview | null = null;
  private lastSaved: ProjectMemorySavedRecord | null = null;
  private busy = false;
  private statusMessage: string | null =
    "Generate a Project Memory preview, review it, then save markdown files to `.nttc/` only.";
  private pendingOverwriteFiles: string[] = [];
  private saveBlockedReason: string | null = null;

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): ProjectMemoryState {
    return {
      preview: this.preview,
      lastSaved: this.lastSaved,
      statusMessage: this.statusMessage,
      busy: this.busy,
      pendingOverwriteFiles: [...this.pendingOverwriteFiles],
      saveBlockedReason: this.saveBlockedReason,
    };
  }

  getPreview(): ProjectMemoryPreview | null {
    return this.preview;
  }

  getLastSaved(): ProjectMemorySavedRecord | null {
    return this.lastSaved;
  }

  generatePreview(input: ProjectMemoryInput): ProjectMemoryPreview {
    this.preview = buildProjectMemoryPreview(input);
    this.pendingOverwriteFiles = this.listExistingApprovedFiles();
    this.saveBlockedReason = this.computeSaveBlockedReason();
    this.statusMessage = this.preview.projectSelected
      ? `Project Memory preview generated (${this.preview.files.length} files). Review before saving to \`.nttc/\`.`
      : "Preview generated without a selected project — save is disabled until a project is selected.";
    this.safetyGate.log(
      "success",
      "Project memory preview generated",
      `${this.preview.files.length} markdown files; truncation flags: ${this.preview.truncationFlags.length}`,
    );
    return this.preview;
  }

  restoreFromHistory(
    preview: ProjectMemoryPreview | null,
    lastSaved: ProjectMemorySavedRecord | null,
  ): void {
    this.preview = preview;
    this.lastSaved = lastSaved;
    this.pendingOverwriteFiles = this.listExistingApprovedFiles();
    this.saveBlockedReason = this.computeSaveBlockedReason();
    if (lastSaved) {
      this.statusMessage = `Previous Project Memory save restored (${lastSaved.savedAt}). Files: ${lastSaved.filesWritten.join(", ")}.`;
    } else if (preview) {
      this.statusMessage =
        "Previous Project Memory preview restored from history. Re-generate to refresh content.";
    }
  }

  clearForProjectChange(): void {
    this.preview = null;
    this.lastSaved = null;
    this.pendingOverwriteFiles = [];
    this.saveBlockedReason = null;
    this.busy = false;
    this.statusMessage =
      "Generate a Project Memory preview, review it, then save markdown files to `.nttc/` only.";
  }

  recordCopyBundle(): void {
    if (!this.preview?.bundleMarkdown) {
      this.safetyGate.log(
        "warning",
        "Project memory copy blocked",
        "Generate a Project Memory preview first.",
      );
      return;
    }
    this.safetyGate.log(
      "success",
      "Project memory copy recorded",
      "Copy Project Memory Bundle was requested from the UI.",
    );
  }

  saveFiles(confirmOverwrite: boolean): {
    ok: boolean;
    message: string;
    needsOverwriteConfirmation?: boolean;
    filesWritten?: string[];
  } {
    if (!this.preview) {
      const message = "Generate a Project Memory preview before saving.";
      this.statusMessage = message;
      this.safetyGate.log("warning", "Project memory save failed", message);
      return { ok: false, message };
    }

    if (!this.safetyGate.getProject()) {
      const message = "Select a project folder before saving Project Memory files.";
      this.saveBlockedReason = message;
      this.statusMessage = message;
      this.safetyGate.log("blocked", "Project memory save refused", message);
      return { ok: false, message };
    }

    const blocked = this.computeSaveBlockedReason();
    if (blocked) {
      this.saveBlockedReason = blocked;
      this.statusMessage = blocked;
      this.safetyGate.log("blocked", "Project memory save refused", blocked);
      return { ok: false, message: blocked };
    }

    this.pendingOverwriteFiles = this.listExistingApprovedFiles();
    if (this.pendingOverwriteFiles.length > 0 && !confirmOverwrite) {
      this.safetyGate.log(
        "info",
        "Project memory overwrite confirmation shown",
        this.pendingOverwriteFiles.join(", "),
      );
      this.statusMessage =
        "Some `.nttc/` files already exist. Confirm overwrite before saving.";
      return {
        ok: false,
        message:
          "Existing `.nttc/` files need overwrite confirmation before saving.",
        needsOverwriteConfirmation: true,
      };
    }

    this.safetyGate.log(
      "info",
      "Project memory save confirmed",
      confirmOverwrite
        ? "User confirmed overwrite for existing `.nttc/` files."
        : "User confirmed first-time save to `.nttc/`.",
    );

    const dirResult = this.safetyGate.resolveProjectMemoryDirectory();
    if (!dirResult.allowed || !dirResult.dirPath) {
      const message =
        dirResult.denyReason ??
        "Could not verify a safe `.nttc/` folder inside the project.";
      this.saveBlockedReason = message;
      this.statusMessage = message;
      this.safetyGate.log("blocked", "Project memory save failed", message);
      return { ok: false, message };
    }

    this.busy = true;
    const filesWritten: string[] = [];

    try {
      if (!fs.existsSync(dirResult.dirPath)) {
        fs.mkdirSync(dirResult.dirPath, { recursive: true });
      }

      for (const file of this.preview.files) {
        const gate = this.safetyGate.checkProjectMemoryWrite(file.fileName);
        if (!gate.allowed || !gate.normalizedPath) {
          const message =
            gate.denyReason ??
            `Safety Gate refused write for ${file.fileName}.`;
          this.statusMessage = message;
          this.safetyGate.log(
            "blocked",
            "Project memory save failed",
            message,
          );
          return { ok: false, message };
        }

        fs.writeFileSync(gate.normalizedPath, file.content, {
          encoding: "utf8",
          flag: "w",
        });
        filesWritten.push(file.fileName);
      }

      const savedAt = new Date().toISOString();
      this.lastSaved = {
        savedAt,
        filesWritten,
        overwriteConfirmed: confirmOverwrite,
        truncationFlags: [...this.preview.truncationFlags],
        generatedAt: this.preview.generatedAt,
      };
      this.pendingOverwriteFiles = [];
      this.saveBlockedReason = null;
      this.statusMessage = `Saved ${filesWritten.length} markdown files to \`.nttc/\`. ${PROJECT_MEMORY_SAFETY_NOTE}`;
      this.safetyGate.log(
        "success",
        "Project memory save succeeded",
        filesWritten.join(", "),
      );
      return { ok: true, message: this.statusMessage, filesWritten };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save Project Memory files.";
      this.statusMessage = `Save failed: ${message}`;
      this.safetyGate.log("warning", "Project memory save failed", message);
      return { ok: false, message: this.statusMessage };
    } finally {
      this.busy = false;
    }
  }

  private computeSaveBlockedReason(): string | null {
    if (!this.safetyGate.getProject()) {
      return "Select a project folder before saving.";
    }
    const dirResult = this.safetyGate.resolveProjectMemoryDirectory();
    if (!dirResult.allowed) {
      return dirResult.denyReason ?? "`.nttc/` path safety check failed.";
    }
    return null;
  }

  private listExistingApprovedFiles(): string[] {
    const dirResult = this.safetyGate.resolveProjectMemoryDirectory();
    if (!dirResult.allowed || !dirResult.dirPath) return [];
    if (!fs.existsSync(dirResult.dirPath)) return [];

    const existing: string[] = [];
    for (const file of this.preview?.files ?? []) {
      const gate = this.safetyGate.checkProjectMemoryWrite(file.fileName);
      if (gate.allowed && gate.normalizedPath && fs.existsSync(gate.normalizedPath)) {
        existing.push(file.fileName);
      }
    }
    return existing;
  }
}
