---
title: "Zep：托管 Context Graph 生态与开源边界案例"
kind: open-source-research-report
status: completed
topic: AI Memory
project: Zep
role: boundary_case
brief_version: "1.0"
---

# Zep：托管 Context Graph 生态与开源边界案例

> **项目快照**：官方仓库 <https://github.com/getzep/zep>｜核验日期 2026-09-03｜Stars 约 4.9k｜许可证 Apache-2.0｜当前仓库在核验日有维护，但仓库自述为 Zep Cloud 示例/集成集合；旧 Community Edition 已移至 `legacy` 且不再支持。[^zep-repository][^zep-license]

> **需求画像**：目标是寻找能够自部署、接入多种 Agent、沉淀业务知识并支撑 Skill 更新的开源 Memory 项目。硬约束是单机可部署、模型 API 可切换和不把团队原始会话强制交给外部 SaaS；Zep 本报告主要用于理解其 Context Graph 设计及开源边界，实际自部署适配必须单独验证。

## 1. 项目要解决什么问题

### 目标用户与使用场景

当前 `getzep/zep` 仓库定位为 Zep Cloud 的 examples、framework integrations、bulk ingestion 和评估工具集合，用于帮助开发者接入 Zep 的托管 Agent Memory 平台。[^zep-repository]

Zep 的产品思路是从聊天历史、业务数据和用户行为组装相关上下文，使 Agent 获得个性化、及时的知识；官方文档把它描述为 temporal Context Graph。[^zep-docs]

### 当前问题

普通会话历史不能直接表达事实的变化、用户/实体关系和来源。Zep 产品通过上下文图谱、用户/线程/消息管理和知识图检索，解决长期记忆和上下文组装问题。[^zep-docs][^graphiti-zep]

对于 Skill 更新研究，Zep 的有价值部分是图谱、线程、episode、observation 和 ontology 等概念，以及其多语言 SDK/集成组织方式。[^zep-repository]

### 问题边界

当前仓库不是 Zep 产品或服务，并不提供可直接自托管的当前 Context Graph Engine。Community Edition 已 deprecated；将仓库的示例代码视为完整开源 Memory Server 会误导部署判断。[^zep-repository]

## 2. 设计的核心思路

### 核心判断

Zep 的核心是以时间知识图谱为中心组装上下文：用户消息和业务数据进入图谱，图谱根据当前/历史事实、关系和查询返回上下文。生产产品使用专有 Context Graph Engine，Graphiti 是其开源框架对应物。[^graphiti-zep][^zep-repository]

### Memory 实现方式

在 Zep Cloud 产品路径中，消息、线程和业务数据进入托管的 Episode/Observation 图谱，系统抽取带时间和关系的事实，再按用户/线程范围做图、向量和全文检索并组装上下文。当前 `getzep/zep` 仓库不包含这套 Context Graph Engine，因此这里的实现方式只能作为产品架构参考，不能当作可自托管实现。[^graphiti-zep][^zep-repository]

### 关键设计选择

- **用户/线程/消息作为一等对象**：产品 API 具备用户、session/thread 和消息管理，便于按会话上下文组织数据。[^zep-repository][^zep-docs]
- **图谱与 Observation**：CLI/API 目录包含 graph、episode、observation、ontology 和 thread-summary 等概念，体现从原始输入到派生知识的分层。[^zepctl]
- **多语言 SDK 和集成**：官方仓库维护 Python、TypeScript、Go SDK 以及多种 Agent framework integrations。[^zep-repository]
- **托管性能与治理**：Zep Cloud 提供生产检索、Dashboard、审计、SLA 和企业支持，这些不等价于 Apache-2.0 仓库能力。[^graphiti-zep]

### 向量化与模型接口核验

当前 `getzep/zep` 仓库是 Cloud examples/integrations 集合，未提供当前 Context Graph Engine 的自托管 Embedding 配置、默认模型、向量维度或可替换向量库；这些能力属于托管产品边界，不能从 SDK 示例推定。[^zep-repository][^zep-docs]

如果团队借鉴其开源 Graphiti 核心，Graphiti 默认使用 OpenAI `text-embedding-3-small`，核心默认维度为 1024，并提供 OpenAI/Azure/Gemini/Voyage embedder 及 OpenAI-compatible/Ollama 接入。这里的模型与维度是 Graphiti 的开源实现事实，不是 Zep Cloud 的自托管承诺。[^graphiti-zep][^zep-graphiti-embedder]

因此公司 API/DeepSeek 是否可用于 Zep 本身应标记为“未确认”；只有在实际使用 Zep Cloud/Graphiti 接口时，分别确认其 Embedding 数据出境、模型选择和维度约束。中文检索、模型切换、旧向量迁移及向量后端均需以目标产品合同/运行配置为准，不能把 Zep 仓库的 Apache-2.0 许可证等价为完整内网方案。[^zep-docs][^graphiti-zep]

### 代价与取舍

托管服务降低了图数据库、索引和权限运维，但要求使用 Zep Cloud API 和其数据边界；当前开源仓库无法提供同等自部署体验。调研判断：对本项目，Zep 更适合作为 Graphiti/Context Graph 的产品化对照，不适合作为单机内网首选。

## 3. 项目如何工作

### 工作流概览

```mermaid
flowchart LR
  A[输入：用户消息/线程与业务数据] --> B[Zep ingestion 写入 episode]
  B --> C[托管 Context Graph 抽取实体、事实和 observation]
  C --> D[时间图与 ontology 持久化]
  D --> E[混合图检索和上下文组装]
  E --> F[输出：给 Agent 的个性化上下文]
  F --> G[外部 Skill 候选/评审流程]
```

### 阶段说明

| 阶段 | 接收什么 | 做什么 | 产生的状态或产物 | 证据 |
| --- | --- | --- | --- | --- |
| 会话接入 | 用户、线程、消息和业务数据 | SDK/ingestion API 登记输入 | thread/episode 原始记录 | [^zep-repository][^zep-docs] |
| 图谱构建 | 原始输入 | 托管引擎抽取实体、关系和观察 | Context Graph、observation | [^zepctl][^graphiti-zep] |
| 时间更新 | 新事实与旧事实 | 维护事实当前状态和历史关系 | 时间有效知识 | [^graphiti-zep] |
| 检索组装 | 查询与用户/线程范围 | 图、向量和全文检索组装上下文 | 相关上下文 | [^zep-docs] |
| Agent 消费 | 上下文和 SDK 结果 | 注入应用 Agent 或框架 | 个性化回答/行动 | [^zep-repository] |
| 下游治理 | 结果、thread/episode ID | 外部系统生成 Skill 候选和评审 | 可追溯变更 | 调研判断 |

### 关键状态与产物

- **Thread/Message**：会话边界和原始消息；适合绑定开发会话 ID，但当前开源仓库只是示例/客户端。[^zep-repository]
- **Episode**：知识摄取原始事件，作为派生观察和事实的来源。[^zepctl]
- **Observation/Graph**：从输入生成的派生实体、事实和关系，用于检索。[^zepctl]
- **Ontology/Thread summary**：约束知识结构和摘要策略，帮助上下文组装。[^zepctl]

### 最终输出

Zep Cloud SDK 返回面向 Agent 的上下文。对于 Skill 更新，可利用 thread/episode/observation ID 作为证据引用；但原始会话、候选生成和 Git 发布必须在团队自有系统完成。

## 4. 与需求画像逐项对照

### 需求矩阵

| 需求项 | 优先级或硬约束 | 项目现有能力 | 证据 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 项目业务知识长期保存 | 必须 | Zep Cloud Context Graph | [^zep-docs] | 满足 | 依赖托管服务；当前仓库不提供同等引擎 |
| 技术决策和经验可检索 | 必须 | 图谱、thread/episode/observation、SDK | [^zepctl][^zep-repository] | 部分满足 | 自部署持久化和访问控制未提供 |
| 完整开发会话接收 | 必须 | 消息/线程 API 示例 | [^zep-repository] | 部分满足 | Claude Code 选择上传和原始归档需自建 |
| 证据来源和历史 | 必须 | Context Graph 时间事实与 episode 概念 | [^graphiti-zep][^zepctl] | 部分满足 | 托管产品能力不能迁移为当前 OSS Server |
| 多 Agent 接入 | 必须 | 多框架 integrations、多语言 SDK | [^zep-repository] | 满足 | 具体集成通过 Zep Cloud API |
| 模型 API 可切换 | 必须 | 产品/SDK 支持 provider 配置，但当前仓库无完整服务实现 | [^zep-docs] | 部分满足 | 公司 API/DeepSeek 需在产品/Graphiti 层验证 |
| 单机自部署 | 必须 | Community Edition 已 deprecated；当前仓库为示例集 | [^zep-repository] | 不满足 | 不能把旧 legacy 当受支持生产路径 |
| 用户主动控制原始会话上传 | 期望 | 调用方决定调用 API | [^zep-repository] | 部分满足 | 产品权限/上传审批需自建或依赖云端 |
| Skill 候选人工发布 | 必须 | benchmark/eval/ingestion 可提供思路 | [^zep-repository] | 部分满足 | 没有团队 Skill Git 发布闭环 |

### 对照归纳

Zep Cloud 的 Memory 产品能力很完整，但当前开源仓库不满足“单机内网自部署”的硬约束。若研究目标是选择可落地 OSS，应把 Zep 的图谱设计映射到 Graphiti，而不是把 Zep Cloud 仓库直接部署。

## 5. 开源与能力边界

### 边界清单

| 能力 | 开源核心 | 商业版或 SaaS | 外部依赖 | 证据 |
| --- | --- | --- | --- | --- |
| Examples、integrations、ingestion 工具 | 有，Apache-2.0 | 用于连接 Zep Cloud | Python/TS/Go 运行时、Zep API Key | [^zep-repository][^zep-license] |
| Zep Context Graph Engine | 无（专有） | Zep Cloud/企业部署 | Zep 账号、API、网络 | [^graphiti-zep] |
| Community Edition Server | 仅 legacy，已不支持 | 无当前 OSS 等价物 | 旧依赖不应生产使用 | [^zep-repository] |
| Graphiti 开源框架 | 独立 Apache-2.0 项目 | Zep 产品内部使用 Graphiti 思路/能力 | 自建图数据库与服务 | [^graphiti-zep] |
| Dashboard、审计、SLA | 不在当前示例仓库 | Zep Cloud 提供 | 托管平台 | [^graphiti-zep] |

### 边界判断

官方 README 明确写出：仓库不是 Zep 产品或服务；Community Edition 被移到 `legacy` 并不再支持。该事实足以否决其作为本次单机 Memory 主选，但不否定其作为 Graphiti 和托管 Context Graph 的设计参考。[^zep-repository]

## 6. 用户如何接入和使用

### 接入前提

- 注册 Zep Cloud、获取 API Key，安装 `zep-cloud` 或对应语言 SDK。[^zep-docs]
- 选择 framework integration、ingestion 工具或 MCP/CLI；准备将开发会话转换为 thread/message/episode。
- 若要求内网和可控数据边界，需改选 Graphiti 或自建等价服务。

### 最快验证路径

1. 通过 SDK 创建用户/线程并写入消息或业务数据；或使用仓库 `ingestion` 工具导入 Slack、文档、Email、JSON/CSV 等。[^zep-repository]
2. 查询图谱节点、边、episode 或 observation，组装给 Agent 的上下文。[^zepctl]
3. 将结果和来源 ID 导出给外部 Skill 候选/评审系统；原始会话保留在公司自有存储。

### 日常使用方式

应用 Agent 每轮写入消息，并从 Zep Cloud 请求相关上下文。管理员使用托管平台的项目、API、日志和图谱工具；当前 OSS 仓库没有完整自托管管理面。[^graphiti-zep][^zep-repository]

### 接入限制

外部 SaaS 依赖与数据合规是关键限制；当前仓库的 examples/integrations 不能替代 Context Graph Engine。若接 DeepSeek/公司 API，需确认服务端模型配置，不应只依据客户端 SDK 推定支持。

## 7. 部署构成

### 运行组件

| 组件 | 必需或可选 | 职责 | 持久化数据 | 与其他组件的关系 | 证据 |
| --- | --- | --- | --- | --- | --- |
| Zep Cloud API | 当前产品路径必需 | 用户、线程、消息、图谱和检索 | 托管 Context Graph | 被 SDK/集成调用 | [^zep-docs] |
| Zep SDK/Integration | 必需 | 应用/Agent 接入 API | 客户端配置 | 调用 Zep Cloud | [^zep-repository] |
| Zep ingestion | 可选 | 批量导入文档、Slack、Email、JSON/CSV | 临时/任务状态 | 写入 Zep Cloud | [^zep-repository] |
| Zep CLI `zepctl` | 可选 | 管理 graph、episode、observation、ontology | 本地凭据配置 | 访问 Zep API | [^zepctl] |
| 本地原始会话归档/Skill 系统 | 本项目场景必需的外部组件 | 保存完整会话和候选变更 | 公司对象存储/Git | 与 Zep ID 关联 | 调研判断 |

### 最小部署路径

当前受支持的最小路径是注册 Zep Cloud、配置 API Key、安装 SDK 并调用 API；这不符合“单机内网自部署”基线。理论上的旧 Community Edition 位于 legacy 且不支持，不应作为 POC 最小路径。[^zep-repository][^zep-docs]

### 生产化仍需考虑

- 评估原始会话是否允许发送外部 SaaS、数据驻留、删除和审计；这些由托管平台条款和配置决定。
- 如果采用 Graphiti 替代，需要增加图数据库、MCP/REST、权限和备份；Graphiti 的部署评估见对应报告。
- 官方未给出当前 OSS 示例仓库的单机资源要求；云端性能指标不能直接外推到自建系统。

## 8. 适配结论与能力缺口

### 适配结论

**仅供借鉴。** Zep 的时间 Context Graph、thread/episode/observation 分层和多 Agent 集成方式值得用于设计团队 Memory，但当前开源仓库不是产品服务，Community Edition 已停维，不能满足单机内网自部署硬约束。

### 已满足能力

- Context Graph 的时间事实、来源和上下文组装模型。[^graphiti-zep]
- 多语言 SDK、Agent framework integrations、ingestion 和评估工具的组织方式。[^zep-repository]
- 可参考的线程、Episode、Observation、Ontology 数据分层。[^zepctl]

### 能力缺口

- **自部署核心**：当前仓库没有受支持的 Context Graph Engine/Server。
- **数据控制**：依赖 Zep Cloud，无法默认保证原始会话留在内网。
- **Skill 治理**：没有从会话证据到 Skill PR 的闭环。

### 需要自研或外部补齐

- 若坚持自建，需采用 Graphiti 或重建图谱、检索、用户/线程管理和服务层。
- 建立本地会话授权、原始归档、审计和 Git Skill 评审。

### 否决风险

“必须在一台内网服务器自部署”是当前明确否决项；除非 Zep 未来重新发布受支持的 OSS Server，否则不应作为主 POC 组合。

---

[^zep-repository]: [Zep 官方 GitHub 仓库（Examples & Integrations）](https://github.com/getzep/zep)
[^zep-license]: [Zep 仓库 Apache-2.0 许可证](https://github.com/getzep/zep/blob/main/LICENSE)
[^zep-docs]: [Zep 官方快速开始文档](https://help.getzep.com/v2/quickstart)
[^zepctl]: [Zep 官方 zepctl CLI](https://github.com/getzep/zepctl)
[^graphiti-zep]: [Graphiti README 中的 Zep 与 Graphiti 边界](https://github.com/getzep/graphiti#graphiti-and-zep)
[^zep-graphiti-embedder]: [Graphiti 官方 Embedder 实现（Zep 开源对应框架）](https://github.com/getzep/graphiti/tree/main/graphiti_core/embedder)
