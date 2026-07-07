# Failure Handling: [skill/workflow name]

<!-- Use this to write the Failure Handling section of a skill, or as a standalone runbook
     for a failure-prone workflow. The unit of content is the failure mode row. -->

## Failure Modes

| # | Failure mode | Detection signal | Immediate action | Retry rule | Escalate to | Never do |
|---|---|---|---|---|---|---|
| 1 | Required input missing | | Ask for it / locate it via [tool]; do not fabricate | n/a | user | Guess the value |
| 2 | Tool/service unavailable | error message / timeout | | max N retries, then stop | | Retry a denied permission verbatim |
| 3 | Sources conflict | two authorities disagree | Present both with citations; mark `CONFLICT` | n/a | human reviewer | Silently pick one |
| 4 | Out of scope request | trigger conditions not met | Name the right skill/agent and hand off | n/a | | Do it anyway "to be helpful" |
| 5 | Partial completion | step X failed after Y succeeded | Report exactly what completed and what didn't | | | Report success |

## Principles

1. **Fail loudly, specifically, and early.** A named error block beats a plausible guess every time.
2. **Distinguish retryable from non-retryable.** Timeouts: retry with backoff. Permission denials and validation failures: stop and report.
3. **Preserve evidence.** Capture the exact error, command, and state before any cleanup.
4. **Degrade transparently.** If a fallback source/tool is used, label the output as fallback-derived.
5. **No silent scope reduction.** If you can only do half the task, say which half.

## State After Failure

What the world should look like when this skill aborts: branches, files, tickets, partial artifacts — cleaned up or explicitly flagged, never ambiguous.

## Reporting Format

```
FAILED: <step> — <one-line cause>
Completed: <steps done>
Not done: <steps remaining>
Evidence: <error text / log path>
Suggested next action: <human decision needed or retry plan>
```
