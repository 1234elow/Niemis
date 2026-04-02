#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NPM_CMD = "npm";

const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const skipQa = args.has("--skip-qa");
const skipBackup = args.has("--skip-backup");

const runCommand = (label, cmd, cmdArgs, cwd) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    console.log(`\n[release-check] ${label}`);
    console.log(`[release-check] $ ${cmd} ${cmdArgs.join(" ")}`);

    const child = spawn(cmd, cmdArgs, {
      cwd,
      shell: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${label} failed with exit code ${code}`));
        return;
      }
      resolve({
        label,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });

async function run() {
  const steps = [];
  if (!skipBuild) {
    steps.push({ label: "Frontend build", cmd: NPM_CMD, args: ["run", "build"], cwd: ROOT });
  }
  if (!skipQa) {
    steps.push({
      label: "Role + audit QA smoke",
      cmd: NPM_CMD,
      args: ["run", "qa:roles"],
      cwd: ROOT,
    });
  }
  if (!skipBackup) {
    steps.push({
      label: "Database backup snapshot",
      cmd: NPM_CMD,
      args: ["run", "db:backup"],
      cwd: ROOT,
    });
  }

  if (steps.length === 0) {
    console.log("[release-check] No steps selected. Remove --skip-* flags.");
    process.exit(0);
  }

  const startedAt = Date.now();
  const results = [];
  for (const step of steps) {
    const result = await runCommand(step.label, step.cmd, step.args, step.cwd);
    results.push(result);
  }

  const backupStep = results.find((result) => result.label === "Database backup snapshot");
  const backupMatch = backupStep?.stdout.match(/"backup_file"\s*:\s*"([^"]+)"/);
  const backupFile = backupMatch ? backupMatch[1] : null;

  const summary = {
    passed: true,
    durationMs: Date.now() - startedAt,
    steps: results.map((result) => ({
      label: result.label,
      durationMs: result.durationMs,
    })),
    ...(backupFile ? { backup_file: backupFile } : {}),
  };

  console.log("\n[release-check] Summary");
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(`\n[release-check] FAILED: ${error.message}`);
  process.exit(1);
});
