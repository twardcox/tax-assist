---
description: Update .ce-project.json with config changes
argument-hint: [section e.g. hooks, toolkit.jira, agentDocs]
allowed-tools: all
---

## Task

Update the project configuration (`.ce-project.json`) with the desired changes. Use the `update_project_config` MCP tool to apply updates.

## What to do

1. **Run show_project_config** - Call `show_project_config` to see the current configuration.

2. **Determine the updates** - Based on the user's request or `$ARGUMENTS`, build a partial config object. Common sections:

   - `toolkit.hooks` - preCommit, commitMsg, prePush, postCheckout
   - `toolkit.jira` - projectKey, boardId, transitions
   - `toolkit.github` - owner, repo
   - `toolkit.gdrive` - outputFolderId
   - `toolkit.figma` - fileKey (Figma file key from `figma.com/design/{fileKey}/...`), projectId (optional team/project ID)
   - `toolkit.ci` - linting, unitTests, e2eTests
   - `agentDocs` - path, readOnly

3. **Call update_project_config** - Pass the updates object. Example:

   ```json
   { "toolkit": { "hooks": { "preCommit": { "enabled": true } } } }
   ```

4. **Confirm** - Report the change and the new config state.

## Rules

- Deep-merge: only include the sections you are changing. The tool merges into existing config.
- When using a remote server, config is stored at `/data/<namespace>/.ce-project.json`. The tool handles this automatically.
- If the user specifies a section (e.g. `hooks`), focus the updates on that section.
