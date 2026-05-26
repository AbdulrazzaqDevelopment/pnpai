#!/usr/bin/env node
// PNPAI pre-tool-use guardrail.
//
// Blocks any tool call whose JSON payload contains a forbidden pattern
// (case-insensitive substring) from the active role's profile.
//
// Exit codes (Claude Code hooks contract):
//   0 — allow
//   2 — block (stderr is shown to the model and user)
//   1 — internal hook error

import {
  activeRole,
  findRepoRoot,
  forbiddenPatterns,
  hasRoleConfig,
  isValidRoleName,
  parseEnvelope,
  readStdin,
  roleConfigPath,
  roleProfilePath,
} from './_lib.mjs';

const repoRoot = findRepoRoot();

// If PNPAI isn't installed in this repo, allow everything. Generic
// infrastructure must not break unrelated repos.
if (!hasRoleConfig(repoRoot)) {
  process.exit(0);
}

const role = activeRole(repoRoot);

// Config file exists but no valid active role — fail closed.
if (role === null) {
  process.stderr.write(
    `PNPAI pre-tool-use: ${roleConfigPath(repoRoot)} exists but has no valid 'active:' role.\n` +
      `  Set one with: pnpai switch role <name>\n`,
  );
  process.exit(1);
}

if (!isValidRoleName(role)) {
  process.stderr.write(
    `PNPAI pre-tool-use: invalid active role '${role}'.\n` +
      `  Role names must be lowercase kebab-case. Run \`pnpai doctor\`.\n`,
  );
  process.exit(1);
}

const raw = await readStdin();
parseEnvelope(raw); // validate JSON (we substring-match on raw)
const patterns = forbiddenPatterns(repoRoot, role);

if (patterns === null) {
  process.stderr.write(
    `PNPAI pre-tool-use: active role '${role}' has no profile file at ${roleProfilePath(
      repoRoot,
      role,
    )}.\n  Run \`pnpai doctor\`.\n`,
  );
  process.exit(1);
}

if (patterns.length === 0) {
  process.exit(0);
}

const haystack = raw.toLowerCase();

for (const pattern of patterns) {
  if (!pattern || pattern.startsWith('#')) continue;
  if (haystack.includes(pattern.toLowerCase())) {
    const bar = '═'.repeat(67);
    process.stderr.write(
      `\n${bar}\n PNPAI — Action BLOCKED by role '${role}'\n${bar}\n` +
        ` Forbidden pattern matched: ${pattern}\n\n` +
        ` Switch role with: pnpai switch role <name>\n` +
        ` Profile: ${roleProfilePath(repoRoot, role)}\n${bar}\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
