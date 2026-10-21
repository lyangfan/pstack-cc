# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In Claude Code, add this repository as a local marketplace and install the plugin:

```text
/plugin marketplace add /path/to/pstack
/plugin install pstack@pstack-local
```

Restart Claude Code, or run `/reload-plugins`, so the skills and agents load. To try it without installing, start Claude Code with `claude --plugin-dir /path/to/pstack`.

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

## Accept the verification offers, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

After setup, start a new chat. The model rule applies to new sessions.

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

Watch its first status line. It names the matched playbook, `Playbook: Feature` for this prompt, and the final reply ends with that playbook's steps as a checklist, every step marked. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. To keep `/poteto-mode` on for every task, the way a Cursor custom mode does, run `/output-style pstack:poteto`. Each new task then loads `poteto-mode` first, even after `/compact`, and quick questions get a direct answer. The choice stays on in this project until you run `/output-style default`. Set `"outputStyle": "pstack:poteto"` in `~/.claude/settings.json` to turn it on everywhere. For one session only, start Claude Code with `claude --settings '{"outputStyle":"pstack:poteto"}'`, which writes no settings. The [README](../../README.md) has an alias for it.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
