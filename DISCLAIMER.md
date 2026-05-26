# Disclaimer

## How this project was made

**Every line of this repository was produced by AI through user prompting.** That includes the architecture, the skill definitions, the subagent specifications, the platform adapters, the shell hooks, the Node CLI, the documentation, the tests, the issue templates, this disclaimer itself, and everything else.

There was no human contributor in the traditional sense. A human directed the work through a series of prompts; the AI researched, designed, wrote, and validated the output. No line was hand-written by a domain expert reviewing each commit. The project's first end-to-end audit, if it ever happens, will be when you read it.

This is not unusual for new AI-era projects, but we believe being explicit about it matters more than the convention of pretending otherwise. You should know what you're installing.

## What that means for you

Three categories of risk are higher than in a typical OSS project:

### 1. Subtle bugs in edge cases

The AI built and tested the system against the scenarios it was prompted to consider. Edge cases not in the prompt are likely not covered. Specifically:

- **YAML parsing in hooks** uses a minimal in-Node regex extractor sufficient for the simple key/list shapes role and platform profiles use. Profiles with unusual quoting, multi-line strings, or unusual indentation could parse incorrectly. Stick to the schema in the existing profiles.
- **Platform adapters** were written from published MCP tool documentation. If your specific MCP server uses different tool names (the Bitbucket ecosystem in particular has several competing implementations), you will need to adjust the operations maps.
- **Error handling** in the CLI is best-effort. Unusual filesystem states, locked files, or partially-completed installs may produce confusing output. `npx pnpai doctor` is the recommended next step when anything looks off.

### 2. Self-consistency without external validation

The smoke tests verify internal consistency: that every plugin in the marketplace has a folder, that every YAML parses, that hooks have valid bash syntax, etc. They do **not** verify that the system *does what it claims to do* against a real Claude Code session connected to a real MCP server.

The specification is internally consistent, but it has not been validated against a real Claude Code session connected to a real MCP server. Behaviors observed in real use may differ in details we didn't anticipate.

### 3. Security claims are best-effort

The [`docs/SECURITY.md`](docs/SECURITY.md) threat model is what the AI considered. It is unlikely to be complete. In particular:

- The pre-tool-use hook's pattern matching is substring-based. Sophisticated prompt injection that doesn't use the exact forbidden patterns will pass the hook. Treat the hook as a *coarse* guardrail.
- The hook can be bypassed by an agent that has `Edit` access to `.claude/hooks/`. Mitigations are listed in SECURITY.md, but they are not bulletproof.
- We did not perform a formal security audit. We did not run static analysis on the shell scripts. We did not fuzz the YAML parsing.

If your use case is security-critical (handling production credentials, regulated data, etc.), do not adopt this project without an independent security review.

## What we did do

To set realistic expectations:

- The full plugin manifest schema is followed.
- All 13 YAML configs parse with PyYAML.
- All 16 JSON files parse.
- Both hooks pass `bash -n` syntax check.
- The CLI script passes `node --check`.
- 15 smoke tests pass, covering marketplace ↔ folder consistency, manifest validity, file existence, kebab-case naming, hook executability, and CLI subcommand behavior.
- Cross-references between docs were verified during writing.
- Plugin manifests use the schema from the unofficial-but-well-maintained `claude-code-json-schema` project.
- Research was done against published documentation as of May 2026 for Claude Code's plugin system, marketplace format, subagent model, and hook contracts.

## What you should do before adopting

1. **Read the code.** Particularly `bin/pnpai.mjs`, the two hook scripts in `plugins/pnpai-core/hooks/`, and the orchestration skill at `plugins/pnpai-core/skills/feature-workflow/SKILL.md`. These are the parts that execute or directly steer behavior.
2. **Run `npx pnpai doctor`** before your first real workflow. It catches the common setup problems.
3. **Pin plugin versions** in `.claude/pnpai-install.json`. Upgrades should be deliberate, not automatic. Read the changelog before bumping.
4. **Start with the Trainee role.** It has the most guardrails. Promote to Senior or Solo only after you've seen the workflow run a few times against work you don't mind losing.
5. **Inspect `.claude/journal/`** after your first few sessions. The audit trail is the easiest way to see what the system actually did vs. what it claimed.
6. **Treat hooks as part of your code review process.** If a PR modifies `.claude/hooks/*.mjs`, review it the same way you'd review a CI script — it runs on every tool call.

## What we ask of you

If you use PNPAI and find a problem, **report it**. The point of releasing this as an OSS project — rather than treating it as a private experiment — is that more eyes find more bugs. An issue with a reproduction is more valuable than a private workaround.

If you fix something, **PR it**. The AI built v1; humans (and other AIs) can make v2 better.

If you adopt it in something that matters, **read it first**. We've tried to make that easier by keeping the codebase small (~700 lines of code, ~3000 lines of docs) and the architecture explicit, but you still have to read it.

## On the use of AI for the project's ongoing work

PNPAI is designed to be operated on by AI agents. The maintainers expect that most future improvements will also be made by humans collaborating with AI, not by humans alone. This is not a limitation; it's the explicit model.

What this means in practice:

- AI-generated PRs are welcome, with the standard expectations: they must pass CI, they must be reviewable, the submitter (human or otherwise) is accountable for what's submitted.
- Issues reported by AI agents observing problems in their own use are welcome and useful.
- Documentation contributions — especially clarifications, corrections, and worked examples — are some of the highest-leverage AI-friendly contributions.
- We do not require AI-generated contributions to be flagged as such; we don't think the distinction is useful at the granularity of a PR. We do require all contributions to follow the same standards.

## On the limitations of AI building its own tools

A final honest note: there is a recursive quality to "AI building tools for AI to use." It is genuinely useful — the AI knows what shape an AI-friendly tool needs to have. It is also genuinely risky — the AI is the worst auditor of its own blindspots, because they are by definition things it did not think to check.

We have tried to mitigate this by:

- Writing the architecture document and worked example with the goal of being legible to a *human* reviewer, even though the construction was AI-led.
- Keeping the surface area small. Fewer features means fewer places for blindspots to hide.
- Making everything inspectable. No compiled binaries, no obfuscated config. Plain markdown, plain YAML, plain JSON, plain bash, plain JavaScript.
- Encouraging skeptical adoption. Start with the Trainee role; read the journal; pin versions.

If you adopt PNPAI, you are part of the audit. Welcome.

---

*This disclaimer is itself AI-written. Including this notice. The recursion goes all the way down. Read accordingly.*
