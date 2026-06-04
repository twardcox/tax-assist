# Universal Tax Benefit Intelligence System (UTBIS)

UTBIS is an AI-assisted tax intelligence platform that identifies every legal tax benefit a user may qualify for, nearly qualify for, or could qualify for through changes in facts, structure, timing, documentation, or behavior.

## What This Is Not

- Not a tax filing tool
- Not a tax fraud guide
- Does not recommend fake deductions, sham transactions, or hidden income

## What This Is

A continuously updated AI tax opportunity platform that compares a user's financial facts against every known legal tax benefit and produces:

- Benefits available **now**
- Benefits **almost** available
- Changes needed to qualify
- Documentation required
- Forms required
- Deadlines
- Risk levels
- Estimated value
- CPA review packets
- Law-change alerts

## Coverage

- Federal tax benefits
- State tax benefits
- Local tax benefits
- Business deductions and elections
- Individual deductions and credits
- Exclusions and deferrals
- Retirement strategies
- Healthcare tax benefits
- Education benefits
- Family/dependent benefits
- Real estate benefits
- Investment benefits
- Estate and gift planning
- Energy credits
- Industry-specific incentives
- Future enacted tax law changes

## Core Questions Answered

1. What tax benefits exist?
2. Which benefits does the user currently qualify for?
3. Which benefits is the user close to qualifying for?
4. What changes would make the user qualify?
5. What documentation is required?
6. What forms are required?
7. What deadlines apply?
8. What risks apply?
9. What tax law changes affect the user?
10. What should the user do next?

## Repository Layout

```
utbis/
├── config/             — App, jurisdiction, and source configuration
├── user_data/          — User-editable taxpayer facts (no hardcoded data)
├── tax_library/        — Structured tax benefit records (federal/state/local)
├── strategies/         — Strategy definitions by category
├── rules/              — Eligibility, phaseout, deadline, and stacking rules
├── forms/              — Official form mappings and metadata
├── documents/          — User-uploaded source documents
├── reports/            — Generated output reports and CPA packets
├── scripts/            — Automation scripts for scanning and updating
└── tests/              — Rule and eligibility test suite
```

## MVP Build Phases

| Phase | Description |
|-------|-------------|
| 1 | Planning repo — YAML schemas, example records, report templates |
| 2 | Local rule scanner — eligibility matching, opportunity output |
| 3 | AI assistant layer — gap analysis, scenario simulation, CPA packets |
| 4 | Tax law update engine — IRS/Treasury/state source monitoring |
| 5 | Dashboard — visual opportunity browser with status and value |

## Getting Started

1. Edit files in `user_data/` with your actual tax facts
2. Run `scripts/scan_opportunities.py` to generate your opportunity report
3. Review `reports/opportunity_report.md` for matches and near-misses
4. Generate `reports/cpa_packet.md` for professional review

## Eligibility Status Legend

| Status | Meaning |
|--------|---------|
| `eligible_now` | Qualifies based on current facts |
| `nearly_eligible` | Close — minor gap identified |
| `eligible_if_changed` | Specific changes would qualify you |
| `future_opportunity` | Becomes available under certain conditions |
| `not_applicable` | Doesn't apply to this taxpayer profile |
| `expired` | No longer available |
| `high_risk` | Legal but requires professional review before claiming |
