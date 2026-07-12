# New Type Tech Coder — Builder & Speaker Role Architecture

**Stage:** 33 (design only)  
**Status:** Documentation / architecture — **not implemented**  
**Related:** [V1-SAFETY-RULES.md](./V1-SAFETY-RULES.md), [README.md](./README.md)

This document defines future **Builder Roles** and **Speaker Roles** before any new provider wiring. First versions must remain **report / plan / script generators only**.

---

## 1. Role categories

### Builder Roles

Builder Roles help **plan or review** changes. They turn safe local metadata and typed requests into plans, risk lists, and outside-builder prompts.

**They may generate:**

- Plans
- Patch outlines
- Files likely to change
- Risk assessments
- Test plans
- Builder prompts
- Revision instructions

**They must not:**

- Edit files
- Run commands
- Install packages
- Access raw source directly
- Bypass Safety Gate
- Enable live Qwen
- Enable edit mode

### Speaker Roles

Speaker Roles help **explain, summarize, or narrate** project status for non-coders and daily use.

**They may generate:**

- Daily project briefings
- Safety summaries
- Review summaries
- “What changed” explanations
- Voice-friendly scripts
- Non-coder explanations

**They must not:**

- Edit files
- Run commands
- Request direct source access
- Trigger TTS / audio automatically (text/script only until a later audited stage)

---

## 2. Hard safety rules (all roles)

These rules apply to every Builder and Speaker role, now and in future stages:

1. **No role may edit files.**
2. **No role may run commands.**
3. **No role may access raw project files.**
4. **No role may enable live Qwen.**
5. **No role may enable edit mode.**
6. **No role may create arbitrary terminal access or custom command typing.**
7. **Any role that proposes code must be patch-plan only** unless a later audited stage explicitly permits more.
8. **Speaker roles are text/script only** — no automatic audio/TTS yet.
9. Roles must use the **same Safety Gate and deny-list posture** as today’s Local AI Reviewer (summary/metadata only).
10. Role outputs are **advice / reports**. They are never executed by New Type Tech Coder.

---

## 3. Input safety model

### Allowed inputs

Roles may receive only safe, already-generated app artifacts and typed text:

| Input | Notes |
|-------|--------|
| Project Summary | Shallow metadata summary |
| Copy-Paste Review Report | Truncated / safe pack |
| Patch Review Pack | Changed-file metadata + risk flags (no full diffs) |
| Decision Report | Rule-based decision guidance |
| Builder Prompt | Plan-only prompt text |
| Builder Result metadata / truncated excerpt | Text import only; never executed |
| External Review comparison summary | Keyword / comparison metadata + truncated excerpts |
| Safe Check result summary | Allowlisted check status / truncated output |
| Changed-file metadata | Paths, kinds, counts, risk flags — not full diffs |
| Backlog summary | Open counts / priorities / short titles |
| Daily Next Action | Rule-based recommendation + reason + freshness |
| User typed request | Plain-English goal text (no secrets) |

### Forbidden inputs

Roles must never receive:

- Raw source code
- Full diffs / patch bodies
- `.env` contents
- Secrets, API keys, tokens
- Certificates / private keys
- Huge logs or unbounded command output
- Direct project folder access (read or write tools)
- Command / terminal access
- File modification tools
- Live Qwen session control
- Edit-mode or apply-patch tools

### Context packaging rule

When a role is later connected to Ollama (or similar), the app must build a **role context pack** from allowed inputs only — same spirit as today’s metadata-only advisor prompt. Truncation and secret-safety notes remain mandatory.

---

## 4. Standard output formats

### Builder output template

Every Builder Role response should follow this structure (markdown):

```markdown
# Role: <Builder Role Name>

## Goal
<What the user is trying to accomplish>

## Recommended plan
<Ordered, small, reviewable steps — plan only>

## Files likely to change
- path/or/area — why
- …

## Risks
- …
- …

## Tests / checks
- …
- …

## Questions before implementation
1. …
2. …

## Do-not-do list
- Do not edit unrelated files
- Do not bypass Safety Gate
- Do not enable live Qwen / edit mode / arbitrary terminal
- …

## Final recommendation
<Proceed / revise / do not proceed — with one plain-English sentence>
```

### Speaker output template

Every Speaker Role response should follow this structure (markdown):

```markdown
# Role: <Speaker Role Name>

## Short briefing
<2–5 sentences>

## Important warnings
- …
- …

## What changed
<Plain English; based on metadata only>

## What to do next
<Align with Daily Next Action when possible>

## Plain-English explanation
<Non-coder friendly>

## Optional voice-friendly script
<Short spoken script; text only — do not auto-play>
```

---

## 5. Proposed Builder Roles

### 5.1 Architect Planner

| Field | Definition |
|-------|------------|
| **Purpose** | Turn the user goal into a safe, small plan. |
| **Allowed inputs** | User request, Project Summary, Decision Report (if any), Daily Next Action, Backlog summary, Safety Backup / Safe Check status summaries. |
| **Forbidden inputs** | Raw source, full diffs, secrets, command access. |
| **Allowed outputs** | Plan, files likely to change, risks, test plan, questions, do-not-do list. Default: **plan-only**. |
| **Forbidden outputs** | File edits, runnable commands, install instructions that the app would execute, “apply this patch now” tooling. |
| **Safest first implementation** | Template-filled plan from existing Decision Report + summary; optional Ollama rewrite later still plan-only. |
| **UI placement** | AI Review → role selector; output also listed under Reports. |
| **Reports to update** | Decision Report appendix / new “Architect Plan” report; may feed Builder Prompt generation. |

### 5.2 Bug Risk Reviewer

| Field | Definition |
|-------|------------|
| **Purpose** | Find likely bugs or risky logic from summaries and reports (not from reading source). |
| **Allowed inputs** | Project Summary, Patch Review Pack metadata, Safe Check summaries, External Review comparison, Builder Result warnings, Backlog summary, user request. |
| **Forbidden inputs** | Raw source, full diffs, secrets. |
| **Allowed outputs** | Risk list, review questions, suggested tests, “needs human review” flags. |
| **Forbidden outputs** | Code patches, command runs, claims of having inspected source. |
| **Safest first implementation** | Rule-assisted risk bullets from changed-file flags + check failures + external review keywords; optional Ollama narrative later. |
| **UI placement** | AI Review role selector; warnings surface on Dashboard alerts. |
| **Reports to update** | Copy-Paste Review Report / Decision Report risk sections; optional Backlog draft suggestions (text only, user confirms). |

### 5.3 Patch Planner

| Field | Definition |
|-------|------------|
| **Purpose** | Convert Decision Report into a small patch plan for Cursor / Codex / Grok / Claude. |
| **Allowed inputs** | Decision Report, Builder Prompt (existing), Project Summary, Patch Review Pack metadata, user request, Daily Next Action. |
| **Forbidden inputs** | Raw source, full diffs, secrets, apply tools. |
| **Allowed outputs** | Plan-only builder prompt / patch outline (files likely to change, steps, tests, do-not-do). |
| **Forbidden outputs** | Applied edits, auto-commits, install/run scripts executed by NTTC. |
| **Safest first implementation** | Extend today’s plan-only Builder Prompt generator with a named “Patch Planner” role label. |
| **UI placement** | Reports (Builder Prompt area) + AI Review role selector. |
| **Reports to update** | Builder Prompt; Decision Report “next builder task” alignment. |

### 5.4 Test Planner

| Field | Definition |
|-------|------------|
| **Purpose** | Suggest safe tests/checks after changes. |
| **Allowed inputs** | Project Summary (scripts list), Safe Checks availability/results, Patch Review Pack metadata, Decision Report, user request. |
| **Forbidden inputs** | Arbitrary terminal, custom command typing, raw source. |
| **Allowed outputs** | Test checklist, manual test steps, which allowlisted checks to consider (user still confirms). |
| **Forbidden outputs** | Auto-running checks without confirmation, inventing non-allowlisted commands for the app to run. |
| **Safest first implementation** | Checklist from package script allowlist + changed-file risk flags; no auto-run. |
| **UI placement** | AI Review + Safety tab cross-link (“suggested checks — confirm on Safety”). |
| **Reports to update** | Decision Report / Patch Review Pack “tests” section; optional Test Plan report. |

### 5.5 UX Reviewer

| Field | Definition |
|-------|------------|
| **Purpose** | Review UI/flow from reports and (later, if audited) user-provided screenshots — not by browsing the project tree. |
| **Allowed inputs** | User request, Project Summary, External Reviews, Builder Result excerpts, optional user-pasted screenshot descriptions / attached images in a future audited stage. |
| **Forbidden inputs** | Direct file access to UI source, secrets. |
| **Allowed outputs** | UX issues, layout suggestions, non-coder wording improvements. |
| **Forbidden outputs** | CSS/code edits applied by NTTC, live preview control. |
| **Safest first implementation** | Text-only UX notes from reports + typed request; screenshots only after a later audited stage. |
| **UI placement** | AI Review role selector; optional History/Backlog draft UX items. |
| **Reports to update** | Review Report UX section; Backlog suggestions (user confirms). |

### 5.6 Safety Reviewer

| Field | Definition |
|-------|------------|
| **Purpose** | Review whether a proposed stage or plan weakens safety boundaries. |
| **Allowed inputs** | Decision Report, Builder Prompt/Result warnings, Daily Next Action, Safety Backup / Safe Check status, Backlog Critical Safety items, this architecture + V1 safety rules (as static text). |
| **Forbidden inputs** | Raw source, tools that change safety flags, live Qwen enablement. |
| **Allowed outputs** | Go / no-go, risks, required mitigations, “do not proceed” reasons. |
| **Forbidden outputs** | Enabling edit mode, live Qwen, terminal, or file writes. |
| **Safest first implementation** | Checklist against hard rules in this doc + V1-SAFETY-RULES; optional Ollama explanation later. |
| **UI placement** | AI Review (prominent); Dashboard warning when no-go. |
| **Reports to update** | Decision Report; Safety tab status notes; Action Log. |

---

## 6. Proposed Speaker Roles

### 6.1 Project Foreman

| Field | Definition |
|-------|------------|
| **Purpose** | Short daily “what is the project state?” briefing. |
| **Allowed inputs** | Project Summary freshness, Daily Next Action, Safety Backup status, Safe Check last result, changed-file counts, Decision/Review existence, Backlog open counts. |
| **Forbidden inputs** | Raw source, secrets, command access. |
| **Allowed outputs** | Short briefing + what to do next (Speaker template). |
| **Text-only script first?** | Yes. |
| **Future TTS?** | Possible later; must remain opt-in and audited. |
| **UI placement** | Dashboard (latest briefing card); AI Review role selector. |

### 6.2 Safety Officer

| Field | Definition |
|-------|------------|
| **Purpose** | Explain safety risks, warnings, and what not to do. |
| **Allowed inputs** | Safety Gate status, checkpoint availability, Safe Check blocks/failures, Builder Result risk phrases, Critical Safety backlog, hard rules text. |
| **Forbidden inputs** | Anything that would let the role change safety settings. |
| **Allowed outputs** | Warnings, plain-English “do not” list, voice-friendly caution script. |
| **Text-only script first?** | Yes. |
| **Future TTS?** | Optional later for warnings; never auto-trigger restore or checks. |
| **UI placement** | Safety tab + Dashboard warnings; AI Review. |

### 6.3 Review Narrator

| Field | Definition |
|-------|------------|
| **Purpose** | Summarize external reviews and disagreements in plain English. |
| **Allowed inputs** | External Review comparison summary, truncated review excerpts, Decision Report, advisor response excerpt. |
| **Forbidden inputs** | Raw source, execution of review advice. |
| **Allowed outputs** | Agreement/disagreement summary, open questions, next review step. |
| **Text-only script first?** | Yes. |
| **Future TTS?** | Optional later. |
| **UI placement** | Request / Output (near External Reviews) + AI Review; Reports excerpt. |

### 6.4 Builder Liaison

| Field | Definition |
|-------|------------|
| **Purpose** | Explain what to ask Cursor / Codex / Grok / Claude next. |
| **Allowed inputs** | Daily Next Action, Decision Report, Builder Prompt, Builder Result status/warnings, user request. |
| **Forbidden inputs** | Apply/edit tools, raw source. |
| **Allowed outputs** | Plain-English “paste this into your builder” guidance; points to existing Builder Prompt. |
| **Text-only script first?** | Yes. |
| **Future TTS?** | Optional later. |
| **UI placement** | Request / Output + Reports; Dashboard secondary hint under Daily Next Action. |

### 6.5 Release Announcer

| Field | Definition |
|-------|------------|
| **Purpose** | Turn build/package status into a short release note. |
| **Allowed inputs** | Safe Check last results, version label, Decision Report “ready” state, user request / stage notes, packaging success notes if recorded as metadata. |
| **Forbidden inputs** | Arbitrary terminal to invent release commands; secrets. |
| **Allowed outputs** | Short release note / changelog-style briefing (text). |
| **Text-only script first?** | Yes. |
| **Future TTS?** | Optional later for “release ready” announcements. |
| **UI placement** | Reports + optional Dashboard when checks are green; AI Review. |

---

## 7. UI architecture proposal (not implemented)

Keep the current tabbed UI. Avoid a new top-level tab until roles prove useful.

### Recommended placement

| Area | Role |
|------|------|
| **AI Review tab** | Primary home: role category (Builder / Speaker), role selector, Generate, preview, Copy. Reuse Local AI connection settings; do not add a second settings maze. |
| **Reports tab** | Persist last role outputs as named reports (Architect Plan, Test Plan, Speaker Briefing, etc.). Copy-paste friendly. |
| **Dashboard** | Show **one** latest Speaker briefing (Project Foreman by default) under or beside Daily Next Action — not every role button. |
| **Request / Output** | Builder Liaison + Review Narrator shortcuts near Builder Result / External Reviews. |
| **Safety** | Safety Officer summary + Safety Reviewer go/no-go when present. |
| **Settings / Advanced** | Optional per-role model name overrides later; default = current Ollama reviewer settings. Keep collapsed/advanced. |

### Clutter rules

- One role generate action at a time.
- Dashboard shows Daily Next Action (rule-based) + at most one Speaker briefing.
- Full role catalog lives in AI Review, not on Dashboard.
- Role outputs never auto-run Safety Backup, Restore, or Build/Test Checks.

### Relationship to existing Local AI Reviewer

Today’s Local AI Reviewer remains the **generic inspect/review** path. Named Builder/Speaker roles are **specialized prompts + templates** over the same metadata-only channel — not new privileges.

---

## 8. Implementation stage plan (after this design)

Safer order (adjusted slightly from the initial suggestion so docs land first, then text-only speakers, then Ollama roles, then plan-only builders):

| Stage | Focus | Notes |
|-------|--------|------|
| **33** | Builder & Speaker Role Architecture | Design document only. |
| **34** | Speaker Script Generator (text-only) | Rule/template-based scripts from allowed metadata; **no** Ollama required; **no** TTS. |
| **35** | (reserved / confirm packaging if needed) | Optional rebuild after Stage 34. |
| **36** | Ollama Role Selector for reviewer / speaker roles | Metadata-only prompts; select role → generate text; still no file/command access. **Implemented.** |
| **37** | Builder Plan Mode through Ollama | Plan-only Architect / Patch Planner style outputs; hard do-not-do list enforced in prompt + UI. |
| **38** | Builder Plan Import / Compare improvements | Compare pasted builder plans/results; warnings only; never execute. |
| **39+** | Patch proposal mode | Structured patch **proposals** / outlines only — **no applying edits**. |
| **Later (audited)** | Controlled edit / apply mode | Only after explicit safety audit, patch review workflow, and user confirmation gates. |
| **Later (audited)** | Optional TTS for Speaker scripts | Opt-in playback only; never auto-trigger on warnings alone without user action. |

### Explicit non-goals until audited later stages

- Live Qwen execution
- Edit mode / AI file writes
- Direct AI file access
- Arbitrary terminal / custom commands
- Auto-apply patches
- Auto-run Build/Test Checks or Restore from role output

---

## 9. Mapping to current app capabilities

| Existing capability | Role relationship |
|---------------------|-------------------|
| Local AI Reviewer | Generic precursor; becomes one selectable “Reviewer” plus named roles |
| Qwen Inspect Prompt Pack | Stays manual/outside; roles must not enable live Qwen |
| External Reviews | Input to Review Narrator / Bug Risk Reviewer |
| Builder Prompt | Output target for Patch Planner / Architect Planner |
| Builder Result Import | Input to Bug Risk / Safety Reviewer / Builder Liaison |
| Decision Report | Core input for Builder roles; may append role sections later |
| Patch Review Pack | Input for Patch / Test / Bug Risk planners |
| Daily Next Action | Input for Foreman / Builder Liaison; remains rule-based (not AI) |

---

## 10. Acceptance criteria for any future role implementation stage

A role implementation stage is incomplete unless it documents:

1. Which allowed inputs are wired
2. That forbidden inputs remain blocked
3. Output uses the standard Builder or Speaker template
4. Action Log records generate / copy / blocked
5. No file edits, commands, live Qwen, edit mode, or terminal were added
6. Manual tests for empty project, no summary, and warning-heavy states

---

## 11. Document control

- **Owner:** Project maintainer (human approval required for any stage that expands privileges)
- **This stage (33):** Design only — no provider behavior, no new Ollama role connections, no UI role selector implementation
- **Next:** Stage 34+ per section 8
