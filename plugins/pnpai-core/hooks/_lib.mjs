// Shared utilities for PNPAI hooks.
//
// Pure Node ESM. No external dependencies. Cross-platform.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function findRepoRoot() {
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (probe.status === 0) return probe.stdout.trim();
  return process.cwd();
}

export async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Minimal YAML extractors. Hooks need two things from YAML: a top-level
// scalar (e.g. `active: trainee`) and a top-level block list (e.g.
// `forbidden:\n  - "..."`). A real YAML parser would be a dependency we
// don't want; this regex pair handles the constrained schema role and
// platform profiles use.
//
// Quote handling: supports unquoted, 'single', and "double" scalars.
// Returns null on absence or all-whitespace value (fail-closed signal).

export function readScalar(yamlText, key) {
  const re = new RegExp(
    `^${key}:\\s*(?:"([^"\\n]*)"|'([^'\\n]*)'|([^'"\\n#]+?))\\s*(?:#.*)?$`,
    'm',
  );
  const m = yamlText.match(re);
  if (!m) return null;
  const value = (m[1] ?? m[2] ?? m[3] ?? '').trim();
  return value === '' ? null : value;
}

export function readListBlock(yamlText, key) {
  const re = new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-.*\\n?)+)`, 'm');
  const m = yamlText.match(re);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((line) => line.match(/^\s+-\s*['"]?(.*?)['"]?\s*(?:#.*)?$/))
    .filter((x) => x)
    .map((x) => x[1].trim())
    .filter((v) => v && !v.startsWith('#'));
}

export function roleConfigPath(repoRoot) {
  return join(repoRoot, '.claude', 'config', 'role.yaml');
}

export function hasRoleConfig(repoRoot) {
  return existsSync(roleConfigPath(repoRoot));
}

export function activeRole(repoRoot) {
  const path = roleConfigPath(repoRoot);
  if (!existsSync(path)) return null;
  return readScalar(readFileSync(path, 'utf8'), 'active');
}

export function roleProfilePath(repoRoot, role) {
  return join(repoRoot, '.claude', 'config', 'roles', `${role}.yaml`);
}

export function forbiddenPatterns(repoRoot, role) {
  const path = roleProfilePath(repoRoot, role);
  if (!existsSync(path)) return null;
  return readListBlock(readFileSync(path, 'utf8'), 'forbidden');
}

export function parseEnvelope(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function toolNameFrom(envelope) {
  return envelope.tool_name || envelope.toolName || '';
}

// Role names must be safe filesystem identifiers. Used to refuse path
// traversal via crafted `active:` values.
export function isValidRoleName(name) {
  return typeof name === 'string' && /^[a-z][a-z0-9-]*$/.test(name);
}
