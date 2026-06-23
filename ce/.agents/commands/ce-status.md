---
description: Server and project config status - shows client info, integrations, and .ce-project.json snapshot
argument-hint:
allowed-tools: all
---

## Task

The user invoked **`/ce-status`**. Show a complete status dashboard: MCP client, server, current project, integrations, and the full `.ce-project.json` configuration snapshot.

## Steps (strict order)

1. **Call `get_client_info`** - reports the detected MCP client name, skill variant (`cursor` / `claude-code` / `agents`), and the primary skills directory for this session.

2. **Call `show_project_config`** - reports integrations status (Jira ✅/❌/⚠️, GitHub ✅/❌/⚠️, Google Drive ✅/⚠️), project root path, config file location (`.ce-project.json`), and persisted toolkit config.

3. **Read `.ce-project.json`** - from the config file path reported in step 2, read the raw file and display its full contents in a fenced JSON code block.

4. **Present the status dashboard** in this structure:

````
Coherence Engine - Status

── Server
   Client:         <clientName from get_client_info>
   Skill variant:  <skillVariant>
   Skills dir:     <primarySkillDirectory>

── Project
   Root:           <projectRoot from show_project_config>
   Config file:    <path to .ce-project.json>

── Integrations
   Jira:           ✅/❌/⚠️  <detail>
   GitHub:         ✅/❌/⚠️  <detail>
   Google Drive:   ✅/⚠️  <detail>

── .ce-project.json
   ```json
   { ... full contents ... }
````

── Next steps
• <any ❌ or ⚠️ items with fix instructions>
• (none if all green)

```

## If configuration is incomplete

- ❌ integrations: point to **`/troubleshoot-setup`** or **`/update-config`**
- Missing `.ce-project.json`: point to **`/init-project`** (first-time setup) or **`/update-config`**
- `get_client_info` returns unknown client: advise adding `?client_name=cursor` (or `claude-code`) to the MCP server URL

## If `show_project_config` or `get_client_info` fails

Explain the error briefly. Point to **`/troubleshoot-setup`** (no arguments - runs the full diagnostic) as the next step.
```
