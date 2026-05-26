---
description: Show PNPAI status — active role, active platform, installed plugins, recent journal entries
argument-hint: [status|role|platform|journal]
---

# /pnpai — PNPAI status and control

Quick command to inspect or control the active PNPAI configuration. Subcommands:

## Steps

If no argument or `status`:
1. Read `.claude/config/role.yaml` — show active role.
2. Read `.claude/config/platform.yaml` — show active platform.
3. Read `.claude/pnpai-install.json` — show installed plugins.
4. Tail the last 10 lines of today's `.claude/journal/<date>.log`.

If `role`:
- Print the active role's full profile (capabilities, mandatory phases, forbidden list).
- Suggest `pnpai switch role <role>` to switch.

If `platform`:
- Print the active adapter's `operations:` map and constraints.
- Note any MCP servers the adapter expects but aren't in `.mcp.json`.

If `journal [N]`:
- Tail the last N (default 25) lines of today's journal.
- Group by session.

If `doctor`:
- Run the same checks as `npx pnpai doctor`. Report problems with fix suggestions.

## Output

Format as a concise status table. Don't repeat what's already visible to the user in their workspace.
