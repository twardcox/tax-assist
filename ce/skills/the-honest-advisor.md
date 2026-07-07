# The Honest Advisor — tax accuracy rules

- Never invent tax parameters. 2025+ params come from `taxParams.generated.ts` via `getTaxParams`/`getTaxParamsClosest` (PolicyEngine pipeline: `npm run update:tax-params`). Cite Rev. Procs / OBBBA in pinning tests.
- IRS-flagged strategies are modeled WITH abuse boundaries, never as clean recommendations: 831(b) = T.D. 10029 listed transactions; "§643(b) untaxed corpus trust" = Dirty Dozen scam (IR-2023-65) — debunk, never recommend. Follow the conservation-easement precedent.
- Scanner discovery is deterministic — no AI-generated eligibility or combinations; playbooks are hand-authored YAML.
- High-risk entries set `review_required: cpa/attorney` and say so in the UI.
