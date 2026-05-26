#!/usr/bin/env node
// PNPAI post-tool-use journal.
//
// Appends a line to .claude/journal/<date>.log for every tool call that
// touches the outside world (MCP calls, git push, git commit, Bash). This
// is the audit trail.
//
// Always exits 0 — journaling failures must not interfere with the user's
// work.

import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  activeRole,
  findRepoRoot,
  parseEnvelope,
  readStdin,
  toolNameFrom,
} from './_lib.mjs';

try {
  const repoRoot = findRepoRoot();
  const journalDir = join(repoRoot, '.claude', 'journal');

  if (!existsSync(journalDir)) {
    process.exit(0);
  }

  const raw = await readStdin();
  const envelope = parseEnvelope(raw);
  const toolName = toolNameFrom(envelope) || 'unknown';

  // Only journal outside-world actions. Internal Read/Glob/Grep/Edit produce
  // too much noise.
  const outsideWorld =
    toolName.startsWith('mcp__') ||
    toolName === 'Bash' ||
    /git.*push/i.test(toolName) ||
    /git.*commit/i.test(toolName);

  if (!outsideWorld) {
    process.exit(0);
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const role = activeRole(repoRoot) || 'unknown';
  const sessionId = process.env.CLAUDE_SESSION_ID || String(process.pid);

  const line = `${timestamp}  session=${sessionId}  role=${role}  tool=${toolName}\n`;
  appendFileSync(join(journalDir, `${date}.log`), line);
} catch {
  // Journaling must never break the user's session.
}

process.exit(0);
