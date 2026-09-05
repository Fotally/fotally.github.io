---
title: "Opik：以 Agent Trace、评估和 CI 反馈沉淀开发经验"
kind: open-source-research-report
status: completed
topic: AI 开发会话收集
project: Opik
role: primary
brief_version: "1.0"
---

# Opik：以 Agent Trace、评估和 CI 反馈沉淀开发经验

> **项目快照**：官方仓库 <https://github.com/comet-ml/opik>｜核验日期 2026-09-04｜Stars 21.8k｜许可证 Apache-2.0｜最近发布/维护状态：GitHub Releases 页面显示 2.2.12 为 Latest，发布于 2026-07-30，仓库持续提交。[^opik-repository][^opik-license][^opik-release]

> **需求画像**：本项目组需要收集开发 Agent 的完整工作轨迹，能够定位工具调用、失败和人工反馈，并把真实失败转化为可回归的评估样例，为 Skill 更新提供证据。必须支持公司内网单机 Docker Compose、可切换公司模型 API 与 DeepSeek，尽量兼容多个 Agent；业务 Memory 可以作为关联数据沉淀，但不是把所有轨迹自动归纳成长期记忆的硬要求。原始 Claude Code 会话是否上传由用户决定，属于偏好而非本轮硬约束。

## 1. 项目要解决什么问题

### 目标用户与使用场景

Opik 面向构建 LLM 应用和 Agent 的工程团队，提供从开发期追踪、评估到生产监控的一体化平台。开发者可以通过 Python/TypeScript SDK、OpenTelemetry 或框架集成记录调用，再在界面中检查多步 Agent 的 Trace、Span、工具调用和反馈。[^opik-readme][^opik-sdk]

对本项目而言，最有价值的场景是把开发 Agent 的一次任务看成可复盘的执行轨迹：输入需求、模型响应、工具调用、测试结果和子 Agent 调用形成树状记录；团队随后筛选失败或高价值案例，添加人工反馈、加入测试套件，并把经验落实到 Skill、提示词或工具约束中。

### 当前问题

第一，单看最终代码难以解释 Agent 为什么走了错误路径。Opik 的层级 Trace/Span 保存 LLM 调用、工具执行、检索步骤及其输入输出，允许从最终结果回溯中间动作。[^opik-readme]

第二，人工复盘往往停留在一次性评论，修复之后没有稳定的回归样例。Opik 的官方评估闭环支持从生产 Trace 过滤失败项，将其加入测试套件，再对修改后的 Agent 重跑并比较结果；测试套件由真实失败逐步积累。[^opik-evaluation-loop]

第三，不同 Agent 和模型供应商会让采集方式碎片化。Opik 提供 Python、TypeScript、REST 和 OpenTelemetry 接口，并列出多种框架与模型提供商；Claude Code 还有独立官方插件，Cursor 等客户端则可以通过官方 MCP Server 查询和写入 Opik 数据。[^opik-sdk][^opik-mcp][^opik-claude-plugin]

### 问题边界

Opik 是可观测性、评估和提示词/Agent 优化平台，不是一个原始会话文件同步盘。Claude Code 插件把会话映射为 Trace，把工具调用、思考和响应映射为 Span；官方材料没有承诺保留本地 Claude Code JSONL 的原始字节、文件目录或完整环境快照，因此不能把它等价为原始会话归档。[^opik-claude-plugin]

Opik 的 Trace、Dataset、Experiment 和 Feedback Score 是结构化评估数据，不会自动形成经过业务负责人审核的公司知识库或长期 Memory。要沉淀业务术语、规则和 Skill 变更，仍需在 Opik 之上增加抽取、审核和 Git 发布流程。

## 2. 设计的核心思路

### 核心判断

Opik 的核心判断是：将 Agent 执行过程结构化为可查询的 Trace 树，再把观察到的失败转化为可重复执行的评估样例。这样“看见问题”和“证明修复没有回归”使用同一组数据链路，而不是分别维护日志和测试样例。

### 关键设计选择

- **以 Trace/Span 表示层级执行**：一个会话或任务可以包含父 Trace、嵌套 Span、LLM 调用、工具调用和检索步骤；同一个 `thread_id` 的 Trace 可以在 UI 中聚合为对话线程。[^opik-conversations][^opik-claude-plugin]
- **以 Dataset/Experiment/Feedback 连接观察与评估**：Dataset 保存测试项，Experiment 将 Dataset 项与实际执行 Trace 关联，Feedback Score 记录人工或自动评价，从而支持版本、模型和提示词的横向比较。[^opik-experiments][^opik-datasets]
- **以 SDK、OpenTelemetry 和 MCP 解耦接入端**：应用可以直接使用 SDK 或 OTel 上报；Agent 客户端则通过 `opik-mcp` 读取 Trace、打分、评论、保存提示词版本和管理测试套件。[^opik-sdk][^opik-mcp]
- **将评估放进开发/CI 回路**：官方提供 `llm_unit` Pytest 集成来记录单测的通过率和测试 Trace；评估文档也将真实失败、测试套件和修改后的回归验证串成循环。[^opik-pytest][^opik-evaluation-loop]

### 代价与取舍

这种设计牺牲了一部分原始会话的“原封不动性”，换取可查询、可评分和可关联的结构化数据。是否能完整记录开发 Agent 的思考、工具输入输出，取决于客户端插件或自研适配器的采集范围；官方 Claude Code 插件明确记录这些内容，但核心 Opik SDK 本身不会自动读取每位开发者的本地会话目录。[^opik-claude-plugin]

Opik 的能力覆盖面也带来较多组件：官方 Docker Compose 依赖 MySQL、ClickHouse、Redis、ZooKeeper、MinIO 以及前后端服务。官方明确把 Compose 定位为本地/测试启动方式，生产规模推荐 Helm/Kubernetes；单服务器试点可以使用 Compose，但需要把备份、鉴权、资源上限和数据保留作为额外治理工作。[^opik-local-deploy][^opik-compose-readme][^opik-architecture]

## 3. 项目如何工作

### 工作流概览

```mermaid
flowchart LR
  A[输入：Agent 会话、LLM 调用、工具调用、测试事件] --> B[SDK/OTel/Claude Code 插件采集]
  B --> C[Trace/Span 上报与线程聚合]
  C --> D[Backend 持久化到 ClickHouse、MySQL、对象存储]
  D --> E[UI/MCP 查询、人工反馈与筛选]
  E --> F[Dataset/测试套件与 Experiment]
  F --> G[评估指标、CI 结果和 Skill 更新证据]
```

### 阶段说明

| 阶段 | 接收什么 | 做什么 | 产生的状态或产物 | 证据 |
| --- | --- | --- | --- | --- |
| 客户端采集 | Agent 函数、LLM 请求、工具调用、Claude Code 会话事件 | SDK 装饰器、框架集成、OTel exporter 或 Claude Code Hook 生成 Trace/Span | 带输入输出、元数据、时间和父子关系的事件 | [^opik-sdk][^opik-claude-plugin] |
| Trace/Thread 组织 | 多个 Trace/Span 及 `thread_id` | 将嵌套调用组成 Trace 树，并按线程聚合多轮对话 | 可展开的 Trace、Span 和 Conversation Thread | [^opik-conversations] |
| 服务端写入 | Trace、Span、反馈、附件及元数据 | Backend 提供 REST/API，分别写入分析库、状态库、缓存和附件存储 | 可查询的项目、Trace、Span、Feedback、附件 | [^opik-architecture][^opik-compose] |
| 复盘与标注 | 查询到的 Trace/Thread | UI 或 MCP 读取执行细节，人工增加分数和评论，在线规则可自动打分 | 反馈分数、评论、低质量案例和待复盘集合 | [^opik-feedback][^opik-mcp] |
| 评估数据构造 | 选中的 Trace 及其元数据 | 将 Trace 转成 Dataset 项或测试套件项，关联期望输出、断言和上下文 | 可版本化的 Dataset、自然语言断言和 Experiment | [^opik-datasets][^opik-evaluation-loop] |
| 回归验证 | 更新后的 Agent、Dataset/测试套件 | 运行 Experiment 或 Pytest，在 CI 中比较指标、通过率和失败样例 | CI 结果、指标、实验比较及 Skill 更新证据 | [^opik-experiments][^opik-pytest] |

### 关键状态与产物

- **Trace/Span 树**：Trace 是一次任务或会话级记录，Span 表示其中的函数、LLM、工具或检索步骤；Claude Code 插件将每轮对话作为 Trace，并将工具调用、思考、响应和子 Agent 调用作为嵌套 Span。[^opik-claude-plugin]
- **Conversation Thread**：多个 Trace 使用同一 `thread_id` 聚合为可回看的多轮对话；它是线程索引，不等于原始客户端会话文件。[^opik-conversations]
- **Feedback Score 与 Comment**：可挂在 Trace、Span 或 Thread 上，既可以来自人工标注，也可以来自在线评估规则；分数和理由是后续筛选和 Dataset 构造的依据。[^opik-feedback][^opik-mcp]
- **Dataset、Test Suite、Experiment**：Dataset 保存数据项，Test Suite 以行为断言表达回归要求，Experiment 将执行 Trace 与数据项关联并保存指标，支持跨版本比较。[^opik-datasets][^opik-experiments][^opik-evaluation-loop]
- **Prompt Version**：MCP 的 `prompt_version.save` 可以将提示词版本写入 Opik；它记录版本和实验关系，但不会自动修改仓库中的 Skill 文件。[^opik-mcp]

### 最终输出

最终输出包括可检索的 Agent Trace、可展开的工具调用树、人工/自动反馈、Dataset/Test Suite、Experiment 指标以及 CI 的通过或失败结果。团队可以据此形成“某次会话暴露了什么问题、对应哪个 Skill、修改后是否改善”的证据包，再由负责人把候选修改提交到 Git。

## 4. 与需求画像逐项对照

### 需求矩阵

| 需求项 | 优先级或硬约束 | 项目现有能力 | 证据 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 收集 Agent 多步轨迹、工具调用和子 Agent | 必须 | Trace/Span 树；官方 Claude Code 插件支持工具、思考、响应及嵌套子 Agent | [^opik-claude-plugin][^opik-readme] | 满足 | Claude Code 需要额外安装插件；其他 Agent 需要 SDK、OTel 或自研适配器。 |
| 支持多种 Agent 客户端 | 必须 | SDK/OTel 跨语言；MCP 支持 Claude Code、Cursor、VS Code Copilot、Codex、opencode | [^opik-sdk][^opik-mcp-doc] | 部分满足 | MCP 是访问 Opik 数据，不代表 Cursor、Codex 等客户端都有官方会话自动采集器。 |
| 能保存可回看的个人完整开发会话 | 必须 | Claude Code 插件按对话轮和 Span 上报；线程可在 UI 中回看 | [^opik-claude-plugin][^opik-conversations] | 部分满足 | 结构化 Trace 可回看；原始本地 JSONL、环境和文件快照的完整保留未确认。 |
| 用户决定是否上传，保护隐私 | 期望 | 插件提供项目/全局启停和项目级 opt-out；自托管可将数据留在内网 | [^opik-claude-plugin][^opik-local-deploy] | 部分满足 | 有显式启停，但未确认“选择某一历史原始会话后再上传”的现成 UI；需自研筛选/确认层。 |
| 从失败会话沉淀经验并支持人工反馈 | 必须 | Trace 筛选、Feedback Score/Comment、Trace 转 Dataset、Annotation Queue | [^opik-feedback][^opik-datasets] | 满足 | 业务负责人仍需定义反馈字段和审核规则。 |
| 把经验变成可回归测试，验证 Skill 修改 | 必须 | Test Suite、Dataset/Experiment、LLM-as-a-judge、Pytest/CI 集成 | [^opik-evaluation-loop][^opik-pytest] | 满足 | Opik 提供证据和执行能力，不自动生成或发布 Skill。 |
| 业务知识长期 Memory | 期望 | Metadata、Dataset、Prompt Version、Comment 可存结构化上下文 | [^opik-datasets][^opik-mcp] | 部分满足 | 没有以业务实体、来源、冲突和生命周期为核心的 Memory 模块；需外接 Memory 或定义治理模型。 |
| 模型 API 可切换，公司 API 与 DeepSeek | 必须 | OpenAI 兼容 Provider、自定义 Base URL；官方 DeepSeek 示例使用 OpenAI 客户端和 `track_openai` | [^opik-provider][^opik-deepseek] | 部分满足 | DeepSeek 直接有文档；公司 API 需兼容 OpenAI 格式或实现自定义模型/适配器。 |
| 单台内网服务器 Docker Compose 试点 | 必须 | 官方提供 Compose 本地部署、持久化卷和 profiles | [^opik-local-deploy][^opik-compose-readme] | 满足 | Compose 组件多；官方不把它作为生产规模方案，资源与吞吐需实测。 |
| 原始会话不经授权不外发 | 期望 | 可自托管，MCP/SDK URL 可指向本地；MCP 与核心均有遥测开关/配置 | [^opik-local-deploy][^opik-mcp-privacy] | 部分满足 | 自托管可控制业务数据路径，但默认使用情况上报和模型评估外呼需按公司策略关闭或审计。 |

### 对照归纳

Opik 对“会话可观察、失败可标注、评估可回归、CI 可验证”这一主线匹配度较高，尤其适合把已打通的 Skill 流程接上真实失败样例。多 Agent 的接入面主要由 SDK/OTel/MCP 组成，而不是统一的 Agent 会话文件格式。

它不直接解决两个边界问题：一是跨成员本地目录中的历史原始会话发现与用户确认上传；二是业务知识 Memory 的实体化治理。若试点先接受“Claude Code 新会话通过插件结构化采集”，可以较快验证经验沉淀闭环；若硬性要求原始 JSONL 无损归档，则需要额外采集器和对象存储设计。

## 5. 开源与能力边界

### 边界清单

| 能力 | 开源核心 | 商业版或 SaaS | 外部依赖 | 证据 |
| --- | --- | --- | --- | --- |
| Opik Server、Web UI、Trace、Dataset、Experiment、Evaluation | 有，核心仓库 Apache-2.0，可自托管 | Opik Cloud 提供托管和附加服务 | Docker、MySQL、ClickHouse、Redis、MinIO、ZooKeeper 等 | [^opik-license][^opik-readme][^opik-architecture] |
| 多语言 SDK、REST、OpenTelemetry | 有，Python/TypeScript SDK 和 REST/OTel 接入 | 云端 API Key、Workspace 和托管运维 | 被观测 Agent、OTel SDK 或框架包 | [^opik-sdk][^opik-faq] |
| Claude Code 会话采集 | 独立官方 `opik-claude-code-plugin`，Apache-2.0；非 Opik 核心仓库 | 可把 URL 指向 Opik Cloud 或自托管 | Claude Code Hooks、插件二进制、Opik API | [^opik-claude-plugin] |
| MCP 读取与写入 Trace、反馈、Prompt、Test Suite、Experiment | 独立官方 `opik-mcp`，Apache-2.0；可本地 `uvx` 运行 | Cloud OAuth、API Key；`ask_ollie`/`run_experiment` 为 Comet Cloud 能力 | Python 3.13+、uv、AI 客户端 MCP 支持 | [^opik-mcp][^opik-mcp-boundary] |
| Ollie/Agent Insights 自动解释 | OSS MCP 可读写基础对象，但官方说明 self-hosted 不支持 `ask_ollie` 和 `run_experiment` | Comet Cloud 提供托管 Ollie 等服务 | 外部模型/Cloud 能力 | [^opik-mcp-boundary][^opik-mcp-doc] |
| LLM-as-a-judge 与自定义模型 | 评估代码、指标和 OpenAI-compatible 配置在 OSS 可用 | 云端模型调用和配额由 Comet Cloud 管理 | 公司模型 API、DeepSeek 或其他兼容端点 | [^opik-provider][^opik-custom-model] |
| 用户管理、计费、支持 | OSS 不包含 Cloud 的用户管理与计费体系 | Opik Cloud 提供用户管理、计费和支持 | 公司 SSO/反向代理可自行补齐 | [^opik-faq] |

### 边界判断

Opik 核心仓库、Claude Code 插件和 MCP Server 都在各自仓库标明 Apache-2.0，但它们是三个可独立升级的组件，不能因为核心开源就默认插件版本、云端 Ollie 或托管身份能力具有同一边界。[^opik-license][^opik-claude-plugin][^opik-mcp]

自托管核心可以把 Trace 与评估数据留在内网；不过 Compose 配置包含使用情况上报选项，MCP Server 默认也有匿名遥测配置。试点部署应检查 `OPIK_USAGE_REPORT_ENABLED`、`OPIK_MCP_ANALYTICS_ENABLED` 和 `OPIK_MCP_ANALYTICS_SOURCE`，并决定评估 Judge 是否允许访问公司 API 或 DeepSeek。[^opik-compose][^opik-mcp-privacy]

## 6. 用户如何接入和使用

### 接入前提

- 部署或准备一个 Opik Server；本地试点可通过官方 `./opik.sh`/Docker Compose，使用 `http://localhost:5173`。[^opik-local-deploy]
- 对应用侧安装 `opik` Python/TypeScript SDK，或使用 OpenTelemetry/框架集成；非 Python/TypeScript Agent 可直接调用 REST。[^opik-sdk][^opik-faq]
- Claude Code 需要安装独立的 `opik-claude-code-plugin` 并通过 Hook 启用追踪；Cursor、Claude Code、VS Code Copilot、Codex、opencode 可通过 `opik-mcp` 配置访问 Opik。[^opik-claude-plugin][^opik-mcp-doc]
- 如果评估需要 LLM Judge，配置 DeepSeek 或公司 OpenAI-compatible API 的 Base URL、密钥和模型；公司非兼容 API 需要自定义模型实现。[^opik-provider][^opik-custom-model]

### 最快验证路径

1. 先启动自托管 Opik，运行 `opik configure --use_local`，让 SDK 将数据发送到本地 API；用 `--verify` 检查 Compose 服务健康。[^opik-local-deploy]
2. 在应用入口用 `@track`、`track_openai`、框架集成或 OTel exporter 建立根 Trace；把仓库、分支、Agent、Skill 版本和任务编号写入项目名、标签或 metadata。
3. 在 Claude Code 中安装插件，使用 `/opik:trace-claude-code start` 按项目或全局启用；项目级 `.claude/.opik-tracing-enabled` 可以覆盖全局设置。[^opik-claude-plugin]
4. 在 Agent 客户端配置 `opik-mcp`。本地 OSS 通常用 `uvx opik-mcp` 的 stdio 方式；对自托管地址设置 `COMET_URL_OVERRIDE`/`OPIK_URL`，并在客户端重启后用 `list my Opik projects` 验证。[^opik-mcp-doc]
5. 复盘 Trace 并添加分数/评论，将失败 Trace 加入 Dataset 或 Test Suite；更新 Skill、提示词、工具定义或检索参数后运行 Experiment/Pytest，保存 CI 结果作为候选变更证据。[^opik-evaluation-loop][^opik-pytest]

### 日常使用方式

开发者在 Opik UI 中按项目、错误状态、低分或线程查看完整 Trace；MCP 用户可以在 Claude Code 或 Cursor 中 `read`/`list` Trace，用 `write` 增加 Score、Comment、Prompt Version、Test Suite 和 Experiment。评审人将高价值失败案例整理为 Dataset 或测试断言，Skill 负责人再把证据转换为 Git 中的候选修改。[^opik-mcp][^opik-evaluation-loop]

CI 中可用 `llm_unit` Pytest 装饰器记录 LLM 测试的通过率与 Trace；对成本敏感的项目可以把完整在线评估与轻量回归测试分层，具体策略不由 Opik 自动决定。[^opik-pytest]

### 接入限制

Opik 核心不会主动扫描每位成员的 Claude Code 个人目录，历史会话需要插件、`ccsync` 类导出器或自研解析器补齐。官方 Claude Code 插件的采集结果是 Opik Trace/Span，原始 JSONL 无损上传、用户在历史会话列表中逐条确认等能力未确认。[^opik-claude-plugin]

MCP Server 的 `ask_ollie` 和 `run_experiment` 在 self-hosted 直接不可用；Cursor 的 MCP 工具调用存在 60 秒硬超时，长时间调查应拆分查询或使用其他客户端。[^opik-mcp-boundary][^opik-mcp-doc]

## 7. 部署构成

### 运行组件

| 组件 | 必需或可选 | 职责 | 持久化数据 | 与其他组件的关系 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MySQL | 必需 | 保存状态库、元数据及迁移状态 | Docker volume 下的 MySQL 数据 | Backend 通过 JDBC 访问 | [^opik-architecture][^opik-compose] |
| ClickHouse + 初始化配置 | 必需 | 保存 Trace、Span、Feedback 等分析数据 | ClickHouse data/log/config volumes | Backend 写入并查询，ZooKeeper 提供协调 | [^opik-architecture][^opik-compose] |
| Redis | 必需 | 缓存及异步任务/队列支撑 | Redis data volume | Backend/Python backend 使用 | [^opik-architecture][^opik-compose] |
| ZooKeeper | 必需（当前 Compose） | ClickHouse 单节点配置/协调 | ZooKeeper volume | ClickHouse 依赖健康检查 | [^opik-compose] |
| MinIO + mc 初始化容器 | 必需（完整 Compose） | 对象/附件存储，`mc` 创建 bucket | MinIO data volume | Backend 使用 S3 兼容接口 | [^opik-compose] |
| Java Backend | 必需 | REST/API、鉴权入口、业务服务、数据库迁移 | 无独立业务卷 | 依赖 MySQL、ClickHouse、Redis、MinIO | [^opik-contribution][^opik-compose] |
| Python Backend | 必需（评估/优化路径） | Python 评估、优化器及后台任务 | 临时执行目录，结果回写 Opik | 通过 Backend/Redis 工作，可启动代码执行容器 | [^opik-compose] |
| React Frontend/Nginx | 必需（UI） | Dashboard、Trace/Thread、Dataset、Experiment 界面 | 无独立业务卷 | 反向代理 Backend，暴露 5173 | [^opik-local-deploy][^opik-compose-readme] |
| Demo data generator | 可选 | 初始化演示数据 | 无 | 等待 Frontend/Python Backend 健康后执行 | [^opik-compose] |
| Guardrails Backend | 可选 | 提示注入等 Guardrails 模型服务 | 可挂载 adapters | 与 Backend 按 profile 启用 | [^opik-local-deploy][^opik-compose-readme] |
| OpenTelemetry Collector + Jaeger | 可选 | 观察 Opik 自身服务、导出 Trace/日志 | Jaeger 数据按配置保存 | `opik-otel` profile 启用 | [^opik-compose-readme] |
| Claude Code Plugin / Opik MCP | 客户端侧可选 | Hook 采集会话；MCP 读写 Opik | 本地配置、启用标志和缓存 | 通过 Opik API 连接 Backend | [^opik-claude-plugin][^opik-mcp] |

### 最小部署路径

官方最小路径是克隆 Opik 仓库、安装 Docker/Docker Compose，执行 `./opik.sh`，然后访问 `http://localhost:5173`；SDK 使用 `opik configure --use_local` 指向本机实例。Docker Compose profiles 还允许只启动 infrastructure、Backend，或完整 Opik 套件。[^opik-local-deploy][^opik-compose-readme]

对于本项目的单服务器试点，建议先启用完整 Opik profile、关闭不需要的 Guardrails/OTel profile，再接入 Claude Code Plugin 和 MCP。这个路径仍然同时运行多个容器与多个数据存储，不能把“一个服务器”误解为“一个进程”。官方未给出适用于本场景的最低 CPU、内存或磁盘数字，需用实际会话量和保留周期实测。

### 生产化仍需考虑

- Compose 文档定位为本地/测试使用，生产规模官方推荐 Kubernetes/Helm；若试点长期运行，至少要固定 `OPIK_VERSION`、备份 MySQL/ClickHouse/MinIO/Redis 数据卷，并制定 Trace/附件保留和清理策略。[^opik-local-deploy][^opik-compose-readme]
- 自托管 OSS 与 Cloud 的用户管理不同；需在内网入口补充 TLS、反向代理、访问控制、项目隔离和审计，不能因 OSS 本地默认 workspace 就视为完成企业权限治理。[^opik-faq]
- 关闭或审计匿名使用情况上报、MCP 遥测和模型评估外呼；Judge 使用 DeepSeek 或公司 API 时，应明确哪些 Trace 内容会发送到模型端点。[^opik-compose][^opik-mcp-privacy][^opik-provider]
- 官方未给出本项目规模下的资源要求和 Trace 吞吐基线，需实测单机并发、ClickHouse 增长、附件体积、评估任务并行度和备份恢复时间。

## 8. 适配结论与能力缺口

### 适配结论

**条件匹配。**

需求矩阵显示，Opik 可以直接提供 Agent Trace、人工反馈、Dataset/Test Suite、Experiment、Pytest/CI 评估和单机 Compose 试点能力；Claude Code 还有官方插件，MCP 能让 Claude Code、Cursor 等客户端直接读写这些产物。它没有直接提供历史本地会话发现、原始 JSONL 无损归档和业务 Memory 治理，并且多客户端自动采集范围不统一。评估 Judge 对 DeepSeek 直接可接，对公司 API 取决于 OpenAI 兼容性。因此它适合作为“结构化会话与经验验证层”，但需补齐用户授权上传与 Skill/Memory 治理层。

### 已满足能力

- **Agent 执行可观察**：Claude Code 插件将会话轮、工具调用、思考、响应和子 Agent 映射为 Trace/Span；SDK/OTel 还可接入其他应用和框架。[^opik-claude-plugin][^opik-sdk]
- **失败经验可标注**：Trace/Thread 可以被人工打分、评论、筛选，并转为 Dataset 或 Test Suite 项。[^opik-feedback][^opik-datasets]
- **修改后可回归**：Experiment、LLM Judge、自然语言测试套件和 Pytest/CI 可以对比修改前后行为。[^opik-evaluation-loop][^opik-pytest]
- **客户端可查询/写入**：官方 MCP Server 为 Claude Code、Cursor、VS Code Copilot、Codex、opencode 提供读写 Trace、Score、Prompt、Test Suite 等接口。[^opik-mcp-doc][^opik-mcp]
- **模型端点可配置**：DeepSeek 有 OpenAI-compatible 的官方示例，公司内部兼容接口可以使用自定义 Provider/Base URL。[^opik-deepseek][^opik-provider]
- **单机可启动**：官方 Compose profile 和持久化卷支持在一台内网服务器启动试点；官方也明确了其与生产 Helm 部署的定位差异。[^opik-local-deploy][^opik-compose-readme]

### 能力缺口

- **原始会话归档缺口**：Opik 的标准产物是 Trace/Span，不是 Claude Code 本地 JSONL、仓库文件快照和完整终端环境；原始会话保留策略未确认。
- **历史会话发现和用户授权缺口**：官方插件能启停新会话追踪，但没有确认提供“本地扫描→候选排序→用户逐条确认→上传完整原始会话”的现成流程。
- **跨 Agent 采集缺口**：MCP 支持多个客户端访问 Opik 数据，但 Cursor、Codex 等客户端是否拥有与 Claude Code 插件等价的会话自动采集器未确认。
- **Memory 治理缺口**：Dataset、Comment、Prompt Version 可承载业务知识片段，但没有业务实体、来源可信度、冲突解决、过期和审批状态的完整 Memory 生命周期。
- **自托管智能分析缺口**：self-hosted MCP 不支持 `ask_ollie` 和 `run_experiment`，需要直接使用基础 `read`/`list`/`write` 或自行补充分析服务。[^opik-mcp-boundary]
- **单机生产化缺口**：官方将 Compose 定位为本地/测试方案，未给出本项目规模的最低资源和可靠性基线；备份、鉴权、保留和升级需要团队自行治理。

### 需要自研或外部补齐

- 在开发者本地增加会话适配层：读取 Claude Code JSONL 或其他 Agent 格式，进行候选筛选、摘要/元数据预览和用户确认，再将原始文件作为受控附件或独立对象上传；如果只需结构化经验，可直接生成 Opik Trace/Span。
- 定义统一事件模型，把 Agent、会话、任务、工具调用、代码变更、测试/CI、Skill 版本和业务标签映射到 Opik 的 project、trace、span、thread、metadata 和 attachment。
- 在 Opik 外建立 Skill 候选记录：关联 Trace/Span、失败原因、适用范围、建议修改、验证任务和 Git PR；Opik 只保存证据和评估结果，不直接发布 Skill。
- 为业务 Memory 增加审核与生命周期字段，例如术语/规则、来源 Trace、负责人、有效期、冲突状态和关联 Skill，并通过 MCP 或 API 让 Agent 查询。
- 对公司模型 API 实施 Provider 适配与网络策略；DeepSeek 可按官方 OpenAI 兼容方式接入，非兼容接口需实现 `OpikBaseModel` 或 REST/SDK 适配。[^opik-deepseek][^opik-custom-model]

### 否决风险

当前未发现必须否决 Opik 的硬性风险：核心平台 Apache-2.0、可自托管，且单机 Compose 和模型端点切换均有官方路径。需要在 POC 前确认的高风险项是：完整原始会话是否为硬要求、单机资源是否足以承载真实数据保留周期、公司 API 是否兼容 OpenAI 格式，以及隐私策略是否允许任何默认遥测或评估外呼。若“原始 JSONL 无损上传且必须用户逐条授权”被提升为硬约束，Opik 本身只能作为下游存储/分析层，不能单独满足。


[^opik-repository]: [Opik 官方 GitHub 仓库](https://github.com/comet-ml/opik)
[^opik-license]: [Opik Apache-2.0 许可证](https://github.com/comet-ml/opik/blob/main/LICENSE)
[^opik-release]: [Opik 官方 Releases](https://github.com/comet-ml/opik/releases/tag/2.2.12)
[^opik-readme]: [Opik README：Tracing、Evaluation 与 Agent 能力](https://github.com/comet-ml/opik#what-is-opik)
[^opik-sdk]: [Opik README：SDK、REST API 与 OpenTelemetry](https://github.com/comet-ml/opik#opik-client-sdk)
[^opik-architecture]: [Opik 官方贡献文档：服务与基础设施构成](https://www.comet.com/docs/opik/contributing/overview)
[^opik-contribution]: [Opik Backend/Frontend/SDK 目录说明](https://www.comet.com/docs/opik/contributing/overview#project-setup-and-architecture)
[^opik-local-deploy]: [Opik 官方 Local Deployment](https://www.comet.com/docs/opik/self-host/local_deployment/)
[^opik-compose-readme]: [Opik Docker Compose 官方说明](https://github.com/comet-ml/opik/tree/main/deployment/docker-compose)
[^opik-compose]: [Opik Docker Compose 配置](https://github.com/comet-ml/opik/blob/main/deployment/docker-compose/docker-compose.yaml)
[^opik-claude-plugin]: [Opik Claude Code Plugin 官方仓库与实现说明](https://github.com/comet-ml/opik-claude-code-plugin)
[^opik-mcp]: [Opik MCP Server 官方仓库](https://github.com/comet-ml/opik-mcp)
[^opik-mcp-doc]: [Opik 官方 MCP Server 文档：客户端与配置](https://www.comet.com/docs/opik/mcp-server)
[^opik-mcp-boundary]: [Opik MCP README：self-hosted 与 Cloud 能力边界](https://github.com/comet-ml/opik-mcp#self-hosted-opik)
[^opik-mcp-privacy]: [Opik MCP README：Telemetry 配置](https://github.com/comet-ml/opik-mcp#telemetry)
[^opik-conversations]: [Opik 官方文档：Log conversations 与 thread_id](https://www.comet.com/docs/opik/tracing/advanced/log_chat_conversations)
[^opik-feedback]: [Opik 官方文档：Log user feedback 与标注](https://www.comet.com/docs/opik/tracing/advanced/annotate_traces)
[^opik-datasets]: [Opik 官方文档：Trace 转 Dataset 与数据结构](https://www.comet.com/docs/opik/evaluation/advanced/manage_datasets)
[^opik-experiments]: [Opik 官方文档：Experiments 关联 Trace 与 Dataset](https://www.comet.com/docs/opik/evaluation/advanced/evaluate_your_llm)
[^opik-evaluation-loop]: [Opik 官方文档：从真实失败到测试套件的评估闭环](https://www.comet.com/docs/opik/evaluation/overview)
[^opik-pytest]: [Opik 官方文档：Pytest 集成与 llm_unit](https://www.comet.com/docs/opik/v1/testing/pytest_integration)
[^opik-provider]: [Opik 官方文档：AI Providers 与自定义 OpenAI-compatible Provider](https://www.comet.com/docs/opik/administration/workspace-settings/ai_providers)
[^opik-deepseek]: [Opik 官方文档：通过 OpenAI 集成追踪 DeepSeek](https://www.comet.com/docs/opik/integrations/openai)
[^opik-custom-model]: [Opik 官方文档：OpenAI-compatible 自定义模型与 LiteLLM](https://www.comet.com/docs/opik/evaluation/metrics/custom_model)
[^opik-faq]: [Opik 官方 FAQ：OSS 与 Cloud、SDK 与认证差异](https://www.comet.com/docs/opik/faq)
