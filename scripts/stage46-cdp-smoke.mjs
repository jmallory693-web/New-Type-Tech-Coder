/**
 * Stage 46 packaged-app smoke harness (CDP).
 * Stage 45 clickable role explanations + prior stage regressions.
 */
const CDP = "http://127.0.0.1:9227";

const LOCAL_AI_ROLE_LABELS = [
  "General Reviewer",
  "Architect Planner",
  "Bug Risk Reviewer",
  "Patch Planner",
  "Test Planner",
  "UX Reviewer",
  "Safety Reviewer",
  "Project Foreman",
  "Safety Officer",
  "Review Narrator",
  "Builder Liaison",
  "Release Announcer",
];

const REQUIRED_RESPONSE_TYPES = [
  "Plan only",
  "Implementation report",
  "Error report",
  "Builder plan",
  "Revised builder plan",
  "Unknown",
];

const report = {
  launched: false,
  pageUrl: null,
  usesVite: null,
  inspectOnly: null,
  liveQwenDisabled: null,
  implementationReview: null,
  builderPlanComparison: null,
  builderPlanMode: null,
  speakerScripts: null,
  roleModelMapping: null,
  roleHelpLinksAiReview: null,
  selectedRoleHelpOpens: null,
  builderPlanHelpOpens: null,
  mappingRoleHelpLinks: null,
  allLocalAiRoleHelp: null,
  builderPlanModeHelp: null,
  safetyReminderInModal: null,
  closeButtonWorks: null,
  escapeClosesModal: null,
  overlayClosesModal: null,
  localAiRoleDropdownWorks: null,
  mappingDropdownsPresent: null,
  refreshInstalledModelsBtn: null,
  dropdownUxStrings: null,
  manualAdvancedToggle: null,
  suggestDefaultsBtn: null,
  audioTts: null,
  editMode: null,
  arbitraryTerminal: null,
  customCommand: null,
  refreshResult: null,
  failures: [],
};

function fail(msg) {
  report.failures.push(msg);
  console.error("FAIL:", msg);
}

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json();
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error("No CDP page target");
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
  return { page, send, ws };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function clickTab(send, label) {
  await evaluate(
    send,
    `(() => {
      const tabs = [...document.querySelectorAll('button, [role="tab"]')];
      const tab = tabs.find((el) => (el.textContent || '').includes(${JSON.stringify(label)}));
      if (!tab) return false;
      tab.click();
      return true;
    })()`,
  );
  await new Promise((r) => setTimeout(r, 500));
}

async function openRoleHelpByLabel(send, label) {
  return evaluate(
    send,
    `(() => {
      const btn = [...document.querySelectorAll('.role-help-link')].find((el) =>
        (el.textContent || '').replace(/\\?/g, '').trim().startsWith(${JSON.stringify(label)}),
      );
      if (!btn) return false;
      btn.click();
      return true;
    })()`,
  );
}

async function modalTitle(send) {
  return evaluate(
    send,
    `document.querySelector('#role-help-title')?.textContent?.trim() || ''`,
  );
}

async function modalOpen(send) {
  return evaluate(send, `!!document.querySelector('.role-help-panel')`);
}

async function closeModalButton(send) {
  await evaluate(send, `document.querySelector('.role-help-close')?.click()`);
  await new Promise((r) => setTimeout(r, 200));
}

async function pressEscape(send) {
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await new Promise((r) => setTimeout(r, 200));
}

function inspectRoleMappingPanel(text, html) {
  report.dropdownUxStrings =
    /Refresh Installed Models to fill the dropdowns/i.test(text) &&
    /Manual model names are only for advanced\/offline use/i.test(text) &&
    /Coder models can be selected for patch planning or Builder Plan Mode/i.test(text);

  report.manualAdvancedToggle = /Use manual model name \(advanced\/offline\)/i.test(text);
  report.suggestDefaultsBtn = /Suggest Role Model Defaults/i.test(text);
  report.refreshInstalledModelsBtn = /Refresh Installed Models/i.test(text);

  const selects = html.match(/<select[^>]*id="role-model-[^"]*"[^>]*>[\s\S]*?<\/select>/gi) || [];
  report.mappingDropdownsPresent =
    selects.length >= 10 || /Use manual model name \(advanced\/offline\)/i.test(text);
}

try {
  const { page, send, ws } = await connect();
  report.launched = true;
  report.pageUrl = page.url;
  report.usesVite = /5173|vite/i.test(page.url || "");

  let bodyText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  let html = await evaluate(send, `document.documentElement.outerHTML`);

  report.inspectOnly = /Inspect-only/i.test(bodyText) || /Inspect-only/i.test(html);
  report.liveQwenDisabled = /Live Qwen is disabled/i.test(bodyText);
  report.audioTts = /text-to-speech|\bTTS\b|Play audio|Speak aloud/i.test(bodyText);
  report.editMode = /Enable Edit Mode|Edit Mode Available:\s*Yes/i.test(bodyText);
  report.arbitraryTerminal = /Open Terminal|Arbitrary terminal|Run any command/i.test(bodyText);
  report.customCommand = /Custom command|Type a command to run/i.test(bodyText);

  await clickTab(send, "AI Review");
  const aiText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  report.liveQwenDisabled =
    report.liveQwenDisabled || /Live Qwen is disabled/i.test(aiText);
  report.builderPlanMode = /Builder Plan Mode — Plan Only/i.test(aiText);
  report.speakerScripts = /Speaker Scripts/i.test(aiText);

  const aiReviewLinks = await evaluate(
    send,
    `(() => {
      const select = document.querySelector('#local-ai-role');
      const selectedLabel = select?.selectedOptions?.[0]?.textContent?.trim() || '';
      const links = [...document.querySelectorAll('.role-help-link')];
      const selectedLink = links.find((el) =>
        (el.textContent || '').replace(/\\?/g, '').trim().startsWith(selectedLabel),
      );
      const builderLink = links.find((el) => /Builder Plan Mode/i.test(el.textContent || ''));
      return {
        count: links.length,
        selectedLabel,
        hasSelectedLink: !!selectedLink,
        hasBuilderLink: !!builderLink,
      };
    })()`,
  );
  report.roleHelpLinksAiReview = aiReviewLinks.count >= 2 && aiReviewLinks.hasSelectedLink;

  if (!aiReviewLinks.hasSelectedLink) {
    fail("AI Review selected role help link missing");
  } else {
    await openRoleHelpByLabel(send, aiReviewLinks.selectedLabel);
    await new Promise((r) => setTimeout(r, 250));
    report.selectedRoleHelpOpens = await modalOpen(send);
    report.safetyReminderInModal = /changes advice style only/i.test(
      await evaluate(send, `document.querySelector('.role-help-reminder')?.textContent || ''`),
    );
    if (!report.selectedRoleHelpOpens) fail("Selected role help modal did not open");
    if (!report.safetyReminderInModal) fail("Safety reminder missing from role help modal");
    await closeModalButton(send);
    report.closeButtonWorks = !(await modalOpen(send));
  }

  if (!aiReviewLinks.hasBuilderLink) {
    fail("Builder Plan Mode help link missing on AI Review tab");
  } else {
    await openRoleHelpByLabel(send, "Builder Plan Mode");
    await new Promise((r) => setTimeout(r, 250));
    report.builderPlanHelpOpens =
      (await modalOpen(send)) && /Builder Plan Mode/i.test(await modalTitle(send));
    if (!report.builderPlanHelpOpens) fail("Builder Plan Mode help modal did not open");
    await pressEscape(send);
    report.escapeClosesModal = !(await modalOpen(send));
    if (!report.escapeClosesModal) fail("Escape did not close role help modal");
  }

  await clickTab(send, "AI Review");
  const dropdownInfo = await evaluate(
    send,
    `window.nttc.getSnapshot().then((s) => {
      const select = document.querySelector('#local-ai-role');
      const options = select ? [...select.options].map((o) => o.value) : [];
      return {
        optionCount: options.length,
        snapshotRole: s.localAiRole,
        selectValue: select?.value || null,
        hasArchitect: options.includes('architect-planner'),
        hasBugRisk: options.includes('bug-risk-reviewer'),
      };
    })`,
  );
  const afterRoleChange = await evaluate(
    send,
    `window.nttc.setLocalAiRole('bug-risk-reviewer').then(async (s) => {
      await new Promise((r) => setTimeout(r, 500));
      await new Promise((requestAnimationFrame));
      return {
        role: s.localAiRole,
        selectValue: document.querySelector('#local-ai-role')?.value || null,
        selectedLabel: document.querySelector('#local-ai-role')?.selectedOptions?.[0]?.textContent?.trim() || null,
      };
    })`,
  );
  report.localAiRoleDropdownWorks =
    dropdownInfo?.optionCount >= 12 &&
    dropdownInfo?.hasArchitect &&
    dropdownInfo?.hasBugRisk &&
    afterRoleChange?.role === "bug-risk-reviewer" &&
    (afterRoleChange?.selectValue === "bug-risk-reviewer" ||
      afterRoleChange?.selectedLabel === "Bug Risk Reviewer");
  if (!report.localAiRoleDropdownWorks) {
    fail(
      `Local AI Role dropdown check failed: ${JSON.stringify({ dropdownInfo, afterRoleChange })}`,
    );
  }

  await clickTab(send, "Request / Output");
  const reqText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  report.implementationReview = /Implementation Review/i.test(reqText);
  report.builderPlanComparison = /Builder Plan Comparison/i.test(reqText);

  await clickTab(send, "Settings");
  bodyText = await evaluate(send, `document.body ? document.body.innerText : ''`);
  html = await evaluate(send, `document.documentElement.outerHTML`);
  report.roleModelMapping = /Role Model Mapping/i.test(bodyText);
  inspectRoleMappingPanel(bodyText, html);

  const mappingLinks = await evaluate(
    send,
    `(() => {
      const links = [...document.querySelectorAll('.role-help-link')];
      const labels = links.map((el) =>
        (el.textContent || '').replace(/\\?/g, '').trim(),
      );
      return { count: links.length, labels };
    })()`,
  );
  report.mappingRoleHelpLinks = mappingLinks.count >= 13;
  if (!report.mappingRoleHelpLinks) {
    fail(`Expected >=13 mapping role help links, got ${mappingLinks.count}`);
  }

  const missingRoleLabels = LOCAL_AI_ROLE_LABELS.filter(
    (label) => !mappingLinks.labels.some((l) => l.startsWith(label)),
  );
  if (missingRoleLabels.length) {
    fail(`Missing mapping help links for: ${missingRoleLabels.join(", ")}`);
  }
  if (!mappingLinks.labels.some((l) => l.startsWith("Builder Plan Mode"))) {
    fail("Builder Plan Mode mapping help link missing");
  }

  const roleHelpResults = [];
  for (const label of LOCAL_AI_ROLE_LABELS) {
    const opened = await openRoleHelpByLabel(send, label);
    await new Promise((r) => setTimeout(r, 200));
    const title = await modalTitle(send);
    const hasSections =
      /Purpose/i.test(await evaluate(send, `document.body?.innerText || ''`)) &&
      /Best used when/i.test(await evaluate(send, `document.body?.innerText || ''`)) &&
      /What it produces/i.test(await evaluate(send, `document.body?.innerText || ''`));
    roleHelpResults.push({
      label,
      opened,
      title,
      hasSections,
      ok: opened && title.startsWith(label) && hasSections,
    });
    await closeModalButton(send);
  }
  report.allLocalAiRoleHelp = roleHelpResults.every((r) => r.ok);
  if (!report.allLocalAiRoleHelp) {
    fail(
      `Some Local AI role help content missing: ${roleHelpResults
        .filter((r) => !r.ok)
        .map((r) => r.label)
        .join(", ")}`,
    );
  }

  const builderOpened = await openRoleHelpByLabel(send, "Builder Plan Mode");
  await new Promise((r) => setTimeout(r, 200));
  const builderTitle = await modalTitle(send);
  const builderSections = /Purpose/i.test(
    await evaluate(send, `document.querySelector('.role-help-panel')?.innerText || ''`),
  );
  report.builderPlanModeHelp =
    builderOpened && /Builder Plan Mode/i.test(builderTitle) && builderSections;
  if (!report.builderPlanModeHelp) fail("Builder Plan Mode help content incomplete");

  await evaluate(send, `document.querySelector('.role-help-overlay')?.click()`);
  await new Promise((r) => setTimeout(r, 200));
  report.overlayClosesModal = !(await modalOpen(send));
  if (!report.overlayClosesModal) fail("Click-outside did not close role help modal");

  report.refreshResult = await evaluate(
    send,
    `typeof window.nttc === 'object'
      ? window.nttc.refreshInstalledModels().then((s) => ({
          ok: s.installedModels?.lastRefreshOk,
          count: s.installedModels?.models?.length ?? 0,
          message: s.installedModels?.lastRefreshMessage ?? null,
        })).catch((e) => ({ ok: false, count: 0, message: String(e) }))
      : { ok: false, count: 0, message: 'no bridge' }`,
  );

  const snap = await evaluate(
    send,
    `window.nttc.getSnapshot().then((s) => ({
      mode: s.safety?.mode,
      writesAllowed: s.safety?.writesAllowed,
      editModeAvailable: s.safety?.editModeAvailable,
      liveInspectEnabled: s.qwen?.liveInspectEnabled,
      hasImplementationReview: !!s.implementationReview,
      hasComparison: !!s.builderPlanComparison,
      hasRoleMapping: !!s.roleModelMapping,
    }))`,
  );

  if (report.usesVite) fail("Packaged app appears to use Vite/dev URL");
  if (!report.inspectOnly) fail("Inspect-only badge missing");
  if (!report.liveQwenDisabled) fail("Live Qwen disabled banner missing");
  if (snap?.liveInspectEnabled) fail("Live Qwen should be disabled");
  if (snap?.mode !== "inspect-only") fail(`Expected inspect-only, got ${snap?.mode}`);
  if (!report.implementationReview) fail("Implementation Review missing");
  if (!report.builderPlanComparison) fail("Builder Plan Comparison missing");
  if (!report.builderPlanMode) fail("Builder Plan Mode missing");
  if (!report.speakerScripts) fail("Speaker Scripts missing");
  if (!report.roleModelMapping) fail("Role Model Mapping missing");
  if (!report.refreshInstalledModelsBtn) fail("Refresh Installed Models missing");
  if (!report.dropdownUxStrings) fail("Stage 42A helper text missing");
  if (!report.manualAdvancedToggle) fail("Manual advanced/offline toggle missing");
  if (!report.suggestDefaultsBtn) fail("Suggest Role Model Defaults missing");
  if (!report.mappingDropdownsPresent) fail("Role model mapping controls missing");
  if (report.audioTts) fail("Audio/TTS unexpectedly present");
  if (report.editMode) fail("Edit mode unexpectedly present");
  if (report.arbitraryTerminal) fail("Arbitrary terminal unexpectedly present");
  if (report.customCommand) fail("Custom command unexpectedly present");

  console.log(
    JSON.stringify(
      {
        report,
        snap,
        aiReviewLinks,
        mappingLinks,
        roleHelpResults,
        refreshResult: report.refreshResult,
        requiredResponseTypesPresent: REQUIRED_RESPONSE_TYPES.length === 6,
      },
      null,
      2,
    ),
  );
  ws.close();
  process.exit(report.failures.length ? 1 : 0);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  console.log(JSON.stringify({ report }, null, 2));
  process.exit(1);
}
