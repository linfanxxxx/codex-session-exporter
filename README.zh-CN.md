# Codex Session Exporter

把本地 Codex 会话导出、查看、迁移为 Markdown、HTML 或可导入的 bundle。

[English](./README.md)

`codex-session-exporter` 是一个独立 CLI，用来处理本地保存的 Codex 会话。它可以：

- 列出和检查本地 Codex 会话
- 导出可读的 Markdown 文档
- 导出适合离线查看的单文件 HTML
- 导出可迁移到其他客户端的 bundle
- 把 bundle 再导入到另一个本地 Codex home

它基于当前 Codex Desktop / CLI 的本地存储结构实现：

- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`

## 快速开始

先安装本地 CLI 命令：

```bash
./scripts/install-cli.sh
```

直接运行命令：

```bash
codex-session-exporter list --limit 10
```

导出某个会话为 Markdown：

```bash
codex-session-exporter export md <session-id> --output ./exports/session.md
```

导出某个会话为 HTML：

```bash
codex-session-exporter export html <session-id> --output ./exports/session.html
```

导出某个会话为可迁移 bundle：

```bash
codex-session-exporter export bundle <session-id> --output ./exports/session.codex-session
```

把 bundle 导入到另一个 Codex home：

```bash
codex-session-exporter import bundle ./exports/session.codex-session --codex-home ~/.codex
```

## 这个工具解决什么问题

Codex 会把会话保存在本地，但目前没有一个公开、现成的工作流来完成这些事情：

- 把会话迁移到另一个 Codex 客户端
- 把会话导出成适合离线阅读的归档文档
- 同时保留原始 session JSONL、线程元数据和可读副本

这个工具就是为这些场景准备的，而且导出格式尽量保持透明、基于本地文件。

## 运行要求

- 实际 CLI 需要可用的 `Node 22+`
- launcher 本身可以在 `Node 18+` 下启动，只要它最终能找到一个 `Node 22+`
- 默认读取本地 Codex home：`~/.codex`

`bin/codex-session-exporter.mjs` 会按下面这些位置自动寻找 `Node 22+`：

- 当前 `node`
- `CODEX_SESSION_EXPORTER_NODE`
- 兼容旧版本的 `CODEX_SESSION_PORTABILITY_NODE`
- `NVM_BIN/node`
- `PATH` 中的 `node`、`node22`、`nodejs`
- `~/.nvm/versions/node/*/bin/node`

## 常用命令

列出最近会话：

```bash
codex-session-exporter list --limit 20
```

查看某个会话：

```bash
codex-session-exporter inspect 019d0a15-0c56-7b61-86ed-5b1f41c263cf
```

导出 Markdown：

```bash
codex-session-exporter export md 019d0a15-0c56-7b61-86ed-5b1f41c263cf --output ./exports/session.md
```

导出 HTML：

```bash
codex-session-exporter export html 019d0a15-0c56-7b61-86ed-5b1f41c263cf --output ./exports/session.html
```

导出 bundle：

```bash
codex-session-exporter export bundle 019d0a15-0c56-7b61-86ed-5b1f41c263cf --output ./exports/session.codex-session
```

导入并改写工作目录：

```bash
codex-session-exporter import bundle ./exports/session.codex-session --codex-home ~/.codex --target-cwd /new/workspace
```

导入并改写共享根目录前缀：

```bash
codex-session-exporter import bundle ./exports/session.codex-session --codex-home ~/.codex --cwd-map /old/root=/new/root
```

如果你不想把命令安装到 `PATH`，也可以继续直接运行仓库里的 launcher：

```bash
./bin/codex-session-exporter.mjs list --limit 10
```

## Skill 包装

仓库里还带了一个可选的 Codex skill：`skills/codex-session-exporter`

安装到本地 Codex skills 目录：

```bash
./scripts/install-skill.sh
```

这个 skill 会优先使用全局安装的 `codex-session-exporter` 命令；如果没有，就回退到安装时记录的仓库路径。

## 兼容性说明

- 旧命令名 `codex-session-portability` 仍然保留兼容
- 可读导出只保留 user / assistant 消息
- tool calls 和 tool outputs 会保留在 bundle 的 `raw/session.jsonl` 中
- 这个工具依赖当前 Codex 的本地存储格式；如果后续 Codex schema 变化，导入导出逻辑也可能需要调整

## Bundle 目录结构

```text
session.codex-session/
  manifest.json
  transcript.md
  transcript.html
  raw/
    session.jsonl
    thread.json
    thread-dynamic-tools.json
    index-record.json
```

## 仓库结构

```text
codex-session-exporter/
  bin/
  scripts/
  skills/
  src/
  LICENSE
  README.md
  README.zh-CN.md
  package.json
```
