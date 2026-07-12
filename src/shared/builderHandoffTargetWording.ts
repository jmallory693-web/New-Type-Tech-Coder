/** Stage 73: target-specific handoff wording (text-only; no automation). */

import type { BuilderHandoffTarget } from "./types";

export function getBuilderHandoffTargetLabel(target: BuilderHandoffTarget): string {
  switch (target) {
    case "cursor":
      return "Cursor";
    case "codex":
      return "Codex";
    case "claude":
      return "Claude";
    case "chatgpt":
      return "ChatGPT";
    case "grok":
      return "Grok";
    case "qwen":
      return "Qwen";
    case "human-programmer":
      return "Human programmer";
    default:
      return "Generic builder";
  }
}

export function getBuilderHandoffTargetNotes(target: BuilderHandoffTarget): string[] {
  switch (target) {
    case "cursor":
      return [
        "Keep edits scoped and file-by-file.",
        "Do not run broad refactors.",
        "Report changed files explicitly.",
      ];
    case "codex":
      return [
        "Return a patch plan and validation steps.",
        "Avoid unrelated cleanup or drive-by refactors.",
      ];
    case "claude":
    case "chatgpt":
    case "grok":
    case "qwen":
      return [
        "Review and plan before implementation.",
        "Do not assume hidden file access to the project.",
        "Ask for missing context if needed.",
      ];
    case "human-programmer":
      return ["Use this pack as a review checklist before touching code."];
    default:
      return [
        "Treat this as a planning and implementation brief only.",
        "Stay within the listed scope and safety boundaries.",
      ];
  }
}
