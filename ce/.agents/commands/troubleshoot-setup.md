---
description: Diagnose CE server setup - reports what is configured, missing, and provides exact fix steps
allowed-tools: all
---

## Task

The user invoked `/troubleshoot-setup`. Run the CE setup diagnostic and surface every fix needed before continuing.

## Steps

1. Call the **`troubleshoot_setup`** MCP tool with **no arguments**.
2. Read the output and interpret every line:
   - ✅ - integration is working; no action needed
   - ❌ - broken; follow the exact fix steps in the output
   - ⚠️ - partially configured; follow the recommendation to complete setup
3. List every ❌ and ⚠️ with the fix steps in a clear table or bullet list.
4. After the user applies all fixes, instruct them to **restart the MCP server** and run `/troubleshoot-setup` again to confirm.

## Common issues

| Symbol                | Issue                                                      | Fix                                  |
| --------------------- | ---------------------------------------------------------- | ------------------------------------ |
| ❌ Jira credentials   | `JIRA_API_TOKEN`, `JIRA_EMAIL`, or `JIRA_BASE_URL` missing | Set env vars; restart server         |
| ❌ GitHub credentials | `GITHUB_TOKEN` missing                                     | Set env var; restart server          |
| ⚠️ No project key     | `JIRA_PROJECT_KEY` or `GITHUB_REPO` unset                  | Run `/update-config` or set env vars |

## When all systems are ready

The tool prints **"🎉 All systems ready!"**. Suggest running `get_next_steps` (or `/ce-status`) to see what to work on next.

## Rules

- Do not assume anything is configured - always read the tool output directly.
- Do not proceed with any phase work if ❌ items remain for integrations the current task depends on.
