# PNPAIDevelopmentAgency

> Plug-and-play AI development workflow for Claude Code. A role-aware orchestration skill, three subagents, and OS-level guardrails that prevent the model from doing things it shouldn't. Works on GitHub and Azure DevOps out of the box.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-v2.1.117%2B-purple.svg)](https://code.claude.com)
[![AI-built](https://img.shields.io/badge/origin-AI--built-orange.svg)](DISCLAIMER.md)

> **⚠ AI-built project — read [`DISCLAIMER.md`](DISCLAIMER.md) before adopting.**
>
> Every line of this repo was produced by AI through user prompting. There is no traditional human author and no line-by-line audit. Start with the Trainee role, inspect `.claude/journal/` after first runs, and report issues.

---

## What it does

You install one of two **role profiles** (Trainee or Senior) and one of two **platform adapters** (GitHub or Azure DevOps). Then in Claude Code you say:

```
Start the workflow for <work-item-id>
```

The orchestration skill runs through 9 phases — fetches the work item, verifies the cited files exist, plans, creates a branch, you implement, the Verifier subagent runs your test commands, commits and opens a PR. At every tool call a pre-tool-use hook checks your role's `forbidden:` list and blocks anything that's not allowed (force-pushes, writes to `main`, etc.). A post-tool-use hook journals every outside-world action to `.claude/journal/`.

The model can be talked into many things; the hook cannot.

## 60-second install

```bash
# In Claude Code, in any repo:
/plugin marketplace add abdulrazzaqdevelopment/pnpai
/plugin install pnpai-core
/plugin install pnpai-role-trainee pnpai-platform-github pnpai-verification-node
```

Or use the CLI for an interactive picker:

```bash
npx pnpai init
```

Then in Claude Code:

```
> Start the workflow for <work-item-id>
```

## Plugins

`pnpai-core` is required. Pick one role, one platform, one verification preset.

| Plugin | Description |
|---|---|
| **`pnpai-core`** ⭐ | Orchestration skill + Researcher + Explorer + Verifier + hooks. Required. |
| `pnpai-role-trainee` | Junior — opens PRs, hook blocks merge / force-push / writes to base branches. |
| `pnpai-role-senior` | Full contributor — can merge. Verifier still mandatory. |
| `pnpai-platform-github` | GitHub Issues + PRs adapter. Needs the GitHub MCP server. |
| `pnpai-platform-azure-devops` | Azure DevOps Boards + Repos adapter. Needs the ADO MCP server. |
| `pnpai-verification-node` | Verifier preset for Node / TypeScript. |
| `pnpai-verification-python` | Verifier preset for Python. |

## Switching roles or platforms

```bash
pnpai switch role senior
pnpai switch platform github
```

The orchestration skill re-reads the config at the start of every phase, and the hook re-reads it on every tool call. Changes take effect immediately.

## CLI reference

```
pnpai init                       Interactive picker (default)
pnpai add <plugin>               Print install commands for one plugin
pnpai doctor                     Check install health
pnpai switch role <name>         Set active role
pnpai switch platform <name>     Set active platform
pnpai version                    Print version
```

## Requirements

- **Claude Code v2.1.117+**
- **Node 20+** on PATH (the only runtime dependency — for hooks and CLI)
- **Git**
- An **MCP server** for your platform — install separately. GitHub MCP for `pnpai-platform-github`; ADO MCP for `pnpai-platform-azure-devops`.

Runs on Linux, macOS, and Windows.

## Documentation

- [`DISCLAIMER.md`](DISCLAIMER.md) — how this project was made and what that means.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the phase model, subagents, hooks, and config files in detail.
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, what the hooks can and can't protect against, known limits.

## License

MIT. See [LICENSE](LICENSE).
