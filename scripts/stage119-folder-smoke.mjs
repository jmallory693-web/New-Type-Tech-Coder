/**
 * Stage 119 structural folder-safety smoke (main-process assess helper only).
 * Does not launch the UI. Does not create scaffold app files beyond tiny temp dirs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const ASSESS_JS = path.join(
  REPO,
  "dist-electron",
  "main",
  "buildMode",
  "assessSafeScaffoldTarget.js",
);

async function main() {
  if (!fs.existsSync(ASSESS_JS)) {
    console.error("Missing built assess helper:", ASSESS_JS);
    process.exit(1);
  }

  const mod = await import(pathToFileURL(ASSESS_JS).href);
  const assess = mod.assessSafeScaffoldTarget;
  if (typeof assess !== "function") {
    console.error("assessSafeScaffoldTarget export missing");
    process.exit(1);
  }

  const stamp = Date.now();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `nttc-s119-${stamp}-`));
  const emptyDir = path.join(root, "empty");
  const readmeDir = path.join(root, "readme-only");
  const pkgDir = path.join(root, "has-package");
  const srcDir = path.join(root, "has-src");
  const releaseDir = path.join(root, "release");
  const nmDir = path.join(root, "node_modules");

  fs.mkdirSync(emptyDir);
  fs.mkdirSync(readmeDir);
  fs.writeFileSync(path.join(readmeDir, "README.md"), "# smoke\n");
  fs.mkdirSync(pkgDir);
  fs.writeFileSync(path.join(pkgDir, "package.json"), "{}\n");
  fs.mkdirSync(srcDir);
  fs.mkdirSync(path.join(srcDir, "src"));
  fs.mkdirSync(releaseDir);
  fs.writeFileSync(path.join(releaseDir, "app.exe"), "x");
  fs.mkdirSync(nmDir);
  fs.writeFileSync(path.join(nmDir, "pkg"), "x");

  const projectRoot = REPO;
  const parentOfProject = path.dirname(projectRoot);
  const home = os.homedir();
  const driveRoot = path.parse(projectRoot).root;

  const cases = [
    {
      name: "1 empty temp folder",
      selectedPath: emptyDir,
      expect: "safe",
    },
    {
      name: "2 README-only folder",
      selectedPath: readmeDir,
      expect: "caution",
    },
    {
      name: "3 current NTTC project",
      selectedPath: projectRoot,
      expect: "blocked",
    },
    {
      name: "4 package.json folder",
      selectedPath: pkgDir,
      expect: "blocked",
    },
    {
      name: "5 src/ folder",
      selectedPath: srcDir,
      expect: "blocked",
    },
    {
      name: "6 release/ folder",
      selectedPath: releaseDir,
      expect: "blocked",
    },
    {
      name: "7 node_modules/ folder",
      selectedPath: nmDir,
      expect: "blocked",
    },
    {
      name: "8 parent of current project",
      selectedPath: parentOfProject,
      expect: "blocked",
    },
    {
      name: "9 user home",
      selectedPath: home,
      expect: "blocked",
    },
    {
      name: "10 drive root",
      selectedPath: driveRoot,
      expect: "blocked",
    },
  ];

  let failed = 0;
  console.log("Stage 119 folder safety smoke");
  console.log("projectRoot:", projectRoot);
  for (const c of cases) {
    const result = assess({
      selectedPath: c.selectedPath,
      currentProjectRoot: projectRoot,
    });
    const ok = result.status === c.expect;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"} ${c.name} → ${result.status} (expect ${c.expect})`,
    );
    if (!ok || process.env.VERBOSE) {
      console.log("  reasons:", result.reasons.join(" | "));
    }
  }

  // Confirm no extra files were created inside fixture dirs beyond what we wrote.
  const emptyAfter = fs.readdirSync(emptyDir);
  if (emptyAfter.length !== 0) {
    failed += 1;
    console.log("FAIL empty folder remained empty check — entries:", emptyAfter);
  } else {
    console.log("PASS empty folder remained empty (no creates by assess)");
  }

  // Structural UI source checks (no Create Files / Scaffold / Write buttons).
  const buildTab = fs.readFileSync(
    path.join(REPO, "src", "renderer", "components", "BuildModeTab.tsx"),
    "utf8",
  );
  const forbiddenButtonPatterns = [
    />\s*Create Files\s*</,
    />\s*Scaffold\s*</,
    />\s*Write\s*</,
    />\s*Apply Patch\s*</,
    />\s*Install\s*</,
  ];
  for (const pattern of forbiddenButtonPatterns) {
    if (pattern.test(buildTab)) {
      failed += 1;
      console.log(`FAIL BuildModeTab appears to expose forbidden control: ${pattern}`);
    }
  }
  if (
    !buildTab.includes("No Create Files, Scaffold, or Write controls exist yet.")
  ) {
    failed += 1;
    console.log("FAIL BuildModeTab missing explicit no-write controls note");
  } else {
    console.log("PASS BuildModeTab notes no Create Files/Scaffold/Write controls");
  }
  for (const ok of [
    "Select Target Folder",
    "Clear Target Folder",
    "Refresh Folder Safety Check",
    "Future write readiness",
  ]) {
    if (!buildTab.includes(ok)) {
      failed += 1;
      console.log(`FAIL BuildModeTab missing expected control text: ${ok}`);
    } else {
      console.log(`PASS BuildModeTab has: ${ok}`);
    }
  }

  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }

  if (failed > 0) {
    console.error(`FAILED ${failed} check(s)`);
    process.exit(1);
  }
  console.log("ALL STAGE 119 FOLDER SMOKE CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
