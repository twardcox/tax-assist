---
description: Cowork - kick off a new CE project (init_project, Jira, GitHub, optional Drive)
argument-hint:
allowed-tools: all
---

## Task

Use **`/new-project`** in the planning client (e.g. Cowork) when **onboarding a new CE project**: create artifact directories, `.ce-project.json`, `CLAUDE.md` when missing, then walk through **Jira**, **GitHub**, and optional **Google Drive**.

For **Development developer setup** in the dev client (rules, skills, CI, hooks), use **`/init-project`** - it loads **`ce://commands/init-project`** and invokes **`init_project`** for the Development bundle (see that playbook).

## Steps

1. **Connect the CE MCP server** in your planning client (e.g. Cowork).

2. **Hosted server (storage under `/data/<key>/`):** Ask for the **Jira project key** (e.g. `MYAPP`). Call **`init_project`** with **`project_key`** set to that key so the session is isolated under the correct namespace. If **`project_key`** is omitted on a hosted server, the tool will error - collect the key first.

3. **Invoke `init_project`** - Optional **`project_name`** for messaging in next-step text. The tool creates the SOW+ layout (e.g. `agent-docs/`, `output-docs/`, `research/`, `reports/`, `specs/tasks/` depending on local vs server storage and whether Google Drive is linked), writes **`.ce-project.json`** when needed, and may create **`CLAUDE.md`** from the template. When the MCP project root is a **local** checkout, the same tool also copies the **Development framework bundle** (dev client rules, skills, scripts, CI, hooks) into the repo.

4. **Jira, GitHub, and optional Drive:** Follow the **`init_project`** response. Then run **`setup_project`** with **`project_name`** (required by the tool) - it reports what is configured and guides **Jira** credentials → **Jira project** (`create_jira_project` / `connect_jira_project`) → **GitHub** token → **GitHub** repo (`create_github_repo` / `connect_github_repo`). Use **`show_project_config`** to see gaps.

5. **Google Drive (optional):** If the team uses Drive for `research/`, `output-docs/`, or related paths, call **`connect_google_drive_folder`** with the appropriate folder ID(s), or configure the server/env as described in the **[Tools reference](https://coherence-engine.fly.dev/ce/docs/tools-reference.md)** (e.g. credentials path, folder ID).

6. **Before SOW+:** When `research/` inputs exist, run **`gate_check_pre_sow`**.

## Rules

- **`init_project`** is the **single** MCP tool for project layout and (when local) Development copied files; use **`/init-project`** in the dev client for the developer-focused playbook.
- Hand off to the dev client for Development only after PMO workflow is ready; developers run **`/init-project`** there.
