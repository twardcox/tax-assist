---
description: Dev client - Development dev setup via `init_project`. Cowork new project → `/new-project`.
argument-hint:
allowed-tools: all
---

## Which flow?

| Where you work                    | Playbook                       | What happens                                                                                                                                   |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Planning client (e.g. Cowork)** | **`/new-project`**             | Full onboarding: **`init_project`**, then **`setup_project`** / Jira / GitHub / optional Drive - see **`ce://commands/new-project`**.          |
| **Dev client (e.g. IDE)**         | **`/init-project`** (this doc) | Run **`init_project`** once before Development so the repo gets the Development framework bundle when the MCP root is your **local** checkout. |

**Do not duplicate the Cowork playbook here.** Use **`/new-project`** in Cowork for new-project layout and integrations.

---

## Development (dev client) - `init_project`

**`/init-project` in the dev client** is a **shortcut** for invoking the **`init_project`** MCP tool - same tool Cowork uses for layout; in a local workspace it also **copies** the Development bundle (rules, skills, scripts, `.github`, `.husky`). It does **not** replace **`/new-project`** for full Cowork onboarding.

Run **`init_project`** to set up the CE project for **Development** (Developer in the dev client). Sprint Planning (Sprint Planning) is done in Cowork by PM/PO; run this **before** starting Development (Development).

### What to do

1. **Invoke the `init_project` MCP tool** - optional **`project_name`** / **`project_key`** per server docs. If the CE MCP server is connected, call **`init_project`**.

2. **Hosted MCP / server storage (`/data/…`):** The tool may **not** write into your laptop repo. In that case run **`get_init_files`** with **`format: "json"`**, parse **`files`**, and write each **`path`** under the open workspace root - or follow **`/sync`**. **Do not** save the tool response as a single `.txt` outside the repo - write real files at the listed paths.

3. **`init_project` copies locally when allowed (or `get_init_files` provides):**

   - `.cursor/rules/ce` (framework rules)
   - `.cursor/rules.json`
   - `.github` (CI workflows)
   - `.husky` (git hooks)
   - `.ce/scripts` and `.ce/lib` (development scripts)

   **`.ce-project.json`** is created or updated as part of project setup; layout dirs (`research/`, `agent-docs/`, …) come from the same tool when Cowork has already run **`init_project`** - do not invent paths manually unless the tool output says to.

4. **Follow the tool output** - it returns next steps (e.g. dev client MCP setup URL, **`setup_project`** for Jira/GitHub if needed).

5. **Verify GitHub access** - Call `github_list_branches` to confirm the configured token can reach the repository.

   - ✅ If it returns a branch list: GitHub is connected and ready.
   - ❌ If it returns a 404 "repository not found" error: the GitHub token does not have access to this repo. This is commonly caused by a **fine-grained personal access token** that was scoped to the wrong repository. Fix it:

     1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
     2. Click the token named for this server (e.g. `ce-mcp-server`)
     3. Click **Edit** next to "Repository access"
     4. Add the project repo (e.g. `owner/project-repo`) to the selected repositories list
     5. Save - no `.env` change needed if the token value hasn't changed
     6. Re-run `github_list_branches` to confirm access

   - ❌ If it returns a 401/403 error: the token itself is invalid or expired - regenerate it at GitHub and update `GITHUB_TOKEN` in `.env`, then restart the MCP server.

### Rules (dev client)

- Run once in or just prior to Development when the developer first opens the project in their dev client.
- If the CE MCP server is not connected, instruct the user to add it and retry.
- When the server cannot write locally, **always use `get_init_files` (JSON) and write each path** (or **`/sync`**) so all init files are present.
- **Always run the GitHub access check (step 5)** - do not skip it. Fine-grained token scope issues are a common blocker and must be surfaced before development begins.
- Add project-specific rules alongside the framework rules (e.g. `.cursor/rules/ce/`) to augment the base ruleset.
