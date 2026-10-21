# pstack for Claude Code

[English](./README.md) | **简体中文**

这是 [pstack](https://github.com/cursor/plugins/tree/main/pstack) 的 Claude Code 移植版。pstack 原本是 [poteto](https://x.com/poteto) 为 Cursor 写的插件。其中的 skill、playbook 和原则都来自原版，移植只改变它们的运行方式：改用 Claude Code 的工具和子代理，模型角色改写成 `<model> <effort>` 的形式，Cursor 专属功能换成 Claude Code 的对应功能。全部差异见[移植说明](#移植说明)。

## 致谢

pstack 由 **Lauren Tan（[@poteto](https://x.com/poteto)）** 创作。原作者是 React 核心团队成员，也在 Cursor 工作。

- 原项目地址：<https://github.com/cursor/plugins/tree/main/pstack>
- 本移植版基于 pstack 0.15.29，提交 [`190d287`](https://github.com/cursor/plugins/tree/190d28736eff128ec94f502a22c7fe0c4b56cd37/pstack)。
- 许可证：MIT。pstack 版权所有 (c) 2026 Lauren Tan，Claude Code 移植部分版权所有 (c) 2026 lyangfan，详见 [LICENSE](./LICENSE)。

感谢 poteto 设计了 pstack 并公开分享。这里的 playbook、原则，以及背后对工程严谨性的坚持，都是原作者的成果，本仓库只是把它们适配到 Claude Code。移植版的问题请在本仓库反馈，不要提到上游。想用 Cursor 版，请去原项目。

## 为什么用 pstack

下面这段译自上游 README，是原作者的原话：

> 越来越多人觉得 AI 写了太多烂代码。我同意。我不想像二十个只会堆砌代码的人组成的团队那样交付。没有质量的产出不是我追求的目标。想要快，先要深。
>
> **pstack 是我的答案。** 这些就是我每天在 Cursor 用来交付高质量代码的 skill。它把 Cursor 变成一支真正的工程团队。目标不是写出最多的代码行，恰恰相反：pstack 帮你写更少、但质量更高的代码。
>
> **pstack 让你放心地并行。** 当你能在一个 agent 上做深，并相信它写出好的、可验证的代码，你就能真正放心地并行。用 `poteto-mode` 同时启动多个 agent，相信它们会在工作中贯彻严格的工程原则。
>
> fork 它，改进它，把它变成你自己的。欢迎提 PR！

**天生多模型。** 很多 skill 会组建由不同模型组成的评审面板，比较各个模型发现了什么。在这个移植版里，面板混用的是 Claude 的几个模型（`opus`、`sonnet`、`fable`、`haiku`）。

## 安装

这个仓库本身就是一个 marketplace，注册名是 `pstack-local`。在 Claude Code 的 session 里运行：

```bash
/plugin marketplace add lyangfan/pstack-cc
/plugin install pstack@pstack-local
```

`/plugin install` 会打开一个面板，让你选择安装范围（只给你自己、给这个仓库的所有协作者，或者只在这个仓库里给你自己）。在 shell 里一条命令就能完成两步，默认装到用户级别：

```bash
claude plugin install pstack --marketplace lyangfan/pstack-cc
```

新开的 session 会自动加载。已经打开的 session 里运行 `/reload-plugins`。

其他加载方式：

- **从本地克隆安装**，方便修改插件：`/plugin marketplace add /绝对路径/pstack-cc`，再执行同样的 install。Claude Code 会直接读取这个目录，所以你的修改在 `/reload-plugins` 之后就会生效。
- **只在一个 session 里试用、不安装**：`claude --plugin-dir /path/to/pstack-cc`。

**更新。** 第三方 marketplace 默认不自动更新。手动更新：

```bash
claude plugin marketplace update pstack-local
claude plugin update pstack@pstack-local
```

也可以在 `/plugin` 的 **Marketplaces** 标签页里为 `pstack-local` 打开自动更新。从本地克隆安装的不需要这一步，它直接读取目录里的文件。

**卸载**：`claude plugin uninstall pstack@pstack-local`。

Claude Code 会给插件的命令和 agent 加上前缀，所以 `/poteto-mode` 实际是 `/pstack:poteto-mode`，子代理是 `pstack:poteto-agent`。没有其他插件占用同名命令时，不带前缀的 `/poteto-mode` 也能用。本文统一写不带前缀的名字。

## 开始使用

两步：

1. 运行 [`/setup-pstack`](./skills/setup-pstack/SKILL.md)，选一个 effort 预算，再选每个角色用哪个模型。
2. 做任何需要严谨的事情时，使用 [`/poteto-mode`](./skills/poteto-mode/SKILL.md)。

第一次用？[pstack 指南](./docs/guide/README.md)（英文）会带你完成第一个真实任务，从安装、写提示词，一直到验证和通宵运行。卡住了，或者不确定该用哪个 skill？问 [`/poteto-help`](./skills/poteto-help/SKILL.md)。

就这么简单。其他 skill 都是按需使用的，mode skill 会在需要时替你调用。默认按模型的长处分工：写代码的委派任务（feature、refactoring、bug fix、perf、hillclimb）交给 `sonnet xhigh`，最难的改动、写作和需要判断的工作交给 `opus xhigh`。默认的评审面板是 `opus xhigh` 加 `sonnet xhigh`。这些都可以用 [`/setup-pstack`](./skills/setup-pstack/SKILL.md) 修改。

## 用法

在任务开始时使用 [`/poteto-mode`](./skills/poteto-mode/SKILL.md)。它读你的请求，从一组 playbook 里挑一个，然后在各步骤需要时调用其他 skill。

输入 `/poteto-mode`，后面直接跟上你的任务，Claude Code 会把 skill 和这条消息一起加载。

### 用 [`/poteto-mode`](./skills/poteto-mode/SKILL.md) 就够了

这个 skill 是主入口。只要你需要 agent 做严谨的工程工作，就用它。它自带二十三个 playbook：

```
/poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even when idle. repro
first, then fix and verify.
```

```
/poteto-mode i'm going to bed. land the stack even if ci flakes. i want everything merged by
morning.
```

<details>
<summary>二十三个 playbook</summary>

| playbook | 用于 |
|---|---|
| [investigation](./skills/poteto-mode/playbooks/investigation.md) | 只读的问题：X 是怎么工作的，Y 为什么这样设计，我们确定吗。 |
| [bug fix](./skills/poteto-mode/playbooks/bug-fix.md) | 复现一个缺陷，找到根因，用运行时证据完成修复。 |
| [perf](./skills/poteto-mode/playbooks/perf-issue.md) | 追踪一处实测的慢，对照基线做改进。 |
| [hillclimb](./skills/poteto-mode/playbooks/hillclimb.md) | 针对一个目标，持续、科学地改进一个指标：循环提出假设，前后对比测量，每个被采纳的改进单独一个提交。 |
| [runtime forensics](./skills/poteto-mode/playbooks/runtime-forensics.md) | 通过插桩诊断一个正在发生的症状（内存泄漏、空闲时 CPU 空转、偶发故障）。 |
| [trace forensics](./skills/poteto-mode/playbooks/trace-forensics.md) | 诊断一份已经采集好的性能数据（cpuprofile、trace、spindump、heap snapshot）。 |
| [feature](./skills/poteto-mode/playbooks/feature.md) | 新增或修改行为，从一个明确命名的数据结构出发构建。 |
| [refactoring](./skills/poteto-mode/playbooks/refactoring.md) | 不改变行为的结构调整。 |
| [prototype](./skills/poteto-mode/playbooks/prototype.md) | 一次性的草稿，用来低成本地做出设计或行为上的决定，或者通过实际观察来解决一个可以实验的分歧。 |
| [visual parity](./skills/poteto-mode/playbooks/visual-parity.md) | 让两个实现的 UI 做到像素级一致。 |
| [authoring a skill](./skills/poteto-mode/playbooks/authoring-a-skill.md) | 编写或修改一个 SKILL.md。 |
| [eval](./skills/poteto-mode/playbooks/eval.md) | 以盲测方式检验一次 skill 或提示词的改动对 agent 行为的影响。 |
| [babysit](./skills/poteto-mode/playbooks/babysit.md) | 把一个 PR 或一组 stack 推进到可合并状态：解决冲突、处理评审意见、修好 CI。 |
| [shipping](./skills/poteto-mode/playbooks/shipping.md) | 独立验证一组 CI 已经全绿的 stack，再从底部开始，把连续通过验证的部分依次合并。默认通过 GitHub，可用时走 Origin。 |
| [autonomous run](./skills/poteto-mode/playbooks/autonomous-run.md) | 不停顿地把一个长任务推进到完成。 |
| [orchestrate](./skills/poteto-mode/playbooks/orchestrate.md) | 交给一个协调者会话的长期项目：持续多天、大量叠加的 PR、成批的子代理。 |
| [autopilot-full](./skills/poteto-mode/playbooks/autopilot-full.md) | 把一批相互独立的 PR 推进到合并，每个 PR 一个负责人。每个代码就绪的版本都由一组 agent 并行验证，之后补丁再有任何改动都会重新检查。 |
| [autopilot-stack](./skills/poteto-mode/playbooks/autopilot-stack.md) | 构建并验证一条线性的 stack，交给你审阅和合并。 |
| [session pickup](./skills/poteto-mode/playbooks/session-pickup.md) | 接手或续做之前某个 agent 未完成的工作。 |
| [pause safely](./skills/poteto-mode/playbooks/pause-safely.md) | 干净地暂停进行中的工作，方便之后接着做。 |
| [multi-phase plan](./skills/poteto-mode/playbooks/multi-phase-plan.md) | 跨多个阶段或多个叠加 PR 的工作。 |
| [worktree cleanup](./skills/poteto-mode/playbooks/worktree-cleanup.md) | 清理已合并或已废弃的 worktree 和过期的 iOS 模拟器以释放磁盘，带安全检查。 |
| [opening a pr](./skills/poteto-mode/playbooks/opening-a-pr.md) | 用小而有序的提交开一个可以直接评审的 PR，标题遵循 Conventional Commits，正文写成简报的样式。其他每个 playbook 最后都会调用它。 |

</details>

调用后，它会：

1. 把你的任务匹配到一个 [playbook](./skills/poteto-mode/playbooks/)，并在第一行状态里写出它的名字。最终回复以一份 checklist 结尾：原样列出这个 playbook 的步骤，每一步都标明已完成，或者写明 `skip: <原因>`。
2. 在各步骤需要时调用其他 skill。
3. 回复去掉 AI 腔，并从使用者和维护者两个角度来写。

完整的规则和 playbook 在 [`skills/poteto-mode/SKILL.md`](./skills/poteto-mode/SKILL.md)。

想让 [`/poteto-mode`](./skills/poteto-mode/SKILL.md) 对每个任务都保持开启，就像 Cursor 的 custom mode 那样，就切换到插件自带的 output style：

```bash
/output-style pstack:poteto
```

这个 style 会让 Claude 在每个新任务开始时加载 `poteto-mode`，压缩上下文之后再加载一次；简单的提问则直接回答。按你想要的生效范围选择：

| 范围 | 怎么开启 | 会写入什么 |
|---|---|---|
| 只在这个 session | 用 `claude --settings '{"outputStyle":"pstack:poteto"}'` 启动 | 什么都不写。用 `--resume` 或 `--continue` 恢复时要再带上这个参数 |
| 这个项目的所有 session | 在 session 里运行 `/output-style pstack:poteto` | 写入项目里的 `.claude/settings.local.json`，这是你本机的个人设置，通常不会提交到 git。用 `/output-style default` 撤销 |
| 所有项目 | 在 `~/.claude/settings.json` 里设置 `"outputStyle": "pstack:poteto"` | 你的用户设置。项目自己的设置优先于它 |

如果用"只在这个 session"的方式，可以设一个 shell 别名，省去每次输入：

```bash
alias claude-poteto="claude --settings '{\"outputStyle\":\"pstack:poteto\"}'"
```

之后运行 `claude-poteto` 启动的 session 会开启这个模式，直接运行 `claude` 则不开启。在已经运行的 session 里，没有"只对当前 session 生效"的开关：`/output-style` 会把设置保存到项目里。不使用这个 style 时，调用一次 `/poteto-mode` 只在当前 session 内有效，`/compact` 或 `/clear` 之后要重新调用。

[`/poteto-mode`](./skills/poteto-mode/SKILL.md) 和 Claude Code 的 `/loop` 命令配合得非常好，可以让 Claude Code 连续工作好几个小时，同时不失严谨。

也可以在 headless 模式下运行（`claude -p "/poteto-mode ..."`）。使用 `--output-format stream-json` 时，主回合每结束一次，事件流就会发出一个 `result` 事件，即使后台子代理还在运行也是如此，所以一次运行可能发出好几个。进程退出才代表运行结束，最后一个 `result` 里才是最终回复。

## skills

[`/poteto-mode`](./skills/poteto-mode/SKILL.md) 会在步骤需要时替你调用其中大部分（`how`、`why`、`architect`、`arena`、`swarm`、`interrogate`、`unslop`、`no-comments`、`technical-writing`、`tdd`，以及各条原则）。`automate-me`、`blast-radius`、`correct`、`in-your-own-words`、`poteto-help`、`recall`、`reflect`、`setup-pstack`、`sharpen` 和 `teach` 只在你手动输入时运行。下表供你需要直接使用某个 skill 时参考：

```
/how do we cancel runs? do we have an n+1 when we look up every run to cancel?
```

```
/interrogate review this pr.
```

<details>
<summary>全部 skill</summary>

| skill | 适用场景 |
|---|---|
| [`/poteto-mode`](./skills/poteto-mode/SKILL.md) | 任何不简单的任务的默认入口。 |
| [`/poteto-help`](./skills/poteto-help/SKILL.md) | 你刚接触 pstack，或者不确定该用哪个 skill、playbook 或原则。它先弄清你想做什么，回答相关的部分，再给你一条可以直接输入的提示词。只在你输入 `/poteto-help` 时运行。 |
| [`/in-your-own-words`](./skills/in-your-own-words/SKILL.md) | 你希望 agent 开始之前先复述你的目标和问题。只在你输入 `/in-your-own-words` 时运行。 |
| [`/sharpen`](./skills/sharpen/SKILL.md) | 发出提示词之前，你想让它更有深度，而不是更长：顶尖的专业人士会做哪些你没要求的事，会从什么原始材料入手，用什么方法和工具，以及用什么外部检查确认结果正确。它交回改写后的提示词，你的选择保持开放，它本身不执行任务。只在你输入 `/sharpen` 时运行。 |
| [`/how`](./skills/how/SKILL.md) | 你想了解某个子系统是怎么工作的。 |
| [`/why`](./skills/why/SKILL.md) | 你想知道某样东西为什么是这样设计的。它在运行时发现可用的 MCP，并行查询各类证据来源（版本控制、问题跟踪、长文档、即时聊天、基础设施监控、错误追踪、数据仓库）。 |
| [`/recall`](./skills/recall/SKILL.md) | 你要开始或继续一项工作，想从自己的聊天记录和共享记录里重建某个主题最近的上下文，并得到一份精炼的现状简报。 |
| [`/ketchup`](./skills/ketchup/SKILL.md) | 你想知道自从你上一条消息之后这个会话里发生了什么，用通俗的语言和简单的图示说明，并列出每一件等你决定的事，而且只看这条回复就能做决定，哪怕因此回复会很长。 |
| [`/blast-radius`](./skills/blast-radius/SKILL.md) | 你有一个看起来很小的改动，想知道它还可能弄坏什么，并且用运行代码来证明"它为什么安全"的那个关键事实，而不是空口断言。 |
| [`/architect`](./skills/architect/SKILL.md) | 你要写的代码会跨越函数边界，想先确定调用方的用法、类型和模块结构。 |
| [`/arena`](./skills/arena/SKILL.md) | 你想让 N 个 agent 并行尝试同一件事，再取各自最好的部分。 |
| [`/swarm`](./skills/swarm/SKILL.md) | 你想让 N 个 worker 并行处理不同的部分或互相竞速，最后汇总成一份报告。 |
| [`/interrogate`](./skills/interrogate/SKILL.md) | 你有一份 diff，想让不同的模型尝试把它挑出毛病，包括一个严格的代码质量视角。 |
| [`/automate-me`](./skills/automate-me/SKILL.md) | 你想根据自己实际的工作方式，起草一个属于你的 `-mode` skill。 |
| [`/setup-pstack`](./skills/setup-pstack/SKILL.md) | 你想为每个角色选择 pstack 使用的模型。它读取 `Agent` 工具接受的模型，写入 `~/.claude/rules/pstack-models.md`。 |
| [`/reflect`](./skills/reflect/SKILL.md) | 一个长任务完成了，你想把这次的经验沉淀为对某个 skill 的修改。 |
| [`/correct`](./skills/correct/SKILL.md) | 你总是因为同样的错误纠正 agent。它从历史记录里归纳出错误的类型，在能起作用的最高层级逐一修复（先是架构，然后是类型、lint 和 CI，再是测试，最后才是文档），并维护一张表，把每条规则和执行它的机制对应起来。 |
| [`/teach`](./skills/teach/SKILL.md) | 你想真正理解一个改动或子系统，而不只是看个摘要。它运行 how 和 why，编织成一份通俗的讲解，用一张张图逐步展开。 |
| [`/tdd`](./skills/tdd/SKILL.md) | 你在修 bug，并且有一条低成本的本地测试路径。先写会失败的测试，再修复。 |
| [`/benchmark-checklist`](./skills/benchmark-checklist/SKILL.md) | 你跑了 benchmark，或者测出了一次提速或退化。在你报告或据此行动之前，先审核这个数字（瓶颈在哪、调优、误差、重复测量、对端到端是否有意义）。 |
| [`/no-comments`](./skills/no-comments/SKILL.md) | 评审前清理注释。它派出 Comment Sicko，修复被采纳的问题，并为注释里声称的约束提供可以落成代码的方案。 |
| [`/typescript-best-practices`](./skills/typescript-best-practices/SKILL.md) | 你在读或改 TypeScript。它把"类型系统纪律"这条原则落实到具体语法。 |
| [`/figure-it-out`](./skills/figure-it-out/SKILL.md) | 没有合适的现成 playbook。它为这个任务设计一份严谨、可审计的 playbook。 |
| [`/show-me-your-work`](./skills/show-me-your-work/SKILL.md) | 你想要一份可以审阅的决策记录。它把决策写进一个可以提交的 TSV 文件。 |
| [`/create-verification-skill`](./skills/create-verification-skill/SKILL.md) | 你的项目没有用脚本证明应用行为的方法。它为任何语言或平台生成一个项目内的验证 skill，附带功能地图。 |
| [`/maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md) | 验证 skill 的功能地图已经和应用对不上了。先读一遍源码，再实际运行一遍，最多提交一个包含已证实修正的 PR。 |
| [`/create-formal-verification-skill`](./skills/create-formal-verification-skill/SKILL.md) | 测试覆盖不到会让竞态、重试、状态机、解析器或 unsafe 代码出错的情况。它用合适的工具验证一条性质，并生成一个项目内的 skill，每次改动后都重新检查。 |
| [`/maintain-formal-verification-skill`](./skills/maintain-formal-verification-skill/SKILL.md) | 形式化验证覆盖的代码自上次检查后有了改动。它更新模型、验证框架或性质以匹配代码，重新运行，并指出每个失败是验证本身过时了，还是代码里真有 bug。 |
| [`/unslop`](./skills/unslop/SKILL.md) | 你在润色文字。去掉 AI 腔。 |
| [`/bro`](./skills/bro/SKILL.md) | 你想把上一条消息用通俗的人话重说一遍，不要术语。 |
| [`/technical-writing`](./skills/technical-writing/SKILL.md) | 分层的写作规范（Diátaxis、Google 开发者文档风格、STE、Global English），用于文档、RFC、README、PR 描述和提交信息。 |

</details>

### 示例

大多数时候，在任务开始时输入 [`/poteto-mode`](./skills/poteto-mode/SKILL.md)，让它自己选 playbook 就行，其他 skill 会在步骤需要时自动调用。也有几个值得直接调用。

<details>
<summary>全部示例</summary>

```
bug fix:           /poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even
                   when idle. repro first, then fix and verify.
perf:              /poteto-mode a big list takes a second or two to load even though we virtualize.
                   run a cpu trace and tell me why.
feature:           /poteto-mode build a small feature behind a feature flag. verify it really works.
prototype:         /poteto-mode build two prototypes of the markdown renderer so we can compare.
                   spawn an agent for each.
multi-phase:       /poteto-mode open source these skills as a plugin. nothing internal leaks, work
                   in a temp dir, show me the dependency graph first.
overnight run:     /poteto-mode i'm going to bed. land the stack even if ci flakes. i want
                   everything merged by morning.
babysit:           /poteto-mode check on pr 123. anything outstanding?
visual parity:     /poteto-mode the row spacing is too tall when this flag is on. the second image
                   is correct. repro and fix until it matches.
figure it out:     /poteto-mode i'm stepping away. migrate every caller from the synchronous store
                   to the new async one, keeping behavior identical. i want to trust it was done
                   right when i'm back.
how:               /how do we cancel runs? do we have an n+1 when we look up every run to cancel?
why:               /why is this feature flag not on yet?
architect:         design this instrumentation to be high signal with no false positives. /architect
                   this first.
arena:             /arena take my prompt to the arena verbatim. i want to compare their proposals
                   with yours.
swarm:             /swarm check every package under packages/ against its check.sh. one worker per
                   package. one report.
interrogate:       /interrogate review this pr.
tdd:               /tdd implement
unslop:            can we unslop and tighten the new changes?
reflect:           /reflect that took too long. capture what we learned so the next run doesn't
                   repeat it.
correct:           /correct
show-me-your-work: /show-me-your-work keep a decision trail i can review when i'm back.
automate-me:       /automate-me
help:              /poteto-help which skill should i use to review this branch?
```

提示词也可以直接用中文写。

</details>

## 子代理

[`/poteto-mode`](./skills/poteto-mode/SKILL.md) 在收到它的那个会话里运行。这个会话负责 playbook、checklist，以及所有子代理的派发。

pstack 还提供 [`subagent_type: "pstack:poteto-agent"`](./agents/poteto-agent.md)，作为运行过程中派出的委派代理的封装。它通过 agent 定义里的 `skills` 字段预加载 `poteto-mode`，包括其中内嵌的原则索引。换成 `general-purpose` 就会跳过这一步，行为也会偏离。不要派 `pstack:poteto-agent` 来执行 playbook 本身。

[`pstack:readonly`](./agents/readonly.md) 是只读子代理，评审员、裁判、探索者和调查者都以它的身份运行。它没有编辑工具，但保留会话里的 MCP 工具。

pstack 还提供 [Comment Sicko](./agents/comment-sicko.md)，一个专门清理注释的代理，以 `subagent_type: "pstack:comment-sicko"` 调用。它删除注释、标出需要重构的代码，但从不编写应用代码。通常通过 [`/no-comments`](./skills/no-comments/SKILL.md) 调用，而不是直接调用。

## 原则

二十四个简短的 skill，每个讲一条原则。`poteto-mode` 内嵌了它们的索引，并在任务开始时读取。单独的 skill 文件让其他 skill 可以按名字加载某条原则，也让索引能指向每条原则的完整规则。它们从 `/` 菜单中隐藏（`user-invocable: false`）。在提示词里点出原则的名字，就能引导 agent。

<details>
<summary>全部二十四条原则</summary>

| 原则 | 分组 | 规则 |
|---|---|---|
| [laziness-protocol](./skills/principle-laziness-protocol/SKILL.md) | 核心 | 倾向于删除，用能解决问题的最小改动。 |
| [foundational-thinking](./skills/principle-foundational-thinking/SKILL.md) | 核心 | 在写逻辑之前使用：选定核心类型和数据结构，安排先搭骨架还是先做功能，弄清并发的各方共享了什么。把数据结构定对，后面的代码就会水到渠成。 |
| [redesign-from-first-principles](./skills/principle-redesign-from-first-principles/SKILL.md) | 核心 | 把新需求当作从第一天起就存在的基础假设来重新设计，而不是硬加上去。 |
| [attack-the-premise](./skills/principle-attack-the-premise/SKILL.md) | 核心 | 当两个以上基于同一前提的修复都没通过同一道检查时使用。把这个前提写下来并直接验证它，再写下一个依赖它的修复。 |
| [subtract-before-you-add](./skills/principle-subtract-before-you-add/SKILL.md) | 核心 | 先删掉无用的部分、多余的校验和占位引用，再在更简单的基础上构建。 |
| [minimize-reader-load](./skills/principle-minimize-reader-load/SKILL.md) | 核心 | 数一数从问题到答案隔了几层，以及读者脑子里要记住多少隐藏状态；合并只有一个调用方的封装，缩小可变状态的范围。 |
| [outcome-oriented-execution](./skills/principle-outcome-oriented-execution/SKILL.md) | 核心 | 用于有明确阶段边界的计划内重写和迁移。直奔目标架构，不要为了中间状态平滑而写一次性的兼容代码。 |
| [experience-first](./skills/principle-experience-first/SKILL.md) | 核心 | 用户的愉悦优先于实现的方便；宁可少做几个打磨好的功能，也不要多做一堆粗糙的。 |
| [exhaust-the-design-space](./skills/principle-exhaust-the-design-space/SKILL.md) | 核心 | 动手之前，先做两三个相互竞争的原型，放在一起比较。 |
| [build-the-lever](./skills/principle-build-the-lever/SKILL.md) | 核心 | 适用于任何不简单的工作，不只是批量工作：修改、迁移、分析、检查。造一个能完成或证明这件事的工具（codemod、脚本、生成器，或者一个让子代理遵循的 skill），而不是手工去做。这个工具就是评审者可以重新运行的成果。 |
| [model-the-domain](./skills/principle-model-the-domain/SKILL.md) | 架构 | 用一个结构来表达业务领域，而不是到处散落的条件判断。 |
| [boundary-discipline](./skills/principle-boundary-discipline/SKILL.md) | 架构 | 把防御性检查集中在系统边界（CLI、配置、网络、外部 API）；信任内部类型，让业务逻辑保持为纯函数。 |
| [type-system-discipline](./skills/principle-type-system-discipline/SKILL.md) | 架构 | 让非法状态无法表示，给有语义的基本类型加上区分标记，在边界处解析外部数据，穷尽所有分支，从权威的 schema 派生类型。 |
| [make-operations-idempotent](./skills/principle-make-operations-idempotent/SKILL.md) | 架构 | 不管之前的运行做到了哪一步，最终都收敛到同一个状态。 |
| [migrate-callers-then-delete-legacy-apis](./skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | 架构 | 在同一轮里迁移所有调用方并删除旧 API，不要保留兼容层。 |
| [separate-before-serializing-shared-state](./skills/principle-separate-before-serializing-shared-state/SKILL.md) | 架构 | 先消除共享；只有当"只能有一个写入者"确实是必须保持的约束时，才从结构上把写入串行化。 |
| [prove-it-works](./skills/principle-prove-it-works/SKILL.md) | 验证 | 任务完成后、宣布完成前使用。用真实产物验证（运行这个功能、读出实际的值、检查 diff），而不是用替代指标、自我报告或"能编译通过"。 |
| [fix-root-causes](./skills/principle-fix-root-causes/SKILL.md) | 验证 | 把每个症状追溯到系统最初出错的地方，在那里修复。只有当被处理的状态本身是合法的，加一个防御检查才算修复。 |
| [sequence-verifiable-units](./skills/principle-sequence-verifiable-units/SKILL.md) | 验证 | 用于多步骤的工作（批量处理、迁移、一连串类似的修改），以及如何组织提交和 PR。把工作拆成小单元，每个单元都以可验证的状态结束，验证完一个再做下一个，并安排交付顺序，让这个顺序本身就能向评审者证明正确性。 |
| [test-behavior-not-implementation](./skills/principle-test-behavior-not-implementation/SKILL.md) | 验证 | 写、改或保留测试时使用。断言代码的使用者能观察到的东西，这样行为坏了测试就会失败，只改内部实现时测试照样通过。 |
| [explain-the-number](./skills/principle-explain-the-number/SKILL.md) | 验证 | 在你相信、报告或依据一个实测数字行动之前使用：提速、退化、吞吐量、延迟或评测结果。找出是什么限制了它，并排除它测的其实不是你以为的那件事。 |
| [guard-the-context-window](./skills/principle-guard-the-context-window/SKILL.md) | 委派 | 把大量的原始内容交给子代理处理；主会话里只保留摘要，不保留原始数据。 |
| [never-block-on-the-human](./skills/principle-never-block-on-the-human/SKILL.md) | 委派 | 先做，再展示结果，让人事后纠正方向；只有不可逆的操作才需要事先确认。 |
| [encode-lessons-in-structure](./skills/principle-encode-lessons-in-structure/SKILL.md) | 元原则 | 把规则落实为 lint、元数据标记、运行时检查或脚本，而不是写更多的文字。 |

</details>

## 未包含的部分

`poteto-mode` 会用到、但本插件没有自带的东西：

- `/simplify`（Claude Code 内置）是提交前的清理步骤。Cursor 版用的是 `cursor-team-kit` 里的 `/deslop`。
- 操作真实的界面时：项目有自己的 `verify-*` skill 就用它；否则 Web 和 Electron 用 `claude-in-chrome` skill 或 Playwright MCP 服务器，CLI 和 TUI 用 `tmux`。Cursor 版用的是 `control-ui` 和 `control-cli`。
- 编写 skill 时，如果装了 `skill-creator` skill 就会用它。

## 为什么没有规划类的 skill？

Claude Code 本身就有 plan mode（Shift+Tab），和 pstack 配合得很好。原作者的观点是：最好的规格说明就是代码，所以规划不是默认步骤。如果你确实想做计划，[`/poteto-mode`](./skills/poteto-mode/SKILL.md) 也支持，只是不作为默认。

## 打造你自己的版本

`poteto-mode` 是 poteto 的风格，你未必完全想要这样。

输入 [`/automate-me`](./skills/automate-me/SKILL.md)。它会挖掘你最近的会话记录，根据你实际的工作方式起草一个 `<你的名字>-mode` skill，底层仍然通过 pstack 运行。这样你保留 pstack 作为基础，同时在 `poteto-mode` 之外拥有自己的路由 skill。

模型也可以配置。输入 [`/setup-pstack`](./skills/setup-pstack/SKILL.md)。它读取 `Agent` 工具接受的模型，写入 `~/.claude/rules/pstack-models.md`。这是一条 Claude Code 会加载到每个 session 的用户规则，把每个角色（写代码、判断、各个评审面板）对应到一个模型和 effort。每个 skill 都会读取它；没有这个文件时，就回退到合理的默认值，所以你只需要覆盖想改的部分。

默认值变化后，之前写下的规则仍会锁定旧的默认值。删掉那几行角色设置，或者删掉整个文件，再重新运行 `/setup-pstack`。重新运行时，模型和默认值不同的角色都会被保留。

## 移植说明

相对 Cursor 版改了什么，以及为什么：

| Cursor | Claude Code | 原因 |
|---|---|---|
| 几乎所有 skill 都设了 `disable-model-invocation: true`，skill 之间按文件路径互相读取 | 被路由的 skill 允许模型调用，并用 `when_to_use` 限定触发条件；原则设为 `user-invocable: false`；只供用户调用的 skill 保留 `disable-model-invocation` | Claude Code 不允许 `Skill` 工具调用设了 `disable-model-invocation` 的 skill，也禁止用别的方式绕过；这类 skill 也无法预加载到子代理里 |
| `Task`、`AskQuestion`、`resume` | `Agent`、`AskUserQuestion`、`SendMessage` | 工具名不同 |
| `readonly: true` | `subagent_type: "pstack:readonly"` | 一个没有编辑工具的插件 agent。它保留了 MCP 工具，而 Cursor 的 readonly 模式会去掉它们 |
| 云端 agent、`environment: "cloud"`、`cloud_base_branch` | `isolation: "worktree"` | 子代理在本地的 `.claude/worktrees/` 下运行，从默认分支创建，所以派发说明里要写明要检出哪个分支。重启会丢失正在运行的 agent，但已推送的分支和 worktree 不会丢。建议把 `.claude/worktrees/` 加进 `.gitignore` |
| `claude-opus-5-5-xhigh`、`grok-4.7-xhigh-fast` 这类模型名 | `opus xhigh`、`sonnet xhigh` | Claude Code 用模型别名加 effort 来指定。没有按单个 agent 开启的 fast 模式，所以去掉了 `-fast` |
| `~/.cursor/rules/pstack-models.mdc` | `~/.claude/rules/pstack-models.md` | Claude Code 从 `~/.claude/rules/` 加载用户规则 |
| `~/.cursor/projects/<slug>/agent-transcripts/` | `~/.claude/projects/<slug>/<session>.jsonl`，通过 [`scripts/transcripts.mjs`](./scripts/transcripts.mjs) 读取 | 目录结构和事件格式都不同 |
| custom mode（Option+Enter） | `/output-style pstack:poteto` | output style 随每次请求发送，压缩上下文后依然有效，它会让 Claude 在每个任务开始时加载 `poteto-mode` |
| benny 自动化、`/make-bot-ui` | 已移除 | 两者都依赖 Cursor Automations 和 Grok Bot routine |

## 开发

每次推送新版本，都要修改 [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json) 里的 `version`。Claude Code 会把从 git 安装的插件锁定在它的 `version` 上，版本号不变，用户就收不到新的提交。

`npm test` 运行 `scripts/` 下的 node 测试套件。`skills/poteto-mode/scripts/` 下的 `.ts` 测试需要用 bun 运行（在那个目录里执行 `bun test`），所以直接在根目录运行 `node --test` 会在它们上面失败。

## 许可证

MIT。pstack 版权所有 (c) 2026 Lauren Tan，即 pstack 的原作者；Claude Code 移植部分版权所有 (c) 2026 lyangfan，以同样的许可证发布。详见 [LICENSE](./LICENSE)。
