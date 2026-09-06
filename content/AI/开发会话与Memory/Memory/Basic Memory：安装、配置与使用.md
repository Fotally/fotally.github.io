---
title: Basic Memory：安装、配置与使用
kind: usage-guide
status: completed
project: Basic Memory
verified_date: 2026-09-06
---

# Basic Memory：安装、配置与使用

> 本文依据 [Basic Memory 官方 GitHub 仓库](https://github.com/basicmachines-co/basic-memory) 的 README 和公开文档整理，核验日期为 2026-09-06。Basic Memory 的命令、默认路径和云端能力会随版本变化，实际使用前应以仓库当前版本为准。

## 1. 项目定位

Basic Memory 是一个以 Markdown 文件为主要知识载体、通过 MCP 接入 AI Agent 的个人 Memory 工具。它的核心思路是：

- 将知识保存为本地 Markdown，而不是把用户锁定在不可读的数据库记录中；
- 使用 frontmatter、Observations、Relations 和 wikilinks 表达知识及其关联；
- 通过 MCP 将笔记检索、写入和编辑能力提供给 Claude Desktop、Claude Code、Codex、Cursor、VS Code 等客户端；
- 默认使用本地 SQLite 作为索引或运行时存储，笔记正文仍然保留在文件系统中；
- 也可以使用 Basic Memory Cloud，实现跨设备同步和云端托管。

对于当前“会话已经收集，再由 Agent 抽取 Markdown Memory”的方案，Basic Memory 更适合作为 Markdown Memory 的交互和检索参考，而不是直接替代原始会话归档、候选审核或 Skill 发布流程。

## 2. 安装前提

### 2.1 本地安装

官方 README 要求使用 Python 3.12 或更高版本，并推荐通过 `uv` 安装：

```bash
uv tool install basic-memory --prerelease=allow
```

`--prerelease=allow` 是当前安装说明中的必要参数，用于允许安装项目所需的预发布依赖。不要在不确认版本兼容性的情况下自行删除该参数。

本地模式默认使用 SQLite，不要求 Docker 或独立数据库服务。要让 AI Agent 实际使用 Basic Memory，还需要一个支持 MCP 的客户端。

### 2.2 可选后端

如果需要使用 Postgres 和 Milvus 相关能力，可以安装额外依赖：

```bash
uv tool install "basic-memory[milvus]" --prerelease=allow
```

这不是普通本地试用的必需路径。用户数量较少时，优先从默认本地 SQLite 开始，只有在并发、数据量或检索需求明确增加后再评估额外后端。

### 2.3 云端模式

Basic Memory 还提供云端服务。云端模式不需要本地 Python 或命令行安装，适合跨设备使用；但数据将进入托管服务，使用前应单独核对账号、费用、数据保留、同步和隐私策略。

本文重点介绍本地安装和本地 MCP 接入，不把云端服务当作本地内网部署能力。

## 3. 本地运行与 MCP 服务器

安装完成后，可以使用以下命令启动 MCP 服务器：

```bash
basic-memory mcp
```

对于一次性运行或不希望安装全局 CLI 的场景，也可以让 MCP 客户端直接调用 `uvx`：

```bash
uvx --prerelease=allow basic-memory mcp
```

客户端通常通过标准输入输出启动这个 MCP 进程。Basic Memory 不需要单独启动一个 Web 服务才能完成最小本地接入；具体 HTTP/HTTPS 传输和云端连接方式应以当前版本文档为准。

## 4. 客户端配置

### 4.1 Claude Desktop

编辑 Claude Desktop 的 MCP 配置文件：

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

加入：

```json
{
  "mcpServers": {
    "basic-memory": {
      "command": "uvx",
      "args": ["--prerelease=allow", "basic-memory", "mcp"]
    }
  }
}
```

保存后重启 Claude Desktop，并确认 MCP 服务器状态正常。

### 4.2 Claude Code

使用 Claude Code 的 MCP 管理命令添加：

```bash
claude mcp add basic-memory -- uvx --prerelease=allow basic-memory mcp
```

添加后可以通过 Claude Code 的 MCP 列表确认服务器是否存在。若服务器无法启动，先检查 `uvx`、Python 版本和 `--prerelease=allow` 参数。

Basic Memory 还提供可选的 Claude Code 插件。先添加插件市场，再安装插件：

```bash
claude plugin marketplace add basicmachines-co/basic-memory \
  --sparse .claude-plugin plugins/claude-code

claude plugin install basic-memory@basicmachines-co
```

插件依赖 MCP 服务器。插件可以提供会话简报、压缩前检查点以及 `/basic-memory:*` 命令，但插件能力与 Basic Memory 核心 CLI/MCP 能力应分开核对。

### 4.3 Codex CLI

编辑：

```text
~/.codex/config.toml
```

加入：

```toml
[mcp_servers.basic-memory]
command = "uvx"
args = ["--prerelease=allow", "basic-memory", "mcp"]
```

README 还展示了可选的工具审批配置，例如：

```toml
default_tools_approval_mode = "approve"
```

具体配置名称和审批语义可能随 Codex 版本变化，应以当前 Codex 文档为准。破坏性工具调用不应因为接入 Basic Memory 就默认免审批。

### 4.4 Cursor

在项目级或用户级 `.cursor/mcp.json` 中加入：

```json
{
  "mcpServers": {
    "basic-memory": {
      "command": "uvx",
      "args": ["--prerelease=allow", "basic-memory", "mcp"]
    }
  }
}
```

项目级配置适合只让一个仓库使用 Basic Memory；用户级配置适合多个项目共享同一 MCP 入口，但需要额外注意项目范围和数据隔离。

### 4.5 VS Code

在用户设置 JSON 中加入 MCP 服务器：

```json
{
  "mcp": {
    "servers": {
      "basic-memory": {
        "command": "uvx",
        "args": ["--prerelease=allow", "basic-memory", "mcp"]
      }
    }
  }
}
```

### 4.6 其他客户端

官方 README 还列出了以下使用方式：

- **Obsidian**：直接打开 `~/basic-memory` 或指定项目目录，不需要额外插件才能查看 Markdown；
- **ChatGPT**：通过 Custom GPT Actions 使用 `search` 和 `fetch`；
- **其他 MCP 客户端**：使用 Basic Memory 的 stdio 或官方支持的远程传输方式；
- **Hermes、OpenClaw 等宿主**：按照仓库中对应的适配器或 Skill 文档配置。

## 5. 本地数据目录与配置

### 5.1 默认路径

本地模式的主要路径如下：

| 路径 | 用途 |
| --- | --- |
| `~/basic-memory` | 默认本地笔记和项目目录 |
| `~/.basic-memory/config.json` | Basic Memory 配置文件 |
| `~/.basic-memory/basic-memory.log` | 日志文件 |
| 本地 SQLite | 默认索引或运行时数据库，具体数据库文件路径应以当前版本实际配置为准 |

默认数据正文是普通 Markdown。可以使用 Obsidian、VS Code 或其他编辑器直接打开和编辑，但直接编辑后应通过 `status`、`doctor` 或客户端查询确认索引是否已经同步。

### 5.2 配置文件

配置文件示例：

```json
{
  "auto_update": false
}
```

常用配置命令：

```bash
basic-memory config list
basic-memory config set cli_output_style plain
basic-memory config unset cli_output_style
```

`config list` 用于查看当前配置，`config set` 用于写入配置，`config unset` 用于移除配置。不要把 API Key 或其他秘密直接提交到 Git 仓库中的配置文件。

### 5.3 环境变量

官方材料中出现的常用环境变量包括：

| 变量 | 用途 |
| --- | --- |
| `BASIC_MEMORY_LOG_LEVEL` | 日志级别，默认通常为 `INFO` |
| `BASIC_MEMORY_CLOUD_MODE` | 云模式路由或日志行为 |
| `BASIC_MEMORY_FORCE_LOCAL` | 强制使用本地路由 |
| `BASIC_MEMORY_FORCE_CLOUD` | 强制使用云端路由 |
| `BASIC_MEMORY_EXPLICIT_ROUTING` | 标记显式路由选择 |
| `BASIC_MEMORY_NO_PROMOS` | 禁用推广和遥测相关行为 |
| `BASIC_MEMORY_IMPORT_UPLOAD_MAX_BYTES` | 导入上传大小限制 |
| `BASIC_MEMORY_ENV` | 运行环境，例如测试模式 |

在不确定某个环境变量是否仍受当前版本支持时，应先使用 `basic-memory doctor` 和当前版本文档确认，不要仅凭旧配置继续运行。

## 6. 语义搜索与重排

Basic Memory 的本地 Markdown 和 SQLite 路径可以先满足关键词、关系和文件级使用场景。若需要启用语义搜索和重排，官方 README 展示了以下环境变量：

```bash
export BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED=true
export BASIC_MEMORY_RERANKER_ENABLED=true
```

使用 LiteLLM 重排时：

```bash
export BASIC_MEMORY_RERANKER_PROVIDER=litellm
export BASIC_MEMORY_RERANKER_MODEL=cohere/rerank-v3.5
export COHERE_API_KEY="..."
```

这条路径会引入额外模型和 API 依赖。对于用户数量较少的本地试点，可以先不启用语义重排，优先验证 Markdown 组织、作用域、来源和人工审核是否有效。

## 7. CLI 常用命令

### 7.1 项目管理

```bash
basic-memory project list
basic-memory project add research ~/research
basic-memory project set-cloud research
basic-memory project set-local research
```

这些命令用于查看项目、添加一个本地目录作为项目，以及在本地和云端路由之间切换。执行 `set-cloud` 前应确认该项目的数据出站和同步边界。

### 7.2 状态与维护

```bash
basic-memory status
basic-memory doctor
basic-memory update
basic-memory update --check
```

建议在首次接入和升级后依次执行：

1. `basic-memory status` 查看项目和服务状态；
2. `basic-memory doctor` 检查运行环境、配置和连接；
3. `basic-memory update --check` 查看是否有新版本；
4. 确认 Markdown 和 SQLite 索引状态后再升级。

### 7.3 配置和工具调用

```bash
basic-memory config list
basic-memory tool edit-note ...
```

CLI 支持 `--json` 输出时，优先使用结构化输出供脚本或 Agent 处理。路由相关命令可根据版本支持 `--local` 或 `--cloud`，用于强制指定数据路径。

### 7.4 导入

官方 README 列出以下导入入口：

```bash
basic-memory import claude conversations
basic-memory import chatgpt
basic-memory import memory-json
```

导入前建议：

- 先备份原始会话或原始导出文件；
- 明确导入范围，不要默认导入全部历史；
- 先在独立项目目录中验证；
- 检查导入内容是否包含密钥、个人信息和内部业务数据；
- 导入后运行 `status` 或 `doctor`，再通过客户端进行检索验证。

## 8. Markdown 知识使用方式

Basic Memory 的本地知识通常以 Markdown 形式保存。推荐使用以下内容边界：

- **Observation**：记录从会话或文档中确认的观察；
- **Relation**：记录实体、页面或笔记之间的关系；
- **frontmatter**：保存标题、类型、项目和其他元数据；
- **wikilinks**：连接相关笔记，形成可读的知识网络。

对于开发会话 Memory，建议将以下内容分开：

1. 原始会话引用或不可变归档；
2. 一次会话的 Episode/总结；
3. 经过审核的项目事实和技术决策；
4. Skill Candidate；
5. 经过验证的正式 Skill。

Basic Memory 本身的 Markdown 文件不应自动被视为已经审核的业务规则。Agent 写入的内容仍然需要来源、范围、状态和人工审核字段。

## 9. 与当前 Markdown Memory 方案的结合

Basic Memory 可以作为当前方案的一个可选实现参考：

```text
已有会话收集
  → Episode / Memory Candidate
  → 写入 Basic Memory Markdown
  → 人工审核与 Git 版本化
  → MCP search/fetch 提供给 Agent
```

适合借鉴的部分：

- Markdown-first 的可读存储；
- MCP 作为 Agent 接入边界；
- 项目目录和本地/云端路由；
- SQLite 作为低运维索引；
- Markdown 中的 Observation、Relation 和 wikilinks。

仍需在外部补齐的部分：

- 原始会话授权、脱敏和保留策略；
- `source_session_id`、消息范围和哈希等证据字段；
- Memory Candidate 与 Published Memory 的状态机；
- Skill 的人工审核、Git PR 和回归验证；
- 多用户权限和项目级隔离策略；
- 云端模式的数据区域、保留和合规策略。

## 10. 升级、备份与卸载

### 10.1 升级

使用：

```bash
basic-memory update
basic-memory update --check
```

`uv tool` 和 Homebrew 安装路径可能启用自动更新检查；可以在 `~/.basic-memory/config.json` 中关闭：

```json
{
  "auto_update": false
}
```

使用 `uvx` 临时运行时，由 `uv` 管理包版本，不应把它与已安装的 `basic-memory` CLI 自动更新机制混为一谈。升级时继续保留 `--prerelease=allow`，除非当前版本文档已明确取消要求。

### 10.2 备份

至少备份：

- `~/basic-memory` 中的 Markdown；
- `~/.basic-memory/config.json`；
- 需要保留的日志和导入源；
- 如果使用云端，先使用官方导出能力导出 Markdown。

SQLite 属于派生索引或运行时状态，不能替代 Markdown 事实源。恢复时优先恢复 Markdown，再按当前版本重建或校验索引。

### 10.3 卸载

官方 README 没有提供一个可以同时清理 CLI、配置、日志、Markdown 和云端数据的统一卸载命令。删除前应先备份并明确数据范围：

```bash
uv tool uninstall basic-memory
```

该命令只处理通过 `uv tool install` 安装的工具，不应假设它会删除：

- `~/basic-memory` 中的 Markdown；
- `~/.basic-memory` 中的配置和日志；
- SQLite 索引；
- 云端账户和托管数据。

这些目录和云端数据需要根据实际保留策略单独处理。

## 11. 常见排查顺序

### MCP 服务器无法启动

1. 确认 Python 为 3.12+；
2. 确认 `uv`/`uvx` 可执行；
3. 确认命令中包含 `--prerelease=allow`；
4. 直接执行 `uvx --prerelease=allow basic-memory mcp` 查看错误；
5. 执行 `basic-memory doctor`；
6. 查看 `~/.basic-memory/basic-memory.log`。

### Agent 找不到笔记

1. 检查 MCP 服务器是否已连接；
2. 检查项目是否指向正确目录；
3. 运行 `basic-memory project list`；
4. 确认当前使用的是 local 还是 cloud 路由；
5. 检查 Markdown 文件是否在 Basic Memory 项目目录中；
6. 先用 `basic-memory status` 或 CLI 查询确认索引状态。

### 导入结果不符合预期

- 减小导入范围，先导入一个会话或一个文件；
- 先脱敏再导入；
- 保留原始导出文件，便于重复处理；
- 不把导入后的摘要直接当作已审核 Memory；
- 检查当前版本对应的导入命令和数据格式。

## 12. 官方来源

- [Basic Memory 官方 GitHub 仓库](https://github.com/basicmachines-co/basic-memory)
- [Basic Memory README](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/README.md)
- [Basic Memory Architecture](https://github.com/basicmachines-co/basic-memory/blob/main/docs/ARCHITECTURE.md)
- [Basic Memory Domain Model](https://github.com/basicmachines-co/basic-memory/blob/main/docs/DOMAIN_MODEL.md)
- [Basic Memory Note Format](https://github.com/basicmachines-co/basic-memory/blob/main/docs/NOTE-FORMAT.md)
- [Basic Memory Docker 文档](https://github.com/basicmachines-co/basic-memory/blob/main/docs/Docker.md)
- [Basic Memory CLI 手册](https://github.com/basicmachines-co/basic-memory/blob/main/docs/manual-pages.md)
- [Basic Memory LiteLLM 配置](https://github.com/basicmachines-co/basic-memory/blob/main/docs/litellm-provider.md)
