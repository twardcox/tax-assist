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
    # Support both _data-based and direct businesses_list override
    biz_from_data = facts._data.get("businesses", {}).get("businesses", [])
    biz_list = overrides.get("businesses_list", biz_from_data)
    facts.first_business.return_value = biz_list[0] if biz_list else {}
    facts.businesses.return_value = biz_list
    facts.state.return_value = overrides.get("state", None)
    facts.business_nexus_states.return_value = overrides.get("business_nexus_states", set())
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


PTE_BENEFIT = {
    "id": "pte-election",
    "name": "Pass-Through Entity (PTE) Election",
    "category": "deduction",
    "jurisdiction": "state",
    "risk_level": "low",
    "required_forms": [],
    "required_documents": [],
    "review_required": {},
}


class TestPteElectionRule:
    """Tests for _rule_pte_election covering representative scenarios."""

    def test_not_applicable_when_no_self_employment(self):
        facts = make_facts(has_self_employment=False)
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.NOT_APPLICABLE

    def test_nearly_eligible_when_no_state_and_no_operating_states(self):
        facts = make_facts(
            has_self_employment=True,
            state=None,
            business_nexus_states=set(),
            businesses_list=[],
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.NEARLY_ELIGIBLE
        assert "household.residence.state" in result.missing_facts
        assert "businesses.businesses[*].operating_states" in result.missing_facts

    def test_nearly_eligible_when_residence_in_non_pte_state_and_no_ops(self):
        # HI is not in _PTE_STATES, prompts user to add operating_states
        facts = make_facts(
            has_self_employment=True,
            state="HI",
            business_nexus_states={"HI"},
            businesses_list=[{}],
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.NEARLY_ELIGIBLE
        assert "businesses.businesses[*].operating_states" in result.missing_facts

    def test_not_applicable_when_all_nexus_states_are_no_income_tax(self):
        # TX and FL have no income tax — no PTE nexus possible
        facts = make_facts(
            has_self_employment=True,
            state="TX",
            business_nexus_states={"TX", "FL"},
            businesses_list=[{"operating_states": ["FL"]}],
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.NOT_APPLICABLE

    def test_nearly_eligible_when_pte_state_but_no_profit_recorded(self):
        facts = make_facts(
            has_self_employment=True,
            state="CA",
            business_nexus_states={"CA"},
            businesses_list=[{}],
            estimated_agi=200_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.NEARLY_ELIGIBLE
        assert "businesses.financials.net_profit_loss" in result.missing_facts

    def test_eligible_if_changed_when_agi_below_threshold(self):
        # AGI < 150k → SALT cap may not be binding
        facts = make_facts(
            has_self_employment=True,
            state="CA",
            business_nexus_states={"CA"},
            businesses_list=[{"financials": {"net_profit_loss": 50_000}}],
            estimated_agi=100_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.ELIGIBLE_IF_CHANGED
        assert "CA" in result.message

    def test_eligible_now_when_agi_at_or_above_threshold(self):
        facts = make_facts(
            has_self_employment=True,
            state="CA",
            business_nexus_states={"CA"},
            businesses_list=[{"financials": {"net_profit_loss": 200_000}}],
            estimated_agi=250_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.ELIGIBLE_NOW
        assert "CA" in result.message

    def test_eligible_now_residence_is_primary_in_multi_state_nexus(self):
        # Residence CA (PTE) + operating in NY (PTE); CA should be primary
        facts = make_facts(
            has_self_employment=True,
            state="CA",
            business_nexus_states={"CA", "NY"},
            businesses_list=[{
                "financials": {"net_profit_loss": 100_000},
                "operating_states": ["NY"],
            }],
            estimated_agi=200_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.ELIGIBLE_NOW
        assert "CA" in result.message
        assert "NY" in result.message

    def test_eligible_now_non_residence_pte_state_includes_note(self):
        # Residence TX (no income tax); operating in CA — CA is the only PTE nexus
        facts = make_facts(
            has_self_employment=True,
            state="TX",
            business_nexus_states={"TX", "CA"},
            businesses_list=[{
                "financials": {"net_profit_loss": 100_000},
                "operating_states": ["CA"],
            }],
            estimated_agi=200_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.ELIGIBLE_NOW
        assert "CA" in result.message
        # Note should mention that residence (TX) has no PTE election
        assert "TX" in result.message

    def test_eligible_now_formation_state_mismatch_includes_note(self):
        # Formation state DE not in nexus states → formation_note appears
        facts = make_facts(
            has_self_employment=True,
            state="CA",
            business_nexus_states={"CA"},
            businesses_list=[{
                "formation_state": "DE",
                "financials": {"net_profit_loss": 100_000},
            }],
            estimated_agi=200_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        assert result.status == EligibilityStatus.ELIGIBLE_NOW
        assert "DE" in result.message

    def test_profit_summed_across_all_businesses(self):
        # First business has $0 profit, second has positive profit → sum > 0 → not NEARLY_ELIGIBLE
        facts = make_facts(
            has_self_employment=True,
            state="CA",
            business_nexus_states={"CA"},
            businesses_list=[
                {"financials": {"net_profit_loss": 0}},
                {"financials": {"net_profit_loss": 80_000}},
            ],
            estimated_agi=200_000,
        )
        engine = RulesEngine(facts)
        result = engine._rule_pte_election(PTE_BENEFIT)
        # Combined profit is positive → should not be NEARLY_ELIGIBLE for missing profit
        assert result.status != EligibilityStatus.NEARLY_ELIGIBLE
        assert "businesses.financials.net_profit_loss" not in (result.missing_facts or [])
