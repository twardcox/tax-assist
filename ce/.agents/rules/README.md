# Coherence Engine Framework Rules (Cross-Tool)

**Planning client:** rules live under `ce/.claude/rules/` - **Dev client:** rules live under `ce/.cursor/rules/` (`.mdc` format).

This directory (`ce/.agents/rules/`) contains **tool-agnostic Markdown rules** compatible with any AI tool that reads the `.agents/` convention, including Gemini CLI, GitHub Copilot CLI, Codex, and `gh skill`.

These rules are **copied into CE projects** when you run **`init_project`** (Development bundle, local workspace). They provide the framework baseline for Sprint Planning+ development.

## Contents

| File                             | Purpose                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `default.md`                     | Sprint Planning workflow, CE navigation, data hygiene                          |
| `agent-invocation.md`            | Which agent to activate by context (Developer, PMO, Gate-Check)                |
| `project-rules.md`               | Baseline project rules (CHANGELOG-per-commit, spec read-only, data dictionary) |
| `data-dictionary-maintenance.md` | When and how to update `DATA_DICTIONARY.md`                                    |
| `interview-ui.md`                | Structured vs prose questions (tool-agnostic; see Cursor `interview-ui.mdc`)   |

## In CE Projects

After **`init_project`**, your project has `.agents/rules/` with a copy of these rules. Add project-specific rules alongside - most tools that read `.agents/` will load both.

## Sync Note

When rules are updated in `ce/.claude/rules/` or `ce/.cursor/rules/`, update the matching file here. Format differs by directory (`.md` for `.agents/` and `.claude/`, `.mdc` for `.cursor/`) but **semantics must be equivalent**. See `agent-tools-sync.json`.
