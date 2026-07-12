# New Type Tech Coder v1 — Safety Rules

## Purpose

New Type Tech Coder v1 is a **local non-coder AI development workbench**.

It helps you:

- Inspect a local project folder
- Generate plain-English project summaries
- Create copy-paste review reports for outside AIs
- Create and carefully restore safety backups
- Run limited allowlisted Build/Test Checks
- Ask a local metadata-only AI reviewer (Ollama-compatible)
- Generate Qwen Inspect Prompt Packs for manual use
- Import outside AI reviews as text-only advice
- Keep history in app-owned storage

**It is not a coding agent.**

v1 does not write your code, run live coding agents against your files, or take autonomous control of a project. Use it to understand, review, and prepare work — then ask Cursor, Codex, Grok, Claude, or another builder to make changes.

---

## What v1 can do

- Select a local project folder.
- Generate a plain-English project summary.
- Detect changed files with read-only Git status and generate a Patch Review Pack (no file edits).
- Generate a copy-paste review report.
- Generate a Decision Report and plan-only Builder Prompt for outside builder tools (no file edits).
- Import a builder AI’s response as text-only Builder Result (never executed; risk/mismatch warnings only).
- Track bugs, UX issues, safety concerns, and feature ideas in an app-owned Bug Log / Improvement Backlog (text only; never executed).
- Create a safety backup.
- Restore the latest safety backup carefully.
- Run allowlisted Build/Test Checks.
- Block risky lifecycle hooks like `prebuild`, `postbuild`, `pretest`, and `posttest`.
- Ask a local Ollama-compatible AI reviewer using summary-only context.
- Generate a Qwen Inspect Prompt Pack.
- Import outside AI reviews as text-only advice (multiple reviews per project, keyword comparison only).
- Save local history in app-owned storage.
- Launch by double-clicking the packaged app or launcher.

---

## What v1 cannot do

- It cannot edit project files through AI.
- It cannot run live Qwen Code.
- It cannot give AI direct file access.
- It cannot give AI terminal access.
- It cannot accept custom command typing.
- It cannot run arbitrary commands.
- It cannot send raw source code to AI by design.
- It cannot send secrets to AI by design.
- It cannot act as Cursor, Codex, or an autonomous coding agent.

---

## Operating rules

1. Use v1 for inspection, review, reporting, and safety checks.
2. Do not use Restore Safety Backup on an important project unless the project is already backed up elsewhere.
3. Use disposable projects when testing restore behavior.
4. Treat outside AI reviews as advice only.
5. Do not paste secrets, API keys, `.env` contents, or private credentials into requests or external reviews.
6. Keep live Qwen execution disabled until a future safety stage proves it can be controlled.
7. Do not add edit mode until the app has a stronger patch-review workflow.
8. Run Build/Test Checks only when the app marks them safe.
9. If lifecycle hooks are blocked, do not bypass manually unless a coder reviews them.
10. Before using on an important project, create a normal Git commit or external backup first.

---

## Current v1 workflow

1. Select project.
2. Generate Project Summary.
3. Create Safety Backup.
4. Run safe Build/Test Checks if available.
5. Generate Copy-Paste Review Report / Patch Review Pack if needed.
6. Ask Local AI Reviewer if configured.
7. Generate Qwen Inspect Prompt Pack if needed.
8. Paste outside review back into External Review.
9. Generate Decision Report / plan-only Builder Prompt.
10. Paste the Builder Prompt into Cursor, Codex, Grok, Claude, or another builder.
11. Paste the builder’s response back into Builder Result (text only — never executed).
12. Record bugs, UX issues, and safety concerns in the Bug Log / Improvement Backlog if needed.
13. Use Decision Report warnings and recommendations to decide the next safe step.

---

## Non-goals for v1

- No live Qwen execution.
- No edit mode.
- No AI file editing.
- No direct AI file access.
- No arbitrary terminal.
- No custom command typing.
- No autonomous project modification.
- No automatic package installation.
- No cloud upload.

---

## Future phase warning

Future phases may add things like:

- Patch review
- Changed-file detection
- Multi-review comparison
- Controlled patch workflows

Those features must **not** weaken the v1 safety boundaries without a new safety audit.

Until that audit happens:

- Live Qwen stays disabled
- Edit mode stays unavailable
- AI must not get direct file or terminal control
- Arbitrary / custom commands stay out of scope

---

## Final v1 status

**New Type Tech Coder v1 is safe for local inspection and review workflows.**

**It is not yet a coding agent.**
