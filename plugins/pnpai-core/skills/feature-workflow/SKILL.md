---
name: feature-workflow
description: |
  PNPAI orchestration skill. Use whenever the user starts a work item:
  "start the workflow for #123", "implement US-456", "fix bug 789".
  Reads .claude/config/role.yaml and .claude/config/platform.yaml to
  determine capabilities and tool names. Coordinates phases 0-8 across
  Researcher, Explorer, and Verifier subagents.
license: MIT
---

# Feature Workflow (PNPAI Core)

The spine of PNPAI. Runs phase-by-phase, consulting the active role and platform on each phase to determine what to do, which subagents to dispatch, and what guardrails apply.

**On origin.** PNPAI was produced by AI through user prompting. Surface ambiguities to the user via `AskUserQuestion` rather than guessing. See `DISCLAIMER.md`.

## Phase 0 — Boot

Read and cache for the session:

1. `.claude/config/role.yaml` — active role name.
2. `.claude/config/roles/<active>.yaml` — capabilities, mandatory phases, mandatory subagents, forbidden actions.
3. `.claude/config/platform.yaml` — active platform name.
4. `.claude/config/platforms/<active>.yaml` — operation map + state vocabulary + constraints.
5. `.claude/config/reviewers.yaml` — for PR handoff.

If anything is missing, tell the user what's missing and suggest `pnpai doctor`. Do not invent missing values.

## Phase 1 — Discovery

Dispatch in a single parallel block:

- **Researcher subagent** — fetch the work item, query duplicates, list branches.
- **Explorer subagent** — verify every file path and symbol the work item references.

After both return:

- If Researcher returned `duplicate_candidates` non-empty → `AskUserQuestion`: proceed / close-this / close-other.
- If Explorer returned `divergence_flags` non-empty → `AskUserQuestion`: pause for revision / proceed with documented scope deviation / abort.

## Phase 2 — Clarify

Use `AskUserQuestion` only when Phase 1 surfaced something the user must decide. Don't fish for context.

## Phase 3 — Plan

**Capability check first.** If `may_create_branch: false`, stop and tell the user what's blocked.

Single parallel tool block:

- Activate the work item if needed (`update_work_item` from the platform adapter's operations map).
- Create the branch via `create_branch`.

Branch naming uses the role's `defaults.branch_prefix` map. Base branch is `default_base_branch` from `platform.yaml` unless the user specified `--stack-on PR#N`.

## Phase 4 — Checkout

```bash
git fetch origin
git checkout <branch>
```

Warn the user if the branch is more than 20 commits behind base.

## Phase 5 — Implement

The lead session performs all edits. There is no Builder subagent.

- Read every file with `Read` before `Edit`.
- Prefer `Edit` over `Write` for existing files.
- One concept per commit.
- No scope creep — work item AC is the contract.
- If routing, scripts, or conventions change, also update `CLAUDE.md`.

## Phase 6 — Verify

If `may_skip_verifier: false`, this phase is mandatory.

Dispatch the **Verifier subagent** if 3 or more files changed; otherwise run inline (`Bash` against the commands in `.claude/config/verification.yaml`).

The Verifier returns a fixed-format report (see `agents/verifier.md`). Any `fail` line blocks Phase 7. Fix and re-verify.

If `verification.yaml` is missing or empty, tell the user and stop. Do not invent commands.

## Phase 7 — Commit & push

Conventional commit:

```
<type>(<id>): <imperative summary under 72 chars>

- What changed and why
- Non-obvious decisions

Resolves: #<id>
```

```bash
git add <explicit paths>     # never -A
git commit -F <message-file>
git push origin <branch>
```

The pre-tool-use hook blocks any forbidden push (force, main, base) per the role profile. If blocked, surface the hook's message verbatim and stop.

## Phase 8 — Handoff

In order:

1. `create_pr(base = parent_branch_if_stacked else default_base_branch)`
2. `set_pr_reviewers(resolve(reviewer_role, reviewers.yaml))`
3. For each unimplemented child of this work item: if it has no separate branch, mark it done with reason "Completed in parent PR".

PR description uses the delta-only template:

```markdown
**Resolves:** #<id>  ([work item](<link>))

**Build:** <verifier metrics>
**Lint:** <verifier metrics>
**Tests:** <verifier metrics>

**Scope deviations from work item:**
- <bullets or "none">

**Stacked on:** PR #<n>  *(if applicable)*

**Manual verification (reviewer):**
- [ ] <each AC row from the work item>
```

Aim for 800–1200 characters. Hard cap from `constraints.pr_description_max_chars` in the adapter.

**Stop rule:** If `may_merge_pr: false`, the workflow ends here. No merging. No further pushes without a new work item.

## Stop conditions

- Pre-tool-use hook blocks an action.
- Verifier reports any `fail`.
- User answers `[abort]` to any `AskUserQuestion`.
- An unhandled MCP error occurs (do not retry blindly).
- Active role's `may_merge_pr` is false and Phase 8 completes.

## Anti-patterns to avoid

- **Don't invent state.** If the platform adapter has no `testing` state, don't pretend it does.
- **Don't auto-fix lint warnings in unchanged files.** Document them as pre-existing.
- **Don't repeat the work item body in the PR description.** Delta-only.
- **Don't escalate role mid-workflow without user consent.** Even if `may_self_promote: true`, ask first.
