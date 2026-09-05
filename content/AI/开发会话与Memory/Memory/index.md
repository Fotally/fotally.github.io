---
title: Memory 开源项目
---

这里整理可自部署的 Agent Memory 项目，以及适合会话知识和 Skill 更新闭环借鉴的架构。

## 项目

- [[Mem0：面向Agent的可插拔长期记忆层]]：以多级作用域、混合检索和 API 形式提供可插拔记忆层。
- [[Letta Code：带持续学习记忆的开发 Agent Harness]]：以 MemoryFS、持续学习和 Skill 机制支持长期开发 Agent。
- [[Graphiti：带时间和来源追踪的上下文知识图谱]]：通过时间事实、Episode 溯源和混合检索构建动态上下文图谱。
- [[Cognee：从多源数据构建知识图谱记忆]]：将会话、工具轨迹和多源资料构建为会话记忆与永久知识图谱。
- [[Hindsight：Retain、Recall、Reflect 的学习型 Agent Memory]]：以 Retain、Recall、Reflect 和多路检索实现会学习的 Agent Memory。
- [[EverOS：以 Markdown、Episode 和 Skill 演化的本地 Memory]]：以 Markdown 事实源、Episode 反思和 Skill 演化构建 local-first Memory。
- [[Supermemory：事实演化、用户画像与混合检索 Memory]]：维护静态/动态用户画像、事实变化和 Memory+RAG 混合检索。
- [[LightRAG：图结构与向量检索的业务知识 Memory]]：用图结构、向量和关键词混合检索组织业务知识。
- [[Memobase：以 Profile 与事件时间线构建可控用户 Memory]]：以 Profile、Event Timeline 和 buffer flush 形成可控用户记忆。
- [[MemU：面向主动记忆与多 Agent 的记忆编排]]：以可读记忆文件、Embedding profile 和 Agent 编排支持主动记忆与 Skill 演化。
- [[Zep：托管 Context Graph 生态与开源边界案例]]：拆解 Zep Cloud 的 Context Graph 思路及其当前开源边界，作为补充参考。

## 统计

- 共 11 篇：10 个可进入单机试点比较的 Memory 项目（Mem0、Letta Code、Graphiti、Cognee、Hindsight、EverOS、Supermemory、LightRAG、Memobase、MemU），以及 1 个用于理解 Context Graph 商业化与开源边界的案例（Zep）。

## 向量化与模型接口速查

| 项目 | Embedding 是否必需 | 官方默认/示例模型 | 主要向量后端 | 公司 API / DeepSeek 注意事项 |
| --- | --- | --- | --- | --- |
| Mem0 | 语义检索必需 | OpenAI `text-embedding-3-small` | 可配置向量数据库 | 需 `/v1/embeddings`；换模型/维度要重建集合 |
| Letta Code | MemoryFS 可选；Archival Memory 必需 | 当前 Code 未确认固定默认值 | Server archival store | 需匹配 `EmbeddingConfig` endpoint；聊天 API 不能代替 Embedding |
| Graphiti | 语义检索必需 | OpenAI `text-embedding-3-small` | 图数据库 + 向量索引 | 需兼容 embeddings 接口并固定 `EMBEDDING_DIM` |
| Cognee | 语义检索必需 | `openai/text-embedding-3-large`；FastEmbed `BAAI/bge-small-en-v1.5` 示例 | 可配置向量存储 | 公司网关需暴露 Embedding；中文模型需单独评测 |
| Hindsight | Recall 语义检索必需 | `BAAI/bge-small-en-v1.5` | PostgreSQL/pgvector | LLM 与 Embedding 分开配置；DeepSeek 聊天接口不等于 Embedding |
| EverOS | 关键词检索可选；向量/混合检索需要 | `Qwen/Qwen3-Embedding-4B` 示例 | LanceDB | OpenAI-compatible `/v1/embeddings`；未确认中文质量基线 |
| Supermemory | 语义 Memory 路径需要 | 官方本地模型/具体默认维度需按版本核验 | 本地引擎/索引 | 需确认 self-host 版本的模型与维度配置 |
| LightRAG | 图/向量语义检索必需 | `text-embedding-3-small`、`bge-m3` 等示例 | NanoVectorDB、pgvector、Milvus、Qdrant 等 | 需设置 `EMBEDDING_DIM`；换模型后执行重建 |
| Memobase | 事件语义检索可选 | `text-embedding-qwen3-embedding-8b`、4096 维示例 | PostgreSQL/pgvector | 可关闭事件 Embedding；DeepSeek 需兼容 Embedding 端点 |
| MemU | MemoryService 写入/查询必需 | OpenAI `text-embedding-3-small` | SQLite 或 PostgreSQL/pgvector | 可切换 provider/Base URL；内置列表未含 DeepSeek Embedding |
