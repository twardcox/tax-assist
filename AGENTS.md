# Agent Setup (tax-assist)

## Primary Entry Points

- Claude: `CLAUDE.md`
- Copilot (VS Code): `.github/copilot-instructions.md`
- Local workflow bundle: `ce/`

## Skill Locations

- Copilot skills: `.github/skills/`
- Cross-tool skills: `.agents/skills/`
- Claude skills: `.claude/skills/`

## Notes

- This repo uses local workflow docs from `ce/`.
- Tracker-specific integrations (for example Jira transitions) are not required unless explicitly reintroduced.
- If behavior is updated in one tool surface, keep `CLAUDE.md`, `.github/copilot-instructions.md`, and this file aligned.
