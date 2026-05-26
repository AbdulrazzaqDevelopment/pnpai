<!--
Thanks for contributing to PNPAI. Use this template; sections that don't apply can be deleted.
-->

## What this changes

<!-- One paragraph. What's different after this PR. -->

## Why

<!-- The problem this solves or the capability it adds. Link any related Issue or Discussion. -->

Closes #<!-- issue number -->

## Type of change

- [ ] New role profile (`pnpai-role-*`)
- [ ] New platform adapter (`pnpai-platform-*`)
- [ ] New verification preset (`pnpai-verification-*`)
- [ ] New subagent
- [ ] Bug fix
- [ ] Documentation
- [ ] Refactor (no behavior change)
- [ ] Other: <!-- describe -->

## Checklist

- [ ] Plugin manifest validates (`node -e "JSON.parse(require('fs').readFileSync('plugins/<name>/.claude-plugin/plugin.json'))"`)
- [ ] If adding a plugin, it's listed in `.claude-plugin/marketplace.json`
- [ ] If adding a plugin, it's referenced in `README.md`'s plugin table
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] CI is green
- [ ] I've tested this against a real Claude Code session (not just static validation)

## Scope deviations

<!-- If this PR does something differently from what the Issue / Discussion proposed, note that here. -->

- None

## Testing notes

<!-- How a reviewer can verify your change works. -->
