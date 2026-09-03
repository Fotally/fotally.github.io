---
title: 个人会话收集开源项目
---

这里整理用于发现、采集、回放和分析开发 Agent 会话的开源项目，重点关注多 Agent 接入、原始证据保留和单机部署。

## 项目

- [[Entire CLI：用 Git Checkpoint 连接 AI 会话与代码变更]]：用 Agent Hook、Git checkpoint 和 commit provenance 关联会话与代码变更。
- [[CloudCLI UI：跨 Agent 本地会话发现与预览]]：在开发者本地发现、统一展示和预览多个 Agent 的历史会话。
- [[OpenLIT（以 OpenTelemetry、ClickHouse 和 SDK 采集 Agent 会话）|OpenLIT]]：通过编码 Agent Hook、OpenTelemetry 和 ClickHouse 采集会话轨迹。
- [[Phoenix：以 OpenTelemetry 轨迹和评估数据集分析 Agent 会话|Phoenix]]：以 OpenInference trace、数据集和评估分析 Agent 执行。
- [[Langfuse：以 Trace、Session 和评估闭环沉淀 Agent 会话|Langfuse]]：以 Trace、Session、标注和 Eval 建立中央分析闭环。
- [[AgentOps（以 Session Replay 和 Agent Span 记录开发经验）|AgentOps]]：以 Session、Agent 和 Tool Span 提供回放与 Agent 运行分析。
- [[Helicone：以 AI Gateway 代理和请求日志沉淀会话|Helicone]]：以统一 AI Gateway 代理模型请求并聚合会话日志，作为补充参考。

## 统计

- 主清单：6 个直接面向个人会话或中央 Trace 的项目（Entire CLI、CloudCLI UI、OpenLIT、Phoenix、Langfuse、AgentOps）。
- 补充参考：1 个以 Gateway 为核心的会话日志项目（Helicone）。
