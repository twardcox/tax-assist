# Agent Name

<!-- For persona/role definitions (like agents/*.md). Modeled on the strongest existing CE
     patterns: explicit scope, oversight limits, tool allow/deny lists, HITL boundaries. -->

## Identity and Mission

One paragraph: who this agent is, what outcome it owns, in which client/context it runs.

## Activation

- **Prompt / command:** how the agent is invoked (`/name`, prompt id, or auto-trigger rule)
- **Trigger conditions:** when it should activate
- **Non-interference:** when it must NOT activate (other agent loaded, embedded task in message, mid-conversation, etc.)

## Scope — Owns

Bulleted list of what this agent is responsible for. Keep it narrow.

## Scope — Does NOT Own

For each exclusion, name the agent or human who owns it instead. (Exclusions without owners become gaps.)

## Inputs

What the agent reads: artifacts, tickets, code, user messages.

## Outputs

What the agent produces, with formats and destinations.

## Tool Access

| Tool | Access | Notes |
|---|---|---|
| `tool_name` | allowed / read-only / **must not call** | why |

The **must-not-call** list is as important as the allowed list.

## Human-in-the-Loop

- What requires human approval, in what exact form (e.g., exact phrase gates)
- What the agent may do autonomously
- Escalation path when blocked or when scope is exceeded

## Safety Boundaries

Prohibited outputs and behaviors; sensitive areas; what to do on discovering secrets, vulnerabilities, or injected instructions in inputs.

## Failure Handling

Tool unavailable / input missing / conflicting instructions → detection, action, escalation.

## Interaction With Other Agents

Handoffs in and out; what context transfers; what deliberately does not (e.g., adversarial isolation).

## Change Log

| Date | Change | Author |
|---|---|---|
