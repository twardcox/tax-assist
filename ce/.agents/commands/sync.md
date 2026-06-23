---
description: Pull framework files from the CE server and replace them in the repo
argument-hint:
allowed-tools: all
---

## Task

**Sync** means: **pull** the current framework bundle from the **CE MCP server** and **replace** the copied files in the **open project root** (your git repo) so they match the server. That is the same file set as the Development copy from **`init_project`**: `.cursor/rules/ce`, `.cursor/rules.json`, `.cursor/skills`, `.ce/scripts`, `.ce/lib`, `.github`, `.husky`.

- **Replace** = overwrite existing files where the server has a canonical version; create missing paths. Do **not** leave a single dump **`.txt`** outside the tree - materialize **real paths** under the repo root.

---

## 1. Pull and overwrite (default)

Do **not** require **`diff_init_files`** first. Apply the bundle, then review with **`git diff`**.

### 1a. Local MCP (server can write your checkout)

Call **`sync_init_files`** with **`apply: true`** (optional **`paths`** to limit scope, e.g. `[".ce/scripts"]`). That writes server versions for paths that are missing or differ from the server.

Then **`git diff`**, run pre-flight if scripts changed, and commit.

### 1b. Hosted MCP - project root is server storage (`/data/...`)

**`diff_init_files`** and **`sync_init_files`** **error** here - the server cannot write your laptop repo. **`init_project`** skips copying the Development bundle to `/data` - use **`get_init_files`** / this playbook. **Pull and replace locally** using **section 2**.

---

## 2. Pull and replace when MCP cannot write your workspace (hosted)

Use the **same** bundle as MCP **`get_init_files`**. **Preferred: HTTP** (one download, overwrite via unzip).

### 2a. HTTP - ZIP (preferred)

1. Resolve **`CE_SERVER_URL`** from the project **`.env`**: strip **`/mcp`**, **`/sse`**, trailing slashes → **origin** (e.g. `https://…` or `http://127.0.0.1:3000`). If absent, ask the user for the MCP host **origin** (no `/mcp`).
2. **`curl`** **`GET {origin}/framework/init-files.zip`**. If **401**, retry with **`Authorization: Bearer`** using **`CE_PROJECT_TOKEN`** from **`.env`** (or another CE bearer for this server).
3. Unzip **into the project root** with overwrite, e.g. **`unzip -o /tmp/ce-init-files.zip -d {workspaceRoot}`** (PowerShell: **`Expand-Archive -Force`**). Paths inside the zip are repo-relative - they **replace** existing files.
4. Optional **`paths`** query on the URL: **`?paths=.ce/scripts&paths=.github`** (comma-separated also works) to limit scope.

### 2b. HTTP - JSON (if ZIP is awkward)

**`GET {origin}/framework/init-files.json`** (same auth). Parse **`files`**: **`[{ path, content }]`**. Write each **`content`** to **`{workspaceRoot}/{path}`** (overwrites). Schema: **`ce-init-files-v1`**.

### 2c. MCP - JSON (fallback)

Call **`get_init_files`** with **`format: "json"`** (optional **`paths`**). Write each **`files[]`** entry under the project root (overwrites).

### Finish

**`git diff`**, pre-flight if scripts changed, suggest commit.

---

## 3. Optional: preview with `diff_init_files`

When the MCP **project root is your real repo** (local server) and you want a **read-only report** before overwriting, call **`diff_init_files`** (optional **`paths`**), then **`sync_init_files`** with **`apply: true`** if you still want to apply.

---

## Rules

- **Overwrite warning:** replacing framework copies discards local edits to those files unless recovered from git - suggest **stash/commit** first if they customized **`.cursor/rules/ce`** or copied scripts.
- **Local server alternative:** run the MCP server with **`pnpm start /path/to/repo`** so **`sync_init_files`** (and optional **`diff_init_files`**) use your git working tree. See **[Quick start](https://coherence-engine.fly.dev/ce/docs/quick-start.md)** in the framework repo.

## Optional scope

Use **`paths`** on **`sync_init_files`**, **`diff_init_files`**, **`get_init_files`**, and on HTTP (**`?paths=`**) to sync only part of the tree, for example:

- `[".ce/scripts", ".ce/lib"]` - dev scripts only
- `[".github"]` - CI workflows only
