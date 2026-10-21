---
name: setup-pstack
description: Configure which models pstack uses per role and at what effort budget. Detects the models the Agent tool accepts and writes a user rule that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
disable-model-invocation: true
---

# Setup pstack

Write `~/.claude/rules/pstack-models.md`, a user rule that sets pstack's model per role. Claude Code loads every `.md` file in `~/.claude/rules/` into each new session, so every pstack skill sees the role lines without reading the file.

## Steps

### 1. Detect available models

Read the `Agent` tool schema in this session. Its `model` enum lists the model aliases you can pass to a subagent (today `opus`, `sonnet`, `haiku`, `fable`), and its `effort` enum lists the effort levels (`low`, `medium`, `high`, `xhigh`, `max`). That is the dependable source. A value is `<model> <effort>`, such as `opus xhigh`. Never write a model the schema does not list. `inherit-parent` is always valid: the role runs on the parent chat model, with no `model` or `effort` passed.

### 2. Load current state

The default role-to-model mapping is the rule shape shown in step 5 below. If `~/.claude/rules/pstack-models.md` already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from those defaults. A line whose role is not in step 5, such as `how critics`, is from a retired role. Drop it. A value from the Cursor version of pstack (a `claude-*`, `grok-*`, or `gpt-*` slug, or `auto`) is stale. Map `claude-<model>-<version>-<effort>` to `<model> <effort>`, `auto` to `inherit-parent`, and any other slug to that role's default, and list each mapping in step 3(c).

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Use `AskUserQuestion`. Offer these four options with these exact labels, and name the current budget when the rule records one. With no rule, say that `large` matches the skill defaults.

- `unlimited — max effort`
- `large — xhigh effort`
- `medium — high effort`
- `small — medium effort`

**(b) Apply it.** Build the working table from the skill defaults, and on a re-run keep any role you changed by model, list, or `inherit-parent`. `unlimited`, `large`, `medium`, and `small` set the effort of every `<model> <effort>` value, panel entries included, to `max`, `xhigh`, `high`, or `medium`. `inherit-parent` does not change. So `unlimited` turns `opus xhigh` into `opus max`, `large` keeps the defaults, and `small` turns them into `opus medium` and `sonnet medium`. Effort support depends on the model. If a spawn later rejects an effort, poteto-mode's Subagents section falls back to the role default.

**(c) Show the roles and confirm.** Show every role with its value. Also list each line step 2 dropped or mapped. Ask whether to accept as-is or change specific roles, offering the detected models plus `inherit-parent` as the options. Use `AskUserQuestion`. For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, `inherit-parent` entries included, so the list length sets the count. Panels catch more when their entries differ by model, so suggest a second model such as `fable` before suggesting a second copy of the same one. `arena cross-judge pool` is also a list, but Arena selects one value from it whose model differs from the parent's when possible. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

### 4. Validate

Every model written must be in the `Agent` tool's `model` enum, and every effort in its `effort` enum. `inherit-parent` always passes. If a chosen value fails, stop and ask again.

### 5. Write the rule

Write `~/.claude/rules/pstack-models.md` with no frontmatter, a `# budget` line with the chosen label and its target effort, and one line per role, using the same labels poteto-mode uses. Overwrite the whole file so re-runs stay idempotent. Never put the role lines in `CLAUDE.md` or `AGENTS.md`. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# A value is `<model> <effort>`: pass `model` and `effort` to the Agent tool. `inherit-parent`: omit both, so the role runs on the parent chat model. inherit-parent entries in a panel list still count toward its fan-out.
# budget: large (xhigh)
feature, refactoring: sonnet xhigh
bug-fix: sonnet xhigh
perf-issue: sonnet xhigh
hillclimb: sonnet xhigh
judgment and prose: opus xhigh
hardest tasks: opus xhigh
how explorer: sonnet xhigh
how explainer: opus xhigh
why investigators: sonnet xhigh
why synthesizer: opus xhigh
reflect tooling: sonnet xhigh
reflect judgment, divergent, synthesizer: opus xhigh
arena runners: opus xhigh, sonnet xhigh
arena cross-judge pool: opus xhigh, sonnet xhigh
swarm workers: sonnet xhigh
architect runners: opus xhigh, sonnet xhigh
interrogate reviewers: opus xhigh, sonnet xhigh
```

### 6. Confirm

Tell the user the rule was written and that it applies to new sessions. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /pstack:create-verification-skill." On yes, run the **create-verification-skill** skill. On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /pstack:create-formal-verification-skill." On yes, run the **create-formal-verification-skill** skill. On no, move on without pushing.
