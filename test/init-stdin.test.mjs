// Regression test: `pnpai init` must read all piped answers when stdin is
// non-TTY. Original bug: readline.question() only listened for the next
// 'line' event, so all buffered piped lines fired in rapid succession but
// only the first had a listener; remaining lines were silently dropped and
// the second question hung forever (exit 13, unsettled top-level await).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'bin/pnpai.mjs');

function runInit(workdir, answers, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'init'], {
      cwd: workdir,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`init timed out after ${timeoutMs}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.stdin.end(answers);
  });
}

test('init reads every piped answer when stdin is non-TTY', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pnpai-init-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    const answers = [
      'pnpai-role-trainee',
      'pnpai-platform-github',
      'pnpai-verification-node',
      'y',
      '',
    ].join('\n');
    const { code, stdout, stderr } = await runInit(tmp, answers);
    assert.equal(code, 0,
      `init should exit 0 on piped input; got ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`);

    const roleYaml = join(tmp, '.claude/config/role.yaml');
    const platformYaml = join(tmp, '.claude/config/platform.yaml');
    const recipe = join(tmp, '.claude/pnpai-install.json');
    assert.ok(existsSync(roleYaml), 'role.yaml should be written');
    assert.ok(existsSync(platformYaml), 'platform.yaml should be written');
    assert.ok(existsSync(recipe), 'pnpai-install.json should be written');

    assert.match(readFileSync(roleYaml, 'utf8'), /active:\s*trainee/);
    assert.match(readFileSync(platformYaml, 'utf8'), /active:\s*github/);

    const parsed = JSON.parse(readFileSync(recipe, 'utf8'));
    assert.equal(parsed.choices.role, 'pnpai-role-trainee');
    assert.equal(parsed.choices.platform, 'pnpai-platform-github');
    assert.equal(parsed.choices.verification, 'pnpai-verification-node');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('init accepts numeric answers via piped stdin', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pnpai-init-num-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    const answers = ['1', '2', '1', 'y', ''].join('\n');
    const { code, stdout, stderr } = await runInit(tmp, answers);
    assert.equal(code, 0,
      `init should exit 0 on numeric piped input; got ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    const role = readFileSync(join(tmp, '.claude/config/role.yaml'), 'utf8');
    assert.match(role, /active:\s*trainee/);
    const platform = readFileSync(join(tmp, '.claude/config/platform.yaml'), 'utf8');
    assert.match(platform, /active:\s*azure-devops/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
