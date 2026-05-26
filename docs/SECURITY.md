# Security model

What PNPAI protects against, what it doesn't, and how to think about it.

> **⚠ AI-authored caveat.** Designed by AI; not independently audited. See [DISCLAIMER.md](../DISCLAIMER.md).

## In one sentence

**The hooks are the security boundary. Everything else is cooperation.**

## Threat model

PNPAI sits inside Claude Code, which runs locally with the user's permissions. The threat is **a careless or compromised AI session**, not a malicious user. We protect against:

1. **Prompt injection** — content in a fetched URL, work-item description, file, or search result that tries to instruct the agent to do something harmful (force-push, delete branches, leak secrets).
2. **Confused-deputy attacks** — untrusted input claiming "I'm authorized to do X".
3. **Honest mistakes** — the model making a wrong guess about what's permitted.

We do **not** protect against:

- A user who runs `rm -rf` themselves.
- A user who installs an untrusted MCP server.
- A user who edits `.claude/config/role.yaml` to grant themselves capabilities.
- Supply-chain attacks on plugins (mitigated by sourcing from the official marketplace and reading manifest changes before installing).

## The guardrail stack

From hardest to softest:

### 1. `pre-tool-use.mjs` — runtime-level enforcement

A Node.js module reads the active role's `forbidden:` list and exits with code 2 on any match. The exit code is final — Claude Code cannot proceed.

This is the **only thing** that survives prompt injection. The model can be talked into trying anything; the hook either allows or refuses. There's no "convince the hook" attack — the hook is a separate process and reads instructions from a file the model didn't write.

Known limits:

- The hook can be bypassed by editing or removing `.claude/hooks/pre-tool-use.mjs`. The model has `Edit` access. **Mitigation:** commit hooks and rely on PR review to catch tampering.
- Pattern matching is substring-based, not semantic. `git push --force` does not block `git push  --force` (two spaces). Keep `forbidden:` lists conservative and broad.
- YAML parsing uses a minimal in-Node regex extractor. Aliases, anchors, flow-style lists, and multiline strings are not supported. Stick to the schema in the existing profiles.
- If `.claude/config/role.yaml` exists but `active:` is empty, the hook **fails closed** (exit 1, blocks every tool call) until the role is set.

### 2. Role profile — declared capability constraints

The orchestration skill consults the role's `capabilities:` (`may_merge_pr`, `may_create_branch`, …) before invoking the relevant tool. If `false`, the skill stops and tells the user.

**Soft enforcement** — a confused model could call the tool anyway. The hook catches the result. The role profile is the first line of defense; the hook is the last.

### 3. AskUserQuestion — human-in-the-loop gates

For ambiguity (duplicate work items, scope deviations), the skill stops and asks the user. Nothing is implicit; the user explicitly authorizes the choice.

## Specific risks and mitigations

| Risk | Mitigation |
|---|---|
| Prompt injection → force-push | Every role's `forbidden:` includes `"git push --force"` and `"git push -f"`. Hook blocks. |
| Prompt injection → write to `main` | Every role's `forbidden:` includes `"git push origin main"` / `"master"`. Hook blocks. |
| Prompt injection → leak secrets via MCP | PNPAI doesn't protect against malicious MCP servers — that's your `.mcp.json` choice. The post-tool-use hook journals every MCP call, so leaks are detectable after the fact. |
| Malicious plugin in marketplace | Read `plugin.json` and source before installing. Plugin signing is on the roadmap. |
| Hook fails silently | Pre-tool-use exits non-zero on any error → Claude Code interprets as blocked. Better false-positive than false-negative. Post-tool-use swallows errors (journaling must not interfere). |

## What to audit before installing

Read the `plugin.json`, any hook scripts (`hooks/*.mjs`), and subagent definitions (`agents/*.md` — check the `tools:` field). For first-party plugins, all of this is public in [the repo](https://github.com/abdulrazzaqdevelopment/pnpai).

## Reporting security issues

Do **not** open a public issue. Email `allafta.mohammed@gmail.com` or open a private security advisory on GitHub.

High-severity issues:

- Any way to bypass `pre-tool-use.mjs` enforcement.
- Any way to exfiltrate journal contents via a tool call that should have been blocked.

## Hardening checklist

- Commit `.claude/hooks/` and `.claude/config/` so changes go through PR review.
- Audit `.claude/journal/` after long sessions.
- Pin plugin versions in `.claude/pnpai-install.json`.
- Run `pnpai doctor` periodically.
