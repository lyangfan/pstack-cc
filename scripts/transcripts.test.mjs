import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";

const script = join(import.meta.dirname, "transcripts.mjs");
const roots = [];
const DAY = 86_400_000;
const workspace = "/work/space";
const slug = "-work-space";

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "transcripts-test-"));
  roots.push(dir);
  return dir;
}

after(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

function run(home, args, extraEnv = {}, cwd = undefined) {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: undefined, CLAUDE_CODE_PROJECT_DIR_NAME: undefined, HOME: home, ...extraEnv };
  return spawnSync(process.execPath, [script, ...args], { env, cwd, encoding: "utf8" });
}

// Entries may be objects or raw strings (to plant malformed lines).
function writeSession(projectDir, id, entries, { mtime, subagentOf } = {}) {
  const file = subagentOf
    ? join(projectDir, subagentOf, "subagents", `${id}.jsonl`)
    : join(projectDir, `${id}.jsonl`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, entries.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n") + "\n");
  if (mtime !== undefined) utimesSync(file, new Date(mtime), new Date(mtime));
  return file;
}

const prompt = (text, extra = {}) => ({
  type: "user",
  message: { role: "user", content: text },
  timestamp: "2026-01-02T03:04:05.000Z",
  uuid: crypto.randomUUID(),
  ...extra,
});
const toolResult = (text, id = "toolu_1") => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: text }] },
  timestamp: "2026-01-02T03:04:07.000Z",
});
const assistant = (...parts) => ({
  type: "assistant",
  message: { role: "assistant", content: parts },
  timestamp: "2026-01-02T03:04:06.000Z",
});
const text = (t) => ({ type: "text", text: t });

function fixture() {
  const home = tempDir();
  const projectDir = join(home, ".claude", "projects", slug);
  mkdirSync(projectDir, { recursive: true });
  return { home, projectDir, args: (...rest) => [...rest, "--workspace", workspace] };
}

describe("dir", () => {
  const cases = [
    ["/Users/test/proj", "-Users-test-proj"],
    ["/Users/test/My Project_1", "-Users-test-My-Project-1"],
    ["/Users/test/a.b@c+d", "-Users-test-a-b-c-d"],
    ["/w/😀", "-w---"],
    ["/w/" + "a".repeat(197), "-w-" + "a".repeat(197)],
    ["/w/" + "a".repeat(198), "-w-" + "a".repeat(197) + "-ipsd09"],
    ["/w/" + "a".repeat(210), "-w-" + "a".repeat(197) + "-u83o13"],
    ["/w/" + "b".repeat(210), "-w-" + "b".repeat(197) + "-u45l6h"],
  ];
  const label = (s) => (s.length > 40 ? `${s.slice(0, 8)}… (${s.length} chars)` : s);
  for (const [path, name] of cases) {
    test(`maps ${label(path)} to ${label(name)}`, () => {
      const home = tempDir();
      const { status, stdout } = run(home, ["dir", path]);
      assert.equal(status, 0);
      assert.equal(stdout.trim(), join(home, ".claude", "projects", name));
    });
  }

  test("--workspace overrides the positional workspace", () => {
    const home = tempDir();
    const { stdout } = run(home, ["dir", "/Users/test/proj", "--workspace", "/Users/test/other"]);
    assert.equal(stdout.trim(), join(home, ".claude", "projects", "-Users-test-other"));
  });

  test("defaults to the current directory", () => {
    const home = tempDir();
    const cwd = realpathSync(tempDir());
    const fromCwd = run(home, ["dir"], {}, cwd);
    assert.equal(fromCwd.status, 0);
    assert.equal(fromCwd.stdout, run(home, ["dir", cwd]).stdout);
  });

  test("resolves a symlinked workspace to its target", () => {
    const home = tempDir();
    const target = realpathSync(tempDir());
    const link = join(tempDir(), "link");
    symlinkSync(target, link);
    const viaLink = run(home, ["dir", link]);
    assert.equal(viaLink.status, 0);
    assert.equal(viaLink.stdout, run(home, ["dir", target]).stdout);
  });

  test("resolves a deleted workspace through its symlinked parent", () => {
    const home = tempDir();
    const target = realpathSync(tempDir());
    const link = join(tempDir(), "link");
    symlinkSync(target, link);
    const { status, stdout } = run(home, ["dir", join(link, "gone", "deeper")]);
    assert.equal(status, 0);
    assert.equal(stdout.trim(), join(home, ".claude", "projects", `${target}/gone/deeper`.replace(/[^a-zA-Z0-9]/g, "-")));
  });

  test("NFC-normalizes the workspace and CLAUDE_CONFIG_DIR", () => {
    const home = tempDir();
    const config = tempDir();
    const decomposed = "cafe\u0301";
    const { stdout } = run(home, ["dir", `/w/${decomposed}`], { CLAUDE_CONFIG_DIR: join(config, decomposed) });
    assert.equal(stdout.trim(), join(config, "caf\u00e9", "projects", "-w-caf-"));
  });

  test("CLAUDE_CONFIG_DIR replaces ~/.claude", () => {
    const home = tempDir();
    const config = tempDir();
    const { status, stdout } = run(home, ["dir", "/Users/test/proj"], { CLAUDE_CONFIG_DIR: config });
    assert.equal(status, 0);
    assert.equal(stdout.trim(), join(config, "projects", "-Users-test-proj"));
  });

  test("CLAUDE_CODE_PROJECT_DIR_NAME names the dir when CLAUDE_CONFIG_DIR is set", () => {
    const home = tempDir();
    const config = tempDir();
    const { stdout } = run(home, ["dir", "/Users/test/proj"], { CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_PROJECT_DIR_NAME: "my_proj-1" });
    assert.equal(stdout.trim(), join(config, "projects", "my_proj-1"));
  });

  test("CLAUDE_CODE_PROJECT_DIR_NAME is ignored when invalid or without CLAUDE_CONFIG_DIR", () => {
    const home = tempDir();
    const config = tempDir();
    for (const name of ["a/b", "a.b", "COM1", "nul", "x".repeat(65)]) {
      const { stdout } = run(home, ["dir", "/Users/test/proj"], { CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_PROJECT_DIR_NAME: name });
      assert.equal(stdout.trim(), join(config, "projects", "-Users-test-proj"), name);
    }
    const { stdout } = run(home, ["dir", "/Users/test/proj"], { CLAUDE_CODE_PROJECT_DIR_NAME: "my_proj" });
    assert.equal(stdout.trim(), join(home, ".claude", "projects", "-Users-test-proj"));
  });

  test("with CLAUDE_CODE_PROJECT_DIR_NAME, list and show also read the plain-slug dir", () => {
    const home = tempDir();
    const config = tempDir();
    const env = { CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_PROJECT_DIR_NAME: "my_proj" };
    writeSession(join(config, "projects", "my_proj"), "sess-override", [prompt("after override")]);
    writeSession(join(config, "projects", "-Users-test-proj"), "sess-plain", [prompt("before override")]);
    const listed = run(home, ["list", "--workspace", "/Users/test/proj"], env);
    assert.match(listed.stdout, /sess-override\s+1 prompts\s+after override/);
    assert.match(listed.stdout, /sess-plain\s+1 prompts\s+before override/);
    const shown = run(home, ["show", "sess-plain", "--workspace", "/Users/test/proj"], env);
    assert.equal(shown.status, 0);
    assert.match(shown.stdout, /## USER[^\n]*\nbefore override/);
  });

  test("list reads sessions from CLAUDE_CONFIG_DIR", () => {
    const home = tempDir();
    const config = tempDir();
    writeSession(join(config, "projects", "-Users-test-proj"), "in-config", [prompt("from config home")]);
    const { stdout } = run(home, ["list", "--workspace", "/Users/test/proj"], { CLAUDE_CONFIG_DIR: config });
    assert.match(stdout, /in-config\s+1 prompts\s+from config home/);
  });
});

describe("list", () => {
  test("prints only the header and exits 0 when the project dir is missing", () => {
    const home = tempDir();
    const { status, stdout } = run(home, ["list", "--workspace", workspace]);
    assert.equal(status, 0);
    assert.deepEqual(stdout.trim().split("\n"), [`# ${join(home, ".claude", "projects", slug)}`]);
  });

  test("lists newest session first", () => {
    const f = fixture();
    const now = Date.now();
    writeSession(f.projectDir, "sess-old", [prompt("old")], { mtime: now - 3 * DAY });
    writeSession(f.projectDir, "sess-new", [prompt("new")], { mtime: now - 1000 });
    writeSession(f.projectDir, "sess-mid", [prompt("mid")], { mtime: now - DAY });
    const { status, stdout } = run(f.home, f.args("list"));
    assert.equal(status, 0);
    const ids = stdout.split("\n").flatMap((line) => line.match(/sess-\w+/) ?? []);
    assert.deepEqual(ids, ["sess-new", "sess-mid", "sess-old"]);
  });

  test("labels the session time as UTC whatever the local timezone", () => {
    const f = fixture();
    const at = new Date(Date.now() - DAY);
    at.setUTCHours(14, 3, 0, 0);
    writeSession(f.projectDir, "sess-utc", [prompt("hello")], { mtime: at.getTime() });
    const { status, stdout } = run(f.home, f.args("list"), { TZ: "America/Los_Angeles" });
    assert.equal(status, 0);
    assert.equal(stdout.trim().split("\n")[1], `${at.toISOString().slice(0, 10)} 14:03 UTC  sess-utc  1 prompts  hello`);
  });

  test("counts only real prompts and shows the last ai-title", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [
      { type: "mode", mode: "normal" },
      { type: "ai-title", aiTitle: "First title" },
      prompt("fix the login bug"),
      prompt("<system-reminder>injected</system-reminder>", { isMeta: true }),
      assistant(text("on it"), { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: "/x" } }),
      toolResult("file contents"),
      "{not valid json",
      prompt("now add tests"),
      { type: "ai-title", aiTitle: "Login fix" },
      { type: "last-prompt", lastPrompt: "now add tests" },
    ]);
    const { status, stdout } = run(f.home, f.args("list"));
    assert.equal(status, 0);
    assert.match(stdout, /sess-a\s+2 prompts\s+\[Login fix\] fix the login bug/);
    assert.doesNotMatch(stdout, /First title/);
  });

  test("omits the bracket when there is no ai-title", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("plain")]);
    const { stdout } = run(f.home, f.args("list"));
    assert.match(stdout, /sess-a\s+1 prompts\s+plain/);
    assert.doesNotMatch(stdout, /\[/);
  });

  test("truncates a long first prompt to 100 chars with an ellipsis", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("x".repeat(150))]);
    const { stdout } = run(f.home, f.args("list"));
    assert.ok(stdout.includes(`${"x".repeat(100)}…`));
    assert.ok(!stdout.includes("x".repeat(101)));
  });

  test("collapses whitespace in the first prompt", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("line one\n\n   line   two")]);
    const { stdout } = run(f.home, f.args("list"));
    assert.ok(stdout.includes("line one line two"));
  });

  test("truncation does not split an emoji", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt(`${"a".repeat(99)}😀 and more text after`)]);
    const { stdout } = run(f.home, f.args("list"));
    assert.ok(stdout.includes(`${"a".repeat(99)}😀…`));
  });

  for (const [kind, emoji] of [["flag", "🇺🇸"], ["ZWJ family", "👨‍👩‍👧"]]) {
    test(`truncation does not split a ${kind} emoji`, () => {
      const f = fixture();
      writeSession(f.projectDir, "sess-a", [prompt(`${"a".repeat(99)}${emoji} and more text after`)]);
      const { stdout } = run(f.home, f.args("list"));
      assert.ok(stdout.includes(`${"a".repeat(99)}${emoji}…`), stdout);
    });
  }

  test("--days excludes older sessions", () => {
    const f = fixture();
    const now = Date.now();
    writeSession(f.projectDir, "sess-recent", [prompt("recent")], { mtime: now - DAY });
    writeSession(f.projectDir, "sess-ancient", [prompt("ancient")], { mtime: now - 30 * DAY });
    const week = run(f.home, f.args("list")).stdout;
    assert.match(week, /sess-recent/);
    assert.doesNotMatch(week, /sess-ancient/);
    const narrow = run(f.home, f.args("list", "--days", "0.5")).stdout;
    assert.doesNotMatch(narrow, /sess-recent/);
    const wide = run(f.home, f.args("list", "--days", "60")).stdout;
    assert.match(wide, /sess-recent/);
    assert.match(wide, /sess-ancient/);
  });

  test("--grep filters case-insensitively", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-k8s", [prompt("deploy to Kubernetes")]);
    writeSession(f.projectDir, "sess-other", [prompt("rename a variable")]);
    const { stdout } = run(f.home, f.args("list", "--grep", "KUBERNETES"));
    assert.match(stdout, /sess-k8s/);
    assert.doesNotMatch(stdout, /sess-other/);
  });

  test("--grep matches text containing double quotes and backslashes", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-quoted", [prompt('run grep "TODO" in C:\\src')]);
    writeSession(f.projectDir, "sess-other", [prompt("rename a variable")]);
    for (const needle of ['grep "TODO"', "C:\\src", '"todo" in c:\\']) {
      const { stdout } = run(f.home, f.args("list", "--grep", needle));
      assert.match(stdout, /sess-quoted/, `--grep ${needle}`);
      assert.doesNotMatch(stdout, /sess-other/, `--grep ${needle}`);
    }
  });

  test("subagent transcripts appear only with --subagents", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-main", [prompt("main task")]);
    writeSession(f.projectDir, "agent-x", [prompt("subagent task")], { subagentOf: "sess-main" });
    const without = run(f.home, f.args("list")).stdout;
    assert.match(without, /sess-main/);
    assert.doesNotMatch(without, /agent-x/);
    const withFlag = run(f.home, f.args("list", "--subagents")).stdout;
    assert.match(withFlag, /sess-main/);
    assert.match(withFlag, /agent-x\s+1 prompts\s+subagent task/);
  });
});

describe("show", () => {
  function conversation(f) {
    return writeSession(f.projectDir, "sess-a", [
      { type: "permission-mode", permissionMode: "default" },
      prompt("please read the config"),
      assistant({ type: "thinking", thinking: "hmm" }, text("Reading it now."), {
        type: "tool_use",
        id: "toolu_1",
        name: "Read",
        input: { file_path: "/etc/config" },
      }),
      "garbage {{",
      toolResult("port=8080"),
      assistant(text("The port is 8080.")),
      { type: "system", content: "noise" },
    ]);
  }

  test("labels prompts, assistant text and tool calls; hides results by default", () => {
    const f = fixture();
    conversation(f);
    const { status, stdout } = run(f.home, f.args("show", "sess-a"));
    assert.equal(status, 0);
    assert.match(stdout, /## USER[^\n]*\nplease read the config/);
    assert.match(stdout, /## ASSISTANT[^\n]*\nReading it now\.\n→ Read \{"file_path":"\/etc\/config"\}/);
    assert.match(stdout, /## ASSISTANT[^\n]*\nThe port is 8080\./);
    assert.doesNotMatch(stdout, /hmm/);
    assert.doesNotMatch(stdout, /←/);
    assert.doesNotMatch(stdout, /port=8080/);
    assert.doesNotMatch(stdout, /noise/);
  });

  test("--results shows tool results", () => {
    const f = fixture();
    conversation(f);
    const { stdout } = run(f.home, f.args("show", "sess-a", "--results"));
    assert.match(stdout, /← port=8080/);
  });

  test("--grep keeps only matching blocks, case-insensitively", () => {
    const f = fixture();
    conversation(f);
    const { stdout } = run(f.home, f.args("show", "sess-a", "--grep", "THE PORT"));
    assert.match(stdout, /The port is 8080\./);
    assert.doesNotMatch(stdout, /please read the config/);
    assert.doesNotMatch(stdout, /Reading it now/);
  });

  test("--grep matches tool input and text as written, not as rendered", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [
      assistant({ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: 'grep -rn "TODO" src' } }),
      assistant({ type: "tool_use", id: "toolu_2", name: "Bash", input: { command: `echo ${"x".repeat(400)} && tail-marker` } }),
      assistant(text(`${"y".repeat(50)} late-word`)),
    ]);
    for (const needle of ['grep -rn "TODO"', "tail-marker", "late-word"]) {
      const { stdout } = run(f.home, f.args("show", "sess-a", "--grep", needle, "--max-chars", "10"));
      assert.equal(stdout.match(/^## /gm)?.length, 1, `--grep ${needle}`);
    }
  });

  test("--max-chars truncates text", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("y".repeat(50))]);
    const { stdout } = run(f.home, f.args("show", "sess-a", "--max-chars", "10"));
    assert.ok(stdout.includes("y".repeat(10)));
    assert.ok(!stdout.includes("y".repeat(11)));
  });

  test("--max-chars does not split emoji", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("😀🇺🇸👨‍👩‍👧 hello")]);
    for (const [max, body] of [["1", "😀"], ["2", "😀🇺🇸"], ["3", "😀🇺🇸👨‍👩‍👧"]]) {
      const { stdout } = run(f.home, f.args("show", "sess-a", "--max-chars", max));
      assert.equal(stdout.trimEnd().split("\n").at(-1), body, `--max-chars ${max}`);
    }
  });

  test("finds a subagent transcript by id", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-main", [prompt("main")]);
    writeSession(f.projectDir, "agent-x", [prompt("subagent prompt")], { subagentOf: "sess-main" });
    const { status, stdout } = run(f.home, f.args("show", "agent-x"));
    assert.equal(status, 0);
    assert.match(stdout, /## USER[^\n]*\nsubagent prompt/);
  });

  test("accepts a file path", () => {
    const f = fixture();
    const file = conversation(f);
    const elsewhere = run(tempDir(), ["show", file]);
    assert.equal(elsewhere.status, 0);
    assert.match(elsewhere.stdout, /please read the config/);
  });

  test("unknown id exits 1 with a message on stderr", () => {
    const f = fixture();
    const { status, stdout, stderr } = run(f.home, f.args("show", "nope"));
    assert.equal(status, 1);
    assert.match(stderr, /no transcript/);
    assert.equal(stdout, "");
  });
});

describe("usage errors", () => {
  function assertUsage({ status, stderr }) {
    assert.equal(status, 2);
    assert.match(stderr, /usage/i);
  }

  test("no arguments", () => assertUsage(run(tempDir(), [])));
  test("unknown command", () => assertUsage(run(tempDir(), ["frobnicate"])));
  test("show without an id", () => assertUsage(run(tempDir(), ["show"])));

  test("list --days abc", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("hi")]);
    const result = run(f.home, f.args("list", "--days", "abc"));
    assertUsage(result);
    assert.equal(result.stdout, "");
  });

  test("list --days with no value", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("hi")]);
    const result = run(f.home, ["list", "--workspace", workspace, "--days"]);
    assertUsage(result);
    assert.equal(result.stdout, "");
  });

  test("show --max-chars x", () => {
    const f = fixture();
    writeSession(f.projectDir, "sess-a", [prompt("hi")]);
    const result = run(f.home, f.args("show", "sess-a", "--max-chars", "x"));
    assertUsage(result);
    assert.equal(result.stdout, "");
  });

  const rejected = [
    ...["", " ", "-1", "0"].map((days) => ["list", "--days", days]),
    ...["", "0", "-1", "1.5"].map((max) => ["show", "sess-a", "--max-chars", max]),
    ["show", "nope", "--max-chars", "x"],
  ];
  for (const argv of rejected) {
    test(JSON.stringify(argv), () => {
      const f = fixture();
      writeSession(f.projectDir, "sess-a", [prompt("hello world")]);
      const result = run(f.home, f.args(...argv));
      assertUsage(result);
      assert.equal(result.stdout, "");
    });
  }

  for (const argv of [["list", "--workspace"], ["dir", "--days"]]) {
    test(`${argv.join(" ")} with no value`, () => {
      const result = run(tempDir(), argv);
      assertUsage(result);
      assert.equal(result.stdout, "");
      assert.doesNotMatch(result.stderr, /\n\s+at /);
    });
  }
});
