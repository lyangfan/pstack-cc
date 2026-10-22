# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In a Claude Code session, add the marketplace and install the plugin:

```text
/plugin marketplace add lyangfan/pstack-cc
/plugin install pstack@pstack-cc
```

`/plugin install` opens a panel where you pick the install scope. New sessions load the plugin. In a session that's already open, run `/reload-plugins`. To try it without installing, start Claude Code with `claude --plugin-dir /path/to/pstack-cc`. The [README](../../README.md#install) covers installing from a local clone, updates, and uninstalling.

Claude Code prefixes plugin commands, so `/setup-pstack` is `/pstack:setup-pstack`. The bare name also works when no other plugin uses it. This guide writes the bare names.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) reads the models the `Agent` tool accepts (`opus`, `sonnet`, `haiku`, `fable`), asks for an effort budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.claude/rules/pstack-models.md`. Claude Code loads every file in `~/.claude/rules/` into each new session, so every pstack skill sees it.

Each role's value is a model and an effort, such as `opus xhigh`. The defaults are `sonnet xhigh` for code delegates and `opus xhigh` for judgment and prose, the same as the `large` budget. `unlimited` lifts every effort to `max`. `medium` and `small` lower the effort and spend fewer tokens.

You only override what you care about. A role with no line in the rule keeps the skill's default. To restore a default, delete that role's line. A rerun of `/setup-pstack` keeps any role whose model differs from the default. When a default changes, a rule written before the change still pins the old default, so delete those role lines, or delete the file, then run `/setup-pstack` again.

Set a role to `inherit-parent` and pstack omits the subagent `model` and `effort` fields, so the subagent inherits your parent chat model. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/swarm` worker unless a race names a model for each arm.

## Turn on the task list

Next, setup asks whether to turn on Claude Code's task tools (`TaskCreate`, `TaskUpdate`, `TaskList`). Claude Code turns them on by default only for older models. Say yes and setup adds this to `~/.claude/settings.json`:

```json
"env": { "CLAUDE_CODE_ENABLE_TODO_TOOLS": "1" }
```

With the tools on, `/poteto-mode` creates one task per playbook step before its first edit, and you watch each step move from pending to done. `/arena`, `/architect`, `/swarm`, and `/figure-it-out` track their phases the same way. Without the tools, they name the playbook or phase in their status lines and end with a checklist. The variable is undocumented, so a later Claude Code release may rename or drop it. If that happens, pstack falls back to the checklist.

## Accept the verification offers, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

After setup, start a new chat. The model rule and the task tools setting apply to new sessions.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/setup-pstack` and pick a smaller reasoning budget or cheaper models. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `inherit-parent` so it runs on the chat's own model, or move code roles to `sonnet` or `haiku`.
- Shorten a panel list. Each entry runs one subagent.
- Save `/poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch its first status line. It names the matched playbook, `Playbook: Feature` for this prompt. With the task tools on, the playbook's steps appear as tasks. The final reply ends with that playbook's steps as a checklist, every step marked. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. To keep `/poteto-mode` on for a whole session, the way a Cursor custom mode stays on for one chat, start Claude Code with `claude --settings '{"outputStyle":"pstack:poteto"}'`. Each new task then loads `poteto-mode` first, quick questions get a direct answer, and nothing is saved, so the next plain `claude` session starts without it. Inside a session that's already running, there is no session-only switch: type `/poteto-mode <task>` for each task instead. To keep it on in every session of this project, run `/output-style pstack:poteto` once, and undo it with `/output-style default`. The [README](../../README.md#keep-poteto-mode-on-for-a-whole-session-like-a-cursor-custom-mode) has an alias and the other scopes.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
