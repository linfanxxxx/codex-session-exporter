import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCodexHome, writeText } from "./utils.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_NAME = "codex-session-exporter";
const SKILL_SOURCE_DIR = path.join(PACKAGE_ROOT, "skills", SKILL_NAME);

export async function installSkill({ codexHome } = {}) {
  const resolvedCodexHome = resolveCodexHome(codexHome);
  const targetSkillDir = path.join(resolvedCodexHome, "skills", SKILL_NAME);
  const installEnvFile = path.join(targetSkillDir, ".install-env");
  const runnerFile = path.join(targetSkillDir, "scripts", "run-exporter.sh");

  await assertSkillSourceExists();
  await fs.mkdir(path.join(resolvedCodexHome, "skills"), { recursive: true });
  await fs.rm(targetSkillDir, { recursive: true, force: true });
  await fs.cp(SKILL_SOURCE_DIR, targetSkillDir, { recursive: true });
  await fs.chmod(runnerFile, 0o755);
  await writeText(
    installEnvFile,
    [
      `CODEX_SESSION_EXPORTER_REPO_ROOT=${shellQuote(PACKAGE_ROOT)}`,
      `CODEX_SESSION_PORTABILITY_REPO_ROOT=${shellQuote(PACKAGE_ROOT)}`,
      "",
    ].join("\n"),
  );

  return {
    codexHome: resolvedCodexHome,
    packageRoot: PACKAGE_ROOT,
    skillName: SKILL_NAME,
    targetSkillDir,
  };
}

async function assertSkillSourceExists() {
  try {
    const stat = await fs.stat(SKILL_SOURCE_DIR);

    if (!stat.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(`Bundled skill directory is missing: ${SKILL_SOURCE_DIR}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\"'\"'`)}'`;
}
