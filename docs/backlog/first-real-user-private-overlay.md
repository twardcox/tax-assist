# Backlog draft: First real user — private facts overlay + trigger-style rules

**Status:** DRAFT for UTBIS Phase 2 intake (not yet a story; enters via the project's CE workflow).
**Origin:** 2026-07-10 owner session — the owner's own LLC becomes UTBIS's first real user profile (dogfooding milestone for Phase 2's "make the scanner produce real results").

## Story A — Private facts overlay

As a user with real financial data in a public repo, I want the scanner to merge a gitignored
private overlay over the public `user_data/*.yaml` templates, so real facts drive results
without ever being committable.

- Given `user_data/private/<name>.local.yaml` exists with the same schema as `user_data/<name>.yaml`,
  when the scanner loads facts, then overlay values (non-null) win over template values.
- Given no private overlay exists, when the scanner runs, then behavior is unchanged (templates only).
- Given any file under `user_data/private/`, then it is gitignored (rule exists as of 2026-07-10;
  add a test or pre-commit guard asserting `git check-ignore` passes for the folder).
- Convention documented in README (`user_data/private/README.md` exists locally as the working example:
  books CSV + `businesses.local.yaml`).

## Story B — Threshold-trigger benefits: §41 research credit + S-corp election

As a pre-profit business owner, I want "almost available" benefits with dollar thresholds
evaluated against my real financials, so the scanner tells me when a CPA conversation becomes
worth its fee.

- Add benefit records: **§41 R&D credit** (incl. §174A immediate-expensing note, QSB payroll-tax
  offset path, 20-yr carryforward; QREs may include research cloud/LLM compute + 65% contract
  research) and **S-corp election** (already on the Phase 2 top-25 — extend with the
  ~$40k-net-profit breakeven heuristic as an "almost available" threshold).
- Eligibility rules read `businesses` financials (post-overlay): annual cash operating spend
  ≥ ~$5,000 → §41 flagged "evaluate with CPA"; net profit ≥ ~$40,000 → S-corp flagged.
  Below threshold → reported as "almost available" with distance-to-threshold.
- Output section mirrors a trigger table: threshold, current value, fired/not-fired.
- Non-goal: computing the credit or preparing elections — this flags CPA conversations only.

## Story C (later) — Monthly books ritual command (TypeScript)

One command: append/validate `books/<year>-transactions.csv`, recompute overlay financials
aggregates, run the backend scan (`POST /api/scan`), and review `reports/opportunity_report.md`.
Target: monthly bookkeeping in ≤15 minutes. (Depends on A + B.)

## Notes

- Real-data fixtures must be synthetic in tests; never reference actual private values in
  committed code, fixtures, or docs (public repo).
- Cross-repo: quarterly reconciliation of `lab-*` tagged rows against the Public Data Discovery
  Lab's management ledger is a human ritual, not an integration — do not build a coupling.
