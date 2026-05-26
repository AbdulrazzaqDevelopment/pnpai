# Changelog

All notable changes to PNPAI are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [1.0.0] — 2026-05-25

Initial release.

### Included

**Core**
- `pnpai-core` — orchestration skill (`feature-workflow`), three subagents (Researcher, Explorer, Verifier), pre/post-tool-use hooks (pure Node.js, cross-platform), `/pnpai` slash command.

**Role profiles**
- `pnpai-role-trainee` — junior contributor; hook-enforced no-merge, no force-push, no writes to base branches.
- `pnpai-role-senior` — full contributor; can merge. Verifier still mandatory.

**Platform adapters**
- `pnpai-platform-github` — GitHub Issues + PRs.
- `pnpai-platform-azure-devops` — Azure DevOps Boards + Repos.

**Verification presets**
- `pnpai-verification-node` — Node / TypeScript.
- `pnpai-verification-python` — Python.

**CLI**
- `npx pnpai init` — interactive picker with platform/ecosystem auto-detect.
- `npx pnpai add <plugin>` — print install commands for one plugin.
- `npx pnpai doctor` — health check.
- `npx pnpai switch role <name>` / `npx pnpai switch platform <name>` — cross-platform config switching.
- `npx pnpai version` / `help`.

**Tests + CI**
- 16 smoke tests covering marketplace integrity, plugin manifest validity, hook syntax, role/platform schema, and AI-origin invariants.
- CI matrix across Linux, macOS, and Windows × Node 20, 22. Hook-enforcement tests run in CI.

**Documentation**
- `README.md` — install, plugins, CLI reference.
- `docs/ARCHITECTURE.md` — phase model, subagents, hooks, config files.
- `docs/SECURITY.md` — threat model and known limits.
- `DISCLAIMER.md` — AI-origin statement.

**AI-origin attestation**
- AI-origin banner in `README.md`. AI-origin notice appended to `LICENSE`. `pnpai_metadata.ai_authored: true` on every plugin manifest.

### Cross-platform

Runs on Linux, macOS, and Windows. Hooks are pure Node.js with no shell, `yq`, `jq`, or other external tool dependencies. `.gitattributes` enforces LF line endings.

[1.0.0]: https://github.com/abdulrazzaqdevelopment/pnpai/releases/tag/v1.0.0
