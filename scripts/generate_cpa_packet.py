"""
generate_cpa_packet.py

Generates a CPA review packet from scan results and user facts.
Outputs reports/cpa_packet.md

Usage:
    python scripts/generate_cpa_packet.py
    python scripts/generate_cpa_packet.py --tax-year 2025
"""

import argparse
import os
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent

import sys
sys.path.insert(0, str(ROOT / "scripts"))
from scan_opportunities import (
    ANTHROPIC_AVAILABLE, AIAdvisor, EligibilityStatus, OpportunityScanner,
)


def load_user_facts_summary() -> dict:
    data_dir = ROOT / "user_data"
    summary = {}
    for yaml_file in data_dir.glob("*.yaml"):
        with open(yaml_file, encoding="utf-8") as f:
            summary[yaml_file.stem] = yaml.safe_load(f) or {}
    return summary


def generate_ai_executive_summary(scanner: OpportunityScanner, model: str) -> str:
    """Return a plain-English CPA meeting brief from Claude, or empty string if unavailable."""
    if not ANTHROPIC_AVAILABLE:
        return ""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return ""
    print("Generating AI executive summary for CPA packet...")
    advisor = AIAdvisor(model=model)
    # Use analyze_opportunities for the top opportunities narrative
    return advisor.analyze_opportunities(scanner.results, scanner.tax_year)


def generate_packet(scanner: OpportunityScanner, output_path: Path, ai_summary: str = ""):
    facts_summary = load_user_facts_summary()
    household = facts_summary.get("household", {})
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        "# CPA Review Packet\n",
        f"**Prepared by:** UTBIS  ",
        f"**Date:** {now}  ",
        f"**Tax Year:** {scanner.tax_year}  \n",
        "---\n",
        "## Taxpayer Facts Summary\n",
        "| Field | Value |",
        "|-------|-------|",
        f"| Filing Status | {household.get('filing_status', 'Not provided')} |",
        f"| State | {household.get('residence', {}).get('state', 'Not provided')} |",
        f"| Estimated AGI | {household.get('estimated_agi', 'Not provided')} |",
        f"| Tax Year | {scanner.tax_year} |",
        "\n---\n",
    ]

    if ai_summary:
        lines += [
            "\n## AI Planning Summary — For Discussion at CPA Meeting\n",
            ai_summary,
            "\n---\n",
        ]

    eligible = [r for r in scanner.results if r.status == EligibilityStatus.ELIGIBLE_NOW]
    if eligible:
        lines += [
            "## Available Opportunities\n",
            "| Benefit | Estimated Value | Risk | Forms |",
            "|---------|----------------|------|-------|",
        ]
        for r in eligible:
            forms = ", ".join(str(f) for f in r.forms_required) if r.forms_required else "—"
            lines.append(f"| {r.benefit_name} | {r.estimated_value or '—'} | {r.risk_level} | {forms} |")
        lines.append("")

    near_miss = [r for r in scanner.results if r.status == EligibilityStatus.NEARLY_ELIGIBLE]
    if near_miss:
        lines += ["\n## Near-Miss Opportunities — CPA Guidance Needed\n"]
        for r in near_miss:
            lines.append(f"### {r.benefit_name}")
            lines.append(f"{r.message}\n")
            if r.missing_facts:
                lines.append("**Missing:**")
                for fact in r.missing_facts:
                    lines.append(f"- `{fact}`")
            if r.next_steps:
                lines.append("\n**Next Steps:**")
                for step in r.next_steps:
                    lines.append(f"- {step}")
            lines.append("")

    if_changed = [r for r in scanner.results if r.status == EligibilityStatus.ELIGIBLE_IF_CHANGED]
    if if_changed:
        lines += ["\n## Proposed Changes — CPA Review Needed\n"]
        for r in if_changed:
            lines.append(f"### {r.benefit_name}")
            lines.append(f"{r.message}\n")
            if r.changes_needed:
                lines.append("**Changes Needed:**")
                for change in r.changes_needed:
                    lines.append(f"- {change}")
            lines.append("")

    high_risk = [r for r in scanner.results if r.status == EligibilityStatus.HIGH_RISK]
    if high_risk:
        lines += ["\n## High-Risk Strategies — Attorney Review Required\n"]
        for r in high_risk:
            lines.append(f"### {r.benefit_name}")
            lines.append(f"{r.message}\n")

    lines += [
        "\n---\n",
        "## Questions for CPA\n",
        "1. Please review all `nearly_eligible` items above and confirm which gaps can be closed.",
        "2. Please advise on any `eligible_if_changed` structural changes that make economic sense.",
        "3. Please confirm risk levels and documentation requirements for all claimed deductions.",
        "4. Please review carryforward amounts from prior years.",
        "\n---\n",
        "_This packet is prepared for CPA review and planning purposes only._\n",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"CPA packet written to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="UTBIS CPA Packet Generator")
    parser.add_argument("--tax-year", type=int, default=2025)
    parser.add_argument("--ai", action="store_true",
                        help="Add AI executive summary (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--model", type=str, default="claude-opus-4-8")
    args = parser.parse_args()

    scanner = OpportunityScanner(tax_year=args.tax_year)
    scanner.scan()

    ai_summary = generate_ai_executive_summary(scanner, args.model) if args.ai else ""
    output_path = ROOT / "reports" / "cpa_packet.md"
    generate_packet(scanner, output_path, ai_summary=ai_summary)


if __name__ == "__main__":
    main()
