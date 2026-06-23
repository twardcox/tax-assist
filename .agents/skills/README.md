# CE Agent Skills (Cross-Tool)

This directory (`.agents/skills/`) contains **tool-agnostic Agent Skills** compatible with any AI tool that reads the `.agents/skills/` convention, including:

- **Gemini CLI** - `.agents/skills/` takes precedence over `.gemini/skills/`
- **GitHub Copilot CLI** - reads `.agents/skills/` (auto-activation; no explicit slash invoke)
- **Codex** - reads `.agents/skills/` (auto-activation)
- **`gh skill`** - GitHub CLI v2.90+ resolves skills from `.agents/skills/` across supported hosts

Each skill is **Coherence Engine configuration** and sets **`disable-model-invocation: true`** so it behaves like an explicit `/{name}` invocation and instructs the agent to load the **canonical playbook from the CE MCP server**:

- **`resources/read`** → **`ce://commands/{name}`** (plural `commands`) - all commands
- or **`get_slash_command`** → **`command_name`:** **`{name}`** - works for all commands

**Skills are the primary user interface.** All commands are treated equally - no "user-facing" vs "internal" distinction. Discovery: `/ce` loads `ce://skills` from the MCP server and presents the full catalog. All names in `scripts/generate-ce-agent-skills.mjs` `COMMAND_NAMES` get skills.

**Playbook bodies** are **not** copied into consumer projects - they stay on the **server** as the single source of truth. Only these small **`SKILL.md`** files are copied by **`init_project`** (Development bundle, local workspace).

**Regenerate** after changing `COMMAND_NAMES` in `scripts/generate-ce-agent-skills.mjs`:

```bash
pnpm run generate:agent-skills
```

That script overwrites skills for all names in **`COMMAND_NAMES`** (generator script). One skill uses a custom body function - **`council`**, which pre-loads the agent roster table before the MCP fetch so the invoking agent can route to the correct sub-agent (Adversary, Developer, PMO, Design) without reading the full playbook first. All other skills use the standard loader body. To add or change a custom body, edit `scripts/generate-ce-agent-skills.mjs` and re-run the script rather than editing the `SKILL.md` directly.

**Sync config:** see **`agent-tools-sync.json`** for the full tool directory mapping.

**Init:** **`init_project`** copies **`ce/.agents/skills/`** → **`.agents/skills/`** in the project workspace.
