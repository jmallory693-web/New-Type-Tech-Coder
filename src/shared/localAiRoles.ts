import type { LocalAiRoleId } from "./types";

export interface RoleHelpContent {
  title: string;
  purpose: string;
  bestUsedWhen: string;
  produces: string;
  doesNotDo: string;
  recommendedModel: string;
}

export const ROLE_HELP_SAFETY_REMINDER =
  "This role changes advice style only. It does not give the model file access, edit access, or command access.";

/** Local AI roles plus Builder Plan Mode and Code Context review (mapping-only, not Local AI Role ids). */
export type RoleHelpKey =
  | LocalAiRoleId
  | "builder-plan-mode"
  | "blueprint-planner"
  | "code-context-review"
  | "patch-draft";

export interface LocalAiRoleDefinition {
  id: LocalAiRoleId;
  label: string;
  category: "reviewer-builder" | "speaker-style" | "general";
  shortDescription: string;
  /** Clarifies speaker-style Ollama roles are not official app status. */
  disclaimer?: string;
  requestedOutput: string[];
  help: RoleHelpContent;
}

export const LOCAL_AI_ROLE_IDS: LocalAiRoleId[] = [
  "general-reviewer",
  "architect-planner",
  "bug-risk-reviewer",
  "patch-planner",
  "test-planner",
  "ux-reviewer",
  "safety-reviewer",
  "project-foreman",
  "safety-officer",
  "review-narrator",
  "builder-liaison",
  "release-announcer",
];

export const LOCAL_AI_ROLES: Record<LocalAiRoleId, LocalAiRoleDefinition> = {
  "general-reviewer": {
    id: "general-reviewer",
    label: "General Reviewer",
    category: "general",
    shortDescription:
      "Balanced inspect-only review: summary, risks, missing info, and next step.",
    requestedOutput: [
      "Summary",
      "Risks",
      "Missing information",
      "Suggested next step",
      "Do-not-build-yet warnings",
    ],
    help: {
      title: "General Reviewer",
      purpose: "General safe review of the project state.",
      bestUsedWhen:
        "The user wants broad advice and does not know which specialist to ask.",
      produces: "Summary, risks, missing information, suggested next step.",
      doesNotDo: "Edit files, run commands, inspect raw source.",
      recommendedModel: "General reasoning model.",
    },
  },
  "architect-planner": {
    id: "architect-planner",
    label: "Architect Planner",
    category: "reviewer-builder",
    shortDescription:
      "Turn the user goal into a safe, small plan-only architecture outline.",
    requestedOutput: [
      "Goal understanding",
      "Proposed safe plan",
      "Files likely to change",
      "Architecture risks",
      "Questions before implementation",
      "Test/check plan",
      "Do-not-do list",
    ],
    help: {
      title: "Architect Planner",
      purpose: "High-level structure and system planning.",
      bestUsedWhen:
        "The user is deciding how a feature should fit into the app.",
      produces:
        "Plan, likely files/areas, architecture risks, questions, test plan.",
      doesNotDo: "Write code or patches.",
      recommendedModel: "General reasoning or architecture-capable model.",
    },
  },
  "bug-risk-reviewer": {
    id: "bug-risk-reviewer",
    label: "Bug Risk Reviewer",
    category: "reviewer-builder",
    shortDescription:
      "Find likely bugs and fragile areas from summaries and reports only.",
    requestedOutput: [
      "Likely bug risks",
      "Fragile areas",
      "Missing checks/tests",
      "High-priority review targets",
      "Suggested next review questions",
    ],
    help: {
      title: "Bug Risk Reviewer",
      purpose: "Find likely breakage points and fragile areas.",
      bestUsedWhen: "A change might introduce bugs or regressions.",
      produces:
        "Bug risks, fragile areas, missing checks/tests, review targets.",
      doesNotDo: "Run tests or inspect raw files.",
      recommendedModel: "Coder/reviewer model.",
    },
  },
  "patch-planner": {
    id: "patch-planner",
    label: "Patch Planner",
    category: "reviewer-builder",
    shortDescription:
      "Convert evidence into a small plan-only patch plan for an outside builder.",
    requestedOutput: [
      "Small patch plan",
      "Files likely to change",
      "Order of operations",
      "Risk controls",
      "Validation checklist",
      "Plan-only builder prompt",
    ],
    help: {
      title: "Patch Planner",
      purpose: "Plan a small safe implementation patch.",
      bestUsedWhen:
        "The user wants Cursor/Codex/Grok/Claude to make a focused change.",
      produces:
        "Small patch plan, likely files, order of operations, risk controls, validation checklist.",
      doesNotDo: "Create or apply the patch.",
      recommendedModel: "Coder model.",
    },
  },
  "test-planner": {
    id: "test-planner",
    label: "Test Planner",
    category: "reviewer-builder",
    shortDescription:
      "Suggest safe checks and manual tests after changes (user still confirms runs).",
    requestedOutput: [
      "Safe checks to run",
      "Manual test steps",
      "Regression risks",
      "Missing tests",
      "What failure would mean",
    ],
    help: {
      title: "Test Planner",
      purpose: "Decide what checks and manual tests should be run.",
      bestUsedWhen: "The user needs validation steps after a change.",
      produces:
        "Safe checks, manual test steps, regression risks, missing tests.",
      doesNotDo: "Run commands automatically.",
      recommendedModel: "Coder/reviewer model.",
    },
  },
  "ux-reviewer": {
    id: "ux-reviewer",
    label: "UX Reviewer",
    category: "reviewer-builder",
    shortDescription:
      "Review non-coder usability from reports and typed goals — not by reading UI source.",
    requestedOutput: [
      "Non-coder usability issues",
      "Confusing labels",
      "Layout concerns",
      "Workflow improvements",
      "Recommended UI changes",
    ],
    help: {
      title: "UX Reviewer",
      purpose: "Review usability for a non-coder user.",
      bestUsedWhen:
        "The app feels crowded, confusing, or hard to operate.",
      produces:
        "Label issues, layout concerns, workflow improvements, UI recommendations.",
      doesNotDo: "Change UI by itself.",
      recommendedModel: "General reasoning model.",
    },
  },
  "safety-reviewer": {
    id: "safety-reviewer",
    label: "Safety Reviewer",
    category: "reviewer-builder",
    shortDescription:
      "Go/no-go review of whether a plan weakens inspect-only safety boundaries.",
    requestedOutput: [
      "Go/no-go",
      "Safety risks",
      "Boundary violations",
      "Required mitigations",
      "What not to build yet",
    ],
    help: {
      title: "Safety Reviewer",
      purpose:
        "Check whether a proposed change violates NTTC's safety boundaries.",
      bestUsedWhen:
        "A feature might touch files, commands, editing, providers, backups, restore, or Qwen behavior.",
      produces: "Go/no-go, risks, mitigations, do-not-build-yet warnings.",
      doesNotDo: "Approve unsafe capabilities automatically.",
      recommendedModel: "Strong general reasoning/safety model.",
    },
  },
  "project-foreman": {
    id: "project-foreman",
    label: "Project Foreman",
    category: "speaker-style",
    shortDescription:
      "Local AI daily briefing style. Optional — not official app status.",
    disclaimer:
      "This is a Local AI role response, not official New Type Tech Coder safety status. Prefer Stage 34 Speaker Scripts for rule-based briefings.",
    requestedOutput: [
      "Current project state",
      "Evidence collected",
      "Recommended next action",
      "Short daily briefing",
    ],
    help: {
      title: "Project Foreman",
      purpose: "Give a daily plain-English project briefing.",
      bestUsedWhen: 'The user asks "What should I do next?"',
      produces: "Current state, evidence collected, recommended next action.",
      doesNotDo: "Override safety reports.",
      recommendedModel: "General language/reasoning model.",
    },
  },
  "safety-officer": {
    id: "safety-officer",
    label: "Safety Officer",
    category: "speaker-style",
    shortDescription:
      "Local AI safety narration. Optional — not official app safety status.",
    disclaimer:
      "This is a Local AI role response, not official New Type Tech Coder safety status. Prefer Stage 34 Safety Officer Speaker Scripts for rule-based warnings.",
    requestedOutput: [
      "Safety status",
      "Current warnings",
      "What not to do",
      "Restore/check/AI cautions",
    ],
    help: {
      title: "Safety Officer",
      purpose: "Explain current safety status and warnings.",
      bestUsedWhen:
        "The user wants to know what not to do before continuing.",
      produces: "Safety status, warnings, restore/check/AI cautions.",
      doesNotDo: "Change safety settings.",
      recommendedModel: "General reasoning/safety model.",
    },
  },
  "review-narrator": {
    id: "review-narrator",
    label: "Review Narrator",
    category: "speaker-style",
    shortDescription:
      "Local AI plain-English narration of external reviews. Optional advice only.",
    disclaimer:
      "This is a Local AI role response, not an official consensus. External reviews remain advice only.",
    requestedOutput: [
      "External review summary",
      "Agreement/disagreement",
      "Risky suggestions",
      "Plain-English review explanation",
    ],
    help: {
      title: "Review Narrator",
      purpose: "Explain outside reviews in plain English.",
      bestUsedWhen:
        "The user pasted reviews from ChatGPT/Claude/Grok/Qwen/Cursor and wants them summarized.",
      produces:
        "Agreements, disagreements, risky suggestions, review explanation.",
      doesNotDo: "Decide based on raw source.",
      recommendedModel: "General reasoning model.",
    },
  },
  "builder-liaison": {
    id: "builder-liaison",
    label: "Builder Liaison",
    category: "speaker-style",
    shortDescription:
      "Local AI guidance on what to ask Cursor/Codex/Grok/Claude next.",
    disclaimer:
      "This is a Local AI role response. Builder Prompts from Reports remain the primary plan-only paste target.",
    requestedOutput: [
      "What to ask Cursor/Codex/Grok/Claude next",
      "Whether builder result needs revision",
      "Plan-only reminder",
      "Suggested builder prompt improvements",
    ],
    help: {
      title: "Builder Liaison",
      purpose: "Help write the next prompt to an outside builder.",
      bestUsedWhen:
        "The user is coordinating Cursor/Codex/Grok/Claude.",
      produces: "Next builder request, revision instructions, plan-only reminders.",
      doesNotDo: "Implement the change itself.",
      recommendedModel: "General/coder-planning model.",
    },
  },
  "release-announcer": {
    id: "release-announcer",
    label: "Release Announcer",
    category: "speaker-style",
    shortDescription:
      "Local AI release-note style summary from metadata. Optional — not packaging truth.",
    disclaimer:
      "This is a Local AI role response, not an official release note from the packaged build.",
    requestedOutput: [
      "Version/build status",
      "Available features",
      "Known limitations",
      "Short release-style note",
    ],
    help: {
      title: "Release Announcer",
      purpose: "Summarize what the current packaged app/build includes.",
      bestUsedWhen:
        "The user wants a release note or status announcement.",
      produces:
        "Version/build status, available features, known limits, short release note.",
      doesNotDo: "Package or release the app.",
      recommendedModel: "General language model.",
    },
  },
};

export const BUILDER_PLAN_MODE_HELP: RoleHelpContent = {
  title: "Builder Plan Mode",
  purpose: "Ask a local model to create a plan for an outside builder.",
  bestUsedWhen:
    "The user wants a safer implementation plan before asking Cursor/Codex/Grok/Claude to act.",
  produces:
    "Builder plan, risks, likely files, validation steps, revised builder prompt.",
  doesNotDo:
    "Write code, create patches, edit files, run commands, or access raw source.",
  recommendedModel: "Coder/planner model.",
};

export const BLUEPRINT_PLANNER_HELP: RoleHelpContent = {
  title: "Blueprint Planner",
  purpose:
    "Draft a Project Blueprint from idea intake fields using local Ollama (Blueprint tab).",
  bestUsedWhen:
    "The user is building from an idea and wants a structured planning document before any code exists.",
  produces:
    "Project Blueprint markdown with phases, requirements, architecture plan, and Phase 1 handoff notes.",
  doesNotDo:
    "Read project source files, write code, scaffold files, install packages, run commands, or save planning docs automatically.",
  recommendedModel:
    "Smaller/faster planning-capable 7B–8B model (e.g. qwen2.5-coder:7b). Large coder models may time out.",
};

export const CODE_CONTEXT_REVIEW_HELP: RoleHelpContent = {
  title: "Code Reviewer",
  purpose:
    "Review user-approved code excerpts from a Code Context Pack using local Ollama.",
  bestUsedWhen:
    "The user selected safe file excerpts and wants local AI to explain risks or answer a code question.",
  produces:
    "Code review, findings, risks, missing context, and recommended next steps.",
  doesNotDo:
    "Browse the project, read unselected files, edit files, run commands, or apply patches.",
  recommendedModel: "Coder/reviewer model (qwen-coder, deepseek-coder, codellama, etc.).",
};

export const PATCH_DRAFT_HELP: RoleHelpContent = {
  title: "Patch Draft",
  purpose:
    "Draft a proposed patch plan from an approved Code Context Pack using local Ollama.",
  bestUsedWhen:
    "The user wants a copyable patch-style draft for an outside builder after reviewing selected excerpts.",
  produces:
    "Patch draft, proposed files, code snippets, risks, validation steps, rollback notes, and builder prompt.",
  doesNotDo:
    "Apply patches, edit files, write source to disk, run commands, or browse unselected files.",
  recommendedModel:
    "Coder model (qwen-coder, qwen2.5-coder, deepseek-coder, codellama, etc.).",
};

export const DEFAULT_LOCAL_AI_ROLE: LocalAiRoleId = "general-reviewer";

export function isLocalAiRoleId(value: unknown): value is LocalAiRoleId {
  return (
    typeof value === "string" &&
    (LOCAL_AI_ROLE_IDS as string[]).includes(value)
  );
}

export function getLocalAiRole(id: LocalAiRoleId): LocalAiRoleDefinition {
  return LOCAL_AI_ROLES[id] ?? LOCAL_AI_ROLES["general-reviewer"];
}

export function isRoleHelpKey(value: unknown): value is RoleHelpKey {
  return (
    typeof value === "string" &&
    (value === "builder-plan-mode" ||
      value === "blueprint-planner" ||
      value === "code-context-review" ||
      value === "patch-draft" ||
      isLocalAiRoleId(value))
  );
}

export function getRoleHelp(key: RoleHelpKey): RoleHelpContent {
  if (key === "builder-plan-mode") return BUILDER_PLAN_MODE_HELP;
  if (key === "blueprint-planner") return BLUEPRINT_PLANNER_HELP;
  if (key === "code-context-review") return CODE_CONTEXT_REVIEW_HELP;
  if (key === "patch-draft") return PATCH_DRAFT_HELP;
  return getLocalAiRole(key).help;
}

export function formatLocalAiRoleOutputInstructions(
  role: LocalAiRoleDefinition,
): string {
  const lines = [
    `## Active Local AI Role: ${role.label}`,
    `- Role id: ${role.id}`,
    `- Category: ${role.category}`,
    `- Role purpose: ${role.shortDescription}`,
  ];
  if (role.disclaimer) {
    lines.push(`- Important label: ${role.disclaimer}`);
  }
  lines.push(
    "",
    "## Requested output format for this role",
    "Please return clearly labeled sections for:",
    ...role.requestedOutput.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Stay inspect-only. Do not claim you edited files, ran commands, enabled live Qwen, or enabled edit mode.",
  );
  return lines.join("\n");
}
