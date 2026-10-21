import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { mutates } from "./checklist-gate.mjs";

const gate = join(import.meta.dirname, "checklist-gate.mjs");

function run(input) {
  return spawnSync(process.execPath, [gate], { input: JSON.stringify(input), encoding: "utf8" });
}

function session(transcriptLines) {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const transcript = join(dir, "t.jsonl");
  writeFileSync(transcript, transcriptLines.map((line) => JSON.stringify(line)).join("\n"));
  return { dir, base: { session_id: "s", transcript_path: transcript, scratchpad_dir: dir } };
}

const said = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });

describe("mutates", () => {
  for (const command of [
    "cat -n scripts/transcripts.mjs; sed -n 1,80p scripts/transcripts.test.mjs",
    "npm test 2>&1 | tail -12",
    "git diff c337c5d..HEAD -- scripts/transcripts.mjs",
    "node -e 'const h=(p)=>{let x=0;return x}'",
    "grep -n foo bar 2>/dev/null | head",
    "git log --oneline -3 && git status --short",
  ]) {
    test(`reads: ${command}`, () => assert.equal(mutates("Bash", { command }), false));
  }

  for (const command of [
    "sed -i '' s/a/b/ f.txt",
    "echo hi > note.txt",
    "cat >> scripts/x.mjs <<'EOF'\nfoo\nEOF",
    "python3 - <<'EOF'\np='x'\nopen(p,'w').write(s)\nEOF",
    "git add -A && git commit -m x",
    "mkdir -p /tmp/x && cd /tmp/x",
    `node -e 'require("fs").writeFileSync("a","b")'`,
  ]) {
    test(`writes: ${command}`, () => assert.equal(mutates("Bash", { command }), true));
  }

  test("edit, write, and delegate tools always count", () => {
    for (const tool of ["Edit", "Write", "NotebookEdit", "Agent", "Task"]) assert.equal(mutates(tool, {}), true);
    assert.equal(mutates("Read", {}), false);
  });
});

describe("gate", () => {
  test("blocks a write until the checklist appears, then lets every call through", () => {
    const { dir, base } = session([said("Step 1.")]);
    const write = { ...base, tool_name: "Write", tool_input: {} };
    assert.equal(run(write).status, 2);
    assert.match(run(write).stderr, /Playbook: <name>/);
    writeFileSync(base.transcript_path, JSON.stringify(said("Playbook: Bug fix\n1. [ ] x")));
    assert.equal(run(write).status, 0);
    writeFileSync(base.transcript_path, JSON.stringify(said("Step 2.")));
    assert.equal(run(write).status, 0, "stays open once the checklist was seen");
    rmSync(dir, { recursive: true });
  });

  test("gives up after three blocks so a run cannot loop", () => {
    const { dir, base } = session([said("Step 1.")]);
    const write = { ...base, tool_name: "Edit", tool_input: {} };
    assert.deepEqual([1, 2, 3, 4].map(() => run(write).status), [2, 2, 2, 0]);
    rmSync(dir, { recursive: true });
  });

  test("never blocks reads or subagents", () => {
    const { dir, base } = session([said("Step 1.")]);
    assert.equal(run({ ...base, tool_name: "Bash", tool_input: { command: "git status" } }).status, 0);
    assert.equal(run({ ...base, agent_id: "a1", tool_name: "Write", tool_input: {} }).status, 0);
    rmSync(dir, { recursive: true });
  });
});
