"""
test_eligibility.py

Integration-style tests for eligibility evaluation using real YAML files.
Tests that the user_data/ and tax_library/ schemas load correctly.
"""

import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from scan_opportunities import BenefitLibrary, UserFacts, OpportunityScanner, EligibilityStatus


class TestUserFactsLoading:

    def test_user_facts_loads_without_error(self):
        facts = UserFacts()
        assert facts._data is not None

    def test_household_yaml_parseable(self):
        f = ROOT / "user_data" / "household.yaml"
        assert f.exists(), "household.yaml must exist"
        with open(f) as fh:
            data = yaml.safe_load(fh)
        assert isinstance(data, dict)

    def test_businesses_yaml_parseable(self):
        f = ROOT / "user_data" / "businesses.yaml"
        assert f.exists()
        with open(f) as fh:
            data = yaml.safe_load(fh)
        assert isinstance(data, dict)

    def test_all_user_data_files_parseable(self):
        data_dir = ROOT / "user_data"
        for yaml_file in data_dir.glob("*.yaml"):
            with open(yaml_file) as f:
                data = yaml.safe_load(f)
            assert data is None or isinstance(data, dict), f"{yaml_file.name} must be a dict or empty"

    def test_get_missing_fact_returns_default(self):
        facts = UserFacts()
        result = facts.get("household.nonexistent_field", default="MISSING")
        assert result == "MISSING"

    def test_blank_facts_has_no_self_employment(self):
        facts = UserFacts()
        # With all-blank YAML files, self-employment should be False
        # (no businesses with entity_type set)
        assert facts.has_self_employment() is False

    def test_blank_facts_has_no_rental(self):
        facts = UserFacts()
        assert facts.has_rental_property() is False


class TestBenefitLibraryLoading:

    def test_library_loads_without_error(self):
        library = BenefitLibrary()
        assert isinstance(library.benefits, list)

    def test_example_benefit_schema_valid(self):
        f = ROOT / "tax_library" / "example-benefit.yaml"
        assert f.exists()
        with open(f) as fh:
            data = yaml.safe_load(fh)
        assert "id" in data
        assert "name" in data
        assert "status" in data
        assert "benefit_type" in data
        assert "risk_level" in data

    def test_example_benefit_excluded_from_library(self):
        library = BenefitLibrary()
        ids = [b["id"] for b in library.benefits]
        assert "home-office-deduction" not in ids, \
            "example-benefit.yaml should not load into library (example files are skipped)"


class TestScannerWithBlankFacts:

    def test_scanner_runs_without_error(self):
        scanner = OpportunityScanner()
        scanner.scan()
        assert isinstance(scanner.results, list)

    def test_scanner_produces_no_eligible_now_for_blank_facts(self):
        scanner = OpportunityScanner()
        scanner.scan()
        eligible = [r for r in scanner.results if r.status == EligibilityStatus.ELIGIBLE_NOW]
        assert len(eligible) == 0, \
            "Blank user facts should produce no eligible_now results — all facts are empty"
