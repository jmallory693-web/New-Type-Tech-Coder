import type {
  SpeakerScriptRecord,
  SpeakerScriptRole,
  SpeakerScriptState,
  SpeakerScriptTone,
} from "../../shared/types";
import { SPEAKER_ROLE_LABELS, SPEAKER_TONE_LABELS } from "../../shared/buildSpeakerScript";
import type { SafetyGate } from "../safety/SafetyGate";

const VALID_ROLES: SpeakerScriptRole[] = [
  "project-foreman",
  "safety-officer",
  "review-narrator",
  "builder-liaison",
  "release-announcer",
];

const VALID_TONES: SpeakerScriptTone[] = [
  "plain",
  "brief",
  "detailed",
  "youtube-style",
  "safety-focused",
];

export class SpeakerScriptManager {
  private role: SpeakerScriptRole = "project-foreman";
  private tone: SpeakerScriptTone = "plain";
  private saved: SpeakerScriptRecord | null = null;
  private statusMessage: string | null =
    "Choose a Speaker role and tone, then Generate Speaker Script (text-only).";

  constructor(private readonly safetyGate: SafetyGate) {}

  getState(): SpeakerScriptState {
    return {
      role: this.role,
      tone: this.tone,
      saved: this.saved,
      statusMessage: this.statusMessage,
    };
  }

  getSaved(): SpeakerScriptRecord | null {
    return this.saved;
  }

  getRole(): SpeakerScriptRole {
    return this.role;
  }

  getTone(): SpeakerScriptTone {
    return this.tone;
  }

  setRole(role: unknown): void {
    if (typeof role !== "string" || !VALID_ROLES.includes(role as SpeakerScriptRole)) {
      this.safetyGate.log(
        "warning",
        "Speaker role change blocked",
        "Unknown speaker role.",
      );
      return;
    }
    this.role = role as SpeakerScriptRole;
    this.safetyGate.log(
      "info",
      "Speaker role changed",
      SPEAKER_ROLE_LABELS[this.role],
    );
  }

  setTone(tone: unknown): void {
    if (typeof tone !== "string" || !VALID_TONES.includes(tone as SpeakerScriptTone)) {
      this.safetyGate.log(
        "warning",
        "Speaker tone change blocked",
        "Unknown speaker tone.",
      );
      return;
    }
    this.tone = tone as SpeakerScriptTone;
    this.safetyGate.log(
      "info",
      "Speaker tone changed",
      SPEAKER_TONE_LABELS[this.tone],
    );
  }

  setSaved(record: SpeakerScriptRecord | null, statusMessage?: string): void {
    this.saved = record;
    if (statusMessage !== undefined) {
      this.statusMessage = statusMessage;
    }
  }

  restoreSaved(record: SpeakerScriptRecord | null): void {
    if (!record || typeof record !== "object") return;
    this.saved = record;
    if (VALID_ROLES.includes(record.role)) {
      this.role = record.role;
    }
    if (VALID_TONES.includes(record.tone)) {
      this.tone = record.tone;
    }
    this.statusMessage = `Previous Speaker Script restored (${record.roleLabel}, ${record.toneLabel}).`;
  }

  clearForProjectChange(): void {
    this.saved = null;
    this.statusMessage =
      "Choose a Speaker role and tone, then Generate Speaker Script (text-only).";
  }

  recordCopy(): void {
    if (!this.saved) {
      this.safetyGate.log(
        "warning",
        "Speaker script copy blocked",
        "Generate a Speaker Script first.",
      );
      this.statusMessage = "Generate a Speaker Script before copying.";
      return;
    }
    this.safetyGate.log(
      "success",
      "Speaker script copied",
      `${this.saved.roleLabel} / ${this.saved.toneLabel}.`,
    );
    this.statusMessage = "Speaker Script copied to clipboard.";
  }
}
