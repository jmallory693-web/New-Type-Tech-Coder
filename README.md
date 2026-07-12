# New Type Tech Coder

Plain-English Windows desktop control panel for local AI coding agents.

**Version:** 0.1.0  
**Current stage:** Stage 61 — Rebuild Packaged App After Stage 60 Patch Draft Safety Review  
**Mode:** Inspect / review only — not a coding agent

**Safety rules:** see [V1-SAFETY-RULES.md](./V1-SAFETY-RULES.md) for what v1 can and cannot do, operating rules, and the recommended workflow.

**Future AI roles:** see [ROLE-ARCHITECTURE.md](./ROLE-ARCHITECTURE.md). Stage 34 Speaker Scripts are rule/template text-only. Stage 36 adds an Ollama Local AI Role selector (metadata-only prompt framing; no new capabilities, no TTS). Stage 38 adds Builder Plan Mode (Ollama plan-only for outside builders; no edits, no commands, no raw source). Stage 38A adds installed-model discovery and role→model mapping (model choice only; still metadata-only). Stage 39 rebuilds the packaged Windows app with Stages 38 + 38A included. Stage 40 adds rule-based Builder Plan Comparison for imported outside builder plans (no Ollama auto-call). Stage 41 rebuilds the packaged Windows app with Stage 40 included. Stage 42 adds rule-based Implementation Review for pasted Implementation reports (no Ollama auto-call). Stage 43 rebuilds the packaged Windows app with Stage 42 included. Stage 42A improves Role Model Mapping with installed-model dropdowns (model selection only; still metadata-only). Stage 44 rebuilds the packaged Windows app with Stages 42 + 42A included. Stage 45 adds clickable role explanations (help-text UX only; no new capabilities). Stage 46 rebuilds the packaged Windows app with Stage 45 included. Stage 47 runs a full daily-use QA trial on a disposable project copy (validation/polish notes only). Stage 48 applies tiny user-facing message polish from Stage 47 findings. Stage 49 rebuilds the packaged Windows app with Stage 48 included. Stage 56 adds Code Question Templates (guided wording only; no auto AI send). Stage 57 rebuilds the packaged Windows app with Stage 56 included. Stage 58 adds Patch Draft Mode (local Ollama patch draft from approved Code Context Pack only; no apply, no file edits). Stage 59 rebuilds the packaged Windows app with Stage 58 included. Stage 60 adds rule-based Patch Draft Safety Review (keyword analysis of Patch Draft text and safe metadata only; no Ollama, no apply). Stage 61 rebuilds the packaged Windows app with Stage 60 included.

**App icon:** A simple placeholder `build/icon.ico` (dark square with “NTTC”) is used for Windows packaging. This is not a final brand logo.

## How to open without terminal

Normal packaged use does **not** need a terminal, Vite, or `npm run dev`.

### Best options

1. **Installer (recommended for daily use)**  
   Double-click `release/New Type Tech Coder-0.1.0-Setup.exe`, install, then open from the Start Menu or Desktop shortcut the installer creates.

2. **Unpackaged build folder**  
   Double-click `release/win-unpacked/New Type Tech Coder.exe` directly.

### Repo launcher (no install step)

From the project folder, double-click:

- `Open New Type Tech Coder.bat`

That opens the already packaged app at `release/win-unpacked/New Type Tech Coder.exe`.

It does **not** rebuild, install packages, start Vite, or run `npm run dev`.

If the packaged `.exe` is missing, the launcher shows a clear message and stops.

### Optional Desktop shortcut

Double-click `Create Desktop Shortcut.bat` (no administrator rights required).  
It runs `Create-Desktop-Shortcut.ps1` and creates a Desktop shortcut pointing at `release/win-unpacked/New Type Tech Coder.exe`.

If shortcut creation fails on your PC, use `Open New Type Tech Coder.bat` or the `.exe` path above.

### Dev mode still needs a terminal

Developer mode (`npm run dev`) still uses the Vite server and a terminal.  
That is only for coding on this app — not for normal packaged use.

## What it does

- Show a Dashboard **What should I do next?** card (rule-based daily guidance)
- Select a project folder and get a plain-English **Project Summary**
- Detect **Changed Files** (Git, read-only) and build a **Patch Review Pack**
- Create a **Copy-Paste Review Report** for ChatGPT / Claude / Gemini / Grok
- Create a **Decision Report** and plan-only **Builder Prompt** for outside tools
- Create a **Safety Backup** and restore with a clear warning
- Ask a **Local AI Role** (Ollama-compatible, metadata-only; role changes prompt framing only)
- Run **Build/Test Checks** for allowlisted package scripts only
- Generate a **Qwen Inspect Prompt** for manual Qwen Code sessions
- Paste **External Reviews** as text-only advice
- Generate text-only **Speaker Scripts** (Project Foreman, Safety Officer, and more)
- Keep **History** in app-owned local storage (not inside your project folder)
- Export **Project Memory** markdown handoff files to `.nttc/` inside the selected project (documentation only; user-confirmed writes)
- Build a **Code Context Pack** preview from selected safe file excerpts (preview/copy only; no AI calls in Stage 52)

## Safety limitations (important)

- App starts in **Inspect-only** mode (no edits allowed)
- **Live Qwen execution is disabled** — use **Generate Qwen Inspect Prompt** instead
- No edit mode, no AI file editing, no direct AI file access
- No arbitrary terminal and no custom command typing
- Build/Test Checks are allowlisted only and **block** when related npm lifecycle hooks (`prebuild`, `postbuild`, etc.) exist
- Symlinks and junctions are refused during scan and folder snapshots
- History is stored under Electron `userData`, not in the selected project folder
- **Project Memory** may write approved markdown files to `<project>/.nttc/` only, after preview + user confirmation (no source edits)

## Requirements

- Windows 10/11
- Node.js 20+ recommended
- Optional: Ollama (or compatible local server) for Local AI Reviewer

## Install

```bash
npm install
```

## Dev mode

Uses the Vite dev server. Closing the Electron window stops the whole `npm run dev` stack.

```bash
npm run dev
```

## Typecheck

```bash
npm run typecheck
```

## Build (without packaging)

Compiles Electron main/preload and the Vite renderer into `dist-electron/` and `dist/`.

```bash
npm run build
```

## Run built app without installer

Loads the built files (no Vite server):

```bash
npm start
```

## Package (Windows)

Uses **electron-builder**.

Unpacked app (fast smoke test):

```bash
npm run pack
```

Output:

- `release/win-unpacked/New Type Tech Coder.exe`

Installer + unpacked (slower):

```bash
npm run dist
```

Output examples:

- `release/win-unpacked/`
- `release/New Type Tech Coder-0.1.0-Setup.exe`

### Icon status

No custom app icon is included yet. Windows uses the Electron default icon. To add one later, place `build/icon.ico` and point electron-builder at it.

## Packaging tool choice

**electron-builder** was chosen because:

- Fits this existing Vite + `tsc` Electron layout with minimal changes
- Produces Windows NSIS installer and an unpacked folder for smoke tests
- Does not require rewriting the project into Electron Forge scaffolding

## Project layout (build outputs)

| Path | Purpose |
|------|---------|
| `dist/` | Vite renderer build |
| `dist-electron/` | Electron main + preload (TypeScript compile) |
| `release/` | Packaged Windows output |

## Manual smoke checklist (packaged)

1. Launch `release/win-unpacked/New Type Tech Coder.exe` (Vite not running)
2. Confirm window title: New Type Tech Coder
3. Confirm Inspect-only badge / Live Qwen disabled
4. Select a test project folder
5. Summarize Project
6. Generate Copy-Paste Review Report
7. Confirm Build/Test Checks and Safety Backup controls exist
8. Confirm history is not written into the project folder
