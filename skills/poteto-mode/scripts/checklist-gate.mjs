#!/usr/bin/env node
// PreToolUse gate for poteto-mode: the first edit or delegate of a session waits for the Playbook checklist.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.agent_id) process.exit(0);

const marker = join(input.scratchpad_dir ?? tmpdir(), `pstack-checklist-${input.session_id}`);
if (existsSync(marker)) process.exit(0);
writeFileSync(marker, "");

const transcript = input.transcript_path && existsSync(input.transcript_path) ? readFileSync(input.transcript_path, "utf8") : "";
if (/"type":"text","text":"Playbook: /.test(transcript)) process.exit(0);

process.stderr.write(
  "poteto-mode: this is the session's first edit or delegate. If you have not sent the opening checklist yet, send it now as its own message: a first line `Playbook: <name>`, then the playbook's steps as a numbered checklist. If you already sent it, do not repeat it. Retry this call either way. This gate fires once per session.\n"
);
process.exit(2);
