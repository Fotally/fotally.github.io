---
title: "EverOS：以 Markdown、Episode 和 Skill 演化的本地 Memory"
kind: open-source-research-report
status: completed
topic: AI Memory
project: EverOS
role: primary
brief_version: "1.0"
---

# EverOS：以 Markdown、Episode 和 Skill 演化的本地 Memory

> **项目快照**：官方仓库 <https://github.com/EverMind-AI/EverOS>｜核验日期 2026-09-04｜Stars 12,676｜许可证 Apache-2.0｜最近维护：`main` 分支最近提交为 2026-09-01。[^everos-repository][^everos-license][^everos-commits]

> **需求画像**：目标是在多个开发 Agent 之间沉淀项目业务知识、技术决策和开发经历，并把可复用经验逐步演化为 Agent Skill。硬约束是优先单机/本地部署、模型 API 可切换、能够接入不同 Agent；原始会话是否上传、完整原文归档和 Skill 最终发布仍由外部治理流程控制。

## 1. 项目要解决什么问题

### 目标用户与使用场景

EverOS 是 Python 库和 local-first memory runtime，面向需要跨应用、设备、编码助手和工作流共享长期记忆的 Agent 与开发者。项目把对话、文件和 Agent 轨迹转换为可读 Markdown，并用 SQLite、LanceDB 派生索引支持检索。[^everos-readme]

对本项目，最接近的场景是把经授权的 Claude Code、Codex、Cursor 或其他 Agent 会话发送到 `/api/v2/memory/add`，在会话结束时调用 `/flush` 生成 Episode；之后由 Offline Memory Engine（OME）异步提取 AtomicFact、Foresight、Profile、Agent Case，并聚类形成 `SKILL.md`。项目组可以直接阅读、编辑和 Git 版本化这些 Markdown 文件。

### 当前问题

传统记忆系统常把事实放在托管数据库、向量库或仪表盘中，开发者难以直接查看、修改和审查。EverOS 将 Markdown 作为唯一事实源，SQLite 和 LanceDB 都可以从 Markdown 重建，方便 Git diff、备份和迁移。[^everos-overview][^everos-how-memory]

一个会话同时包含用户背景、一次任务经历和 Agent 的可复用操作。EverOS 用 user-track 与 agent-track 分开保存：Episode、AtomicFact、Foresight、Profile 属于用户轨道，Agent Case 和 Agent Skill 属于 Agent 轨道。[^everos-how-memory]

记忆抽取与检索不应阻塞原始内容落盘。`/add` 先将消息放入 SQLite buffer，`/flush` 在边界确定后同步写入 Episode Markdown；级联索引和 OME 在后台继续运行，使原文先得到持久化，再逐步获得可搜索和可复用的派生知识。[^everos-pipeline]

### 问题边界

EverOS v1 明确面向个人 Agent 或小团队本地部署，明确不包含 10K+ 用户的多租户/社区部署、端到云同步和分布式分片。[^everos-overview]

它提供的是本地记忆运行时和 HTTP/CLI 接口，不是完整的组织级会话管理平台。官方 API 明确说明没有内置认证，默认只绑定 `127.0.0.1`；对外暴露、成员权限、上传审批和审计需要另加网关或治理层。[^everos-api]

## 2. 设计的核心思路

### 核心判断

EverOS 的核心主张是“Markdown 是用户拥有的记忆事实源，索引和演化状态都可重建”。它把一次会话先固化为 Episode，再让 OME 根据策略生成事实、前瞻、画像、案例和 Skill；Agent 使用 LanceDB 的混合检索读取这些产物。[^everos-how-memory][^everos-architecture]

### Memory 实现方式

会话通过 Memory API 先写成带 frontmatter 的每日 Episode Markdown；Cascade/OME 随后从 Episode 异步派生 AtomicFact、Foresight、Profile、Agent Case 和 `SKILL.md`。Markdown 是可读事实源，SQLite/LanceDB 只保存可重建的元数据与检索索引，Agent 查询时通过关键词、向量和标量过滤召回对应记忆。[^everos-storage][^everos-ome]

### 关键设计选择

- **Markdown-first**：每条业务记忆都有 YAML frontmatter 和明确路径，Episode 采用按日追加，Profile 采用单文件改写，Skill 采用目录加 `SKILL.md`（可带 `references/` 与 `scripts/`）。[^everos-storage]
- **三件套存储**：Markdown 保存内容，SQLite 保存 buffer、审计、级联队列和 OME 状态，LanceDB 保存向量、BM25 和标量列。后两者均可从 Markdown 重建，降低迁移和备份风险。[^everos-how-memory]
- **同步入口、异步演化**：`/add`/`/flush` 保证 Episode 已落盘后返回，Cascade 负责增量索引，OME 通过事件和定时策略生成派生记忆。这样开发会话原文和后续经验提取拥有不同的一致性时点。[^everos-pipeline][^everos-api]
- **双轨与正交作用域**：按 `app_id`、`project_id`、`user_id`、`agent_id`、`session_id` 组合隔离检索，用户知识和 Agent Skill 分开演化。[^everos-readme][^everos-api]
- **离线 Reflection**：可选的 `reflect_episodes` 按周期合并相关 Episode，重新抽取事实，并用 `deprecated_by` 标记旧条目；不是每次查询都重新总结。[^everos-ome]

### 向量化与模型接口核验

EverOS 的基础关键词检索可以不启用 Embedding；向量检索、混合检索以及部分 Reflection/Skill extraction 路径才需要单独的 `[embedding]` provider。当前官方默认配置为 OpenAI-compatible 端点 `https://api.deepinfra.com/v1/openai`、模型 `Qwen/Qwen3-Embedding-4B`，并没有在配置中声明固定向量维度；服务返回的维度必须在 LanceDB 的索引空间中保持一致。[^everos-default-config][^everos-quickstart]

Embedding 配置只有 `model`、`api_key`、`base_url` 以及超时、批量和并发参数，接口形态是 OpenAI-compatible。官方没有确认 EverOS 内置的模型目录、向量维度自动探测或独立的 Embedding provider 枚举；因此可接公司兼容 API 或 DeepSeek 兼容网关的前提是它们提供 `/v1/embeddings`，具体模型名、维度和中文效果需要实测。[^everos-config][^everos-default-config]

向量落在本地 LanceDB，并与 BM25、标量过滤联合检索；改变 Embedding 模型或输出维度应重建 `.index/lancedb`，不能把不同向量空间混在同一索引中。官方没有给出默认模型对中文业务知识的质量结论，中文试点应优先使用已验证的多语言模型，并保留关键词检索作为对照。[^everos-how-memory][^everos-storage]

### 代价与取舍

Markdown 易于审查和 Git 管理，但多进程共享写入、访问权限和大规模并发需要额外设计；LanceDB 是派生索引，因而搜索存在最终一致性窗口。内置 OME 的异步任务和 APScheduler 适合单机持续演化，但不是分布式任务平台。调研判断：EverOS 与“会话 → 经验 → Skill”目标的贴合度很高，却更像单机运行时和文件协议，团队共享必须补齐认证、上传审批和协作治理。

## 3. 项目如何工作

### 工作流概览

```mermaid
flowchart LR
  A[输入：消息、文件或 Agent 轨迹] --> B[/add：按 session/app/project 写入 SQLite buffer]
  B --> C[/flush 或边界检测：LLM 抽取 MemCell]
  C --> D[同步写入 Episode Markdown 与 frontmatter]
  D --> E[Cascade watcher：SQLite 队列驱动 LanceDB 增量索引]
  D --> F[OME：异步提取事实、Profile、Case 与 Skill]
  F --> G[Reflection：可选合并 Episode 并淘汰旧条目]
  E --> H[输出：关键词/向量/标量过滤检索]
  G --> I[输出：可复用 Agent Skill 与业务知识]
  H --> J[Agent 上下文或外部 Skill 候选评审]
  I --> J
```

### 阶段说明

| 阶段 | 接收什么 | 做什么 | 产生的状态或产物 | 证据 |
| --- | --- | --- | --- | --- |
| 会话缓冲 | `messages`、`session_id`、`app_id`、`project_id` | `/add` 按会话和作用域累积消息，等待边界或显式 flush | SQLite `unprocessed_buffer` | [^everos-pipeline][^everos-api] |
| 边界与抽取 | 缓冲消息或 `/flush` 请求 | 边界检测触发一次 LLM，提取结构化 MemCell | SQLite MemCell 及抽取结果 | [^everos-pipeline] |
| Episode 持久化 | MemCell 与会话元数据 | UserMemoryPipeline 原子写入带 frontmatter 的每日 Episode Markdown | `users/<user>/episodes/episode-<date>.md` | [^everos-storage][^everos-architecture] |
| 级联建索引 | Markdown 新建/修改事件 | watchdog 监测文件，将变更写入 `md_change_state`，只重嵌入变化条目 | LanceDB 向量、BM25 和标量行 | [^everos-cascade] |
| OME 演化 | Episode 与 MemCell 事件 | 异步运行 AtomicFact、Foresight、Profile、Agent Case/Skill 等策略 | 派生 Markdown：事实、画像、案例、Skill | [^everos-ome] |
| Reflection | 同一主题的多个 Episode | LLM 合并叙事，重新抽取事实并标记旧 Episode 已被替代 | 合并 Episode、`deprecated_by` 关系 | [^everos-ome] |
| 查询消费 | 查询、作用域和检索方法 | LanceDB 执行关键词、向量和标量过滤，必要时读取原始 Markdown | 记忆条目、Episode 或 Skill 内容 | [^everos-api][^everos-architecture] |
| Skill 治理 | Agent Skill、来源 Episode 和项目规则 | 外部流程审阅候选 Skill，生成 Git diff 并验证后发布 | 可追溯的 Skill PR | 调研判断 |

### 关键状态与产物

- **Episode**：一次边界内的会话叙事，按用户和日期追加到 Markdown；`/flush` 返回 `extracted` 时，Episode 已经在磁盘上。它是最接近原始开发会话的结构化记忆，但并不自动等同于原始会话文件。[^everos-pipeline][^everos-how-memory]
- **AtomicFact / Foresight / Profile**：OME 从 Episode 派生出的原子事实、对未来行为的前瞻和用户画像，均有各自 Markdown 存储策略。[^everos-how-memory]
- **Agent Case**：Agent 轨道上的可复用轨迹；薄的、不具实质内容的轨迹会按官方策略跳过。[^everos-ome]
- **Agent Skill**：相关案例聚类后生成的 `skills/skill_<name>/SKILL.md`，可扩展 `references/` 和 `scripts/`，与本项目现有 Skill 目录形态接近。[^everos-storage][^everos-ome]
- **索引与一致性状态**：SQLite `system.db` 保存变更队列、审计和 LSN，`ome.db` 保存 OME 状态，LanceDB 保存可重建索引；Markdown 直接编辑会被 watcher 重新索引。[^everos-storage][^everos-cascade]

### 最终输出

查询接口返回按项目、用户、Agent、应用和会话过滤的 Episode、事实、案例或 Skill。开发 Agent 可以在任务开始读取项目知识和既有 Skill，在任务结束提交会话并触发 OME；团队则从 Agent Case/Skill 和来源 Episode 中挑选 Skill 更新候选，提交人工评审。

### 官方源码实现核验（2026-09-06）

以下结论不是只依据 README 或架构文档，而是对官方 `main` 分支源码路径的静态核验；本次未安装依赖、未启动服务、未实际调用模型。需要特别区分：`/add`/`/flush` 的请求链负责把 Episode 写入 Markdown，而 OME 的派生抽取通常只是被事件入队，是否已经完成要看 OME run record 或后续索引状态。

#### 1. Buffer、边界检测与 `/flush`

- **规范化不等于缓冲**：`src/everos/memory/extract/ingest/service.py` 的 `process()` 只把外部消息转换成 `CanonicalMessage`，生成稳定 `message_id`、解析时间、工具调用和多模态文本；它不写 `unprocessed_buffer`。
- **`/add` 的分支在 `src/everos/entrypoints/api/routes/memorize.py`**：普通 `/add` 调用 `memorize(payload, defer_extraction=False)`；设置 `defer_extraction=true` 才只进入缓冲；`/flush` 用空 `messages` 调用 `memorize(..., is_final=True)`，再把 service 的 `extracted` 映射为 `extracted`，否则返回 `no_extraction`。
- **真正的读—合并—边界—回写在 `src/everos/service/memorize.py` 与 `src/everos/service/_boundary.py`**：`memorize()` 以 `session_id` 获取 asyncio lock，锁覆盖整个 read/merge/detect/tail-write 周期；`buffer_messages()` 从 SQLite `unprocessed_buffer` 按 `(app_id, project_id, session_id, track="memorize")` 读取，按 `message_id` 去重并按 `(timestamp, message_id)` 排序，再调用 `replace()`。`src/everos/infra/persistence/sqlite/repos/unprocessed_buffer.py` 的 `replace()` 在一个事务中执行 scoped delete-then-insert，空列表表示清空该会话缓冲。
- **`prepare_cells()` 的行为**：非 final 请求没有 user 消息时只保留缓冲；没有 LLM 时返回 `skipped`；普通聊天模式调用 `everalgo.boundary.detect_boundaries`，agent 模式调用 `AgentBoundaryDetector`。无 cell 时把合并片段原样放回 buffer；有 cell 时为每个 cell 写一行 SQLite `memcell` ledger，建立 cell→message ID 映射，将算法返回的 tail 重新写回 buffer，并把同一个 `memcell_id` 交给 user/agent 两条下游管线。`is_final=True` 依赖算法的 final contract 返回空 tail，源码没有额外的本地 assert。
- **结论**：显式 `defer_extraction` 是“只缓冲”，普通 `/add` 仍可能立即做边界检测和抽取；`/flush` 是强制 final 边界，不是一个单独的 Markdown writer。`unprocessed_buffer` 是会话 staging 数据，不能被 Cascade 从 Markdown 重建。

#### 2. Episode、AtomicFact、Foresight、Profile 与 Agent Skill 的实际抽取链

| 产物 | 事件/策略链 | 官方源码中的关键逻辑 |
| --- | --- | --- |
| **Episode** | `UserMemoryPipeline` → `EpisodeExtracted` | `src/everos/memory/extract/pipeline/user_memory.py` 对每个 cell 先发 `UserPipelineStarted`，再用 `EpisodeExtractor.aextract(cell, sender_id=None)` 做一次整 cell 抽取；`ValueError` 最多重试两次并作递增退避，最终一次失败会抛出。提取结果通过 `Episode.from_algo()` 按 cell 内不同 user sender fan-out，每个 owner 写一份 Episode Markdown，并在写成功后发 `EpisodeExtracted`。 |
| **AtomicFact** | `EpisodeExtracted` → `extract_atomic_facts` | `src/everos/memory/strategies/extract_atomic_facts.py` 使用 `AtomicFactExtractor.aextract_from_text(event.episode_text, timestamp=...)`；结果为空则结束，否则把 `parent_id` 设为 Episode entry ID，并通过一次 `AtomicFactWriter.append_entries()` 批量追加。 |
| **Foresight** | `UserPipelineStarted` → `extract_foresight` | `src/everos/memory/strategies/extract_foresight.py` 只扫描 `ChatMessage(role="user")`，按 sender 调用 `ForesightExtractor.aextract()`，按 owner 批量写入。策略装饰器明确设置 `enabled=False`；源码注释还说明当前没有搜索路由或 prompt 消费 Foresight，因此默认不花这部分 LLM 成本。 |
| **Profile** | embedding 可用：`EpisodeExtracted` → profile clustering → `ProfileClusterUpdated` → `extract_user_profile`；无 embedding：`EpisodeExtracted(source="pipeline")` 直达 | `src/everos/memory/strategies/trigger_profile_clustering.py` 对 Episode 文本做 embedding、按几何/时间窗口合并 user cluster，再发 `ProfileClusterUpdated`。`src/everos/memory/strategies/extract_user_profile.py` 用 `applies_to` 保证两条路不重复：cluster 路径从 cluster 成员反查 memcell，Tier-1 direct 路径总是纳入当前 event 的 `memcell_id`，并用 LanceDB timestamp 查询补充历史 memcell；随后读取旧 profile、调用 `ProfileExtractor.aextract()`，最后由 `ProfileWriter.write()` 整体覆盖 `users/<user_id>/user.md`。Reflection 产生的 `EpisodeExtracted(source="reflection")` 不走 direct profile 路径。 |
| **Agent Case** | agent mode：`AgentMemoryPipeline` → `AgentPipelineStarted` → `extract_agent_case` | `src/everos/memory/extract/pipeline/agent_memory.py` 本身不写 Markdown，只为每个 cell 发事件。`src/everos/memory/strategies/extract_agent_case.py` 收集 assistant-side sender，调用一次 `AgentCaseExtractor.aextract()`；算法返回空列表时跳过，否则把同一 case fan-out 到每个 agent owner，写 Agent Case Markdown，再发 `AgentCaseExtracted`。 |
| **Agent Skill** | `AgentCaseExtracted` → skill clustering → `SkillClusterUpdated` → `extract_agent_skill` | `src/everos/memory/strategies/trigger_skill_clustering.py` 先检查 embedding，`quality_score < 0.2` 直接跳过，否则 embedding `task_intent`、调用 `cluster_by_llm`、持久化 cluster 并发事件。`src/everos/memory/strategies/extract_agent_skill.py` 从 event payload 重建目标 case，避免等待 Cascade；已有 skill 以 Markdown `AgentSkillReader.list_by_cluster()` 为存在性真相，只有超出 top-K 时才用 LanceDB 做相关性排序，再读取 supporting cases，调用 `AgentSkillExtractor.aextract()`，整文件写回 `SKILL.md`，并清理 rename 后遗留的旧 skill 目录。源码明确写明 retire op 当前不被实现为删除或 retired 标记，不能宣称已具备 Skill 退休能力。 |

`src/everos/memory/events.py` 是上述链路的契约：`EpisodeExtracted` 携带 episode 文本，`AgentCaseExtracted` 携带完整 case 字段，`SkillClusterUpdated` 携带 case vector；这些 event payload 让下游在 Cascade 尚未完成时仍可执行关键抽取，避免把“刚写入 Markdown 但尚未建 LanceDB 索引”误判为不存在。

#### 3. Markdown 写入、覆盖与事实源边界

- **Daily log append**：`src/everos/infra/persistence/markdown/writers/base.py` 的 `BaseDailyWriter.append_entries()` 按 schema 解析路径，在单个 per-path lock 内读取 `entry_count`、分配 `ep_<YYYYMMDD>_<NNNN>` 等 entry ID、渲染 `<!-- entry:... -->` 标记，并一次性更新 frontmatter 后写回。`src/everos/infra/persistence/markdown/writers/episode_writer.py` 将 Episode 绑定为 `users/<scope>/episodes/episode-<YYYY-MM-DD>.md`，并维护 `entry_count`/`last_appended_at`。
- **Profile 是整文件 upsert**：`src/everos/infra/persistence/markdown/writers/profile_writer.py` 不做 read-modify-write 或字段合并，调用方提供的完整 frontmatter 和 body 会整体替换 `user.md`。因此 Profile 的并发保护在策略层的 owner partition lock，而不是 writer 的追加 entry 语义。
- **Skill 是命名目录整文件 upsert**：`src/everos/infra/persistence/markdown/writers/agent_skill_writer.py` 写入 `agents/<agent>/skills/skill_<name>/SKILL.md`，`references/*.md` 与 `scripts/*` 单独替换；`scripts` 不进入 Cascade 检索内容。`write_main()` 会覆盖人工编辑的原有主文件，Skill 重命名由策略显式删除旧目录。
- **原子性与路径安全**：`src/everos/core/persistence/markdown/writer.py` 将目标限制在 MemoryRoot 内，在同目录临时文件上执行写入、flush、fsync，再用 `os.replace` 原子替换；追加操作使用 per-path asyncio lock。其 `patch_frontmatter()` 对 dict 字段做增量合并、标量整体替换，这正是 Reflection 更新 `deprecated_entries` 的入口。

#### 4. Cascade 与索引：Markdown → LanceDB，不负责反向生成 Markdown

- `src/everos/memory/cascade/registry.py` 将 `episode`、`atomic_fact`、`foresight`、`agent_case`、`agent_skill`、`user_profile` 等 kind 绑定到 frontmatter schema、LanceDB schema/repository 和 handler；路径匹配由 registry 统一提供。
- `src/everos/memory/cascade/watcher.py` 用 watchdog 递归监控 MemoryRoot。回调只把新增/修改/删除/移动转换为相对路径并写入 `md_change_state`，不在文件事件线程中解析 Markdown；`src/everos/memory/cascade/scanner.py` 以 `KIND_REGISTRY` 定期全树扫描，补上 daemon 停机期间或编辑器 move-replace 漏掉的事件。
- `src/everos/memory/cascade/worker.py` 原子 claim pending rows，按 kind 并发调用 handler；成功标记 done，外部服务错误做有上限的 retry，其他异常进入失败处理。`src/everos/memory/cascade/orchestrator.py` 的 `sync_once()` 是 CLI/补偿路径的 scan + drain；启动时还会把上次崩溃遗留的 processing rows 恢复为 pending。
- Handler 把 Markdown 结构化内容投影到 LanceDB：`episode.py` 将 Subject/Content 参与 embedding/BM25，`atomic_fact.py` 索引 Fact，`foresight.py` 索引 Foresight 并把 Evidence 作为辅助 BM25，`user_profile.py` 将异构列表 JSON 化，`agent_skill.py` 拼接 `SKILL.md` body 与按文件名排序的 references、排除 scripts。embedding 不可用时各 handler 写入 `vector=None`，仍保留 BM25/标量路径；优化是延迟维护，未索引 tail 仍可被扫描，不应把“未优化”误写成“不可见”。

#### 5. OME 的入队、门控与失败语义

- `src/everos/service/memorize.py` 首次构造 `OfflineEngine` 时注册两组策略：LLM-only 的 AtomicFact/Foresight/AgentCase/Profile，以及需要 embedding 的 clustering/AgentSkill/Reflection。需要 embedding 的策略仍注册，但在策略 body 内自行 no-op；配置能力升级需要重启，body guard 不是热加载机制。
- `src/everos/infra/ome/engine.py` 的 `emit()` 调用 `_dispatch_event()`：先由 `EventDispatcher.dispatch()` 经过 `enabled`、`applies_to`、可选 Counter gate，再调用 `_enqueue_run()`。它不会等待策略函数执行完成；真正运行由 APScheduler/runner 驱动。
- `src/everos/infra/ome/_dispatch/dispatcher.py` 明确规定三道 gate；`src/everos/infra/ome/_dispatch/runner.py` 为每次尝试写 RunRecord，执行 `RUNNING → SUCCESS/FAILED/DEAD_LETTER`，失败按快照的 `max_retries` 重试。`engine.wait_for_event()` 会轮询同一 event 的所有 run 到 terminal 状态，Reflection 用它等待合并 Episode 的下游抽取完成。
- 因此 `/flush` 返回 `extracted` 的强保证是边界 cell 和 Episode Markdown 已由 memorize 主流程处理；AtomicFact、Profile、AgentCase、Skill clustering 等 OME 派生结果是否完成，不能仅凭 HTTP 返回值推断。

#### 6. OME Reflection 与 `deprecated_by` 的源码核验

- `src/everos/memory/strategies/reflect_episodes.py` 将 Reflection 注册为 Cron `0 2 * * 1` 且 `enabled=False`，先检查 embedding，再为每个 distinct owner scope 构造 `ReflectionOrchestrator`。未配置 embedding 时不会进入 orchestrator。
- `src/everos/memory/reflection/orchestrator.py` 按 cluster 选择候选：未反射 cluster 至少 2 个成员，已反射 cluster 仍有新增成员时也可再次处理，每轮最多 10 个。没有 `parent_type="cluster"` 的成员走 INIT；存在历史合并 Episode 时走 UPDATE，把旧 merged episode 与新 Episode 分开传给 `EpisodeReflector.areflect()`。
- 合并结果先追加为一个新的 Episode Markdown entry，inline 中写 `parent_type="cluster"`、`parent_id=<cluster_id>`；随后发 `EpisodeExtracted(source="reflection")` 并等待该 event 的 OME downstream runs，超时为 120 秒。等待的是策略 run terminal，不是 Cascade 索引完成。
- deprecation 在 cluster partition lock 内重新读取当前成员并与原始快照求交集，然后执行三类更新：
  1. 按原 Episode 的 `md_path` 分组，对每个 Markdown 文件调用 `EpisodeWriter.patch_frontmatter()`，增量写入 `deprecated_entries: {旧 entry_id: 合并 entry_id}`；
  2. 对旧 Episode 的 LanceDB 行更新 `deprecated_by=<merged_entry_id>`；
  3. 对 `parent_id` 属于旧 Episode 的 AtomicFact 行，在 `deprecated_by IS NULL` 时更新同一 replacement ID。
- 最后从 SQLite cluster 移除旧成员、加入合并 Episode、重新 embedding centroid、将 count 设为 1，并写入 ReflectionReport。也就是说，**Markdown 中记录的是 `deprecated_entries` 映射，LanceDB 行上才是 `deprecated_by` 字段**；两者共同实现“旧记录可追溯但默认不再作为 live 结果”的语义。

#### 未确认能力（本次源码范围内没有证据）

- **未确认**：官方仓库是否提供 Claude Code、Codex、Cursor 等本地会话格式的原生发现、预览、授权上传、脱敏和原文归档适配器；源码的 `/add` 只接受调用方已经归一化的消息 DTO。
- **未确认**：除调用方普通 `/add` 和显式 `/flush` 之外，是否存在另一个未在本次 `main` 源码路径中发现的 idle/threshold 自动 flush 入口；当前可见 service 代码没有把 OME Cron/Idle 调度接到 buffer flush。
- **未确认**：官方是否提供 Skill 候选人工评审、Git PR、回归验证和生产发布门禁；源码能写/覆盖 `SKILL.md`，但没有组织治理流程。
- **未确认**：Foresight 是否有仓库外的消费方；当前源码注释明确指出没有搜索路由或 prompt slot 消费它，且策略默认关闭。
- **已确认的限制而非未知**：Skill retire/delete 不是现成的生命周期能力；`extract_agent_skill.py` 明确不执行算法的 retire 分支，只有 rename reconciliation 会删除旧目录。团队不应把低 confidence Skill 自动删除当作官方保证。

## 4. 与需求画像逐项对照

### 需求矩阵

| 需求项 | 优先级或硬约束 | 项目现有能力 | 证据 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 项目业务知识长期保存 | 必须 | Markdown knowledge、Episode、AtomicFact、Profile | [^everos-overview][^everos-how-memory] | 满足 | 可按 `app_id/project_id` 分区；知识目录治理需另定 |
| 技术决策和开发经验可检索 | 必须 | Episode、Agent Case、Skill、关键词/向量/标量混合检索 | [^everos-how-memory][^everos-api] | 满足 | 需在会话元数据中保留决策/Skill 标签与来源 ID |
| 接收完整开发会话 | 必须 | `/add` 接收消息数组和 Agent 轨迹，Episode 作为结构化 Markdown | [^everos-api][^everos-pipeline] | 部分满足 | 能接收调用方提供的内容，但原始 Claude Code 文件的发现、上传审批和原文归档不属于核心接口 |
| 多 Agent 接入 | 必须 | HTTP API、CLI、MCP/集成生态；README 列出 DeepSeek Harness、Hermes、OpenClaw、Dify 等 | [^everos-readme][^everos-integrations] | 部分满足 | 未列出的 Claude Code/Codex/Cursor 需自定义适配器或 MCP 接入；统一事件字段需自行约定 |
| 模型 API 可切换 | 必须 | TOML/环境变量配置 LLM、Embedding、Rerank 的 model、api_key、base_url | [^everos-config] | 满足 | 公司 OpenAI-compatible API 可配置；DeepSeek 需验证抽取/Embedding 的具体接口兼容性 |
| 单机自部署 | 必须 | Python 3.12+ 本地服务，Markdown + SQLite + LanceDB，无 MongoDB/Redis/独立向量库 | [^everos-quickstart][^everos-how-memory] | 满足 | 官方范围就是个人 Agent/小团队本地部署，未发现官方 Docker Compose 必需路径 |
| 用户主动控制原始会话上传 | 期望 | API 由调用方显式 `/add`/`/flush`，可不接入自动插件 | [^everos-api] | 部分满足 | 用户选择、预览、确认和撤回需要在本地采集器/网关实现 |
| Skill 候选可追溯、人工发布 | 必须 | Agent Case/Skill 有 Markdown 文件，frontmatter 可 Git 版本化，OME 可生成候选 | [^everos-storage][^everos-ome] | 部分满足 | 需把来源 Episode、提议理由、评审状态、Git PR 和回归结果纳入外部治理 |
| 隐私、权限和跨项目隔离 | 必须 | 本地 root、`app_id/project_id` 路径隔离，默认 loopback | [^everos-storage][^everos-api] | 部分满足 | 没有内置认证；暴露给团队前必须加网关、权限、TLS、备份与审计 |

### 对照归纳

EverOS 在“会话变成 Episode、经验变成 Case/Skill、Markdown 可审查和本地单机运行”方面与目标高度一致。它对多 Agent 的核心接口是可扩展的，但当前官方集成列表并不等于已验证支持所有目标 Agent。原始文件归档、组织权限和人工 Skill 发布必须在 EverOS 之上补齐。

## 5. 开源与能力边界

### 边界清单

| 能力 | 开源核心 | 商业版或 SaaS | 外部依赖 | 证据 |
| --- | --- | --- | --- | --- |
| EverOS Python 包、CLI、HTTP API | 有，Apache-2.0 | 未确认有必须的商业版 | Python 3.12+、可选模型 API | [^everos-license][^everos-readme] |
| Markdown/SQLite/LanceDB 本地存储 | 有 | 未确认有必须云服务 | 本地文件系统、LanceDB/SQLite Python 包 | [^everos-how-memory][^everos-storage] |
| Episode、OME、Agent Case/Skill 演化 | 有 | 未确认有必须的商业版 | LLM；Embedding/Ranker 按功能可选 | [^everos-ome][^everos-config] |
| 关键词检索 | 有 | 未确认 | LanceDB/BM25 | [^everos-quickstart][^everos-how-memory] |
| 向量、混合、Agentic Search 与 Reflection | 有，但需配置相应 provider | 未确认 | Embedding、Rerank 和 LLM provider | [^everos-readme][^everos-quickstart] |
| 用户/Agent/项目权限与认证 | 无内置 | 未确认 | 自建反向代理、SSO、权限服务 | [^everos-api] |
| 多租户、云同步、分布式部署 | v1 明确不在范围 | 未确认 | 未来版本或外部系统 | [^everos-overview] |

### 边界判断

EverOS README 中的“多 Agent 生态”表示已有集成或示例，并不能直接证明 Claude Code、Codex、Cursor 的原始本地会话格式都能无改造导入；需要在 POC 中编写和验证适配器。[^everos-integrations]

此外，“local-first”不等于“可直接作为团队服务暴露”：官方 API 明确没有内置认证且默认只绑定回环地址。若将 root 放到共享服务器，必须由团队自行增加身份认证、项目授权、TLS 和备份。

## 6. 用户如何接入和使用

### 接入前提

- 安装 Python 3.12+，通过 PyPI 安装 `everos` 或从源码使用 `uv sync`。[^everos-quickstart]
- 准备一个可调用的 LLM；最小官方路径使用 `[llm]` 配置，Embedding、Rerank、知识库和多模态能力为可选升级。[^everos-quickstart]
- 为每个应用和仓库规划 `app_id`、`project_id`，为成员、Agent、分支和会话建立稳定标识；将原始会话文件 ID放入消息元数据或外部索引。
- 若多人通过服务器访问，准备反向代理/认证层，因为 EverOS 不提供内置认证。[^everos-api]

### 最快验证路径

1. 执行 `everos init --root <path>` 生成 `everos.toml` 与 `ome.toml`，并在 `[llm]`、`[embedding]`、`[rerank]` 中配置可切换的模型 Base URL 和凭据。[^everos-quickstart][^everos-config]
2. 启动 `everos server start`，调用 `/health` 确认 LLM、Embedding、Rerank 和 Cascade 能力；只配置 LLM 时可先用关键词检索。[^everos-quickstart][^everos-api]
3. 编写 Claude Code/Codex/Cursor 等本地适配器：用户选定会话后将消息、工具调用、测试结果和项目元数据发送到 `/api/v2/memory/add`，结束时调用 `/api/v2/memory/flush`。[^everos-api]
4. 让 Cascade 把 Markdown 变化同步到 LanceDB；按需在 `ome.toml` 启用 Agent Case、Skill clustering 和 `reflect_episodes`，再通过 `/search` 检索。[^everos-ome][^everos-cascade]
5. 由外部 Skill 治理流程检查来源 Episode 与生成的 `SKILL.md`，人工确认后提交 Git，并用固定任务验证更新效果。

### 日常使用方式

开发会话前按 `project_id`/`agent_id` 召回业务知识和既有 Skill；会话中持续 `/add` 或在结束时批量提交；结束后 `/flush` 固化 Episode，OME 在后台生成案例和 Skill。用户也可以直接编辑 Markdown，Cascade 会把改动重新索引，Git 可记录知识和 Skill 的变化。[^everos-cascade][^everos-storage]

### 接入限制

官方最小配置只提供关键词检索；向量/混合检索、Reflection 和 Skill extraction 需要配置 Embedding（以及部分路径的 Rerank）provider。README 指出 DeepSeek Harness 有集成，但没有证据表明 DeepSeek API 对所有 EverOS 所需的抽取、Embedding 和重排能力都可直接复用，需分别验证。[^everos-quickstart][^everos-integrations]

API 搜索是最终一致的：Episode 落盘后，LanceDB 还要等待 Cascade；刚 flush 的内容可能暂时搜不到，应调用 `cascade sync` 或按官方建议重试。[^everos-api][^everos-cascade]

## 7. 部署构成

### 运行组件

| 组件 | 必需或可选 | 职责 | 持久化数据 | 与其他组件的关系 | 证据 |
| --- | --- | --- | --- | --- | --- |
| EverOS HTTP API/CLI | 必需 | 提供 `/add`、`/flush`、`/search`、健康检查和运维命令 | 通过 root 写 Markdown、SQLite、LanceDB | Agent 适配器调用；启动 Cascade 与 OME | [^everos-api][^everos-quickstart] |
| Markdown memory root | 必需 | 保存 Episode、事实、画像、Case、Skill 和 knowledge | 用户可读 `.md` 与 YAML frontmatter | 唯一事实源，被 Cascade/OME 读取 | [^everos-storage][^everos-how-memory] |
| SQLite index/state | 必需 | 会话 buffer、MemCell、审计、Cascade 队列、OME state/scheduler | `.index/sqlite/*.db` | API/OME/Cascade 共同使用 | [^everos-storage] |
| LanceDB | 必需的检索运行组件 | 向量 ANN、BM25 和标量过滤 | `.index/lancedb/*.lance`，可由 Markdown 重建 | Cascade 写入，Search 读取 | [^everos-how-memory][^everos-cascade] |
| LLM provider | 必需（抽取/OME） | 边界检测、MemCell、事实/案例/Profile/Skill 演化和 Reflection | 本地不保存 provider 状态 | API/OME 通过配置的 base URL 调用 | [^everos-config][^everos-ome] |
| Embedding provider | 可选（向量/混合检索） | 生成文档/查询向量 | 本地模型缓存或远端服务 | Cascade/Search 调用 | [^everos-quickstart][^everos-config] |
| Rerank provider | 可选（高级检索） | 对候选结果重排，支撑部分 Agentic Search/Wiki | 本地模型缓存或远端服务 | Search 调用 | [^everos-quickstart][^everos-config] |
| Watchdog/Cascade coroutine | 必需 | 监视 Markdown，增量同步索引 | SQLite `md_change_state` | API lifespan 内运行，不是独立 OS 服务 | [^everos-cascade] |
| APScheduler/OME | 可选策略但随服务运行 | 异步记忆演化与周期 Reflection | `ome.db`、`ome.aps.db` | 订阅 MemCell 事件、按 `ome.toml` 调度 | [^everos-ome][^everos-storage] |
| 反向代理/认证/备份 | 团队部署必需 | 对外访问控制、TLS、审计和恢复 | 代理配置、备份副本、访问日志 | 位于 Agent 与 EverOS API 之间 | [^everos-api] |

### 最小部署路径

最小路径是单台主机安装 Python 3.12+ 和 `everos`，将一个本地目录作为 memory root，配置一个 LLM，运行 `everos server start`；此时可以写入 Markdown、自动维护索引并使用关键词搜索。无需 MongoDB、Elasticsearch、Redis 或独立数据库服务器。[^everos-quickstart][^everos-how-memory]

若需团队共享，可把该进程放在内网服务器，持久化挂载 memory root，并增加反向代理和认证；配置 Embedding/Rerank 后再开启混合检索与 Skill/Reflection。官方仓库当前未确认存在必须的 Dockerfile 或 Docker Compose 部署路径，因此 Docker 化应视为团队自建封装而非官方前提。

### 生产化仍需考虑

- 设计 root 的项目隔离、成员权限、原始会话保留和删除流程；默认 loopback 绑定不能替代组织级认证。[^everos-api]
- 备份 Markdown 事实源、SQLite 运行状态和配置；LanceDB 可在索引损坏时从 Markdown 重建，但需验证 OME 状态和外部会话 ID仍可关联。[^everos-how-memory][^everos-storage]
- 配置 LLM/Embedding/Rerank 超时、重试、并发和模型成本；官方未给出本项目场景的 CPU、内存或吞吐最低要求，需按实际会话规模实测。
- 监控 Cascade 队列、LSN、OME 任务、索引延迟和失败重试；搜索的最终一致性必须在 Agent 适配器中考虑。[^everos-api][^everos-cascade]
- 如果把 Skill Markdown 纳入 Git，定义谁可以修改、如何关联来源 Episode、如何人工确认和如何回滚，避免 OME 自动产物直接覆盖生产 Skill。

## 8. 适配结论与能力缺口

### 适配结论

**条件匹配。** EverOS 对“会话 → Episode → Agent Case → Skill”的演化路径、Markdown 可审查、单机部署和可切换模型有直接设计；但多 Agent 适配、原始会话上传与归档、团队认证和人工 Skill 发布仍需外部补齐，且项目 v1 明确不面向分布式/大规模团队部署。

### 已满足能力

- Markdown 是源事实，Episode、业务知识和 Skill 都可读、可编辑、可 diff、可 Git 版本化。[^everos-storage][^everos-how-memory]
- `/add`、`/flush`、Cascade 和 OME 清晰拆开会话落盘、索引同步和离线演化，适合快速验证经验沉淀。[^everos-pipeline][^everos-ome]
- Agent Case 与 `skills/skill_<name>/SKILL.md` 直接对应“从开发经历提取可复用 Skill”的目标。[^everos-storage][^everos-ome]
- SQLite + LanceDB + Markdown 在一台服务器上运行，不需要外部数据库、消息队列或向量服务；可通过 `--root` 管理不同存储目录。[^everos-how-memory][^everos-quickstart]
- LLM、Embedding、Rerank 均有 `base_url`、模型和凭据配置，可用于公司 API/DeepSeek 兼容性验证。[^everos-config]

### 能力缺口

- **原始会话保真归档**：Episode 是结构化记忆而非保证原样保存的 Claude Code 会话文件；需外置原始文件仓库和来源 ID。
- **多 Agent 会话适配**：需为 Claude Code、Codex、Cursor 等读取本地会话格式，并把工具调用、补丁、测试和权限事件映射为 EverOS 消息/元数据。
- **团队安全治理**：没有内置认证、SSO、成员/项目授权或原始会话人工审批，默认 loopback 只适合本机或受控代理访问。[^everos-api]
- **Skill 发布门禁**：OME 可生成和改写 Skill，但不提供公司的候选评审、Git PR、回归测试和发布策略；自动产物不能直接视为生产 Skill。
- **规模边界**：v1 不支持多租户、云同步和分布式分片，单服务器并发、存储增长和多人同时编辑需实测。[^everos-overview]

### 需要自研或外部补齐

- 本地会话选择/预览/授权上传工具、原始会话归档和脱敏/删除策略。
- 多 Agent 事件归一化适配器和接入层，负责调用 `/add`、`/flush` 以及按项目作用域检索。
- 反向代理、组织权限、审计、备份和监控；为 Cascade/OME 的最终一致性提供任务状态展示。
- Skill 候选评审界面或 Git 集成：关联来源 Episode、生成 diff、人工批准、回滚并运行固定验证任务。

### 否决风险

当前未发现硬性否决项。最大风险是把本地 Markdown 的可读性误认为已经具备团队权限和原始会话治理，或把 OME 生成的 `SKILL.md` 未经证据审查直接发布。

---

[^everos-repository]: [EverOS 官方 GitHub 仓库](https://github.com/EverMind-AI/EverOS)
[^everos-license]: [EverOS Apache License 2.0](https://github.com/EverMind-AI/EverOS/blob/main/LICENSE)
[^everos-commits]: [EverOS main 分支提交记录](https://github.com/EverMind-AI/EverOS/commits/main)
[^everos-readme]: [EverOS README：定位、作用域与生态](https://github.com/EverMind-AI/EverOS/blob/main/README.md)
[^everos-overview]: [EverOS 官方项目范围说明](https://github.com/EverMind-AI/EverOS/blob/main/docs/overview.md)
[^everos-how-memory]: [EverOS How Memory Works](https://github.com/EverMind-AI/EverOS/blob/main/docs/how-memory-works.md)
[^everos-storage]: [EverOS Storage Layout](https://github.com/EverMind-AI/EverOS/blob/main/docs/storage_layout.md)
[^everos-architecture]: [EverOS Architecture](https://github.com/EverMind-AI/EverOS/blob/main/docs/architecture.md)
[^everos-api]: [EverOS HTTP API v2](https://github.com/EverMind-AI/EverOS/blob/main/docs/api.md)
[^everos-pipeline]: [EverOS How Memory Works：消息到 Episode 的写入管线](https://github.com/EverMind-AI/EverOS/blob/main/docs/how-memory-works.md#how-a-memory-is-born)
[^everos-cascade]: [EverOS How Memory Works：Cascade daemon](https://github.com/EverMind-AI/EverOS/blob/main/docs/how-memory-works.md#the-cascade-daemon)
[^everos-ome]: [EverOS How Memory Works：Offline Memory Engine 与 Reflection](https://github.com/EverMind-AI/EverOS/blob/main/docs/how-memory-works.md#the-offline-memory-engine-ome)
[^everos-quickstart]: [EverOS QUICKSTART.md](https://github.com/EverMind-AI/EverOS/blob/main/QUICKSTART.md)
[^everos-config]: [EverOS 配置示例](https://github.com/EverMind-AI/EverOS/blob/main/config.example.toml)
[^everos-integrations]: [EverOS README：Ecosystem Integrations](https://github.com/EverMind-AI/EverOS#ecosystem-integrations)
[^everos-default-config]: [EverOS 默认配置：Embedding 端点与模型](https://github.com/EverMind-AI/EverOS/blob/main/src/everos/config/default.toml)
