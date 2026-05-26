#!/usr/bin/env node
/**
 * pnpai — PNPAIDevelopmentAgency installer
 *
 * Subcommands:
 *   pnpai init                       Interactive picker (default)
 *   pnpai add <plugin>               Print commands to add a specific plugin
 *   pnpai doctor                     Check install health
 *   pnpai switch role <name>         Set active role
 *   pnpai switch platform <name>     Set active platform
 *   pnpai version                    Print version
 *
 * Zero runtime dependencies. Node 20+ required.
 * MIT licensed. https://github.com/abdulrazzaqdevelopment/pnpai
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
const VERSION = PKG.version;
const MARKETPLACE_REF = 'abdulrazzaqdevelopment/pnpai';
const ON_WINDOWS = process.platform === 'win32';

// Plugin catalog — mirrors .claude-plugin/marketplace.json.
const CATALOG = {
  core: {
    'pnpai-core': 'Orchestration skill, 3 subagents, hooks. Required.',
  },
  roles: {
    'pnpai-role-trainee': 'Junior — opens PRs, cannot merge.',
    'pnpai-role-senior': 'Full contributor — can merge.',
  },
  platforms: {
    'pnpai-platform-github': 'GitHub Issues + PRs.',
    'pnpai-platform-azure-devops': 'Azure DevOps Boards + Repos.',
  },
  verification: {
    'pnpai-verification-node': 'Node / TypeScript.',
    'pnpai-verification-python': 'Python.',
  },
};

const ALL_PLUGINS = Object.values(CATALOG).flatMap((g) => Object.keys(g));
const ROLE_NAMES = Object.keys(CATALOG.roles).map((p) => p.replace(/^pnpai-role-/, ''));
const PLATFORM_NAMES = Object.keys(CATALOG.platforms).map((p) => p.replace(/^pnpai-platform-/, ''));

// ANSI styling (no chalk dep).
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const sty = (s, ...styles) => styles.join('') + s + c.reset;
const banner = () => {
  console.log('');
  console.log(sty('  PNPAI', c.bold, c.cyan) + sty(`  v${VERSION}`, c.dim));
  console.log(sty('  Plug-and-play AI development workflow', c.dim));
  console.log('');
};

function detectRepo() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8', windowsHide: true,
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

function detectPlatform(repoRoot) {
  if (existsSync(join(repoRoot, '.azuredevops'))) return 'pnpai-platform-azure-devops';
  if (existsSync(join(repoRoot, '.github/workflows'))) return 'pnpai-platform-github';
  return null;
}

function detectEcosystem(repoRoot) {
  if (existsSync(join(repoRoot, 'package.json'))) return 'pnpai-verification-node';
  if (existsSync(join(repoRoot, 'pyproject.toml'))) return 'pnpai-verification-python';
  if (existsSync(join(repoRoot, 'requirements.txt'))) return 'pnpai-verification-python';
  return null;
}

function detectClaudeCode() {
  // On Windows, npm-installed CLIs are .cmd wrappers — need shell: true.
  const r = spawnSync('claude', ['--version'], {
    encoding: 'utf8', shell: ON_WINDOWS, windowsHide: true,
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

async function pickOne(rl, question, options) {
  console.log('');
  console.log(sty(question, c.bold));
  const entries = Object.entries(options);
  entries.forEach(([key, desc], i) => {
    console.log(`  ${sty(`[${i + 1}]`, c.cyan)} ${sty(key, c.bold)}  ${sty(desc, c.dim)}`);
  });
  while (true) {
    const a = (await rl.question(sty('  → ', c.cyan))).trim();
    const idx = parseInt(a, 10);
    if (idx >= 1 && idx <= entries.length) return entries[idx - 1][0];
    if (entries.find(([k]) => k === a)) return a;
    console.log(sty(`  Enter 1-${entries.length} or the exact name.`, c.yellow));
  }
}

async function confirm(rl, question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const a = (await rl.question(`${question} ${sty(`[${hint}]`, c.dim)} `)).trim().toLowerCase();
  if (a === '') return defaultYes;
  return a.startsWith('y');
}

function writeRecipe(repoRoot, plugins, choices) {
  const dir = join(repoRoot, '.claude');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'pnpai-install.json');
  writeFileSync(path, JSON.stringify({
    pnpai_version: VERSION,
    installed_at: new Date().toISOString(),
    marketplace: MARKETPLACE_REF,
    plugins, choices,
  }, null, 2) + '\n');
  return path;
}

function writeBootstrapConfig(repoRoot, choices) {
  const dir = join(repoRoot, '.claude/config');
  mkdirSync(dir, { recursive: true });
  const role = choices.role.replace(/^pnpai-role-/, '');
  const platform = choices.platform.replace(/^pnpai-platform-/, '');
  writeFileSync(join(dir, 'role.yaml'),
    `# managed by PNPAI — switch with: pnpai switch role <name>\n` +
    `active: ${role}\n` +
    `overrides: {}\n`);
  writeFileSync(join(dir, 'platform.yaml'),
    `# managed by PNPAI — switch with: pnpai switch platform <name>\n` +
    `active: ${platform}\n` +
    `project: <set-me>\n` +
    `repository: <set-me>\n` +
    `default_base_branch: main\n`);
  return [join(dir, 'role.yaml'), join(dir, 'platform.yaml')];
}

// ─── Subcommands ─────────────────────────────────────────────────────────

async function cmdInit() {
  banner();
  const repoRoot = detectRepo();
  if (!repoRoot) {
    console.error(sty('  Not inside a git repository. Run `git init` first.', c.red));
    process.exit(1);
  }
  console.log(sty('  Repository: ', c.dim) + repoRoot);
  const claude = detectClaudeCode();
  console.log(sty('  Claude Code:', c.dim) + (claude ? ' ' + claude : sty(' not on PATH', c.yellow)));
  const detectedPlatform = detectPlatform(repoRoot);
  const detectedEcosystem = detectEcosystem(repoRoot);
  if (detectedPlatform) console.log(sty(`  Detected:   `, c.dim) + sty(detectedPlatform, c.green));
  if (detectedEcosystem) console.log(sty(`  Ecosystem:  `, c.dim) + sty(detectedEcosystem, c.green));

  const rl = createInterface({ input, output });
  try {
    const role = await pickOne(rl, 'Which role?', CATALOG.roles);
    const platform = await pickOne(rl, 'Where does the work live?', CATALOG.platforms);
    const verification = await pickOne(rl, 'Which verification preset?', CATALOG.verification);
    const plugins = ['pnpai-core', role, platform, verification];

    console.log('');
    console.log(sty('  Plan:', c.bold));
    plugins.forEach((p) => console.log(`    ${sty('+', c.green)} ${p}`));
    console.log('');
    if (!(await confirm(rl, '  Proceed?', true))) {
      console.log(sty('  Aborted.', c.yellow));
      return;
    }

    const cfg = writeBootstrapConfig(repoRoot, { role, platform, verification });
    const recipe = writeRecipe(repoRoot, plugins, { role, platform, verification });

    console.log('');
    console.log(sty('  Wrote:', c.bold));
    cfg.forEach((f) => console.log(`    ${sty('•', c.dim)} ${f}`));
    console.log(`    ${sty('•', c.dim)} ${recipe}`);
    console.log('');
    console.log(sty('  Run in Claude Code:', c.bold));
    console.log(`    ${sty(`/plugin marketplace add ${MARKETPLACE_REF}`, c.cyan)}`);
    plugins.forEach((p) => console.log(`    ${sty(`/plugin install ${p}`, c.cyan)}`));
    console.log('');
    console.log(sty('  Then: > Start the workflow for <work-item-id>', c.green));
    console.log('');
  } finally {
    rl.close();
  }
}

function cmdAdd(name) {
  banner();
  if (!ALL_PLUGINS.includes(name)) {
    console.error(sty(`  Unknown plugin: ${name}`, c.red));
    console.error('');
    console.error(sty('  Available:', c.dim));
    for (const [group, plugins] of Object.entries(CATALOG)) {
      console.error(sty(`    ${group}:`, c.bold));
      for (const [k, v] of Object.entries(plugins)) {
        console.error(`      ${sty(k, c.cyan)} — ${sty(v, c.dim)}`);
      }
    }
    process.exit(1);
  }
  console.log(sty('  Run in Claude Code:', c.bold));
  console.log(`    ${sty(`/plugin marketplace add ${MARKETPLACE_REF}`, c.cyan)}`);
  console.log(`    ${sty(`/plugin install ${name}`, c.cyan)}`);
}

function cmdDoctor() {
  banner();
  const repoRoot = detectRepo();
  let problems = 0;
  const check = (label, ok, hint = '') => {
    console.log(`  ${ok ? sty('✓', c.green) : sty('✗', c.red)} ${label}` +
      (ok ? '' : sty(`\n     ${hint}`, c.dim)));
    if (!ok) problems++;
  };

  check('Inside a git repository', !!repoRoot, 'Run `git init`.');
  if (!repoRoot) { console.log(''); process.exit(1); }

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  check(`Node ${process.versions.node} (>= 20 required)`, nodeMajor >= 20,
    'Upgrade Node to 20+: https://nodejs.org/');
  check('Claude Code on PATH', !!detectClaudeCode(),
    'Install: https://code.claude.com/docs/install');

  const files = {
    '.claude/config/role.yaml': join(repoRoot, '.claude/config/role.yaml'),
    '.claude/config/platform.yaml': join(repoRoot, '.claude/config/platform.yaml'),
    '.claude/pnpai-install.json': join(repoRoot, '.claude/pnpai-install.json'),
  };
  for (const [label, path] of Object.entries(files)) {
    check(`${label} exists`, existsSync(path), 'Run `pnpai init`.');
  }

  if (existsSync(files['.claude/pnpai-install.json'])) {
    try {
      const r = JSON.parse(readFileSync(files['.claude/pnpai-install.json'], 'utf8'));
      check(`Recipe version matches CLI (${r.pnpai_version} vs ${VERSION})`,
        r.pnpai_version === VERSION, 'Re-run `pnpai init` to refresh.');
    } catch (e) {
      check('Recipe file is valid JSON', false, e.message);
    }
  }

  console.log('');
  if (problems === 0) console.log(sty('  All checks passed.', c.green));
  else {
    console.log(sty(`  ${problems} problem${problems === 1 ? '' : 's'} found.`, c.yellow));
    process.exit(1);
  }
}

function cmdSwitch(kind, value) {
  if (!kind || !value || (kind !== 'role' && kind !== 'platform')) {
    console.error('Usage: pnpai switch <role|platform> <name>');
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    console.error(`Invalid name '${value}'. Must be lowercase kebab-case.`);
    process.exit(1);
  }
  const known = kind === 'role' ? ROLE_NAMES : PLATFORM_NAMES;
  if (!known.includes(value)) {
    console.error(`Unknown ${kind}: '${value}'. Available: ${known.join(', ')}`);
    process.exit(1);
  }
  const repoRoot = detectRepo();
  if (!repoRoot) {
    console.error('Not inside a git repo.');
    process.exit(1);
  }
  const yamlPath = join(repoRoot, '.claude/config', `${kind}.yaml`);
  if (!existsSync(yamlPath)) {
    console.error(`No ${yamlPath}. Run \`pnpai init\` first.`);
    process.exit(1);
  }
  const original = readFileSync(yamlPath, 'utf8');
  const updated = /^active:/m.test(original)
    ? original.replace(/^active:.*$/m, `active: ${value}`)
    : `active: ${value}\n${original}`;
  writeFileSync(yamlPath, updated);
  console.log(sty(`✓ ${kind} → ${value}`, c.green));
  console.log(sty(`  ${yamlPath}`, c.dim));
}

// ─── Dispatch ────────────────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;
const sub = cmd || 'init';

try {
  switch (sub) {
    case 'init': await cmdInit(); break;
    case 'add': cmdAdd(rest[0]); break;
    case 'doctor': cmdDoctor(); break;
    case 'switch': cmdSwitch(rest[0], rest[1]); break;
    case 'version': case '-v': case '--version':
      console.log(`pnpai ${VERSION}`); break;
    case 'help': case '-h': case '--help':
      console.log(`Usage:
  pnpai init                       Interactive picker (default)
  pnpai add <plugin>               Print commands to add a specific plugin
  pnpai doctor                     Check install health
  pnpai switch role <name>         Set active role
  pnpai switch platform <name>     Set active platform
  pnpai version                    Print version
`); break;
    default:
      console.error(sty(`Unknown command: ${sub}`, c.red));
      console.error('Run `pnpai help` for usage.');
      process.exit(1);
  }
} catch (err) {
  console.error(sty(`\n  Error: ${err.message}`, c.red));
  if (process.env.PNPAI_DEBUG) console.error(err.stack);
  process.exit(1);
}
