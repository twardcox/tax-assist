# Tool-Use Rule: [tool or tool family]

<!-- For rules governing a specific tool, API, or command family (like the CE artifact tools
     or the destructive `npm test`). Keep one rule file per tool family. -->

## Tool

Name, what it does, where it's configured (env vars, config file, MCP server).

## Who May Call It

| Agent / context | Access |
|---|---|
| | allowed / read-only / **must not call** |

## Preconditions

What must be true before calling (auth present, config resolved, user confirmed, correct client). Include the check command where one exists.

## Destructive or Irreversible Effects

State plainly what this tool destroys, publishes, or makes irreversible. If none, write "None."
For destructive tools: **confirmation rule** — what the agent must say/ask before invoking, and what counts as authorization.

## Correct Usage

Canonical invocation(s) with real parameter examples. Known-good patterns.

## Known Failure Modes

| Symptom | Actual cause | Correct response |
|---|---|---|
| | | |

(Example from this repo's history: Congress.gov 403s are swallowed as empty results — check `CONGRESS_API_KEY` before debugging "missing data".)

## Prohibited Patterns

Misuses seen or foreseen (e.g., inventing auth schemes, calling write tools from read-only agents, bypassing rate limits).

## Secrets and Data Handling

Where credentials live; what output must never contain (keys, tokens, PII); logging rules.

## Escalation

When tool behavior is surprising or access is denied: who to tell, what evidence to capture, and what NOT to retry.
