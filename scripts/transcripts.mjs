#!/usr/bin/env node
// Reads Claude Code session transcripts for one workspace.
//   transcripts.mjs dir [workspace]
//   transcripts.mjs list [--workspace <path>] [--days <n>] [--grep <text>] [--subagents]
//   transcripts.mjs show <session-id | file> [--workspace <path>] [--grep <text>] [--results] [--max-chars <n>]

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const usage = "usage: transcripts.mjs dir [workspace] | list [--days n] [--grep text] [--subagents] | show <session-id|file> [--grep text] [--results] [--max-chars n]";
const number = (name, fallback) => {
  const value = Number(option(name, fallback));
  if (Number.isFinite(value)) return value;
  console.error(usage);
  process.exit(2);
};

function projectSlug(path) {
  const slug = path.replace(/[^a-zA-Z0-9]/g, "-");
  if (slug.length <= 200) return slug;
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = ((hash << 5) - hash + path.charCodeAt(i)) | 0;
  return `${slug.slice(0, 200)}-${Math.abs(hash).toString(36)}`;
}

const workspace = resolve(option("workspace", command === "dir" && args[1] ? args[1] : process.cwd()));
const projectDir = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects", projectSlug(workspace));

function sessionFiles(includeSubagents) {
  if (!existsSync(projectDir)) return [];
  const top = readdirSync(projectDir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(projectDir, name));
  const subagents = includeSubagents
    ? readdirSync(projectDir)
        .map((name) => join(projectDir, name, "subagents"))
        .filter((dir) => existsSync(dir))
        .flatMap((dir) => readdirSync(dir).filter((name) => name.endsWith(".jsonl")).map((name) => join(dir, name)))
    : [];
  return [...top, ...subagents]
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

function summarize(path) {
  const all = entries(path);
  const prompts = all.filter(isPrompt).map((entry) => textOf(entry.message.content).trim());
  const title = all.findLast((entry) => entry.type === "ai-title")?.aiTitle ?? "";
  const start = all.find((entry) => entry.timestamp)?.timestamp ?? "";
  return { prompts, title, start };
}

function oneLine(text, max) {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = [...flat];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : flat;
}

function list() {
  const days = number("days", "7");
  const grep = option("grep")?.toLowerCase();
  const cutoff = Date.now() - days * 86_400_000;
  const rows = sessionFiles(flag("subagents")).filter(({ mtime }) => mtime >= cutoff);
  console.log(`# ${projectDir}`);
  for (const { path, mtime } of rows) {
    if (grep && !readFileSync(path, "utf8").toLowerCase().includes(grep)) continue;
    const { prompts, title } = summarize(path);
    const id = basename(path, ".jsonl");
    const when = `${new Date(mtime).toISOString().slice(0, 16).replace("T", " ")} UTC`;
    console.log(`${when}  ${id}  ${prompts.length} prompts  ${title ? `[${title}] ` : ""}${oneLine(prompts[0] ?? "", 100)}`);
  }
}

function locate(target) {
  if (existsSync(target)) return target;
  const match = sessionFiles(true).find(({ path }) => basename(path, ".jsonl") === target);
  if (!match) throw new Error(`no transcript ${target} under ${projectDir}`);
  return match.path;
}

function show() {
  const path = locate(args[1]);
  const grep = option("grep")?.toLowerCase();
  const maxChars = number("max-chars", "2000");
  const results = flag("results");
  console.log(`# ${path}`);
  for (const entry of entries(path)) {
    if (entry.type !== "user" && entry.type !== "assistant") continue;
    const content = entry.message?.content;
    const parts = typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : [];
    const lines = [];
    for (const part of parts) {
      if (part.type === "text" && part.text?.trim()) lines.push(part.text.trim().slice(0, maxChars));
      if (part.type === "tool_use") lines.push(`→ ${part.name} ${oneLine(JSON.stringify(part.input ?? {}), 300)}`);
      if (part.type === "tool_result" && results) lines.push(`← ${oneLine(textOf(part.content), 300)}`);
    }
    if (lines.length === 0) continue;
    const block = lines.join("\n");
    if (grep && !block.toLowerCase().includes(grep)) continue;
    const role = isPrompt(entry) ? "USER" : entry.type === "user" ? "tool" : "ASSISTANT";
    console.log(`\n## ${role} ${entry.timestamp ?? ""}\n${block}`);
  }
}

try {
  if (command === "dir") console.log(projectDir);
  else if (command === "list") list();
  else if (command === "show" && args[1]) show();
  else {
    console.error(usage);
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
