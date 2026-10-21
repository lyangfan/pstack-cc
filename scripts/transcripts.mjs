#!/usr/bin/env node
// Reads Claude Code session transcripts for one workspace.
//   transcripts.mjs dir [workspace]
//   transcripts.mjs list [--workspace <path>] [--days <n>] [--grep <text>] [--subagents]
//   transcripts.mjs show <session-id | file> [--workspace <path>] [--grep <text>] [--results] [--max-chars <n>]

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const usage = "usage: transcripts.mjs dir [workspace] | list [--days n] [--grep text] [--subagents] | show <session-id|file> [--grep text] [--results] [--max-chars n], each with optional --workspace <path>";

// The fewest and most positionals each command takes after its name.
const arity = { dir: [0, 1], list: [0, 0], show: [1, 1] };

function parseCommandLine() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      workspace: { type: "string" },
      days: { type: "string", default: "7" },
      grep: { type: "string" },
      "max-chars": { type: "string", default: "2000" },
      subagents: { type: "boolean", default: false },
      results: { type: "boolean", default: false },
    },
  });
  if (!/^\d+(\.\d+)?$/.test(values.days) || Number(values.days) === 0) throw new Error(`invalid --days ${values.days}`);
  if (!/^[1-9]\d*$/.test(values["max-chars"])) throw new Error(`invalid --max-chars ${values["max-chars"]}`);
  const [command, ...rest] = positionals;
  if (command === undefined) throw new Error("missing command");
  if (!Object.hasOwn(arity, command)) throw new Error(`unknown command ${command}`);
  const [min, max] = arity[command];
  if (rest.length < min) throw new Error(`${command} needs a session id or file`);
  if (rest.length > max) throw new Error(`unexpected argument ${rest[max]}`);
  const [target] = rest;
  return {
    command,
    target,
    workspace: values.workspace ?? (command === "dir" ? target : undefined) ?? process.cwd(),
    days: Number(values.days),
    grep: values.grep?.toLowerCase(),
    maxChars: Number(values["max-chars"]),
    subagents: values.subagents,
    results: values.results,
  };
}

let options;
try {
  options = parseCommandLine();
} catch (error) {
  console.error(`${error.message}\n${usage}`);
  process.exit(2);
}

function projectSlug(path) {
  const slug = path.replace(/[^a-zA-Z0-9]/g, "-");
  if (slug.length <= 200) return slug;
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = ((hash << 5) - hash + path.charCodeAt(i)) | 0;
  return `${slug.slice(0, 200)}-${Math.abs(hash).toString(36)}`;
}

// Claude Code names the dir after NFC(realpath(cwd)). A workspace deleted since then
// resolves through its deepest surviving ancestor, so a symlinked parent like /tmp still maps.
function canonical(path) {
  try {
    return realpathSync(path).normalize("NFC");
  } catch {
    const parent = dirname(path);
    return parent === path ? path.normalize("NFC") : join(canonical(parent), basename(path).normalize("NFC"));
  }
}

const workspace = canonical(resolve(options.workspace));
const configDir = (process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude")).normalize("NFC");
// Claude Code honors this override only under a custom config dir, and skips names unsafe as a dir on Windows.
const nameOverride = process.env.CLAUDE_CODE_PROJECT_DIR_NAME ?? "";
const validName = /^[A-Za-z0-9_-]{1,64}$/.test(nameOverride) && !/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(nameOverride);
const useOverride = Boolean(process.env.CLAUDE_CONFIG_DIR) && validName;
// New sessions go to the first dir. Claude Code still reads sessions saved under the plain slug before the override.
const projectDirs = [...new Set([useOverride ? nameOverride : projectSlug(workspace), projectSlug(workspace)])]
  .map((name) => join(configDir, "projects", name));

function sessionFiles(includeSubagents) {
  return projectDirs
    .filter((projectDir) => existsSync(projectDir))
    .flatMap((projectDir) => {
      const top = readdirSync(projectDir)
        .filter((name) => name.endsWith(".jsonl"))
        .map((name) => join(projectDir, name));
      const subagents = includeSubagents
        ? readdirSync(projectDir)
            .map((name) => join(projectDir, name, "subagents"))
            .filter((dir) => existsSync(dir))
            .flatMap((dir) => readdirSync(dir).filter((name) => name.endsWith(".jsonl")).map((name) => join(dir, name)))
        : [];
      return [...top, ...subagents];
    })
    .map((path) => ({ path, mtime: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

function entries(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "string" ? part : part.text ?? "")).join("\n");
}

function isPrompt(entry) {
  if (entry.type !== "user" || entry.isMeta) return false;
  const content = entry.message?.content;
  return typeof content === "string" || (Array.isArray(content) && content.some((part) => part.type === "text"));
}

function contains(value, needle) {
  if (typeof value === "string") return value.toLowerCase().includes(needle);
  return Boolean(value) && typeof value === "object" && Object.values(value).some((child) => contains(child, needle));
}

function summarize(all) {
  const prompts = all.filter(isPrompt).map((entry) => textOf(entry.message.content).trim());
  const title = all.findLast((entry) => entry.type === "ai-title")?.aiTitle ?? "";
  const start = all.find((entry) => entry.timestamp)?.timestamp ?? "";
  return { prompts, title, start };
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// One grapheme can hold any number of combining marks, so code units are capped too.
// 32 per grapheme is double the longest standard emoji sequence.
function truncate(text, max) {
  let count = 0;
  for (const { index, segment } of graphemes.segment(text)) {
    if (count++ === max || index + segment.length > max * 32) return text.slice(0, index);
  }
  return text;
}

function oneLine(text, max) {
  const flat = text.replace(/\s+/g, " ").trim();
  const cut = truncate(flat, max);
  return cut === flat ? flat : `${cut}…`;
}

function list() {
  const { days, grep } = options;
  const cutoff = Date.now() - days * 86_400_000;
  const rows = sessionFiles(options.subagents).filter(({ mtime }) => mtime >= cutoff);
  for (const projectDir of projectDirs) console.log(`# ${projectDir}`);
  for (const { path, mtime } of rows) {
    const all = entries(path);
    if (grep && !contains(all, grep)) continue;
    const { prompts, title } = summarize(all);
    const id = basename(path, ".jsonl");
    const when = `${new Date(mtime).toISOString().slice(0, 16).replace("T", " ")} UTC`;
    console.log(`${when}  ${id}  ${prompts.length} prompts  ${title ? `[${title}] ` : ""}${oneLine(prompts[0] ?? "", 100)}`);
  }
}

function locate(target) {
  if (existsSync(target)) return target;
  const match = sessionFiles(true).find(({ path }) => basename(path, ".jsonl") === target);
  if (!match) throw new Error(`no transcript ${target} under ${projectDirs.join(" or ")}`);
  return match.path;
}

function show() {
  const { grep, maxChars, results } = options;
  const path = locate(options.target);
  console.log(`# ${path}`);
  for (const entry of entries(path)) {
    if (entry.type !== "user" && entry.type !== "assistant") continue;
    const content = entry.message?.content;
    const parts = typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : [];
    const lines = [];
    const searchable = [];
    for (const part of parts) {
      if (part.type === "text" && part.text?.trim()) {
        lines.push(truncate(part.text.trim(), maxChars));
        searchable.push(part.text);
      }
      if (part.type === "tool_use") {
        lines.push(`→ ${part.name} ${oneLine(JSON.stringify(part.input ?? {}), 300)}`);
        searchable.push(part.name, part.input);
      }
      if (part.type === "tool_result" && results) {
        const result = textOf(part.content);
        lines.push(`← ${oneLine(result, 300)}`);
        searchable.push(result);
      }
    }
    if (lines.length === 0) continue;
    if (grep && !contains(searchable, grep)) continue;
    const block = lines.join("\n");
    const role = isPrompt(entry) ? "USER" : entry.type === "user" ? "tool" : "ASSISTANT";
    console.log(`\n## ${role} ${entry.timestamp ?? ""}\n${block}`);
  }
}

try {
  if (options.command === "dir") console.log(projectDirs[0]);
  else if (options.command === "list") list();
  else show();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
