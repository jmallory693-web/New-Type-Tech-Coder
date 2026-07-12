/** Stage 73: Builder Handoff Export UI copy. */

export const BUILDER_HANDOFF_EXPORT_TITLE = "NTTC Builder Handoff Pack";

export const BUILDER_HANDOFF_EXPORT_PURPOSE =
  "Create a safe builder handoff from the current patch draft, imported draft, safety review, comparison report, planning style, and validation requirements.";

export const BUILDER_HANDOFF_EXPORT_NO_INPUTS_MESSAGE =
  "Create a patch draft, imported draft, safety review, or comparison before generating a handoff.";

export const BUILDER_HANDOFF_EXPORT_SAFETY_REMINDER =
  "NTTC has not applied any patch. This handoff is text-only.";

export const BUILDER_HANDOFF_TARGET_OPTIONS = [
  { id: "generic-builder" as const, label: "Generic builder" },
  { id: "cursor" as const, label: "Cursor" },
  { id: "codex" as const, label: "Codex" },
  { id: "claude" as const, label: "Claude" },
  { id: "chatgpt" as const, label: "ChatGPT" },
  { id: "grok" as const, label: "Grok" },
  { id: "qwen" as const, label: "Qwen" },
  { id: "human-programmer" as const, label: "Human programmer" },
];

export const BUILDER_HANDOFF_STRICTNESS_OPTIONS = [
  { id: "conservative" as const, label: "Conservative" },
  { id: "normal" as const, label: "Normal" },
  { id: "fast-small-patch" as const, label: "Fast small patch" },
];

export const DEFAULT_BUILDER_HANDOFF_TARGET = "generic-builder" as const;
export const DEFAULT_BUILDER_HANDOFF_STRICTNESS = "conservative" as const;
