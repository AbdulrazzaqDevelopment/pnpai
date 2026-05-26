# Architecture

How PNPAI works under the hood. Read [README.md](../README.md) first.

## One paragraph

PNPAI is a Claude Code plugin marketplace. Two YAML files (`role.yaml`, `platform.yaml`) at known paths in your repo decide who the agent is acting as and where work lives. An orchestration skill reads those files, runs a 9-phase pipeline, and dispatches three subagents in parallel where useful. Two Node.js hooks intercept every tool call: one blocks anything the active role's `forbidden:` list disallows, the other journals outside-world actions to `.claude/journal/`. The model can be talked into many things; the hooks cannot.

## The two configuration knobs

### `.claude/config/role.yaml`

```yaml
active: trainee
overrides: {}
```

One line decides who the agent is acting as. The orchestration skill re-reads this every phase; the hook re-reads it on every tool call. Switching role takes effect immediately.

### `.claude/config/platform.yaml`

```yaml
active: github
project: <your-project>
repository: <your-repo>
default_base_branch: main
```

The active platform decides which adapter the skill reads operations from. Adapters map abstract operation names (`fetch_work_item`, `create_pr`) to concrete MCP tool names (`mcp__github__get_issue`, `mcp__azure-devops__repo_create_pull_request`, …).

## Component graph

```
┌──────────────────────────────────────────────────────────────────────┐
│                        User in Claude Code                            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │  "Start the workflow for <work-item-id>"
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  feature-workflow SKILL (pnpai-core)                                  │
│    reads role.yaml, platform.yaml, roles/<active>.yaml, …             │
│    runs phases 0..8                                                   │
│    dispatches subagents in parallel where useful                      │
└──┬──────────────────┬──────────────────┬─────────────────────────────┘
   │                  │                  │
   ▼                  ▼                  ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Researcher │  │  Explorer  │  │  Verifier  │   ← 3 subagents
│  (Sonnet)  │  │  (Sonnet)  │  │  (Haiku)   │     in pnpai-core
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │ MCP           │ Read           │ Bash
      ▼               ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Platform adapter (pnpai-platform-*)                                  │
│    operations: { fetch_work_item: "mcp__X__Y", … }                    │
│    vocabulary: types, states, constraints                             │
└────────────────────────────┬─────────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  MCP server (you install separately)                                  │
└──────────────────────────────────────────────────────────────────────┘

Every tool call passes through:
┌──────────────────────────────────────────────────────────────────────┐
│  pre-tool-use.mjs    blocks forbidden actions per active role         │
│  post-tool-use.mjs   journals every outside-world action              │
└──────────────────────────────────────────────────────────────────────┘
```

## Phase model

The skill runs phases 0 through 8 sequentially. Roles declare which are `mandatory_phases`; the skill skips non-mandatory phases unless the user requests them.

| # | Name | Purpose |
|---|---|---|
| 0 | Boot | Read role + platform config |
| 1 | Discovery | Researcher + Explorer parallel dispatch |
| 2 | Clarify | `AskUserQuestion` if Discovery surfaced ambiguity |
| 3 | Plan | Activate work item + create branch |
| 4 | Checkout | Local branch sync + freshness audit |
| 5 | Implement | Lead session does edits (no Builder subagent) |
| 6 | Verify | Verifier runs the configured commands |
| 7 | Commit | Explicit paths, conventional commit, push |
| 8 | Handoff | Create PR, assign reviewer, close child work items |

Each phase has a capability check before its side effects. If `may_create_branch: false`, Phase 3 stops. If `may_merge_pr: false`, the workflow ends at Phase 8.

## Subagents

Three subagents ship with `pnpai-core`. Each runs in its own context window with scoped tools.

| Subagent | Model | Tools | Purpose |
|---|---|---|---|
| Researcher | Sonnet | Read + platform MCP (read-only) | Fetch the work item; query duplicates; list branches. |
| Explorer | Sonnet | Read, Glob, Grep | Verify every file path and symbol the work item cites. |
| Verifier | Haiku | Bash, Read | Run the configured verification commands; return a mechanical pass/fail report. |

The lead session is the only thing that writes — edits, commits, pushes, work-item state changes, PRs. Subagents return structured outputs the lead synthesizes.

## Hooks

Two Node.js ESM modules in `plugins/pnpai-core/hooks/`. Pure Node, zero external dependencies. Run identically on Linux, macOS, and Windows.

### `pre-tool-use.mjs`

Reads the active role's `forbidden:` list and blocks any tool call whose stringified input contains any forbidden pattern (case-insensitive substring match against the full JSON envelope).

This is the **hard guardrail**. Soft instructions in prompts ("never merge to main") can be talked around. A hook exiting code 2 at the runtime level cannot. The Trainee role's `forbidden:` list contains `git push origin main`; even if a prompt-injection convinces the model to attempt that push, the hook refuses.

YAML parsing uses a minimal in-Node regex extractor sufficient for the simple key/list shapes role profiles use. Aliases, anchors, flow-style lists, and multiline strings are not supported — see [SECURITY.md](SECURITY.md).

### `post-tool-use.mjs`

Appends one line to `.claude/journal/<date>.log` for every outside-world action: any `mcp__*` call, `git push`, `git commit`, or `Bash` invocation. The journal is the audit trail.

Internal tools (`Read`, `Glob`, `Grep`, `Edit`, `Write`) are not journaled — they would create too much noise.

## Plugin layout

```
plugins/<name>/
├── .claude-plugin/plugin.json     # manifest
└── <one or more of:>
    ├── skills/<name>/SKILL.md
    ├── agents/<name>.md
    ├── hooks/<name>.mjs           # Node ESM only
    ├── commands/<name>.md
    └── data/<config>.yaml         # role profiles, platform adapters, verification presets
```

The `.claude-plugin/plugin.json` follows the standard Claude Code schema. The `data/` directory is a PNPAI convention.

## Config resolution precedence

When the skill needs (say) the Trainee role profile, it looks in order:

1. `.claude/config/roles/trainee.yaml` — user override
2. `<pnpai-role-trainee plugin>/data/role.yaml` — bundled default

This gives a clean upgrade path: customize what you need in `.claude/config/`, and upgrade plugins independently. Plugin upgrades don't write to `.claude/config/`.

## What PNPAI is NOT

- **Not a tech-stack opinion.** The Verifier runs whatever your `verification.yaml` declares.
- **Not a CI provider opinion.** CI integration is your team's choice.
- **Not a project-management tool.** Work tracking lives in your platform (GitHub Issues, ADO Boards).
- **Not an MCP server.** PNPAI calls MCP servers; it doesn't bundle them.
- **Not a replacement for code review.** The hook blocks specific patterns; reviewers still review.
