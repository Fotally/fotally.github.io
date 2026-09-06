---
title: "Letta Code：带持续学习记忆的开发 Agent Harness"
kind: open-source-research-report
status: completed
topic: AI Memory
project: Letta Code
role: primary
brief_version: "1.0"
---

# Letta Code：带持续学习记忆的开发 Agent Harness

> **项目快照**：官方仓库 <https://github.com/letta-ai/letta-code>｜核验日期 2026-09-03｜Stars 约 3.2k｜许可证 Apache-2.0｜仓库在核验日有提交，最新 Release 为 `v0.31.11`（2026-09-01）。[^letta-code-repository][^letta-code-license][^letta-code-release]

> **需求画像**：目标是让开发 Agent 跨会话保持项目上下文，并把实践经验转化为可复用的记忆或 Skill。硬约束是支持可切换模型、尽量覆盖多 Agent、单机可运行；共享业务知识、原始会话留存和 Skill 评审可由外部系统补齐。

## 1. 项目要解决什么问题

### 目标用户与使用场景

Letta Code 是一个完整的、可运行的 Agent Harness，而不是单独的 Memory 数据库或记忆 SDK。它面向终端、桌面和远程环境，把长期 Agent 的身份、上下文、Memory、工具和 Skill 放在持续存在的运行时里；本报告只把其中的 Memory 机制作为可借鉴的子系统来分析。[^letta-code-repository][^letta-docs]

### 当前问题

普通聊天式 Agent 每次会话都要重新解释项目约定。Letta Code 让 Agent 可以保存、修改和检索自己的上下文，使 Agent 随使用积累经验。官方特性表将“自我改进与学习”描述为通过 memory blocks 和 skill learning 重写上下文。[^letta-code-repository]

开发者还需要在本地 CLI、桌面应用或远程机器之间保持 Agent 状态。Letta Code 提供本地 CLI、`letta server` 远程环境、桌面和消息渠道，但部分跨设备能力依赖 Constellation/登录服务。[^letta-code-repository]

### 问题边界

Letta Code 是完整的 Agent Harness，不是通用的团队会话数据仓库。它不会自动把所有成员的 Claude Code 原始会话导入，也不会把某次经验转换为团队 Skill 的 Git PR；需要外部采集与评审流程。

## 2. 设计的核心思路

### 核心判断

Letta Code 把记忆视为 Agent 运行时状态的一部分，而不是每次请求外挂一段 RAG 文本。默认块以声明式 MDX 资源进入运行时；Git-backed Memory 再把可变的 Agent 记忆变成可提交、可同步、可回滚的文件状态。Agent 能通过工具和 Skill 读写记忆，在长期运行中修改自己的工作上下文。[^letta-code-repository][^letta-docs][^letta-memory-source][^letta-memory-git-source]

### Memory 实现方式

Letta Code 的 Memory 不是单一存储层，而是两条机制：普通默认 Memory Block 由 `memory.ts` 从内嵌的 MDX 资源加载，默认标签是 `persona` 和 `human`，解析后返回 `CreateBlock[]` 并在模块级缓存；该文件本身不实现持久化写入、编辑或删除。Git-backed Memory 则由 `memory-git.ts` 管理每个 Agent 的本地 Memory Git 仓库，负责 clone/pull、提交记忆写入、记录 commit SHA，并按配置 push 到 MemFS 远端或另一个 memory repository。[^letta-memory-source][^letta-memory-git-source]

因此，Memory Block 是运行时上下文中的结构化块，MemoryFS Git 是可版本化的文件状态；二者不能笼统地都称为 Markdown 或都称为向量记忆。若需要大规模 archival recall，应另行接入并核对 Letta Server 的 passage/Embedding 存储；这与本地 Memory Block 和 Git-backed Memory 是不同路径，且 Letta Code 当前源码没有展示这条向量写入/检索调用链。[^letta-docs-memory][^letta-archival-embedding]

### 关键设计选择

- **记忆优先的 Harness**：Agent 由模型、上下文、工具、权限、Skill 和持久化状态共同组成，适合长生命周期 Agent。[^letta-code-repository]
- **声明式默认块与 Git-backed 状态分层**：`memory.ts` 从内嵌 MDX 资源生成默认 `persona`/`human` blocks，并缓存加载结果；启用 Git-backed Memory 后，`memory-git.ts` 将 Agent 记忆放在 `~/.letta/agents/{agentId}/memory/` 的 Git 仓库中，启动时同步、写入后提交，并可在回合结束后推送。[^letta-memory-source][^letta-memory-git-source]
- **Skill 与自我学习**：Skill 既可作为预制能力，也可在 Agent 学习中扩展；这和“经验候选→Skill 更新”的目标有概念上的连接，但 Skill 发布和团队评审仍不由 Memory Git 自动完成。[^letta-code-repository][^letta-docs-skills]
- **模型无关**：官方说明支持 Claude、GPT、Gemini、GLM、Kimi 等模型，模型选择通过配置/命令完成。[^letta-code-repository]

### 向量化与模型接口核验

Letta Code 的核心 MemoryFS、memory blocks 和 Skills 是文件/运行时状态，不要求先部署向量模型；因此个人本地路径可以只依赖 Node.js 与 Agent 模型。若接入 Letta Server 的 archival memory，写入 passage 时会创建 Embedding 并用于向量存储，此时需要额外的 `EmbeddingConfig`，包括模型、端点类型、维度和分块参数。[^letta-docs-memory][^letta-archival-embedding]

官方 SDK 暴露的 Embedding endpoint type 包含 OpenAI、Anthropic、Bedrock、Google、Azure、Ollama、LM Studio、llama.cpp、vLLM、Hugging Face、Mistral、Together 和 Pinecone 等；但 Letta Code 仓库没有为本地 MemoryFS 声明默认 Embedding 模型或固定维度。历史 Letta Server 示例中可见 `letta-free`/1024 维配置，但它属于服务端默认/示例，不应当推定为当前 Code CLI 的要求。[^letta-archival-embedding][^letta-archival-example]

公司 API 或 DeepSeek 只有在兼容 Letta 支持的 Embedding endpoint 类型和 `/embeddings` 请求形态时才能接入；DeepSeek 聊天模型不能直接当作 Embedding。中文语料需自行选多语言模型并验证维度；一旦把 archival 向量写入存储，替换模型/维度通常需要重建对应 archive，不能与旧向量混用。[^letta-archival-embedding]

### 代价与取舍

运行时把很多控制权交给 Agent 自己，记忆质量依赖工具调用、提示和模型行为；它不会自动保证业务事实正确或多人并发编辑无冲突。调研判断：Letta Code 对“一个 Agent 的连续学习”很强，但要做团队共享 Memory，还需要统一存储、权限、导入和评审层。

## 3. 项目如何工作

### 工作流概览

```mermaid
flowchart LR
  A[输入：用户任务与项目目录] --> B[完整 Letta Code Harness 组装上下文]
  B --> C[加载默认 blocks 或调用 Memory/Skill 工具]
  C --> D[读写 Agent Memory 状态]
  D --> E[MemoryFS Git：pull、commit、可选 push]
  E --> F[输出：代码改动、回答、Memory commit SHA]
  F --> G[外部导出：会话证据或 Skill 候选]
```

### 阶段说明

| 阶段 | 接收什么 | 做什么 | 产生的状态或产物 | 证据 |
| --- | --- | --- | --- | --- |
| 启动 Agent | 项目目录、模型配置、Agent ID | CLI 初始化或恢复长期 Agent；Git-backed 路径按需 clone/pull Memory 仓库 | 可运行的 Agent 运行时、默认 Memory Block 或本地 Memory Git 仓库 | [^letta-code-repository][^letta-memory-source][^letta-memory-git-source] |
| 上下文组装 | 当前任务、系统上下文、memory blocks、Skills | 按运行时策略将相关状态暴露给模型 | 当前回合上下文 | [^letta-docs] |
| 工具执行 | 模型工具调用 | 读代码、修改文件、运行命令或调用外部工具 | 工具结果和代码变更 | [^letta-code-repository] |
| 记忆自编辑 | Agent 发现的新约定/经验 | 通过记忆工具或 Skill 修改持久化上下文 | MemoryFS 工作区中的文件变更 | [^letta-memory-git-source][^letta-docs-memory] |
| 提交与同步 | Memory 文件变更、提交原因和同步模式 | 指定 pathspec 暂存并提交，按配置在回合结束后 push | commit SHA、同步状态或冲突摘要 | [^letta-memory-git-source] |
| 结束与复用 | 已完成会话状态 | 下次启动恢复 Agent 记忆；外部系统可另行导出 | 连续 Agent 状态或候选经验 | 调研判断 |

### 关键状态与产物

- **Memory blocks**：始终或按策略注入上下文的结构化/文本记忆块，用来保存身份、项目约定和工作状态。官方文档将其作为 Letta 记忆系统的核心概念。[^letta-docs-memory]
- **Archival/长期记忆**：不必每回合放入上下文，可通过检索工具访问的历史信息；具体后端和策略以运行时版本为准。[^letta-docs-memory]
- **MemoryFS Git 仓库**：本地 Letta Code Agent 的记忆文件与版本状态，能作为导出和回滚依据，但不等价于团队知识库。[^letta-code-repository]
- **Skills**：可复用的能力说明和工作流，部分 Skill 可由 Agent 学习或自配置。[^letta-docs-skills]

### 最终输出

用户得到代码、命令结果和持续存在的 Agent 状态。若要服务 Skill 更新，应在会话结束时通过 Hook/插件读取变更、工具调用和 MemoryFS diff，再产生带证据的 Skill 候选，而不能直接把 Agent 自己修改的 Skill 视作已审核规则。

## 4. 与需求画像逐项对照

### 需求矩阵

| 需求项 | 优先级或硬约束 | 项目现有能力 | 证据 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 项目业务知识长期保存 | 必须 | 长期 Agent 记忆、MemoryFS、memory blocks | [^letta-code-repository][^letta-docs-memory] | 满足 | 需约定项目级共享 Agent 或外部同步策略 |
| 技术决策和经验可检索 | 必须 | Agent 记忆与归档记忆工具 | [^letta-docs-memory] | 部分满足 | 版本、来源、冲突和团队审核不由核心自动解决 |
| 接收完整开发会话 | 必须 | 自身运行时有会话状态 | [^letta-code-repository] | 部分满足 | 没有面向外部 Claude Code 会话的通用导入和人工上传工作流 |
| 多 Agent 接入 | 必须 | Letta Code 支持多模型/渠道，自身是独立 Harness | [^letta-code-repository] | 部分满足 | 不是 Claude Code/Codex/Cursor 会话统一采集器，需要适配层 |
| 模型 API 可切换 | 必须 | 支持 Claude、GPT、Gemini、GLM、Kimi 等 | [^letta-code-repository] | 满足 | 公司 API/DeepSeek 的自定义 Base URL 需 POC 验证 |
| 单机自部署 | 必须 | 本地 CLI；`letta server` 可运行服务 | [^letta-code-repository] | 部分满足 | 本地个人运行轻；团队共享服务、数据库和权限边界需另建 |
| 用户主动控制原始会话上传 | 期望 | 本地运行不强制外传 | [^letta-code-repository] | 部分满足 | 需外部导出工具提供明确选择/确认 |
| Skill 候选可追溯、人工发布 | 必须 | Skill 文件和 Git 化记忆可提供素材 | [^letta-code-repository][^letta-docs-skills] | 部分满足 | 没有内置候选评审、PR、回归验证闭环 |

### 对照归纳

Letta Code 最直接覆盖的是“持续存在的开发 Agent 和记忆优先运行时”。它可以成为个人试点的采集端或经验产生端，但作为团队 Memory 服务时会遇到共享、权限、导出和服务部署问题。

## 5. 开源与能力边界

### 边界清单

| 能力 | 开源核心 | 商业版或 SaaS | 外部依赖 | 证据 |
| --- | --- | --- | --- | --- |
| Letta Code CLI 与 Harness | 有，Apache-2.0 | Letta Cloud/Constellation 提供托管和跨环境能力 | Node.js 22.19+、模型 API | [^letta-code-license][^letta-code-repository] |
| 本地 Agent 记忆 | 有 | 云端可同步/跨机器访问 | 本地文件系统、Git | [^letta-code-repository] |
| App Server/远程环境 | 有运行命令和部署仓库 | 云端控制面和登录体验 | Docker/网络/持久卷；部分能力依赖登录 | [^letta-code-repository][^letta-deployment] |
| Skills、渠道和自我学习 | 有部分开源实现 | 云端产品可能提供额外集成 | 各渠道凭据、模型 API | [^letta-docs-skills][^letta-code-repository] |

### 边界判断

Letta 主仓库当前说明：历史 V1 Server 已退役，源代码在 `archive` 分支且不再维护；当前代码集中在 `letta-code`。因此不能把旧 Docker Server 文档当作当前完整团队服务的无条件保证。[^letta-landing]

`letta server` 的官方部署仓库描述的是连接 Letta Cloud 的远程环境，容器需要持久卷保存认证状态；这与完全内网、自建控制面不是一回事。[^letta-deployment]

## 6. 用户如何接入和使用

### 接入前提

- 安装 Node.js（当前 `letta-code` 的 `package.json` 要求 Node.js >=22.19.0）和 `@letta-ai/letta-code`；选择可用模型提供商和凭据。[^letta-code-package]
- 规划 Agent ID、项目目录和 MemoryFS 的持久化位置；团队共享还需设计同步/服务端存储。
- 如果导出给 Skill 流程，需要增加 Hook 或事件转发器，记录用户确认的会话范围。

### 最快验证路径

1. `npm install -g @letta-ai/letta-code`，在目标代码库运行 `letta`，创建或恢复本地 Agent。[^letta-code-repository]
2. 按模型配置选择 Claude、GPT、Gemini、DeepSeek 或公司兼容 API；在会话中以 Skill 和记忆工具积累项目上下文。[^letta-code-repository]
3. 通过 MemoryFS Git diff、工具日志和代码变更生成经验候选，写入团队知识/评审系统，而不是自动覆盖共享 Skill。

### 日常使用方式

开发者在同一个项目目录反复运行 CLI，Agent 读取已有 MemoryFS，按需读写 memory blocks 和 Skills。若运行 `letta server`，远程环境可由桌面或聊天界面访问，但认证、网络和持久卷按部署方式配置。[^letta-code-repository][^letta-deployment]

### 接入限制

Letta Code 不提供把其他 Agent（Claude Code、Codex、Cursor）的原始会话统一导入的稳定标准；需要对各 Agent 的 JSONL/Trace/Hook 进行适配。其团队共享记忆的原生云能力和自托管能力边界也需按当前版本单独确认。

## 7. 部署构成

### 运行组件

| 组件 | 必需或可选 | 职责 | 持久化数据 | 与其他组件的关系 | 证据 |
| --- | --- | --- | --- | --- | --- |
| Letta Code CLI/Harness | 必需（本地路径） | 交互式 Agent、工具和 Skill 执行 | 配置、会话状态、MemoryFS | 调用模型 API，操作项目目录 | [^letta-code-repository] |
| Node.js/Bun 运行时 | 必需 | 执行 CLI 及其依赖 | 包缓存 | 被 CLI 使用 | [^letta-code-package][^letta-code-repository] |
| MemoryFS Git 仓库 | Git-backed Memory 启用时必需；普通默认 blocks 不依赖它 | 保存 Agent 记忆文件、Git 版本和同步状态 | `~/.letta/agents/{agentId}/memory/` | CLI/Harness 通过 memory-git 读写、提交和同步 | [^letta-memory-git-source] |
| `letta server` | 可选 | 将运行时暴露为远程环境 | `/root/.letta` 等持久卷 | 与云端/自建 Letta Base URL 连接 | [^letta-deployment] |
| 模型 API | 必需 | 推理、记忆编辑和工具决策 | 通常不在本地 | CLI/Harness 调用 | [^letta-code-repository] |
| 外部导出/团队 Memory 服务 | 本项目场景可选 | 汇总成员会话与业务知识 | 原始会话、证据、候选 PR | 读取 CLI/Hook 输出 | 调研判断 |

### 最小部署路径

个人验证的最小路径是本机安装 npm 包、配置模型 API、在代码库运行 `letta`；普通默认 Memory Block 不需要额外数据库。启用 Git-backed Memory 时还需要本地 Git 仓库，远程路径则需要容器/主机、持久卷和 Letta 服务地址；官方部署仓库的默认方式还包括与 Letta Cloud 的 OAuth/WebSocket 连接。[^letta-code-repository][^letta-memory-source][^letta-memory-git-source][^letta-deployment]

### 生产化仍需考虑

- 需要明确 MemoryFS 是否允许多人共享、如何解决 Git 合并冲突，以及原始会话和记忆的访问隔离。
- 需要给 Agent 自编辑 Memory/Skill 增加审批和回滚策略；不能仅依赖模型自我约束。
- 官方未给出本项目场景的最低 CPU、内存或并发指标，需实测；自托管内网控制面是否完整也需核验当前版本。

## 8. 适配结论与能力缺口

### 适配结论

**条件匹配。** Letta Code 是完整的 Agent Harness，适合作为个人/项目级持续学习 Agent 的试点；其中可直接借鉴的是默认 Memory Block 的声明式加载方式，以及 MemoryFS Git 的文件化、提交、同步和回滚机制，而不是把整个产品当作通用 Memory 服务。若目标是团队集中收集多种 Agent 的完整会话并形成共享 Memory，它仍需要外部采集、服务化存储和治理层。

### 已满足能力

- memory-first Agent、MemoryFS Git 持久化和 Skill 学习机制。[^letta-code-repository][^letta-docs-skills]
- 支持多模型供应商，具备 API 切换方向。[^letta-code-repository]
- 本地 CLI 启动路径轻，适合快速验证“记忆是否提升开发连续性”。[^letta-code-repository]

### 能力缺口

- **统一会话收集**：自身会话与 Claude Code 等外部会话不是同一采集协议。
- **集中共享与权限**：本地 MemoryFS 偏单 Agent；团队级共享需要服务端和身份/项目隔离。
- **Skill 治理闭环**：Skill 学习能力不等于带来源、评审、Git 合并和回归验证的发布流水线。

### 需要自研或外部补齐

- 本地用户选择会话、生成导出包的插件/Hook。
- 会话事件归一化、原始对象存储和团队 Memory API。
- Skill 候选审查、Git PR、回归任务和效果评估。

### 否决风险

若试点的硬要求是“单台内网服务器集中运行并跨成员共享原始会话”，当前官方资料无法确认 `letta-code` 提供不依赖 Letta Cloud 的完整控制面；应先验证自托管 API、认证和多租户边界。

## 9. 官方源码实现核验

> **核验范围与口径**：本节按 2026-09-06 访问的 `letta-ai/letta-code` `main` 分支源码核对；只阅读源码和官方 API 文档，没有安装或运行项目。源码文件中未发现需要单独列出的 `class` 实现，下面列出的实现均为函数、常量、类型和工具注册。标为“已核验”的内容可由源码直接追溯；标为“未确认”的内容不能仅凭 Letta Code 仓库推出。

### 9.1 Memory Block 的加载与进入 Agent 请求

| 真实文件 | 函数/符号 | 已核验的数据流与边界 |
| --- | --- | --- |
| `src/agent/prompt-assets.ts` | `MEMORY_PROMPTS` | 将 `./prompts/persona.mdx`、`./prompts/human.mdx` 等资源以内嵌字符串暴露；这一步不是从 MemoryFS 或向量库读取。 |
| `src/agent/memory.ts` | `MEMORY_BLOCK_LABELS`、`parseMdxFrontmatter`、`loadMemoryBlocksFromMdx`、`getDefaultMemoryBlocks` | `MEMORY_PROMPTS` → `persona.mdx`/`human.mdx` → 解析 frontmatter 与 body → `CreateBlock[]`。`getDefaultMemoryBlocks` 使用模块级 `cachedMemoryBlocks` 缓存；本文件不写文件、不调用持久化 API。默认标签是 `persona`、`human`，只读标签由 `READ_ONLY_BLOCK_LABELS` 决定。 |
| `src/agent/create.ts` | `createAgent` 内的 memory block 选择逻辑 | 未显式传入 `options.memoryBlocks` 时，普通 Agent 使用 `await getDefaultMemoryBlocks()`；`LETTA_CODE_AGENT_ROLE === "subagent"` 的子 Agent 默认使用空数组。 |
| `src/agent/create-agent-request.ts` | `mergeMemoryBlocks`、`buildCreateAgentRequest`、`buildCreateAgentRequestForPersonality` | Personality 默认 blocks 先生成，再按 `label` 用显式 blocks 替换或追加；最终以 API 请求的 `memory_blocks`/`block_ids` 字段发送。子 Agent 不接收默认 `memory_blocks`/`block_ids`。 |

**已核验结论**：这里的默认 `Memory Block` 是 Agent 创建请求中的 API block，不等同于 `~/.letta/agents/{agentId}/memory/` 下的 Markdown 文件；`memory.ts` 本身也不负责把 block 写回 Git。Personality 流程可以另行把默认文件种入 MemoryFS，但那是文件系统路径。[^letta-prompt-assets-source][^letta-create-source][^letta-create-request-source]

### 9.2 MemoryFS 与 Git-backed Memory 的真实调用面

| 真实文件 | 函数/符号 | 已核验的数据流与边界 |
| --- | --- | --- |
| `src/agent/memory-filesystem.ts` | `getMemoryFilesystemRoot`、`getScopedMemoryFilesystemRoot`、`resolveScopedMemoryDir`、`ensureLocalMemfsCheckout`、`renderMemoryFilesystemTree` | 默认作用域是 `$HOME/.letta/agents/<agentId>/memory`，并有 `system/` 子目录；函数负责解析作用域、创建/准备 checkout、渲染文件树。它不负责把 Markdown 内容解析成向量。 |
| `src/agent/memory-git.ts` | `initializeLocalMemoryRepo`、`cloneMemoryRepo`、`pullMemory` | 本地初始化 Git 仓库或 clone 状态仓库；已有非 Git 目录可迁移；pull 还会修复 remote、处理 fast-forward 失败/恢复，并同步附属仓库。 |
| `src/agent/memory-git.ts` | `commitMemoryWrite`、`assertMemoryRepoCleanForWrite` | 写入前要求工作树干净；写文件后按 `pathspecs` 暂存并提交，返回 `{ committed, sha? }`。`pathspecs` 可指向 `memoryDir` 下的合法相对文件，不是固定的两个 block 文件，但上层 memory 工具会再做路径和格式约束。 |
| `src/agent/memory-git.ts` | `pushMemory`、`syncPendingMemoryCommitsAfterTurn`、`getMemoryGitStatus`、`getMemoryConflictSummary`、`getMemoryAheadBehind` | `pushMemory` 执行 `git push -u origin main`，推送该分支的全部已提交文件；post-turn 同步检查 dirty/conflict/ahead-behind，必要时 push，遇到 non-fast-forward 时尝试 pull-rebase-push。 |
| `src/agent/memory-runtime.ts` | `isActiveMemfsEnabled`、`getActiveMemoryDirectory`、`isLocalMemfsActive` | 只判断当前 backend/Agent 是否启用 MemFS 并返回活动目录；源码没有在此处实现 block 加载或 Git 同步。 |

典型文件记忆数据流是：MemFS 配置/checkout → Agent 在 memory 工具中修改 `$MEMORY_DIR` → `commitMemoryWrite` 产生本地 commit → 已完成回合由 `runPostTurnMemorySync` 尝试 push 或给出冲突/dirty 提醒。`src/websocket/listener/turn-cleanup.ts` 只在回合 `finalized` 且有 `agentId` 时调用 post-turn sync；CLI/headless 也有对应调用路径。源码因此支持“提交”和“推送”两个阶段分离，不能把一次 memory 工具调用直接描述成已经 push 成功。[^letta-memory-filesystem-source][^letta-memory-runtime-source][^letta-memory-sync-source][^letta-turn-cleanup-source]

### 9.3 Agent 自编辑 Memory 的工具与限制

| 真实文件 | 函数/符号 | 已核验行为 |
| --- | --- | --- |
| `src/tools/tool-definitions.ts` | `toolDefinitions`、`ROOT_MEMORY_TOOL_ASSETS` | 注册 `memory` 与 `memory_apply_patch`；分别使用 `MemorySchema`/`MemoryV2Schema` 和对应描述文件，handler 来自 `src/tools/impl/`。 |
| `src/tools/impl/memory.ts` | `memory` | 支持 `str_replace`、`insert`、`delete`、`rename`、`update_description`、`create`；要求非空 `reason`，解析安全的 memory-relative path，拒绝越界/遍历，检查 `.git`、干净工作树、frontmatter 和 `read_only`，直接改 Markdown 文件，再调用 `commitMemoryWrite`，返回缩写 commit SHA 并发送 `memory_updated`。 |
| `src/tools/impl/memory-apply-patch.ts` | `memory_apply_patch` | 接受 unified patch，支持 Add/Update/Move/Delete File，执行同样的路径、frontmatter、索引和只读校验，再按受影响路径调用 `commitMemoryWrite`。源码明确表明它修改的是 Git-backed Markdown 文件，不创建、更新或删除 API Memory Block 记录。 |
| `src/agent/prompts/letta.md`、`letta_local_memfs.md`、`letta_root_memfs.md` | memory 工具使用说明 | 规定小改动使用 memory 工具，大改动直接编辑 `$MEMORY_DIR` 后 commit；MemFS pre-commit hook 校验 frontmatter/索引/read-only；“编辑记忆”影响后续 recompile，不改变当前回合行为。 |

**已核验结论**：Agent 的“自编辑”是受工具 schema、路径校验、格式校验和 Git commit 约束的文件编辑，不是模型直接修改一个向量索引，也不是自动把当前对话写入 archival memory。工具本身在 remote 模式主要完成 commit；常规 push 由回合清理阶段完成。WebSocket 的 `write_memory_file`/`delete_memory_file` 命令另有 `awaitMemoryPushBounded`，会在提交后等待最多约 8 秒的同步，但超时后仍可后台继续。[^letta-memory-tool-source][^letta-memory-patch-source][^letta-tool-definitions-source][^letta-prompt-source]

### 9.4 Personality 文件种入与 commit/push 边界

`src/agent/personality-default-files.ts` 的 `seedPersonalityDefaultMemoryFiles`/`seedPersonalityDefaultMemoryFilesBestEffort` 会从 Personality 取得默认文件，跳过已有文件或已有历史的路径，把文件写入 `memoryDir`，用 `commitMemoryWrite` 按文件路径提交；远程模式至少有一个成功种入文件时再调用 `pushMemory(agentId)`。这条路径写入的是 MemoryFS 文件，不是 `memory_blocks` API 字段。

`src/agent/personality.ts` 的 `applyPersonalityToMemory` 会在远程存储先 `pullMemory`，修改 `system/...`（或兼容旧布局的 `memory/system/...`）中的 persona/human 文件，再按变更路径 commit。由此可确认：[^letta-personality-files-source][^letta-personality-source]

- **commit**：记录已写入 MemoryFS Git 仓库的文件变更，可返回 SHA；dirty 工作树会阻止写入。
- **push**：把已提交历史同步到远端 MemFS/state repository；不是每一次文件写入都在同一函数中完成。
- **可选镜像**：`memory-git.ts` 的 `setMemoryRepositoryUrl`/`pushToMemoryRepository` 支持将当前分支推到配置的另一个仓库，这是镜像/备份能力，不是 archival vector store。

### 9.5 Archival memory 与 Embedding 的边界

| 证据位置 | 已核验 | 未确认/不能推出 |
| --- | --- | --- |
| `src/cli/args.ts`、`src/headless.ts` | CLI 有可选 `--embedding`；`values.embedding` 进入新 Agent 的 `embeddingModel` 选项。 | 该选项在 Letta Code 仓库中没有展示 embedding 生成、写入 passage 或向量检索流程。 |
| `src/agent/create.ts`、`src/agent/create-agent-request.ts` | `embeddingModel` 最终只被转发为创建请求的可选 `embedding` 字段，与 `memory_blocks`、`enableMemfs`、`memoryPromptMode` 分开。 | 仅凭这个字段不能确认当前 backend 的默认 embedding provider、维度、chunking 或是否启用 archival memory。 |
| Letta 官方 Passage API | Passage 属于 archival memory；API 模型包含 `embedding`、`embedding_config`、`embedding_dim`，`EmbeddingConfig` 有 provider type、model、endpoint、chunk size 等字段。 | Letta Code 当前源码未找到 `archival_memory`、`passage` 创建/搜索调用；不能把 Passage API 的能力反推成本地 MemoryFS 的默认能力。 |

**边界结论**：Memory Block、MemoryFS Markdown/Git 和 archival Passage/Embedding 是三条不同层次。当前源码已核验的是前两条；第三条只能确认 Letta 服务端 API 的数据模型和 Letta Code 的 `--embedding` 转发入口，不能确认 Letta Code 本地会自动生成或查询向量。因而报告中不应把 MemoryFS 描述为“向量记忆”，也不应把历史示例中的 `letta-free`/固定 1024 维当作当前 CLI 的必需默认值。需要 archival recall 时，应另行核对实际 backend 的 Agent 配置、Passage API 和 embedding provider。[^letta-create-source][^letta-create-request-source][^letta-archival-embedding]

### 9.6 核验后的实现判断

- **已核验**：默认 `persona`/`human` API Memory Block 的 MDX 加载与模块缓存；普通 Agent 创建时的 `memory_blocks` 注入；MemoryFS 的 Agent-scoped Git 仓库；memory 工具的自编辑、commit、frontmatter/read-only 校验；完成回合后的 push/rebase 同步。
- **已核验**：memory 工具编辑的是文件；`memory_apply_patch` 不直接改 API Memory Block；commit 成功不等于 push 已成功。
- **未确认**：Letta Code 当前是否通过某个 backend 自动启用 archival memory、何时写入 Passage、实际 embedding provider/维度/检索排序；这些不能由本仓库的 `--embedding` 参数单独证明。
- **仍需外部治理**：Git 冲突、事实正确性、多人共享权限、原始会话导入、Skill 候选评审和发布回归都不由上述源码自动完成。

---

[^letta-code-repository]: [Letta Code 官方 GitHub 仓库](https://github.com/letta-ai/letta-code)
[^letta-code-license]: [Letta Code Apache-2.0 许可证](https://github.com/letta-ai/letta-code/blob/main/LICENSE)
[^letta-code-release]: [Letta Code Releases](https://github.com/letta-ai/letta-code/releases)
[^letta-code-package]: [Letta Code package.json](https://github.com/letta-ai/letta-code/blob/main/package.json)
[^letta-landing]: [Letta 官方仓库当前说明](https://github.com/letta-ai/letta)
[^letta-docs]: [Letta 官方文档](https://docs.letta.com/)
[^letta-docs-memory]: [Letta Memory 文档](https://docs.letta.com/concepts/memory)
[^letta-docs-skills]: [Letta Skills 文档](https://docs.letta.com/guides/skills)
[^letta-deployment]: [Letta Code Server Deployment](https://github.com/letta-ai/letta-code-server-deployment)
[^letta-archival-embedding]: [Letta 官方 Passage API：EmbeddingConfig 与端点类型](https://docs.letta.com/api/python/resources/passages)
[^letta-archival-example]: [Letta 官方仓库中的 embedding_config 示例](https://github.com/letta-ai/letta/issues/2043)
[^letta-memory-source]: [Letta Code memory.ts：默认 Memory Block 加载源码](https://github.com/letta-ai/letta-code/blob/main/src/agent/memory.ts)
[^letta-memory-git-source]: [Letta Code memory-git.ts：Git-backed Memory 源码](https://github.com/letta-ai/letta-code/blob/main/src/agent/memory-git.ts)
[^letta-memory-filesystem-source]: [Letta Code memory-filesystem.ts：MemoryFS 目录与 checkout](https://github.com/letta-ai/letta-code/blob/main/src/agent/memory-filesystem.ts)
[^letta-memory-runtime-source]: [Letta Code memory-runtime.ts：运行时 MemFS 状态](https://github.com/letta-ai/letta-code/blob/main/src/agent/memory-runtime.ts)
[^letta-create-source]: [Letta Code create.ts：Agent 创建与默认 blocks](https://github.com/letta-ai/letta-code/blob/main/src/agent/create.ts)
[^letta-create-request-source]: [Letta Code create-agent-request.ts：Agent 创建请求构造](https://github.com/letta-ai/letta-code/blob/main/src/agent/create-agent-request.ts)
[^letta-memory-tool-source]: [Letta Code tools/impl/memory.ts：Memory 自编辑工具](https://github.com/letta-ai/letta-code/blob/main/src/tools/impl/memory.ts)
[^letta-memory-patch-source]: [Letta Code tools/impl/memory-apply-patch.ts：Memory patch 工具](https://github.com/letta-ai/letta-code/blob/main/src/tools/impl/memory-apply-patch.ts)
[^letta-memory-sync-source]: [Letta Code memory-git-sync.ts：回合结束后的 Memory Git 同步](https://github.com/letta-ai/letta-code/blob/main/src/reminders/memory-git-sync.ts)
[^letta-turn-cleanup-source]: [Letta Code turn-cleanup.ts：完成回合时触发同步](https://github.com/letta-ai/letta-code/blob/main/src/websocket/listener/turn-cleanup.ts)
[^letta-personality-files-source]: [Letta Code personality-default-files.ts：Personality 默认文件种入](https://github.com/letta-ai/letta-code/blob/main/src/agent/personality-default-files.ts)
[^letta-personality-source]: [Letta Code personality.ts：Personality 与 MemoryFS 文件更新](https://github.com/letta-ai/letta-code/blob/main/src/agent/personality.ts)
[^letta-tool-definitions-source]: [Letta Code tool-definitions.ts：Memory 工具注册](https://github.com/letta-ai/letta-code/blob/main/src/tools/tool-definitions.ts)
[^letta-prompt-assets-source]: [Letta Code prompt-assets.ts：内嵌 MDX 资源](https://github.com/letta-ai/letta-code/blob/main/src/agent/prompt-assets.ts)
[^letta-prompt-source]: [Letta Code memory prompt：Memory 工具与 MemFS 约束](https://github.com/letta-ai/letta-code/blob/main/src/agent/prompts/letta.md)
