---
kind: open-source-research-validation
status: pending
topic: AI 开发会话与 Memory
---

# AI 开发会话与 Memory：验证记录

本文件是研究控制工件，不是项目深度报告，也不构成行动计划。它保存报告中被移出的“尚未由静态资料确认”的验证问题，避免把后续实验写进正式研究结论。正式报告只保留截至核验日可由一手资料支持的事实、判断和能力边界。

## AgentOps

- 用一条真实 Claude Code 会话核对 Session、LLM、Tool、文件编辑和测试 Span 的映射完整性。
- 明确 prompt、completion、tool result、diff 和 secret 的采集策略，并观察大事件的存储与查询行为。
- 依据官方 Compose 组合核对 API、Dashboard、Collector、ClickHouse 和 PostgreSQL/Supabase 的实际资源与恢复边界。
- 核对 `skill_version`、任务类型和评审标签能否贯穿回放，并能否导出为 Skill 回归任务。

## Entire CLI

- 在无敏感数据的测试仓库中导入指定 Claude Code Session，对比原始 JSONL 与 checkpoint `full.jsonl` 的字段保留情况。
- 设置 `push_sessions=false`，确认普通代码 push 不会发送 checkpoint refs。
- 验证独立私有 checkpoint 仓库能否使用公司 Git 服务，而不局限于文档示例中的 GitHub。
- 检查中文姓名、手机号、内部项目代号和公司密钥格式的脱敏覆盖率。
- 验证 Session Picker 能否在不复制原始会话的前提下完成预览和明确授权。
- 将 checkpoint 转换为“问题、尝试、失败、修复、测试、结果”结构，核对其对 Skill 更新的证据价值。

## Helicone

- 用公司 API 和 DeepSeek 各验证一条请求链的路由与成本字段。
- 核对 session properties 是否能稳定关联 Skill commit。
- 按预期保留期估算 ClickHouse/MinIO 的容量与清理边界。
- 评估 Claude Code 本地事件上传器是否能补足 Helicone 不覆盖的终端、文件和测试事件。

## Langfuse

- 将一条 Claude Code JSONL 会话映射为 Trace、工具 Observation 和 Session。
- 核对敏感字段在 SDK/OTel 发送前的本地过滤边界。
- 按官方 Compose 组合核对磁盘增长与查询边界。
- 将会话失败标签导出为 Dataset，确认其是否能支撑 Skill 回归评估。

## OpenLIT

- 用 Claude Code、Cursor、Codex 各执行一条含工具调用、失败重试、文件编辑和子 Agent 的会话，核对统一字段和 chat rollup。
- 分别核对三种 capture mode 的内容、secret、路径和 prompt redaction 边界。
- 按单机部署组合核对 ClickHouse 磁盘、查询延迟、容器内存和备份恢复边界。
- 核对“本地选择/确认 → 原始对象存储 → trace 引用 → Memory/Skill PR”桥接所需字段。

## Phoenix

- 用官方 coding-harness-tracing 插件核对 Claude Code 会话的 turn、工具、子 Agent、token 成本和 `session_id` 是否完整到达，并核对历史 JSONL 到 OpenInference span 的字段映射。
- 核对长 prompt、工具输出和代码 diff 的存储上限。
- 在 SQLite 单机模式下核对 1,000 条会话的查询与备份边界。
- 核对 Dataset 实验结果能否按 Skill commit 进行对比。

## 使用约束

- 这些项目均只记录尚未由当前静态报告确认的边界，不代表官方能力承诺。
- 结果应回填到对应项目报告的“能力缺口”或“接入限制”，而不是直接把实验结论写入汇总页。
