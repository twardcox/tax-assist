# My Data Entry Checklist — Business Owner Profile (M1 / EP-001)

Maps the private worksheet (`user_data/private/businesses.local.yaml`, local-only) onto the
My Data UI so entering real facts is a ≤10-minute checklist task. **Field names only — no real
values belong in this file** (public repo).

Log in as your own account (not the seeded test user). Sections: **My Data → Businesses**, plus
the two cross-references at the end.

## Before you start

- [ ] Register/log in with your own account (per-user isolation keeps seed data separate)
- [ ] Have the worksheet open beside the browser

## Businesses → Business Entities → Add Business

### Identity

| Worksheet field | My Data field | Vocabulary note |
| --- | --- | --- |
| `name` | Business Name | — |
| `ein` | EIN | Sole props without employees may use SSN |
| `entity_type` | Entity Type | Select **Single-Member LLC** (`llc_single` — worksheet's `llc_single_member` is not a valid value) |
| `tax_classification` | Tax Classification | Select **Disregarded Entity (Schedule C)** (`disregarded` — worksheet's `disregarded_entity_schedule_c` maps here) |
| `industry` | Industry | Free text |
| `naics_code` | NAICS Code | Worksheet has candidates; confirm with CPA later — null is fine |

### Formation / states (advanced group)

| Worksheet field | My Data field | Note |
| --- | --- | --- |
| `formation_state` | Formation State | TODO-owner on worksheet — leave blank until known; surfaces as `missing_facts`, not a blocker |
| `operating_states` | Operating States | — |

### Financials

| Worksheet field | My Data field |
| --- | --- |
| `financials.gross_revenue` | Gross Revenue |
| `financials.cost_of_goods_sold` | Cost of Goods Sold |
| `financials.operating_expenses` | Operating Expenses |
| `financials.net_profit_loss` | Net Profit/Loss |
| `financials.assets_total` | Total Assets |
| `financials.liabilities_total` | Total Liabilities |

> These are the fields the trigger benefits (§41, S-corp) read. After M3 ships, the monthly
> ritual command recomputes them from the books CSV — enter current values once now.

### Employees

| Worksheet field | My Data field |
| --- | --- |
| `employees.w2_employees_count` | W-2 Employee Count |
| `employees.w2_wages_total` | Total W-2 Wages |
| `employees.owner_w2_salary` | Owner W-2 Salary |
| `employees.independent_contractors` | Independent Contractors (toggle) |

### Home office / Vehicle / Retirement plans

Straight 1:1 mapping (`home_office.*`, `vehicle.*`, `retirement_plans.*` → same-named fields).
Worksheet values are all false/null today — enter as-is; toggles default off.

### No UI field — keep on the worksheet, mention in Notes

- `owners` list (single-member: 100% you — note it in the business Notes field)
- `employees.payroll_tax_deposits`
- `health_insurance.*` → enter premiums under **My Data → Healthcare → Self-Employed Health Insurance** instead
- `depreciation.assets_placed_in_service` → no businesses UI yet; keep the asset list on the worksheet
- `qbi_eligible` / `specified_service_trade` → QBI Eligible and SSTB fields exist in the Tax Classification Details group (advanced)
- `notes` → Notes field (paste the R&D/§41 posture paragraph — it's context, not computed)

## Cross-references (for a meaningful scan)

- [ ] **My Data → Household**: filing status, state/county of residence, estimated AGI — the scanner keys jurisdiction and phase-outs off these
- [ ] **My Data → Healthcare**: self-employed health insurance premium (if any)

## After entry

- [ ] Run a scan (Dashboard) — remaining nulls should appear as `missing_facts`, not errors
- [ ] Run `npm run backup:db` from `backend-ts/` (dated dump of the DB now containing real data)
- [ ] Tick off the worksheet TODOs as facts arrive (EIN, formation state, legal name)
