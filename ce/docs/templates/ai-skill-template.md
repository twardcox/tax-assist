# Skill Name

<!-- Copy this file to skills/<kebab-name>.md. Delete comments. Every section is required;
     write "None." rather than deleting a section, so absence is a decision, not an oversight. -->

## Skill ID

<!-- kebab-case, stable, unique. Matches filename. e.g. `the-honest-advisor` -->

## Purpose

What this skill does, in 1–3 sentences. Outcome-focused, not implementation-focused.

## When to Use

Clear trigger conditions. Prefer observable triggers ("any change touching `src/routes/`")
over vibes ("when security matters").

## When Not to Use

Cases where this skill should not be used, and what to use instead.

## Inputs Required

Required inputs from the user, files, tools, or context. For each: name, where it comes from, what to do if missing (see Failure Handling).

## Optional Inputs

Useful but non-required inputs and how they improve the result.

## Tools Required

Tools, APIs, file access, web access, code execution, or connectors needed.
Mark any **destructive** command (deletes data, resets state, force-pushes) in bold with a warn-first rule.

## Output

Expected deliverable format: file paths, naming conventions, report structure, or message shape. The reader should be able to predict what "done" looks like before running the skill.

## Process

Step-by-step instructions. Numbered. Each step should be checkable — a reviewer can tell whether it happened.

## Source Grounding

How the skill must use citations, source files, public data, user-provided data, or tool outputs.
For regulated domains (tax, legal, financial, medical, safety): **no factual parameter may originate from model memory** — every figure traces to a named file, tool output, or cited primary source.

## Safety and Compliance

Boundaries, prohibited actions, sensitive areas, human review requirements. State what the skill must **never** output (e.g., legal conclusions, recommendations of flagged strategies) and what it outputs instead (review packets, flagged leads, options with trade-offs).

## Assumptions

Allowed assumptions and how to label them in output (e.g., `ASSUMPTION: …`).
Date any perishable assumption (branch names, current versions) so staleness is detectable.

## Failure Handling

What to do when data is missing, tools fail, sources conflict, or the request is out of scope. Each failure mode gets: detection signal → action → who to tell.

## Validation

How to check the output before declaring done (commands to run, checks to perform, expected results).

## Acceptance Criteria

Specific, testable completion requirements. If a criterion can't be checked, rewrite it until it can.

## Examples

At least one good/typical example and one edge-case or failure-path example.

## Related Skills

Links or paths to related skills, and how responsibility is divided between them.

## Change Log

| Date | Change | Author |
|---|---|---|
| YYYY-MM-DD | Created | |
