# UTBIS Roadmap

## Phase 1 — Planning Repo (Current)

Goal: Get the schema, structure, and data model right before writing logic.

- [x] Repository directory skeleton
- [x] `user_data/` YAML files — all taxpayer fact categories
- [x] `tax_library/example-benefit.yaml` — canonical benefit record schema
- [x] `rules/eligibility_rules/example-rule.yaml` — rule evaluation schema
- [x] `config/` — app settings, jurisdictions, law sources
- [x] `forms/federal_forms.yaml` — federal form registry (20+ forms)
- [x] `reports/` — opportunity report, CPA packet, gap analysis, year-end plan templates
- [x] `scripts/scan_opportunities.py` — functional scanner skeleton
- [x] `scripts/` — all other script stubs
- [x] `tests/` — test suite for rules, eligibility, and forms

## Phase 2 — Local Rule Scanner

Goal: Make the scanner produce real results against real benefit records.

- [ ] Populate `tax_library/federal/` with top 25 federal benefit records
  - QBI Deduction (Section 199A)
  - S Corp Election / SE Tax Reduction
  - Section 179 / Bonus Depreciation
  - Home Office Deduction
  - Business Vehicle Deduction
  - Self-Employed Health Insurance
  - SEP-IRA / Solo 401(k)
  - HSA Triple Tax Advantage
  - Real Estate Depreciation
  - Passive Activity Loss / Real Estate Professional
  - 1031 Exchange
  - Opportunity Zone Investment
  - Charitable Contribution (cash + non-cash)
  - Augusta Rule (Section 280A(g))
  - Mortgage Interest Deduction
  - SALT Deduction ($10k cap)
  - Child Tax Credit
  - Child and Dependent Care Credit
  - Earned Income Tax Credit
  - American Opportunity Credit
  - Lifetime Learning Credit
  - Residential Clean Energy Credit
  - Clean Vehicle Credit
  - Foreign Earned Income Exclusion
  - Backdoor Roth IRA
- [ ] Write eligibility rule YAML for each benefit
- [ ] Implement rule evaluator in `scan_opportunities.py`
- [ ] Add phaseout calculations for income-limited benefits
- [ ] Write stacking rules
- [ ] Make tests pass against real data

## Phase 3 — AI Assistant Layer

Goal: Add Claude-powered natural language analysis on top of rule results.

- [ ] AI Tax Advisor Agent — explains each opportunity in plain English
- [ ] Opportunity Discovery Agent — searches full library for user profile
- [ ] Gap Analysis Agent — identifies what prevents qualification
- [ ] Scenario Simulator — "what if I buy a rental property?"
- [ ] Document Intelligence Agent — extracts data from uploaded PDFs
- [ ] Receipt Classification Agent — AI expense categorization
- [ ] CPA Packet Generator — structured professional review document
- [ ] Add `ANTHROPIC_API_KEY` env var integration to all AI scripts

## Phase 4 — Tax Law Update Engine

Goal: Keep the benefit library current automatically.

- [ ] Implement `scripts/update_tax_law.py` source fetching
- [ ] IRS news RSS/scrape integration
- [ ] IRS publication change detection
- [ ] Internal Revenue Bulletin parser
- [ ] Federal Register API integration
- [ ] State revenue department monitoring (top 10 states first)
- [ ] Law change classification and benefit record update workflow
- [ ] Notification system for high-impact changes

## Phase 5 — Dashboard

Goal: Visual interface for non-technical users.

- [ ] Opportunity browser — available now / near-miss / if changed
- [ ] User facts editor — guided input forms
- [ ] Document uploader — drag-drop + extraction
- [ ] CPA packet exporter — PDF generation
- [ ] Law change alert feed
- [ ] Year-end countdown with action items
- [ ] Estimated value calculator
- [ ] Authentication and multi-taxpayer support

## Future Considerations

- Mobile app for receipt capture
- Integration with accounting software (QuickBooks, Xero, Wave)
- Integration with tax prep software (TurboTax, Drake, Lacerte) for pre-fill
- IRS transcript API integration (when available) for prior year facts
- Multi-state analysis for state arbitrage planning
- Estate planning module
- Trust and entity structuring analyzer
