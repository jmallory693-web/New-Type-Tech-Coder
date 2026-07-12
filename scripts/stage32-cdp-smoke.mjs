/**
 * Stage 32 disposable packaged-app smoke harness (CDP).
 * Does not change product code.
 */
const CDP = "http://127.0.0.1:9222";

const report = {
  title: null,
  pageUrl: null,
  launchedWithoutVite: false,
  bridgeAvailable: null,
  dailyNextHeading: null,
  dailyNextTitle: null,
  primaryButton: null,
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
await send("DOM.enable");

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

const ui = await evalExpr(`(() => {
  const text = document.body ? document.body.innerText : "";
  const html = document.body ? document.body.innerHTML : "";
  const heading = Array.from(document.querySelectorAll("h3")).find(
    (el) => el.textContent && el.textContent.includes("What should I do next")
  );
  const nextCard = document.querySelector(".dashboard-next");
  const nextTitle = nextCard
    ? (nextCard.querySelector(".dashboard-next-title")?.textContent || "").trim()
    : null;
  const primary = nextCard
    ? nextCard.querySelector(".dashboard-next-actions button")
    : null;
  const hasCustomCommand =
    !!document.querySelector('input[placeholder*="custom command" i], textarea[placeholder*="custom command" i]') ||
    /type a custom command/i.test(text);
  const hasArbitraryTerminal =
    /arbitrary terminal/i.test(text) && /run any command/i.test(text);
  return {
    hasHeading: Boolean(heading),
    headingText: heading?.textContent?.trim() || null,
    nextTitle,
    primaryLabel: primary?.textContent?.trim() || null,
    inspectOnly: /Inspect-only:\\s*no edits allowed/i.test(text),
    liveQwenDisabled: /Live Qwen disabled for safety/i.test(text),
    editModeUnavailable: /Edit mode unavailable/i.test(text),
    hasCustomCommand,
    hasArbitraryTerminal,
    urlIsFile: location.protocol === "file:",
    sample: text.slice(0, 500),
  };
})()`);

report.dailyNextHeading = ui.hasHeading;
report.dailyNextTitle = ui.nextTitle;
report.primaryButton = ui.primaryLabel;
report.inspectOnlyBadge = ui.inspectOnly;
report.liveQwenBadge = ui.liveQwenDisabled;
report.editModeBadge = ui.editModeUnavailable;
report.customCommandInput = ui.hasCustomCommand;
report.arbitraryTerminal = ui.hasArbitraryTerminal;

if (report.title !== "New Type Tech Coder") fail("Unexpected window title");
if (!report.launchedWithoutVite) fail("App did not load from file:// packaged path");
if (report.bridgeAvailable !== "object") fail("window.nttc bridge missing");
if (!report.dailyNextHeading) fail("Missing What should I do next? heading");
if (!report.dailyNextTitle) fail("Missing recommended next action title");
if (!report.primaryButton) fail("Missing primary button on Daily Next card");
if (!report.inspectOnlyBadge) fail("Missing Inspect-only badge text");
if (!report.liveQwenBadge) fail("Missing Live Qwen disabled badge text");
if (!report.editModeBadge) fail("Missing Edit mode unavailable badge text");
if (report.customCommandInput) fail("Custom command input unexpectedly present");
if (report.arbitraryTerminal) fail("Arbitrary terminal UI unexpectedly present");

console.log(JSON.stringify({ ...report, uiSample: ui.sample }, null, 2));
ws.close();
process.exit(report.failures.length ? 1 : 0);
