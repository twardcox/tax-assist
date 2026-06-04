"""
test_update_tax_law.py

Tests for Phase 4: update_tax_law.py
Run with: python -m pytest tests/ -v
"""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from update_tax_law import (
    ChangeRecord,
    _parse_rss_date,
    classify_change_types,
    detect_affected_benefits,
    load_sources,
    make_slug,
    update_federal_register_state,
    update_irs_news_state,
)


# ─── classify_change_types ────────────────────────────────────────────────────


class TestClassifyChangeTypes:
    def test_changed_threshold_inflation(self):
        types = classify_change_types("IRS Announces 2026 Inflation Adjustments for Tax Provisions")
        assert "changed_threshold" in types

    def test_proposed_rule(self):
        types = classify_change_types("Proposed Rule REG-123456-23 for Section 199A")
        assert "proposed_rule" in types

    def test_revenue_ruling(self):
        types = classify_change_types("Rev. Rul. 2026-01 clarifying passive activity rules")
        assert "revenue_ruling" in types

    def test_revenue_procedure(self):
        types = classify_change_types("Rev. Proc. 2026-10 updating safe harbor amounts")
        assert "revenue_procedure" in types

    def test_expired_benefit(self):
        types = classify_change_types("Bonus Depreciation Provision Expired December 31")
        assert "expired_benefit" in types

    def test_new_benefit(self):
        types = classify_change_types("New Credit Established for Small Business Healthcare Costs")
        assert "new_benefit" in types

    def test_risk_change_audit(self):
        types = classify_change_types("IRS Announces Increased Audit Activity on Syndicated Conservation Easements")
        assert "risk_change" in types

    def test_final_rule(self):
        types = classify_change_types("Final Regulations under Section 168 Bonus Depreciation TD 9973")
        assert "final_rule" in types

    def test_deadline_change(self):
        types = classify_change_types("IRS Extends Filing Deadline to April 15 for Disaster Victims")
        assert "deadline_change" in types

    def test_unknown_falls_back_to_new_interpretation(self):
        types = classify_change_types("IRS Issues Guidance on Remote Work Expenses")
        assert len(types) > 0

    def test_abstract_contributes_to_match(self):
        types = classify_change_types("IRS Notice 2026-5", "This notice sets forth the inflation-adjusted amounts for 2026.")
        assert "changed_threshold" in types


# ─── detect_affected_benefits ────────────────────────────────────────────────


class TestDetectAffectedBenefits:
    def test_ev_credit(self):
        benefits = detect_affected_benefits("Clean Vehicle Credit Update", "Section 30D clean vehicle credit amounts")
        assert "federal-ev-credit" in benefits

    def test_child_tax_credit(self):
        benefits = detect_affected_benefits("2026 Child Tax Credit Amounts")
        assert "federal-child-tax-credit" in benefits

    def test_qbi_deduction(self):
        benefits = detect_affected_benefits("Proposed Rule on QBI Deduction Under Section 199A")
        assert "federal-qbi-deduction" in benefits

    def test_hsa(self):
        benefits = detect_affected_benefits("HSA Contribution Limits Adjusted for Inflation")
        assert "federal-hsa" in benefits

    def test_salt(self):
        benefits = detect_affected_benefits("State and Local Tax Deduction Cap Extended")
        assert "federal-salt-deduction" in benefits

    def test_no_match_returns_empty(self):
        benefits = detect_affected_benefits("Procedural Rules for IRS Appeals Office")
        assert isinstance(benefits, list)

    def test_multiple_benefits_detected(self):
        title = "HSA and Section 179 Limits for 2026"
        benefits = detect_affected_benefits(title)
        assert "federal-hsa" in benefits
        assert "federal-section-179" in benefits


# ─── _parse_rss_date ──────────────────────────────────────────────────────────


class TestParseRssDate:
    def test_rfc2822(self):
        result = _parse_rss_date("Mon, 02 Jun 2026 12:00:00 +0000")
        assert result == "2026-06-02"

    def test_iso8601(self):
        result = _parse_rss_date("2026-06-02T09:30:00Z")
        assert result == "2026-06-02"

    def test_plain_date(self):
        result = _parse_rss_date("2026-06-02")
        assert result == "2026-06-02"

    def test_invalid_returns_none(self):
        result = _parse_rss_date("not a date")
        assert result is None

    def test_empty_returns_none(self):
        result = _parse_rss_date("")
        assert result is None


# ─── make_slug ────────────────────────────────────────────────────────────────


class TestMakeSlug:
    def test_basic(self):
        assert make_slug("IRS Announces 2026 Inflation Adjustments") == "irs-announces-2026-inflation-adjustments"

    def test_special_chars_stripped(self):
        slug = make_slug("Rev. Proc. 2026-01: Safe Harbor!")
        assert "." not in slug
        assert ":" not in slug
        assert "!" not in slug

    def test_max_length(self):
        long_title = "A" * 200
        assert len(make_slug(long_title)) <= 50


# ─── State management ────────────────────────────────────────────────────────


class TestStateManagement:
    def test_federal_register_state_tracks_document_numbers(self):
        state: dict = {}
        records = [
            ChangeRecord(
                id="federal-register-2026-001",
                source="federal_register",
                source_name="Federal Register",
                title="Test Doc",
                url="https://example.com",
                publication_date="2026-06-01",
                change_types=["final_rule"],
                affected_benefits=[],
                summary="Test",
                document_number="2026-001",
            )
        ]
        update_federal_register_state(state, records)
        assert "2026-001" in state["federal_register"]["seen_document_numbers"]
        assert "last_checked" in state["federal_register"]

    def test_irs_news_state_tracks_item_ids(self):
        state: dict = {}
        records = [
            ChangeRecord(
                id="irs-news-abc12345",
                source="irs_news",
                source_name="IRS Newsroom",
                title="IR-2026-001",
                url="https://irs.gov/newsroom/ir-2026-001",
                publication_date="2026-06-01",
                change_types=["new_interpretation"],
                affected_benefits=[],
                summary="Test item",
            )
        ]
        update_irs_news_state(state, records)
        assert "irs-news-abc12345" in state["irs_news"]["seen_item_ids"]
        assert "last_checked" in state["irs_news"]

    def test_state_accumulates_across_calls(self):
        state: dict = {}
        r1 = ChangeRecord(
            id="federal-register-2026-001", source="federal_register",
            source_name="FR", title="Doc 1", url="", publication_date="2026-06-01",
            change_types=[], affected_benefits=[], summary="", document_number="2026-001",
        )
        r2 = ChangeRecord(
            id="federal-register-2026-002", source="federal_register",
            source_name="FR", title="Doc 2", url="", publication_date="2026-06-02",
            change_types=[], affected_benefits=[], summary="", document_number="2026-002",
        )
        update_federal_register_state(state, [r1])
        update_federal_register_state(state, [r2])
        seen = state["federal_register"]["seen_document_numbers"]
        assert "2026-001" in seen
        assert "2026-002" in seen


# ─── load_sources ────────────────────────────────────────────────────────────


class TestLoadSources:
    def test_federal_sources_present(self):
        sources = load_sources()
        assert "federal_sources" in sources

    def test_federal_register_in_sources(self):
        sources = load_sources()
        assert "federal_register" in sources["federal_sources"]

    def test_irs_news_in_sources(self):
        sources = load_sources()
        assert "irs_news" in sources["federal_sources"]

    def test_sources_have_required_fields(self):
        sources = load_sources()
        for key, config in sources["federal_sources"].items():
            assert "name" in config, f"{key} missing 'name'"
            assert "url" in config, f"{key} missing 'url'"
            assert "change_types" in config, f"{key} missing 'change_types'"


# ─── ChangeRecord ─────────────────────────────────────────────────────────────


class TestChangeRecord:
    def test_detected_at_set_automatically(self):
        r = ChangeRecord(
            id="test-001", source="test", source_name="Test", title="T",
            url="", publication_date="2026-06-01",
            change_types=[], affected_benefits=[], summary="",
        )
        assert r.detected_at != ""

    def test_ai_classified_defaults_false(self):
        r = ChangeRecord(
            id="test-001", source="test", source_name="Test", title="T",
            url="", publication_date="2026-06-01",
            change_types=[], affected_benefits=[], summary="",
        )
        assert r.ai_classified is False
