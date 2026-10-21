#!/usr/bin/env node
// PreToolUse gate for poteto-mode: no edit, write, or delegate until the Playbook checklist is in the transcript.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_BLOCKS = 3;
const WRITES = [
  /(^|[^>&0-9=\-<])>>?\s*(?!\/dev\/null|&)[^\s|&;]/,
  /\bsed\s+(-[a-zA-Z]*\s+)*-i/,
  /\btee\b/,
  /\bgit\s+(add|commit|apply|am|stash|rm|mv|checkout\s+--)\b/,
  /(^|[;&|]\s*)(mv|cp|rm|touch|mkdir|patch)\s/,
  /writeFile(Sync)?\(|\.write_text\(|\bopen\([^)]*["'][wa]\+?["']/,
];

export function mutates(tool, input) {
  if (["Edit", "Write", "NotebookEdit", "Agent", "Task"].includes(tool)) return true;
  return tool === "Bash" && WRITES.some((pattern) => pattern.test(input?.command ?? ""));
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.agent_id || !mutates(input.tool_name, input.tool_input)) return 0;

  const state = join(input.scratchpad_dir ?? tmpdir(), `pstack-checklist-${input.session_id}`);
  const blocks = existsSync(state) ? readFileSync(state, "utf8") : "";
  if (blocks === "done" || blocks.length >= MAX_BLOCKS) return 0;

  const transcript = input.transcript_path && existsSync(input.transcript_path) ? readFileSync(input.transcript_path, "utf8") : "";
  if (/"type":"text","text":"Playbook: /.test(transcript)) {
    writeFileSync(state, "done");
    return 0;
  }

  writeFileSync(state, `${blocks}x`);
  process.stderr.write(
    "poteto-mode: no opening checklist yet. Before this edit, write, or delegate, send it as its own message: a first line `Playbook: <name>`, then the playbook's steps as a numbered checklist. If you sent it in this same turn, do not repeat it. Then retry this call.\n"
  );
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
