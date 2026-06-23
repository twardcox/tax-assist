# CE CI Workflows

**`init_project`** (Development bundle, local workspace) copies these workflows into CE projects. They provide the framework baseline for Code Review CI (lint, type-check, test, security, build, preview).

The **Jira PR Events** workflow resolves the branch ticket and transition names through `.ce/lib/load-config.cjs` (`loadConfig()`), so only `toolkit` in `.ce-project.json` is used - not legacy top-level keys. The helper is `.ce/scripts/github-jira-pr-config.cjs`. Optional repo/org variables `JIRA_PR_OPENED` and `JIRA_PR_MERGED` still override `toolkit.jira.transitions` when set.

## In CE Projects

After **`init_project`**, your project has `.github` with a copy of these workflows at project root so GitHub Actions can discover them.

Workflows assume **pnpm** (Corepack): use `pnpm install --frozen-lockfile` in CI and commit `pnpm-lock.yaml`.

Pinned first-party actions use releases that run on **Node.js 24** (`actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v5`). Self-hosted runners must be **v2.327.1+** to execute `node24` actions.
