"""
test_rules.py

Tests for the UTBIS rules engine.
Run with: python -m pytest tests/ -v
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import (
    EligibilityStatus,
    OpportunityResult,
    RulesEngine,
    UserFacts,
)


def make_facts(**overrides) -> UserFacts:
    """Build a UserFacts-like object with controlled data for testing."""
    facts = MagicMock(spec=UserFacts)
    facts._data = overrides.get("_data", {})
    facts.has_self_employment.return_value = overrides.get("has_self_employment", False)
    facts.has_any_business.return_value = overrides.get("has_any_business", False)
    facts.has_rental_property.return_value = overrides.get("has_rental_property", False)
    facts.hdhp_enrolled.return_value = overrides.get("hdhp_enrolled", False)
    facts.has_dependents.return_value = overrides.get("has_dependents", False)
    facts.filing_status.return_value = overrides.get("filing_status", None)
    facts.estimated_agi.return_value = overrides.get("estimated_agi", None)
    # Derive first_business from _data so rule methods that call self.f.first_business() work
    businesses = facts._data.get("businesses", {}).get("businesses", [])
    facts.first_business.return_value = businesses[0] if businesses else {}
    return facts


EXAMPLE_BENEFIT = {
    "id": "home-office-deduction",
    "name": "Home Office Deduction",
    "category": "business_deduction",
    "jurisdiction": "federal",
    "risk_level": "low",
    "required_forms": [{"form": "Form 8829"}],
    "required_documents": [],
    "review_required": {"cpa": False},
}


class TestHomeOfficeRule:

    def test_not_applicable_when_no_self_employment(self):
        facts = make_facts(has_self_employment=False)
        engine = RulesEngine(facts)
        result = engine._rule_home_office_deduction(EXAMPLE_BENEFIT)
        assert result.status == EligibilityStatus.NOT_APPLICABLE

    def test_nearly_eligible_when_self_employed_no_home_office_data(self):
        facts = make_facts(
            has_self_employment=True,
            _data={"businesses": {"businesses": [{"entity_type": "sole_prop", "home_office": {"claimed": False}}]}}
        )
        engine = RulesEngine(facts)
        result = engine._rule_home_office_deduction(EXAMPLE_BENEFIT)
        assert result.status == EligibilityStatus.NEARLY_ELIGIBLE

    def test_eligible_now_when_all_data_present(self):
        facts = make_facts(
            has_self_employment=True,
            _data={
                "businesses": {
                    "businesses": [
                        {
                            "entity_type": "sole_prop",
                            "home_office": {
                                "claimed": True,
                                "square_footage": 200,
                            },
                        }
                    ]
                }
            }
        )
        engine = RulesEngine(facts)
        result = engine._rule_home_office_deduction(EXAMPLE_BENEFIT)
        assert result.status == EligibilityStatus.ELIGIBLE_NOW

    def test_eligible_now_has_next_steps(self):
        facts = make_facts(
            has_self_employment=True,
            _data={
                "businesses": {
                    "businesses": [
                        {
                            "entity_type": "llc_single",
                            "home_office": {"claimed": True, "square_footage": 150},
                        }
                    ]
                }
            }
        )
        engine = RulesEngine(facts)
        result = engine._rule_home_office_deduction(EXAMPLE_BENEFIT)
        assert result.next_steps
        assert len(result.next_steps) > 0

    def test_eligible_if_changed_fallback(self):
        facts = make_facts(
            has_self_employment=True,
            _data={"businesses": {"businesses": []}}
        )
        engine = RulesEngine(facts)
        result = engine._rule_home_office_deduction(EXAMPLE_BENEFIT)
        assert result.status in (
            EligibilityStatus.ELIGIBLE_IF_CHANGED,
            EligibilityStatus.NEARLY_ELIGIBLE,
        )


class TestGenericEvaluation:

    def test_unknown_benefit_returns_unknown_status(self):
        facts = make_facts()
        engine = RulesEngine(facts)
        unknown_benefit = {
            "id": "some-obscure-benefit",
            "name": "Some Obscure Benefit",
            "category": "credit",
            "jurisdiction": "federal",
            "risk_level": "low",
            "required_forms": [],
            "required_documents": [],
            "review_required": {},
        }
        result = engine.evaluate(unknown_benefit)
        assert result.status == EligibilityStatus.UNKNOWN

    def test_result_has_benefit_name(self):
        facts = make_facts()
        engine = RulesEngine(facts)
        benefit = {
            "id": "test-benefit",
            "name": "Test Benefit",
            "category": "deduction",
            "jurisdiction": "federal",
            "risk_level": "low",
            "required_forms": [],
            "required_documents": [],
            "review_required": {},
        }
        result = engine.evaluate(benefit)
        assert result.benefit_name == "Test Benefit"
        assert result.benefit_id == "test-benefit"
