/**
 * Stage 78: built-in Quick Start Guide text (static; no project reads, no AI).
 */

import { PROJECT_MEMORY_FILE_NAMES } from "./projectMemoryConstants";

export interface QuickStartGuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  numbered?: string[];
}

export const QUICK_START_GUIDE_TITLE = "NTTC Quick Start Guide";

export const QUICK_START_GUIDE_SECTIONS: QuickStartGuideSection[] = [
  {
    id: "what-nttc-is",
    title: "What NTTC is",
    paragraphs: [
      "New Type Tech Coder is a safe AI coding supervisor. It helps you collect code context, ask local AI for advice, compare patch ideas, safety-review drafts, and create builder handoff prompts.",
      "NTTC is designed for non-coders and cautious developers who want a calm, inspect-only control panel — not an IDE that edits your project automatically.",
    ],
  },
  {
    id: "what-nttc-is-not",
    title: "What NTTC is not",
    paragraphs: ["NTTC will never silently change your project. Remember:"],
    bullets: [
      "NTTC is not an IDE.",
      "NTTC does not edit your source files.",
      "NTTC does not apply patches.",
      "NTTC does not run arbitrary terminal commands.",
      "NTTC does not let AI browse your project invisibly.",
      "NTTC does not enable Live Qwen.",
      "NTTC does not send project data unless you explicitly use an AI workflow (with confirmation).",
      "Project Memory export only writes `.nttc/*.md` files after explicit user action.",
    ],
  },
  {
    id: "safe-workflow",
    title: "Recommended safe workflow",
    paragraphs: ["Follow this order when planning a change:"],
    numbered: [
      "Open a disposable or backed-up project.",
      "Create or verify Safety Backup.",
      "Build a Code Context Pack (preview/copy only).",
      "Ask Local AI about selected code, if Ollama is active.",
      "Generate a Patch Draft, if useful (draft only — no apply).",
      "Import outside patch drafts from Cursor, Claude, ChatGPT, Grok, Codex, or similar.",
      "Run Patch Draft Safety Review.",
      "Run External Patch Draft Comparison.",
      "Generate Builder Handoff Pack.",
      "Send the handoff to a builder or outside AI.",
      "Paste the builder's implementation report back into NTTC (Builder Result / Implementation Review).",
      "Run Implementation Review.",
      "Export Project Memory only if you want `.nttc/` planning notes.",
    ],
  },
  {
    id: "first-time",
    title: "First-time user path",
    paragraphs: ["If you are new to NTTC, start here:"],
    bullets: [
      "Start with a disposable copy of a project — not your only live copy.",
      "Look for the Inspect-only badge in the header.",
      "Check the Ollama bubble (Active vs Offline).",
      "Use Workflow Progress on the Reports tab to see what is done and what is next.",
      "Do not skip Safety Backup before risky planning work.",
      "Do not trust a patch draft until Safety Review and Comparison are done.",
      "Use Recommended Next Step on the Dashboard when unsure.",
      "Building a new app from scratch? Use the Blueprint tab to plan before any code exists.",
      "Blueprint tab optional Ask Local Planner AI drafts a blueprint from idea fields only (no project file reads).",
      "After saving a blueprint, generate Phase Task Cards to break Phase 1 into small builder-ready packets (planning text only).",
      "Select one task card and generate a Task Builder Handoff to copy to Cursor, Claude, or a human builder — one task at a time.",
      "Build Mode starts with Safe Scaffold Mode. It will only create files in a confirmed empty folder after previews and confirmation. Current Build tab is planning-only and does not write files.",
      "Target folder safety checks are metadata-only. NTTC checks whether a future scaffold target appears empty/safe, but this stage still does not create files.",
      "Safe Scaffold File Tree Preview shows proposed relative file paths only. It does not generate contents or create files.",
    ],
  },
  {
    id: "ollama",
    title: "Ollama / local AI",
    paragraphs: [
      "The Ollama status bubble in the header shows whether local models are reachable — it does not enable Live Qwen.",
    ],
    bullets: [
      "Green / Active: local Ollama models are reachable. You may use Ask Local AI or Patch Draft after confirmation.",
      "Red / Offline or Error: Ollama is not reachable. Skip live AI steps; use manual import and rule-based reports.",
      "Ollama Active does not mean Live Qwen is enabled — Live Qwen inspect stays disabled for safety.",
      "Local AI only receives the approved Code Context Pack or Patch Draft context after you confirm.",
      "Slow local models may take 1–2+ minutes. Use Fast Draft Setup to reduce context size.",
      "Configure models on Settings / Advanced (Role Model Mapping).",
    ],
  },
  {
    id: "outside-ai",
    title: "Outside AI workflow (Cursor, Codex, Claude, ChatGPT, Grok, Qwen, human programmer)",
    paragraphs: [
      "NTTC prepares text handoffs; outside tools do the implementation. You stay in control.",
    ],
    numbered: [
      "Complete Safety Review and Comparison when possible.",
      "Generate Builder Handoff Pack and choose a builder target (Cursor, Claude, ChatGPT, Grok, Codex, Qwen, human programmer, or generic).",
      "Copy the handoff pack and paste it into the outside builder.",
      "Let the builder produce a plan or implementation — outside NTTC.",
      "Paste returned patch drafts into Manual Patch Draft Import.",
      "Paste implementation summaries into Builder Result, then run Implementation Review.",
      "Run Safety Review and Comparison again before sending another handoff.",
    ],
  },
  {
    id: "safety-warnings",
    title: "Safety warnings",
    bullets: [
      "Never paste real secrets (API keys, passwords, tokens) into imported drafts.",
      "Do not ignore high-risk phrase warnings on imported text.",
      "Do not proceed when Safety Review says Do not proceed yet.",
      "Do not skip Safety Backup before risky work.",
      "Do not assume NTTC applied anything — it did not.",
      "Do not assume AI responses are correct — treat them as proposals.",
      "Treat all patch drafts as proposals only.",
      "Do not use Build/Test Checks as permission to bypass review.",
    ],
    paragraphs: [],
  },
  {
    id: "recommendations",
    title: "Understanding recommendations",
    paragraphs: [
      "NTTC uses rule-based guidance from stored reports — not hidden AI reasoning.",
    ],
    bullets: [
      "Recommended Next Step (Dashboard): what to do next and why, plus Expected Result.",
      "Workflow Progress (Reports): checklist of completed, current, blocked, and pending steps.",
      "Workflow Health: Green / Yellow / Red summary of backup, review, comparison, and handoff state.",
      "Handoff Readiness: Not Ready, Planning Only, Review Ready, or Implementation Ready.",
      "Blocked Reason card: plain-English blockers when something cannot proceed safely.",
      "Patch Draft Safety Review recommendation: rule-based review of draft text before outside handoff.",
      "External Patch Draft Comparison risk: agreement, conflicts, and blocked/high-risk levels.",
      "Builder Handoff recommendation: e.g. Do not send yet, Send only for planning, Send to builder for narrow implementation.",
    ],
  },
  {
    id: "files-written",
    title: "What files NTTC may write",
    paragraphs: [
      "Only explicit Project Memory export writes markdown inside your project folder. Safety Backup may create a labeled local git checkpoint or app-managed backup — never a silent source edit.",
    ],
    bullets: PROJECT_MEMORY_FILE_NAMES.map((f) => `.nttc/${f}`),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    bullets: [
      "Ollama Offline: start Ollama, check Settings base URL, use Test Connection. Continue with manual import if needed.",
      "Patch Draft timeout: use Fast Draft Setup (one small file, ~25 lines) and retry.",
      "Reports feel crowded: collapse completed sections; open Guide tab for the full workflow.",
      "Safety Review says Do not proceed yet: fix draft text or get a narrower outside plan.",
      "Comparison says Blocked: resolve conflicts between NTTC and imported drafts.",
      "Builder Handoff says Do not send yet: complete backup, review, and comparison first.",
      "Build/Test Checks not run: optional allowlisted checks on Safety tab — none auto-run.",
      "Git branch says unknown in backup summary: cosmetic; backup may still work if verified.",
      "OneDrive file locking or packaging EBUSY: close running NTTC before rebuilding the packaged app.",
    ],
    paragraphs: [],
  },
];

/** Concise markdown for Copy Quick Start Guide (static text only). */
export function buildQuickStartGuideMarkdown(): string {
  const lines: string[] = [
    `# ${QUICK_START_GUIDE_TITLE}`,
    "",
    "> Inspect-only. NTTC does not edit source files or apply patches.",
    "",
  ];

  for (const section of QUICK_START_GUIDE_SECTIONS) {
    lines.push(`## ${section.title}`, "");
    for (const p of section.paragraphs) {
      if (p.trim()) lines.push(p, "");
    }
    if (section.numbered?.length) {
      section.numbered.forEach((item, i) => {
        lines.push(`${i + 1}. ${item}`);
      });
      lines.push("");
    }
    if (section.bullets?.length) {
      for (const b of section.bullets) {
        lines.push(`- ${b}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "---",
    "Safety reminder: NTTC has not applied any patch. All drafts are proposals.",
  );
  return lines.join("\n").trim() + "\n";
}
