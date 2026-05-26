// Smoke tests for PNPAI structure.
// Uses Node's built-in test runner — no dependencies.
// Run with: npm test

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_PLUGINS = [
  'pnpai-core',
  'pnpai-role-trainee',
  'pnpai-role-senior',
  'pnpai-platform-github',
  'pnpai-platform-azure-devops',
  'pnpai-verification-node',
  'pnpai-verification-python',
];

// ─── Marketplace ─────────────────────────────────────────────────────────

test('marketplace.json is valid JSON and lists the expected plugins', () => {
  const mp = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(mp.name, 'pnpai');
  assert.ok(mp.owner.name);
  assert.ok(Array.isArray(mp.plugins));
  const listed = mp.plugins.map((p) => p.name).sort();
  assert.deepEqual(listed, [...EXPECTED_PLUGINS].sort());
});

test('every plugin in marketplace.json has a folder; every folder is listed', () => {
  const mp = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
  const listed = new Set(mp.plugins.map((p) => p.name));
  const folders = readdirSync(join(ROOT, 'plugins')).filter((f) => !f.startsWith('.'));
  for (const plugin of mp.plugins) {
    assert.ok(existsSync(join(ROOT, 'plugins', plugin.name)),
      `plugins/${plugin.name} should exist`);
  }
  for (const folder of folders) {
    assert.ok(listed.has(folder),
      `plugins/${folder} should be listed in marketplace.json`);
  }
});

// ─── Plugin manifests ────────────────────────────────────────────────────

test('every plugin has a valid plugin.json with required fields', () => {
  for (const folder of EXPECTED_PLUGINS) {
    const manifest = join(ROOT, 'plugins', folder, '.claude-plugin/plugin.json');
    assert.ok(existsSync(manifest), `${folder}: plugin.json must exist`);
    const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
    assert.equal(parsed.name, folder, `${folder}: name must match folder`);
    assert.ok(parsed.version, `${folder}: needs version`);
    assert.ok(parsed.description, `${folder}: needs description`);
    assert.ok(parsed.author?.name, `${folder}: needs author.name`);
    assert.equal(parsed.pnpai_metadata?.ai_authored, true,
      `${folder}: must declare ai_authored: true`);
    assert.ok(Array.isArray(parsed.pnpai_metadata?.claude_code_features),
      `${folder}: claude_code_features must be array`);
    assert.ok(parsed.pnpai_metadata?.portability,
      `${folder}: portability must be set`);
  }
});

test('every plugin folder name is kebab-case', () => {
  for (const folder of EXPECTED_PLUGINS) {
    assert.match(folder, /^[a-z][a-z0-9-]*[a-z0-9]$/,
      `${folder}: must be kebab-case`);
  }
});

// ─── pnpai-core ──────────────────────────────────────────────────────────

test('pnpai-core ships the expected components', () => {
  const core = join(ROOT, 'plugins/pnpai-core');
  assert.ok(existsSync(join(core, 'skills/feature-workflow/SKILL.md')));
  for (const agent of ['researcher', 'explorer', 'verifier']) {
    assert.ok(existsSync(join(core, 'agents', `${agent}.md`)),
      `pnpai-core should ship the ${agent} subagent`);
  }
  assert.ok(existsSync(join(core, 'hooks/pre-tool-use.mjs')));
  assert.ok(existsSync(join(core, 'hooks/post-tool-use.mjs')));
  assert.ok(existsSync(join(core, 'hooks/_lib.mjs')));
  assert.ok(existsSync(join(core, 'commands/pnpai.md')));
});

test('hook scripts parse as valid Node modules', () => {
  const hookDir = join(ROOT, 'plugins/pnpai-core/hooks');
  for (const file of readdirSync(hookDir)) {
    if (!file.endsWith('.mjs')) continue;
    execSync(`node --check "${join(hookDir, file)}"`);
  }
});

test('pnpai-core declares PreToolUse and PostToolUse hooks invoked via node', () => {
  const manifest = JSON.parse(readFileSync(
    join(ROOT, 'plugins/pnpai-core/.claude-plugin/plugin.json'), 'utf8'));
  assert.ok(manifest.hooks?.PreToolUse, 'must declare PreToolUse hooks');
  assert.ok(manifest.hooks?.PostToolUse, 'must declare PostToolUse hooks');
  const commands = [
    ...manifest.hooks.PreToolUse.flatMap((m) => m.hooks).map((h) => h.command),
    ...manifest.hooks.PostToolUse.flatMap((m) => m.hooks).map((h) => h.command),
  ];
  assert.ok(commands.length >= 2, 'at least one hook per event must be declared');
  for (const cmd of commands) {
    assert.match(cmd, /^node\b/,
      `hook command must start with 'node' for cross-platform: ${cmd}`);
    assert.ok(cmd.endsWith('.mjs"'), `hook command must target an .mjs file: ${cmd}`);
  }
});

// ─── Role and platform profiles ──────────────────────────────────────────

test('every role plugin ships a valid data/role.yaml', () => {
  for (const role of ['trainee', 'senior']) {
    const path = join(ROOT, `plugins/pnpai-role-${role}/data/role.yaml`);
    assert.ok(existsSync(path));
    const content = readFileSync(path, 'utf8');
    assert.ok(content.includes(`name: ${role}`), `${path}: needs name`);
    assert.ok(content.includes('capabilities:'), `${path}: needs capabilities`);
    assert.ok(content.includes('forbidden:'), `${path}: needs forbidden list`);
  }
});

test('every platform plugin ships a valid data/platform.yaml', () => {
  for (const p of ['github', 'azure-devops']) {
    const path = join(ROOT, `plugins/pnpai-platform-${p}/data/platform.yaml`);
    assert.ok(existsSync(path));
    const content = readFileSync(path, 'utf8');
    assert.ok(content.includes('operations:'), `${path}: needs operations map`);
  }
});

// ─── CLI ─────────────────────────────────────────────────────────────────

test('CLI parses and version subcommand matches package.json', () => {
  const bin = join(ROOT, 'bin/pnpai.mjs');
  assert.ok(existsSync(bin));
  execSync(`node --check "${bin}"`);
  const out = execSync(`node "${bin}" version`, { encoding: 'utf8' });
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(out.trim(), `pnpai ${pkg.version}`);
});

test('CLI help subcommand works', () => {
  const out = execSync(`node "${join(ROOT, 'bin/pnpai.mjs')}" help`, { encoding: 'utf8' });
  assert.match(out, /Usage:/);
  assert.match(out, /pnpai switch role/);
});

test('package.json declares bin entry and correct name', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'pnpai');
  assert.ok(pkg.bin?.pnpai, 'package.json must declare bin.pnpai');
});

// ─── AI-origin invariants ────────────────────────────────────────────────

test('DISCLAIMER.md exists and mentions AI origin', () => {
  const content = readFileSync(join(ROOT, 'DISCLAIMER.md'), 'utf8');
  assert.ok(/AI/i.test(content));
  assert.ok(content.length > 1000);
});

test('README links to DISCLAIMER and surfaces AI-built status', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.ok(readme.includes('DISCLAIMER.md'));
  assert.ok(/AI-built/i.test(readme));
});

test('LICENSE contains MIT and AI-origin notice', () => {
  const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  assert.ok(license.includes('MIT License'));
  assert.ok(license.includes('ORIGIN NOTICE'));
});

test('package.json has ai-built keyword', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.keywords.includes('ai-built'));
});
