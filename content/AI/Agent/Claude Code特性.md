---
title: Claude Code 的扩展机制与适用范围
---

Claude Code 提供的扩展机制并不是一组可以互相替换的“插件接口”。它们分别作用于上下文、工作流、工具、执行隔离、多人协作、生命周期控制和分发等不同层面。对开发者而言，最重要的不是先学会某个配置格式，而是先判断：要扩展的究竟是 Claude **知道什么、怎样做、能调用什么、由谁执行、何时强制执行，还是如何分发**。

本文面向希望扩展 Claude Code、但还不清楚各机制适用范围与加载方式的开发者。文中的“扩展机制”包含 `CLAUDE.md`、智能体技能（Agent Skills，Skills）、代码智能（Code Intelligence）、模型上下文协议（Model Context Protocol，MCP）、子智能体（Subagents）、智能体团队（Agent Teams）、钩子（Hooks）、插件（Plugins）和插件市场（Plugin Marketplaces）；制品（Artifacts）也会单独介绍，但它更接近结果发布能力，而不是传统意义上的运行时扩展点。[^claude-code-overview]

> 本文依据 Claude Code 官方文档整理，资料核对日期为 2026-08-29。Claude Code 更新频繁，实验性能力和配置字段应以文末官方文档为准。

## Claude Code 扩展体系概览

可以把 Claude Code 的扩展能力理解为几个彼此衔接的层次：

- **上下文层**：`CLAUDE.md` 与 `.claude/rules/` 告诉 Claude 项目的长期约定。
- **工作流层**：Skills 封装可复用的知识、步骤和配套资源。
- **代码理解层**：Code Intelligence 通过语言服务器提供符号级导航与即时诊断。
- **工具接入层**：MCP 把外部服务、数据源和工具接入 Claude Code。
- **执行隔离层**：Subagents 把独立任务放入隔离上下文中执行。
- **并行协作层**：Agent Teams 让多个独立 Claude Code 会话共享任务并互相通信。
- **生命周期控制层**：Hooks 在指定事件发生时执行确定性的检查、阻断或自动化。
- **封装与分发层**：Plugins 将多种扩展打包，Plugin Marketplaces 负责发现、版本和分发。
- **结果发布层**：Artifacts 将 Claude 生成的结果发布为可交互页面。

这些机制可以组合。例如，一个 Plugin 可以同时携带 Skills、Subagents、Hooks、MCP 和 Code Intelligence 配置；一个 Skill 也可以在隔离的 Subagent 中运行，并调用 MCP 工具。组合的前提是每一层各司其职，而不是把所有内容都塞进同一种配置。

## 总览对比表

| 机制 | 主要扩展对象 | 加载或触发方式 | 最适合解决的问题 | 不适合承担的职责 |
| --- | --- | --- | --- | --- |
| `CLAUDE.md` / `.claude/rules/` | 长期上下文与项目约定 | 会话启动、访问匹配文件时加载 | 编码规范、仓库结构、常用命令、目录规则 | 需要确定性阻断的安全策略 |
| Skills | 可复用知识与工作流 | 用户调用或模型按描述自动调用 | 重复流程、专项方法、带脚本或模板的任务 | 接入本身不存在的外部工具 |
| Code Intelligence | 代码语义理解 | 安装语言插件并启动对应语言服务器 | 定义、引用、类型、诊断、符号导航 | 通用外部业务系统集成 |
| MCP | 外部工具、服务与数据 | 启动时发现服务器，实际调用时加载工具定义 | 数据库、Issue、浏览器、内部 API 等接入 | 单纯记录项目规范 |
| Subagents | 隔离的任务执行者 | 委派、`@` 点名或指定主 Agent | 高输出、可独立完成、需要专门工具或模型的任务 | 需要多个执行者彼此持续协商的工作 |
| Agent Teams | 多个协作会话 | 启用实验特性后由 Lead 创建团队 | 并行调查、跨模块实现、竞争假设验证 | 简单任务或对 Token 成本敏感的任务 |
| Hooks | 生命周期自动化与强制控制 | 匹配事件时自动执行 | 格式化、审计、通知、危险操作阻断 | 需要丰富语境的长期知识说明 |
| Plugins | 扩展能力的封装单元 | 安装或用开发目录加载 | 跨项目、跨团队复用和版本化一组能力 | 只需本项目的一条简单规则 |
| Plugin Marketplaces | Plugin 的目录与分发 | 添加市场后再选择安装 Plugin | 发现、安装、更新和组织 Plugins | 直接提供运行时能力 |
| Artifacts | 结果呈现与分享 | 对话中创建并发布 | 可视化报告、仪表盘、交互说明 | 扩展 Claude Code 的执行能力 |

## `CLAUDE.md` 与 `.claude/rules/`

### 定义与适用范围

`CLAUDE.md` 是 Claude Code 的持久上下文文件，用于说明仓库结构、构建命令、编码规范、架构约束和协作习惯。`.claude/rules/` 则把规则拆成多个主题文件，并可通过 `paths` Frontmatter 让规则只在处理匹配文件时进入上下文。[^claude-code-memory]

它们适合表达“在这个项目中通常应怎样工作”，例如：

- 项目各目录的职责；
- 测试、Lint 和构建命令；
- 命名、错误处理和文档维护约定；
- 仅对前端、后端或某类文件生效的规则。

它们本质上是给模型的上下文，而不是不可绕过的策略引擎。如果某条规则必须在执行前被确定性地检查或阻断，应使用 Hooks。

### 加载机制与作用域

Claude Code 会在会话启动时读取当前目录及其祖先目录中的 `CLAUDE.md`。子目录中的 `CLAUDE.md` 不会全部预先加载，而是在 Claude 访问该目录下的文件时按需进入上下文。`CLAUDE.md` 还可以用 `@路径` 导入其他文件，导入会在启动阶段解析，递归深度最多为四层。[^claude-code-memory]

常见位置如下：

| 位置 | 作用域 |
| --- | --- |
| 托管策略中的 `CLAUDE.md` | 组织级，通常由管理员统一下发 |
| `~/.claude/CLAUDE.md` | 当前用户的所有项目 |
| `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 当前项目，可提交到版本库 |
| `./CLAUDE.local.md` | 当前用户在当前项目中的本地偏好，通常不提交 |
| `./.claude/rules/*.md` | 当前项目的模块化规则 |
| `~/.claude/rules/*.md` | 当前用户的模块化规则 |

没有 `paths` 的 Rules 会在启动时加载；带 `paths` 的 Rules 仅在 Claude 读取或修改匹配文件时加载。`.claude/rules/` 会递归发现子目录中的 Markdown 文件，因此可以按领域组织规则。

### 最小示例

项目根目录的 `CLAUDE.md`：

```md
# 项目约定

- 使用 `pnpm test` 运行测试。
- 修改业务代码后，同步更新对应文档。
- API 错误统一返回项目定义的错误对象。
```

只对 TypeScript 文件生效的 `.claude/rules/typescript.md`：

```md
---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# TypeScript 规则

- 对外导出的函数必须声明返回类型。
- 测试名称描述可观察行为，不描述实现细节。
```

### 与其他机制的区别及注意事项

- 与 Skills 相比，`CLAUDE.md` 是默认存在的长期背景；Skill 是面向特定任务、按需加载的工作流。
- 与 Hooks 相比，`CLAUDE.md` 提供指导但不保证执行；Hook 能在生命周期事件上运行并阻断部分操作。
- Claude Code 原生读取的是 `CLAUDE.md`，不会自动把 `AGENTS.md` 当作同类文件。需要共用时，可在 `CLAUDE.md` 中写 `@AGENTS.md`。
- 官方建议保持内容简洁、具体，并尽量控制在约 200 行以内。过长的通用说明会持续占用上下文，也会稀释真正重要的约束。[^claude-code-memory]

## Skills

### 定义与适用范围

Skills 是包含 `SKILL.md` 和可选资源的目录，用来封装可复用的知识、操作流程、脚本、示例和模板。Claude 可以根据 Skill 的描述自动选择它，用户也可以通过 `/skill-name` 显式调用。Skills 采用开放的 Agent Skills 格式，并在 Claude Code 中增加了工具权限、隔离执行、Hooks 等扩展字段。[^claude-code-skills]

Skills 适合：

- 固化代码审查、发布、迁移、排障等重复流程；
- 为某个领域提供按需加载的操作手册；
- 将脚本、模板和参考资料与工作流放在一起；
- 为团队提供可版本化、可调用的专项能力。

### 加载与触发机制

默认情况下，Claude Code 在启动时只把 Skill 的名称和描述放入上下文。模型判断任务匹配，或用户显式调用 Skill 后，才会读取完整 `SKILL.md`；Skill 引用的其他文件仍可继续按需加载。这种渐进式加载使大型知识包不必永久占用上下文。[^claude-code-skills]

两个字段会改变触发方式：

- `disable-model-invocation: true`：只允许用户显式调用，也不在启动时向模型公开描述，适合部署等不应自动触发的操作。
- `user-invocable: false`：不显示在用户的 Slash Command 菜单中，只供模型按需使用，适合背景知识型 Skill。

Skill 执行后，其展开内容会留在当前会话上下文中。若需要让工作流在不继承当前对话的独立上下文中执行，可设置 `context: fork`，并可用 `agent` 指定执行它的 Subagent。

### 位置与优先级

| 位置 | 作用域 |
| --- | --- |
| 托管配置中的 Skills | 组织级 |
| `~/.claude/skills/<skill-name>/SKILL.md` | 当前用户的所有项目 |
| `.claude/skills/<skill-name>/SKILL.md` | 当前项目 |
| `<plugin>/skills/<skill-name>/SKILL.md` | 随 Plugin 分发 |

同名 Skill 的优先级为托管级高于个人级，个人级高于项目级。Plugin 中的 Skills 使用命名空间，不与这些同名项直接冲突。Claude Code 也会在进入 Monorepo 的嵌套目录时发现其中的 `.claude/skills/`。[^claude-code-skills]

### 最小示例

创建 `.claude/skills/api-review/SKILL.md`：

```md
---
name: api-review
description: 审查 HTTP API 变更。在新增或修改接口、请求字段、响应结构时使用。
allowed-tools:
  - Read
  - Grep
  - Glob
---

# API 变更审查

1. 找出本次变更涉及的路由、请求模型和响应模型。
2. 检查兼容性、鉴权、错误结构和文档是否同步。
3. 按严重程度列出问题，并给出对应文件位置。
```

此 Skill 可以由 Claude 根据描述自动使用，也可以由用户输入 `/api-review` 调用。若它还需要固定检查表，可放在同目录的 `references/checklist.md`，再从 `SKILL.md` 中说明何时读取。

### 与其他机制的区别及注意事项

- Skills 描述“怎样完成一类任务”；MCP 提供完成任务时可调用的外部能力。
- `context: fork` 可以复用 Subagent 的隔离能力，但 Skill 仍是工作流定义，Subagent 是任务执行者定义。
- 旧的 `.claude/commands/*.md` 仍受支持，但官方建议新能力优先使用 Skills；同名 Skill 与旧 Command 并存时，Skill 优先。
- `SKILL.md` 宜保持聚焦，官方建议主体不超过 500 行，把详细参考、示例和脚本拆入配套文件。
- Skill 中的脚本和动态命令会在本机执行。共享或安装第三方 Skill 前，应像审查代码一样审查其内容。

## Code Intelligence

### 定义与适用范围

Code Intelligence 通过语言服务器协议（Language Server Protocol，LSP）让 Claude Code 获得与 IDE 类似的代码语义能力，包括编辑后的即时诊断、跳转到定义、查找引用、悬停类型、文档符号、实现和调用层级。[^claude-code-tools][^claude-code-discover-plugins]

它适合需要准确跨文件导航、理解类型关系或在修改后快速发现编译级错误的代码库。普通文本搜索仍然有价值，但 Code Intelligence 能回答“这个符号实际指向哪里”“哪些引用受影响”这类语义问题。

### 加载与触发机制

LSP 工具默认并不激活。开发者需要安装对应语言的 Code Intelligence Plugin，并确保该 Plugin 要求的语言服务器二进制已经安装。启用后，Claude 在编辑文件后可以自动获得诊断；定义、引用等符号信息则按需查询。[^claude-code-tools]

Plugin 负责告诉 Claude Code 怎样启动语言服务器，本机的语言服务器二进制负责真正解析代码。只安装其中一部分通常不足以工作。

### 最小示例

以 TypeScript 为例，先安装官方市场中的 Plugin，再安装它要求的语言服务器：

```text
/plugin install typescript-lsp@claude-plugins-official
```

```bash
npm install -g typescript-language-server typescript
```

重新加载 Plugins 后，打开 TypeScript 项目并让 Claude 修改代码；LSP 会向 Claude 返回相关诊断。不同语言的 Plugin 名称和外部二进制不同，应以官方 Plugin 目录显示的依赖为准。[^claude-code-discover-plugins]

### 与其他机制的区别及注意事项

- Code Intelligence 关注本地代码的语义；MCP 关注外部系统、数据和工具。
- Code Intelligence 通常以 Plugin 分发，但“Plugin”是包装形式，“LSP”才是提供代码语义能力的机制。
- 它不能替代测试和构建，只是更早、更精确地暴露部分问题。
- 团队分发 Plugin 时，仍需说明每位开发者要额外安装的语言服务器二进制。

## MCP

### 定义与适用范围

MCP 是连接 AI 应用与外部工具和数据源的开放协议。在 Claude Code 中，MCP Server 可以提供 Tools、Resources 和 Prompts，还可支持 Elicitation 等交互能力。它适合接入 Issue 系统、数据库、浏览器、监控平台、内部 API 和 SaaS 服务。[^claude-code-mcp]

判断是否需要 MCP 的一个实用标准是：如果开发者经常从另一个系统复制信息到 Claude Code，或希望 Claude 对该系统执行操作，就值得考虑 MCP。

### 加载与触发机制

Claude Code 启动时发现可用 MCP Server。默认的 Tool Search 会先保留工具名称和服务器描述，只有在确实选择某个工具时才加载完整 Schema，从而减少大量工具对上下文的占用。实际调用仍受权限确认和服务器自身认证控制。[^claude-code-mcp]

MCP 支持的主要连接方式包括：

- **HTTP**：远程服务器的推荐方式，适合云服务与 OAuth。
- **stdio**：Claude Code 在本机启动一个子进程，通过标准输入输出通信，适合本地工具。
- **SSE**：旧的远程传输方式，新增集成优先使用 HTTP。
- **WebSocket**：适合需要服务器主动推送的持久连接，但其认证与配置能力和 HTTP 不完全相同。

### 配置作用域与优先级

| 作用域 | 存储位置 | 适用场景 |
| --- | --- | --- |
| Local | `~/.claude.json` 中的项目配置 | 只在当前项目使用且不共享，默认作用域 |
| Project | 项目根目录的 `.mcp.json` | 随仓库共享，首次使用需要信任确认 |
| User | `~/.claude.json` | 当前用户的所有项目 |
| Plugin | Plugin 根目录的 `.mcp.json` | 随 Plugin 安装与启停 |

同名 Server 的优先级为 Local 高于 Project，高于 User，再高于 Plugin 和 claude.ai Connector。一个高优先级条目会覆盖低优先级的整个 Server 配置，而不是逐字段合并。[^claude-code-mcp]

### 最小示例

添加一个只供当前项目使用的本地 stdio Server：

```bash
claude mcp add --transport stdio --scope local filesystem -- npx -y @modelcontextprotocol/server-filesystem ./docs
```

随后可用以下命令检查状态：

```bash
claude mcp list
claude mcp get filesystem
```

需要与团队共享时，可以使用 Project 作用域并提交 `.mcp.json`。配置中的敏感值应通过 `${ENV_VAR}` 或 `${ENV_VAR:-default}` 引用环境变量，不要把密钥提交到仓库。

### 与其他机制的区别及注意事项

- MCP 定义“Claude 能调用什么”；Skill 定义“Claude 应怎样利用这些能力完成任务”。
- MCP Server 可以提供 Prompt，但它仍以外部服务的能力为中心；复杂、可版本化的项目工作流通常更适合 Skill。
- Project 级 `.mcp.json` 来自仓库，启用前需要用户确认信任。第三方 Server 可能执行代码、访问账号或返回带 Prompt Injection 的外部内容，应审查来源并按最小权限授权。
- MCP 工具过多仍可能带来发现成本和上下文成本。应按项目需要启用 Server，而不是把所有集成都设为全局。

## Subagents

### 定义与适用范围

Subagents 是运行在独立上下文中的专门执行者。每个 Subagent 可以拥有自己的 System Prompt、工具权限、模型、MCP Server、预加载 Skills、Hooks 和持久 Memory；完成任务后，它向调用它的主会话返回结果，而不是把全部中间过程塞回主上下文。[^claude-code-subagents]

Subagents 适合：

- 搜索、日志分析和测试输出等会产生大量中间信息的任务；
- 能够独立描述并独立验收的子任务；
- 需要更严格工具白名单或不同模型的专项角色；
- 需要避免污染主会话上下文的调查工作。

### 加载与触发机制

Claude Code 可以依据 Subagent 的 `description` 自动委派任务；用户也可以在提示中直接点名，使用 `@agent-name` 可明确要求由指定 Subagent 执行。还可通过 `--agent` 让某个自定义 Agent 成为整个会话的主 Agent。[^claude-code-subagents]

Subagent 获得自己的提示、被委派的任务、适用的 `CLAUDE.md` 与 Memory，以及配置中预加载的 Skills，但不会继承父会话的完整对话历史。内置的 Explore 和 Plan Agent 为保持轻量，连 `CLAUDE.md` 与 Git 状态也不会加载。

### 位置与优先级

| 位置或来源 | 作用域 |
| --- | --- |
| 托管 Agent | 组织级 |
| `--agents` 命令行定义 | 当前启动进程 |
| `.claude/agents/*.md` | 当前项目 |
| `~/.claude/agents/*.md` | 当前用户 |
| `<plugin>/agents/*.md` | 随 Plugin 分发，使用命名空间 |

同名定义按表中从上到下的顺序确定优先级。

### 最小示例

创建 `.claude/agents/api-auditor.md`：

```md
---
name: api-auditor
description: 审查 API 兼容性和鉴权边界。在接口变更完成后主动使用。
tools:
  - Read
  - Grep
  - Glob
model: sonnet
maxTurns: 12
skills:
  - api-review
---

你是一名 API 审查者。只报告有代码证据的问题，重点检查破坏性变更、越权访问和错误响应一致性。
```

之后可以说：“使用 `@api-auditor` 审查本次接口改动。”`api-review` Skill 会完整预加载到该 Subagent 的上下文中。

### 与其他机制的区别及注意事项

- Subagent 与主会话之间是父子汇报关系；需要多个执行者相互通信和共同维护任务状态时，使用 Agent Teams。
- Skill 代表可复用流程，Subagent 代表带独立上下文、权限和模型的执行角色。两者经常组合。
- `isolation: worktree` 可让 Subagent 在临时 Git Worktree 中工作，适合隔离代码修改；结束时是否保留 Worktree 取决于其中是否存在改动。
- Plugin 提供的 Subagent 为降低安全风险，会忽略其 `hooks`、`mcpServers` 和 `permissionMode` 字段；需要这些能力时应由使用方明确配置。[^claude-code-subagents]

## Agent Teams

### 定义与适用范围

Agent Teams 由一个 Lead 和多个 Teammates 组成。每个成员都是独立的 Claude Code 会话，拥有自己的上下文；团队通过共享任务列表和消息系统协调，Teammates 也可以直接互相通信。该能力目前是实验性功能，默认关闭。[^claude-code-agent-teams]

Agent Teams 适合真正可以并行推进且需要成员互相协调的工作，例如：

- 多个调查者验证不同的故障假设；
- 前端、后端和测试分别实现不同模块；
- 多个审查者从安全、性能和可维护性角度交叉审查；
- 大型研究任务中，成员需要共享发现并继续追问。

### 加载与触发机制

先在 Claude Code 设置中启用实验开关：

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

随后可以直接描述团队目标和分工：

```text
创建一个 Agent Team 调查登录变慢的问题：
一名 Teammate 检查数据库查询，一名检查认证服务调用，一名检查前端请求瀑布；
共享证据后由 Lead 汇总结论。
```

Lead 创建第一名 Teammate 时团队成立。每个 Teammate 会加载项目的 `CLAUDE.md`、MCP 和 Skills，但不会继承 Lead 的完整对话历史，因此创建任务时应提供足够的上下文和验收标准。[^claude-code-agent-teams]

### 与 Subagents 的区别

| 比较项 | Subagents | Agent Teams |
| --- | --- | --- |
| 上下文 | 独立上下文 | 每名成员都是独立会话 |
| 通信结构 | 结果主要返回父会话 | 成员可直接互相通信 |
| 协调状态 | 由主会话委派 | 共享任务列表与 Mailbox |
| 适用任务 | 边界清晰的独立子任务 | 需要并行协商和动态接力的复杂任务 |
| 成本 | 相对可控 | 多会话并行，Token 成本明显更高 |

### 限制与注意事项

- Agent Teams 仍为实验性能力，交互方式和限制可能变化。
- 一个会话一次只能管理一个团队，不能嵌套团队，Lead 在团队创建后不能更换。
- 团队成员同时修改同一文件容易产生冲突，分工时应明确文件或模块所有权。
- 简单任务、强顺序依赖任务或对 Token 成本敏感的场景，不应为了“并行”而使用 Agent Teams。
- 部分会话恢复、回退、任务状态刷新和关闭行为仍有限制；正式纳入团队工作流前应先阅读最新限制说明。[^claude-code-agent-teams]

## Hooks

### 定义与适用范围

Hooks 是在 Claude Code 生命周期事件发生时自动执行的处理器。它们用于把依赖模型遵循的“建议”升级为确定性自动化，例如命令执行前阻断危险操作、文件修改后运行格式化、会话结束时写审计记录，或在权限被拒绝时发送通知。[^claude-code-hooks]

Hook 的处理器可以是：

- `command`：执行本地 Shell 命令；
- `http`：向 HTTP Endpoint 发送事件；
- `mcp_tool`：调用 MCP 工具；
- `prompt`：用单次模型判断返回决策；
- `agent`：让一个多轮 Agent 对事件进行判断，目前属于实验性方式。

常用事件包括 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`SubagentStart`、`SubagentStop`、`TaskCompleted`、`Stop`、`ConfigChange` 和 `SessionEnd`。不同事件能返回的控制决策并不相同，应按官方事件表配置。

### 加载与触发机制

Hooks 可以来自用户设置、项目设置、本地设置、托管设置、Plugin，以及 Skill 或 Subagent 的 Frontmatter。不同来源的 Hooks 会合并；同一事件下所有匹配的 Hooks 会并发运行。`matcher` 用于筛选工具名、事件类型或其他事件相关字段，不设置时通常匹配该事件的所有触发。[^claude-code-hooks]

Command Hook 通过标准输入接收 JSON 事件。退出码 `0` 表示正常完成；在支持阻断的事件中，退出码 `2` 会阻断操作，并把标准错误作为反馈交给 Claude。需要更细的决策时，可以向标准输出返回官方定义的结构化 JSON。

### 最小示例

在 `.claude/settings.json` 中阻止 Claude 执行 `git push`：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/block-git-push.mjs"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/block-git-push.mjs`：

```js
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const event = JSON.parse(input);
  const command = event.tool_input?.command ?? "";

  if (/\bgit\s+push\b/.test(command)) {
    console.error("项目策略禁止由 Claude 执行 git push。请由开发者手动确认并执行。");
    process.exit(2);
  }
});
```

这个示例把约束放在 `PreToolUse`，因为危险命令一旦执行，事后检查已来不及。实际项目还应根据使用的 Shell 和允许的命令形式完善匹配规则。

### 与其他机制的区别及注意事项

- `CLAUDE.md` 和 Skills 依赖模型理解并遵循；Hooks 在事件边界自动运行，更适合强制策略。
- Hook 的“允许”不能越过 Claude Code 自身的权限系统；权限拒绝仍然优先。
- 同一事件的匹配 Hooks 并发运行。某个 Hook 阻断操作，并不意味着其他 Hook 的副作用不会发生，因此不要把相互依赖的步骤拆成并发 Hooks。
- Hooks 以当前用户权限执行任意代码。安装第三方 Plugin 或复制 Hook 配置前，应审查命令、Endpoint 和 MCP 工具权限，并尽量使用窄 `matcher`。[^claude-code-hooks]

## Plugins

### 定义与适用范围

Plugins 是 Claude Code 的扩展封装与分发单元。一个 Plugin 可以组合 Skills、Subagents、Hooks、MCP Server、LSP Server、Legacy Commands 和其他配套文件，使一组能力能够跨项目安装、启停、升级和共享。[^claude-code-plugins]

如果能力只服务于当前仓库，直接使用 `.claude/` 下的配置通常更简单；如果它需要跨多个项目复用、由团队统一分发、独立版本化，或发布到 Marketplace，再封装为 Plugin。

### 目录结构与加载机制

典型结构如下：

```text
api-toolkit/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── api-review/
│       └── SKILL.md
├── agents/
│   └── api-auditor.md
├── hooks/
│   └── hooks.json
├── .mcp.json
├── .lsp.json
└── bin/
```

只有 Manifest 放在 `.claude-plugin/` 中；`skills/`、`agents/`、`hooks/` 等组件目录都位于 Plugin 根目录。安装 Plugin 后，Claude Code 按组件类型发现内容；Plugin Skills 和 Subagents 使用 Plugin 名称作为命名空间，避免与本地能力冲突。[^claude-code-plugins]

### 最小示例

`.claude-plugin/plugin.json`：

```json
{
  "name": "api-toolkit",
  "description": "API 开发与审查工具集",
  "version": "0.1.0"
}
```

为 Plugin 添加 `skills/api-review/SKILL.md` 后，在开发阶段直接加载目录：

```bash
claude --plugin-dir ./api-toolkit
```

进入会话后可通过 `/api-toolkit:api-review` 调用该 Skill。修改 Plugin 文件后，可执行 `/reload-plugins` 重新加载，而不必重启整个会话。[^claude-code-plugins]

### 与其他机制的区别及注意事项

- Plugin 本身不是一种新的工作流或工具协议，而是多种扩展机制的包装和生命周期管理层。
- Marketplace 只是 Plugin 的目录和分发源；把 Marketplace 添加到 Claude Code 并不会自动安装其中所有 Plugins。
- Plugin 可以携带可执行 Hooks、MCP Server 和二进制文件。安装前应审查来源和权限，团队发布时也应明确外部依赖。
- 不要为了只有一条项目规则的需求创建 Plugin。先在 `.claude/` 中验证能力，达到跨项目复用需求后再封装。

## Plugin Marketplaces

### 定义与适用范围

Plugin Marketplaces 是 Plugins 的目录与分发机制。Marketplace 用 `marketplace.json` 描述可安装的 Plugins、来源、版本和元数据；它解决的是“到哪里发现和取得扩展”，而不是直接向 Claude Code 提供工具。[^claude-code-marketplaces]

Marketplace 适合：

- 团队维护内部 Plugin 目录；
- 开源项目集中发布多个 Plugins；
- 统一指定 Git、GitHub、NPM 或仓库子目录等来源；
- 管理 Plugin 的发现、安装与更新路径。

### 加载与安装机制

添加 Marketplace 只会注册目录。用户仍需从该目录明确安装某个 Plugin，Plugin 的组件才会加载。Claude Code 自带 Anthropic 官方 Marketplace，也可以添加 GitHub 仓库、Git URL 或本地路径形式的第三方 Marketplace。[^claude-code-discover-plugins][^claude-code-marketplaces]

### 最小示例

`.claude-plugin/marketplace.json`：

```json
{
  "name": "engineering-tools",
  "owner": {
    "name": "Example Engineering"
  },
  "plugins": [
    {
      "name": "api-toolkit",
      "source": "./plugins/api-toolkit",
      "description": "API 开发与审查工具集",
      "version": "0.1.0"
    }
  ]
}
```

添加 Marketplace 并安装其中的 Plugin：

```text
/plugin marketplace add ./engineering-tools
/plugin install api-toolkit@engineering-tools
```

安装可以选择 User、Project、Local 或 Managed 等作用域；需要让团队统一使用时，应根据组织管理方式选择 Project 或 Managed，而不是要求每个人手工复制配置。[^claude-code-discover-plugins]

### 与其他机制的区别及注意事项

- Marketplace 管理“有哪些 Plugin、从哪里安装”；Plugin 才承载实际的 Skills、Hooks、MCP 等能力。
- Marketplace 中的版本字段用于更新判断。发布新版本时应同步维护 Plugin Manifest 与 Marketplace 元数据。
- Marketplace 与其中的 Plugins 都是信任边界。第三方目录可以指向会执行本地代码或访问外部账号的内容，添加和安装前都应审查来源。

## Artifacts

### 定义与适用范围

Artifacts 用于把 Claude Code 生成的内容发布为可交互、可分享的页面，例如可视化比较、状态仪表盘、带注释的代码差异或时间线。它是输出呈现能力，不会给 Claude Code 增加新的本地工具或执行权限。[^claude-code-artifacts]

### 创建与发布机制

Artifacts 由 Claude 在对话中创建，发布前需要用户授权。发布后的页面默认是私有的，可以继续在同一 Artifact 上迭代并保留版本。其主体是单个自包含的 HTML 或 Markdown 页面，不适合需要后端服务、多路由应用或任意外部网络请求的产品。[^claude-code-artifacts]

如果 Artifact 使用支持的 MCP Connector 展示实时数据，查看者需要用自己的账号授权访问；本机 Local MCP Server 不能在发布后的页面中继续被调用。

### 最小示例

在已登录并支持 Artifacts 的 Claude Code 会话中输入：

```text
分析本次性能测试结果，创建一个 Artifact：
用交互式图表比较各接口的 P50、P95 和错误率，并标出相对上次基线的变化。
```

Claude 创建页面后会请求发布许可。开发者可以先检查内容和数据边界，再决定是否发布或分享。

### 限制与注意事项

- Artifacts 要求受支持的 Claude 订阅、Anthropic API 连接方式和较新的 Claude Code 版本；Bedrock、Vertex AI 与 Microsoft Foundry 等第三方 Provider 不支持该能力。[^claude-code-artifacts]
- Artifact 是展示层，不替代 Plugin、MCP 或 Skill。若需求是让 Claude 访问新数据源，应先接入 MCP，再决定是否用 Artifact 呈现结果。
- 发布前应检查页面中是否包含源码、日志、客户数据或其他敏感信息，并按组织共享策略设置访问范围。

## 机制组合

实际扩展通常由多种机制协作完成。下面几种组合最有代表性。

### 项目规范与强制策略

```text
CLAUDE.md / .claude/rules 说明“应该怎样做”
                    ↓
Hooks 在关键事件验证“是否真的这样做”
```

例如，在 `CLAUDE.md` 中说明提交前必须通过测试，同时用 `PreToolUse` Hook 阻止危险 Git 命令，用 `PostToolUse` Hook 对修改后的文件运行格式化。说明性内容留在上下文，确定性控制留在事件边界。

### 可复用工作流与外部工具

```text
Skill 定义排障步骤
  ├─ 调用 MCP 查询监控、Issue 和日志
  └─ 必要时委派 Subagent 消化大量输出
```

Skill 不需要重新实现外部集成，只需规定何时调用哪些 MCP 工具、怎样交叉验证以及如何输出结论。高输出的日志分析交给 Subagent，可避免主上下文被中间信息占满。

### 团队级能力分发

```text
Plugin 封装 Skills + Subagents + Hooks + MCP/LSP 配置
                              ↓
Marketplace 提供发现、安装与更新入口
```

先在单个项目的 `.claude/` 中验证能力，再抽取成 Plugin；当存在多个 Plugins 或需要统一分发时，再建立 Marketplace。这样每一层都有实际需求，不会为了分发形式过早增加维护成本。

### 大型并行任务

Agent Teams 负责拆分、共享任务状态和成员通信；每个 Teammate 内部仍可调用 Skills、MCP 和 Code Intelligence，也可以把边界清晰的小任务再交给 Subagent。由于并行会显著增加成本，应先确认任务之间确实能够独立推进，并提前划分文件所有权。

## 选择机制

选择时先从要改变的对象出发：

```text
需要扩展什么？
├─ 项目的长期约定或目录规则
│  ├─ 默认适用于整个项目 → CLAUDE.md
│  └─ 只适用于特定文件 → .claude/rules/
├─ 一类可复用的知识或操作流程 → Skill
├─ 代码的符号导航、类型与即时诊断 → Code Intelligence
├─ 外部服务、数据源或新工具 → MCP
├─ 一个需要独立上下文的专门执行任务 → Subagent
├─ 多个执行者需要并行协作并互相通信 → Agent Teams
├─ 某个生命周期事件必须自动检查、执行或阻断 → Hook
├─ 需要跨项目安装、启停和版本化一组能力 → Plugin
├─ 需要集中发现、安装和更新多个 Plugins → Plugin Marketplace
└─ 需要把结果发布为交互页面 → Artifact
```

如果一个需求同时落在多条分支上，不必强行选一个。例如“团队统一的生产故障排查能力”可以用 Skill 编排流程、MCP 连接监控系统、Subagent 隔离日志分析、Hook 记录审计事件，最后由 Plugin 封装并通过内部 Marketplace 分发。

最后检查三个边界：

- **是否需要强制执行**：需要时用 Hook，不要只写提示规则。
- **是否需要隔离或协作**：独立汇报用 Subagent，成员互相通信才用 Agent Teams。
- **是否真的需要分发层**：仅当前项目使用时先放在 `.claude/`；跨项目复用后再封装 Plugin，有多个可分发包时再引入 Marketplace。

## 参考文档

以下引用均来自 Claude Code 官方文档，脚注编号由 Markdown 渲染器按照首次引用顺序自动生成。

[^claude-code-overview]: [扩展 Claude Code](https://code.claude.com/docs/zh-CN/features-overview)，Claude Code Docs。
[^claude-code-memory]: [Claude Code 的记忆管理](https://code.claude.com/docs/zh-CN/memory)，Claude Code Docs。
[^claude-code-skills]: [使用 Skills 扩展 Claude](https://code.claude.com/docs/zh-CN/skills)，Claude Code Docs。
[^claude-code-tools]: [Claude Code 工具参考](https://code.claude.com/docs/zh-CN/tools-reference)，Claude Code Docs。
[^claude-code-discover-plugins]: [发现和安装预构建插件](https://code.claude.com/docs/zh-CN/discover-plugins)，Claude Code Docs。
[^claude-code-mcp]: [通过 MCP 将 Claude Code 连接到工具](https://code.claude.com/docs/zh-CN/mcp)，Claude Code Docs。
[^claude-code-subagents]: [创建和使用专用 Subagents](https://code.claude.com/docs/zh-CN/sub-agents)，Claude Code Docs。
[^claude-code-agent-teams]: [协调 Claude Code Agent Teams](https://code.claude.com/docs/zh-CN/agent-teams)，Claude Code Docs。
[^claude-code-hooks]: [使用 Hooks 自动化工作流](https://code.claude.com/docs/zh-CN/hooks-guide)，Claude Code Docs。
[^claude-code-plugins]: [创建 Plugins](https://code.claude.com/docs/zh-CN/plugins)，Claude Code Docs。
[^claude-code-marketplaces]: [创建和分发 Plugin Marketplace](https://code.claude.com/docs/zh-CN/plugin-marketplaces)，Claude Code Docs。
[^claude-code-artifacts]: [从 Claude Code 创建和分享 Artifacts](https://code.claude.com/docs/zh-CN/artifacts)，Claude Code Docs。
