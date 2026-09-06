---
title: 基于会话抽取 Markdown Memory 的方案设计
kind: memory-solution-design
status: draft
updated_at: 2026-09-06
---

# 基于会话抽取 Markdown Memory 的方案设计

## 1. 方案摘要

本方案的前提是：用户的开发会话已经被收集，并且每个会话具备稳定的 `session_id`、项目标识和原始文件引用。本阶段不重新设计会话采集，而是研究各个 Memory 项目的源码实现，组合出一条适合当前用户规模的低基础设施链路：

```text
已授权的原始会话
  → 标准化事件
  → Episode / 会话总结
  → Memory Candidate
  → 人工审核
  → Published Memory
  → Skill Candidate
  → Git diff + 回归验证
  → Published Skill
```

核心决定是：**先用 Markdown、Git、目录范围和关键词/全文检索，不提前引入 Embedding、向量数据库或图数据库。** 当前用户数量少，主要风险不是召回规模，而是抽取质量、来源追踪、冲突处理和模型输出污染正式知识。

## 2. 目标与非目标

### 2.1 目标

- 从已经收集的 Claude Code、Codex、Cursor 或其他 Agent 会话中提取项目事实、技术决策、约束、偏好、失败模式和可复用流程。
- 让每条派生 Memory 都能回溯到原始会话、消息/事件范围和抽取任务。
- 用 Markdown 保存可读、可审查、可版本化的 Memory 和 Skill。
- 支持新增、合并、更新、冲突、过期和恢复，而不是静默覆盖旧知识。
- 让 Agent 只能生成候选，不能直接修改正式 Memory 或发布 Skill。
- 在没有向量化的情况下，通过项目范围、标签、关键词和可选 SQLite FTS5 完成检索。
- 为未来增加 Embedding 或混合检索保留稳定的文件和字段契约。

### 2.2 非目标

- 不重新实现会话采集器。
- 不把每次会话自动变成长期 Memory。
- 不把一次成功对话直接发布为正式 Skill。
- 不在 MVP 阶段部署向量数据库、图数据库或复杂多租户服务。
- 不用摘要替代原始会话证据。
- 不让远程模型、索引或 Agent 自主绕过审核流程。

## 3. 对各项目源码机制的借鉴

| 项目                     | 可借鉴的源码级思想                                                        | 在本方案中的取舍                                                           |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Mem0                   | `add` 经 LLM 抽取短事实，再做去重/更新判断；写入与检索分离                              | 保留作用域、候选关系和显式更新概念；暂不使用向量检索，自动抽取不直接覆盖正式 Memory                      |
| Graphiti               | Episode、事实边、来源关系、有效/失效时间、冲突使旧事实失效                                | 用 Markdown frontmatter 和链接表达来源、时间和替代关系；不引入图数据库                     |
| Cognee                 | `add → cognify → recall/search` 分段；session memory 与长期知识分离        | 用 Episode、Memory Candidate 和 Published Memory 分层；不直接复制知识图谱管线       |
| EverOS                 | Episode、AtomicFact、Profile、Skill 的 Markdown-first 演化，异步索引可重建     | 采用 Markdown 作为事实源，索引只做派生物                                          |
| MemU                   | `prepare → Agent 判断/写作 → commit`；Agent 可以决定不保存                   | Agent 只能写 Candidate，commit 通过人工审核和 Git 发布                          |
| claude-mem             | 事件异步压缩为 observation/summary，索引→时间线→详情的渐进读取                       | 保留原始来源，Episode 只是中间证据；用关键词/FTS 替代 Chroma                           |
| TencentDB-Agent-Memory | L0-L3、Chat Memory/Skill/Wiki/CodeGraph 分离、Team/Agent/Task/ACL 装配 | MVP 只实现 L0、Episode、Memory、Skill Candidate 和 Skill；权限先依赖目录/Git/审核角色 |
| Letta Code             | MemoryFS/Git-backed Memory 的可读、提交、回滚和同步                          | 正式 Memory 由审核流程写入，Agent 不直接拥有生产写权限                                 |
| Memobase               | Profile/稳定事实与 Event/时间线分离，先缓冲再 flush                             | 使用 `memory_type` 与有效期区分稳定知识和临时事件                                   |
| Hindsight              | Retain、Recall、Reflect 分阶段；观察需要证据，反思不等于写入                         | 将跨会话归纳放到周期性 Reflect，仍然输出 Candidate                                 |
| LightRAG/Supermemory   | 来源、范围、关键词、事实演化、替代和过期关系                                           | 用标签、别名、`supersedes`、`conflicts_with` 和 `valid_until` 表达有限关系        |

## 4. 数据资产边界

### 4.1 原始会话（L0）

原始会话是不可变证据，不是 Memory。至少保留：

- `session_id`、Agent/版本、模型、项目/仓库、分支和提交；
- 起止时间、原始文件引用、内容哈希；
- 用户授权记录、上传人、上传时间和保留期限；
- 能定位到消息或事件范围的稳定偏移。

Memory 可以被修订、合并或废弃，但不能因为已有摘要就删除原始证据引用。

### 4.2 Episode

Episode 是一次会话或任务的结构化中间证据，描述任务目标、采取的方案、成功/失败路径、涉及文件、测试结果、未解决问题和候选主题。它不等于完整 transcript，也不直接等于长期事实。

### 4.3 Published Memory

只保存对未来任务有稳定帮助的内容，例如业务规则、术语、技术决策、工程约束、已验证的排错路径、重复失败模式和团队/项目偏好。一次性事件、未验证推测、秘密、个人隐私和临时环境细节默认不升级为长期 Memory。

### 4.4 Skill

Skill 是具有触发条件、前置条件、步骤、成功标准、失败边界和验证任务的可重复流程。只有“这次这样做成功了”但没有复用边界的内容，先保存为 Event、Pattern 或 Memory Candidate。

## 5. Markdown 目录布局

```text
memory-root/
├── index.md
├── sources/
│   └── sessions/<session-id>.md
├── projects/<project-id>/
│   ├── index.md
│   ├── episodes/
│   ├── facts/
│   ├── decisions/
│   ├── constraints/
│   ├── patterns/
│   ├── events/
│   ├── candidates/memory/{pending,approved,rejected}/
│   ├── candidates/skill/{pending,approved,rejected}/
│   ├── skills/<skill-id>/SKILL.md
│   └── conflicts/{open,resolved}/
├── jobs/{pending,running,succeeded,failed}/
├── audits/{extraction,review,publish}/
└── .index/{keywords,tags,sqlite}/
```

- `sources/` 保存原始会话引用或受控副本。
- `episodes/` 保存会话级中间证据。
- `facts/decisions/constraints/patterns/` 保存已审核 Memory。
- `candidates/` 永远与正式目录分开。
- `.index/` 是可删除、可重建的派生索引，不是事实源。

## 6. Frontmatter 契约

Memory、Episode、Candidate 和 Skill 都需要可追踪的元数据。最小 Memory 示例：

```yaml
---
id: "MEM-20260906-0001"
title: "项目集成测试必须使用统一入口"
kind: "memory"
status: "candidate"
review_state: "pending"
memory_type: "constraint"
scope:
  project_id: "project-example"
  repository: "repository-example"
  branch: "main"
  user_id: null
  agent_id: null
created_at: "2026-09-06T00:00:00Z"
updated_at: "2026-09-06T00:00:00Z"
valid_from: "2026-09-06T00:00:00Z"
valid_until: null
confidence: 0.82
importance: "medium"
source_refs:
  - "SRC-SESSION-001"
source_ranges:
  - session_id: "session-001"
    event_start: 12
    event_end: 28
    quote_hash: "sha256:..."
extraction:
  job_id: "JOB-20260906-0001"
  model: "configured-model"
  prompt_id: "memory-extract-v1"
  prompt_version: "1.0"
  input_hash: "sha256:..."
  output_hash: "sha256:..."
relations:
  supersedes: []
  superseded_by: []
  conflicts_with: []
  supports: []
---
```

建议的 `status`：`candidate`、`approved`、`published`、`deprecated`、`rejected`、`blocked`。禁止从 `candidate` 直接进入 `published`。正式 Skill 还需要版本、owner、来源 Memory 和验证任务。

## 7. 抽取流水线

### 阶段 0：输入检查

确认会话已有稳定 ID、项目范围、哈希、授权记录、敏感信息扫描结果和重复上传判断。缺字段时创建 `blocked` Job，不进入模型抽取。

### 阶段 1：标准化事件

将不同 Agent 的消息、工具调用、文件读取/修改、命令、测试和评审反馈统一为事件，保留 `event_id`、`session_id`、顺序、父事件、时间、原始偏移和内容哈希。标准化文件可重建，不是长期事实源。

### 阶段 2：Episode 抽取

第一轮 Agent 只回答“发生了什么”：任务目标、方案、成功/失败路径、涉及文件、测试结果和未解决问题。每个结论必须关联事件范围；如果会话没有值得保存的内容，返回空候选及原因。

### 阶段 3：Memory Candidate 抽取

第二轮 Agent 从 Episode 和证据片段中提出候选：

- `fact`、`definition`、`decision`、`constraint`、`preference`；
- `event`、`pattern`、`failure_mode`、`verification`、`question`。

每条候选必须有结论、适用范围、来源事件、置信度、证据强度、有效期建议，以及与现有 Memory 的关系：`new`、`merge`、`update`、`supersede`、`conflict`、`event_only` 或 `reject`。

### 阶段 4：Skill Candidate 分析

只有存在清晰触发条件、可复用步骤、成功标准、适用边界和至少一个可信来源时，才生成 Skill Candidate。优先要求第二个支持证据或人工确认。Agent 可以建议 `create/update/patch/deprecate/none`，但不能直接发布。

### 阶段 5：机械校验

在人工审核前检查：frontmatter 完整性、ID 唯一性、来源存在、事件范围有效、时间字段合理、关系无循环、路径安全、敏感信息、重复正文和悬空引用。

### 阶段 6：审核与发布

审核者检查证据、范围、重复/冲突、敏感信息、有效期和验证结果。批准后生成 Git diff，记录审核人、候选 ID、前后哈希、验证任务、提交和发布版本。正式 Skill 必须再执行回归验证。

## 8. 无向量化检索

MVP 采用三级检索：

1. **范围过滤**：按 `project_id`、仓库、分支、用户/Agent、类型、状态和有效期过滤目录。
2. **索引检索**：项目 `index.md` 保存 ID、标题、类型、标签、状态、更新时间和来源数量。
3. **关键词/全文检索**：先使用文件扫描和标签/别名；文件数量增加后再用 SQLite FTS5。

SQLite 只能是可重建索引，不能作为事实源。查询结果必须回读 Markdown，检查状态、有效期、来源和权限。响应采用“索引 → 时间线 → 详情”的渐进方式，不把全部 Memory 注入每次 Agent 会话。

无向量方案的主要限制是同义表达、跨语言和代码标识符召回较弱。使用 `aliases`、标准标签、错误码、文件路径和项目术语表缓解；未来可在不改变 Markdown 契约的前提下增加 Embedding 派生索引。

## 9. 去重、冲突与生命周期

### 9.1 去重

先用 `scope + memory_type + normalized_statement + validity bucket` 生成精确指纹，再比较标题、标签、关键实体、文件路径和决策对象。无法确定的语义重复交给 Agent 分析，但高风险合并必须人工确认。

### 9.2 冲突与替代

- 完全重复：合并来源和支持证据。
- 新证据支持旧事实：追加支持记录。
- 新事实替代旧事实：新建版本，旧文件写入 `superseded_by` 并标记 `deprecated`。
- 不同时间有效：通过 `valid_from/valid_until` 并存。
- 不同项目或作用域：分别保存。
- 无法判断：建立 Conflict，暂停自动发布。

已发布 Memory 不直接覆盖正文；使用新文件、关系字段和 Git diff 保留历史。

### 9.3 默认生命周期

业务术语和技术决策长期有效但需变更确认；临时事件 30–90 天后复查；验证结果绑定提交、版本和测试环境；个人偏好绑定用户，不自动进入项目共享 Memory；过期内容默认标记 `deprecated` 而不是删除。

## 10. 失败恢复与幂等

每次抽取创建 Job，记录 `job_id`、输入哈希、Prompt/模型版本、尝试次数、状态、错误、输出路径和输出哈希。幂等键建议为：

```text
hash(session_id + source_hash + extraction_profile + prompt_version)
```

Episode 成功而 Memory 失败时保留 Episode 并单独重试；Memory 成功而 Skill 失败时只重试 Skill；Markdown 使用临时文件和原子重命名；索引失败不回滚事实文件，直接标记待重建；LLM 输出格式错误时失败，不从自然语言猜字段。

## 11. 安全和权限

- 原始来源目录权限最高，Candidate 目录允许抽取服务写入，Published 目录只由审核/发布流程写入。
- Agent 只能读取已发布 Memory，并写入 Candidate；不能直接提交生产 Skill。
- 抽取前后扫描 API Key、Token、密码、SSH 私钥、数据库连接串、个人信息和内部配置。
- 本地 Markdown 不等于模型不出站；远程 LLM、Embedding 和代码抓取端点必须白名单化并记录。
- 需要阻止危险操作时使用权限/hook/策略层，不能只依赖 Memory 文本。

## 12. MVP 实施顺序

1. 建立目录、frontmatter 和来源 ID 规范，手工准备 5–10 个已授权会话样本。
2. 实现 Episode 结构化抽取和失败 Job。
3. 实现 Memory Candidate 抽取、去重、冲突和人工审核。
4. 实现 Skill Candidate，要求触发条件、步骤、边界和验证任务。
5. 生成项目索引，先用文件扫描，必要时增加 SQLite FTS5。
6. 用 Git diff、审核记录和回滚验证发布流程。
7. 稳定运行后再做周期性 Reflect，从多次 Episode 归纳 Pattern Candidate。


## 14. 验收标准

- 每条 Published Memory 都能回溯到 Session、事件范围和抽取 Job。
- 原始会话、Episode、Candidate、Published Memory 和 Skill 分开存储。
- 相同输入重复处理不产生重复正式 Memory。
- 新事实不会静默覆盖旧事实，冲突会产生记录。
- Agent 不能绕过审核直接发布 Skill。
- 可以按项目、类型、标签和关键词检索，并查看来源详情。
- 删除索引后可以从 Markdown 重建。
- 抽取失败、索引失败和模型超时都有可恢复状态。
- 远程模型和敏感信息边界显式记录。

## 15. 最终方案判断

在当前用户数量少、会话收集已经存在的前提下，最合理的第一版不是复制某个完整 Memory 平台，而是组合各项目的强项：

- 用 Mem0 的抽取/更新思想定义候选操作；
- 用 Graphiti 的 Episode、有效期和冲突关系维护来源；
- 用 EverOS、MemU、Letta 的 Markdown/Git 可读资产和候选边界；
- 用 claude-mem 的事件摘要和渐进检索；
- 用 TencentDB-Agent-Memory 的 L0-L3、资产分离和装配概念；
- 用 Memobase/Hindsight 的稳定事实、事件和 Reflect 分层。

因此 MVP 采用：

```text
原始会话（已有）
  → Episode Markdown
  → Memory Candidate Markdown
  → 人工审核
  → Published Memory Markdown
  → Skill Candidate Markdown
  → Git + 回归验证
  → Published Skill
```

最重要的不是先解决向量召回，而是确保来源、作用域、状态、冲突和审核都能被看见、重建和回滚。
