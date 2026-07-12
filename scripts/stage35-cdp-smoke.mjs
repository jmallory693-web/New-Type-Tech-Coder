/**
 * Stage 35 disposable packaged-app smoke harness (CDP).
 * Does not change product code.
 */
const CDP = "http://127.0.0.1:9222";

const report = {
  title: null,
  pageUrl: null,
  launchedWithoutVite: false,
  bridgeAvailable: null,
  speakerScriptsHeading: null,
  roles: {},
  tones: {},
  generateButton: null,
  copyButton: null,
  audioTtsControls: null,
  inspectOnlyBadge: null,
  liveQwenBadge: null,
  editModeBadge: null,
  customCommandInput: null,
  arbitraryTerminal: null,
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === "page") || list[0];
if (!page) {
  fail("No CDP page target");
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

report.title = page.title;
report.pageUrl = page.url;
report.launchedWithoutVite =
  typeof page.url === "string" &&
  page.url.startsWith("file:") &&
  !page.url.includes("5173");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Runtime.enable");

const evalExpr = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
};

report.bridgeAvailable = await evalExpr("typeof window.nttc");

// Navigate to AI Review tab so Speaker Scripts section is visible.
await evalExpr(`(() => {
  const tabs = Array.from(document.querySelectorAll("button, [role='tab']"));
  const ai = tabs.find((el) => /AI Review/i.test(el.textContent || ""));
  if (ai) ai.click();
  return Boolean(ai);
})()`);

await new Promise((r) => setTimeout(r, 400));

const ui = await evalExpr(`(() => {
  const text = document.body ? document.body.innerText : "";
  const html = document.body ? document.body.innerHTML : "";
  const speakerHeading = Array.from(document.querySelectorAll(".field-label, h2, h3")).find(
    (el) => /Speaker Scripts/i.test(el.textContent || "")
  );
  const roleSelect = document.getElementById("speaker-role");
  const toneSelect = document.getElementById("speaker-tone");
  const roleOptions = roleSelect
    ? Array.from(roleSelect.options).map((o) => o.textContent.trim())
    : [];
  const toneOptions = toneSelect
    ? Array.from(toneSelect.options).map((o) => o.textContent.trim())
    : [];
  const buttons = Array.from(document.querySelectorAll("button")).map(
    (b) => (b.textContent || "").trim()
  );
  const hasGenerate = buttons.some((t) => /Generate Speaker Script/i.test(t));
  const hasCopy = buttons.some((t) => /Copy Speaker Script/i.test(t));
  const hasAudio =
    !!document.querySelector("audio, [data-tts], button[aria-label*='TTS' i], button[aria-label*='speak' i]") ||
    buttons.some((t) => /^(Play audio|Speak aloud|Start TTS|Text to speech)$/i.test(t));
  const hasCustomCommand =
    !!document.querySelector('input[placeholder*="custom command" i], textarea[placeholder*="custom command" i]') ||
    /type a custom command/i.test(text);
  const hasArbitraryTerminal =
    /arbitrary terminal/i.test(text) && /run any command/i.test(text);
  return {
    hasSpeakerHeading: Boolean(speakerHeading),
    roleOptions,
    toneOptions,
    hasGenerate,
    hasCopy,
    hasAudio,
    inspectOnly: /Inspect-only:\\s*no edits allowed/i.test(text),
    liveQwenDisabled: /Live Qwen disabled for safety/i.test(text),
    editModeUnavailable: /Edit mode unavailable/i.test(text),
    hasCustomCommand,
    hasArbitraryTerminal,
    sample: text.slice(0, 700),
  };
})()`);

const requiredRoles = [
  "Project Foreman",
  "Safety Officer",
  "Review Narrator",
  "Builder Liaison",
  "Release Announcer",
];
const requiredTones = [
  "Plain",
  "Brief",
  "Detailed",
  "YouTube-style",
  "Safety-focused",
];

report.speakerScriptsHeading = ui.hasSpeakerHeading;
for (const role of requiredRoles) {
  report.roles[role] = ui.roleOptions.includes(role);
}
for (const tone of requiredTones) {
  report.tones[tone] = ui.toneOptions.includes(tone);
}
report.generateButton = ui.hasGenerate;
report.copyButton = ui.hasCopy;
report.audioTtsControls = ui.hasAudio;
report.inspectOnlyBadge = ui.inspectOnly;
report.liveQwenBadge = ui.liveQwenDisabled;
report.editModeBadge = ui.editModeUnavailable;
report.customCommandInput = ui.hasCustomCommand;
report.arbitraryTerminal = ui.hasArbitraryTerminal;

if (report.title !== "New Type Tech Coder") fail("Unexpected window title");
if (!report.launchedWithoutVite) fail("App did not load from file:// packaged path");
if (report.bridgeAvailable !== "object") fail("window.nttc bridge missing");
if (!report.speakerScriptsHeading) fail("Missing Speaker Scripts section");
for (const role of requiredRoles) {
  if (!report.roles[role]) fail(`Missing speaker role: ${role}`);
}
for (const tone of requiredTones) {
  if (!report.tones[tone]) fail(`Missing tone: ${tone}`);
}
if (!report.generateButton) fail("Missing Generate Speaker Script button");
if (!report.copyButton) fail("Missing Copy Speaker Script button");
if (report.audioTtsControls) fail("Audio/TTS controls unexpectedly present");
if (!report.inspectOnlyBadge) fail("Missing Inspect-only badge text");
if (!report.liveQwenBadge) fail("Missing Live Qwen disabled badge text");
if (!report.editModeBadge) fail("Missing Edit mode unavailable badge text");
if (report.customCommandInput) fail("Custom command input unexpectedly present");
if (report.arbitraryTerminal) fail("Arbitrary terminal UI unexpectedly present");

// Generate a text-only script and confirm preview appears.
const generated = await evalExpr(`(async () => {
  if (!window.nttc) return { ok: false, reason: "no bridge" };
  const next = await window.nttc.generateSpeakerScript();
  const saved = next && next.speakerScript && next.speakerScript.saved;
  return {
    ok: Boolean(saved && saved.markdownReport),
    role: saved ? saved.roleLabel : null,
    tone: saved ? saved.toneLabel : null,
    startsOk: saved
      ? String(saved.markdownReport).startsWith("# New Type Tech Coder - Speaker Script")
      : false,
    hasVoiceSection: saved
      ? /Voice-friendly script/i.test(saved.markdownReport)
      : false,
  };
})()`);

if (!generated.ok) fail(`Speaker script generation failed: ${generated.reason || "unknown"}`);
if (!generated.startsOk) fail("Generated script missing expected header");
if (!generated.hasVoiceSection) fail("Generated script missing voice-friendly section");

console.log(
  JSON.stringify(
    { ...report, generated, uiSample: ui.sample },
    null,
    2,
  ),
);
ws.close();
process.exit(report.failures.length ? 1 : 0);
