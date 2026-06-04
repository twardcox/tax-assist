"""
test_forms.py

Tests for the federal forms registry.
Validates that forms/federal_forms.yaml is well-formed and complete.
"""

import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parent.parent


def load_forms(filename: str) -> list:
    f = ROOT / "forms" / filename
    with open(f) as fh:
        data = yaml.safe_load(fh) or {}
    return data.get("forms", [])


class TestFederalFormsRegistry:

    def test_federal_forms_file_exists(self):
        assert (ROOT / "forms" / "federal_forms.yaml").exists()

    def test_forms_is_a_list(self):
        forms = load_forms("federal_forms.yaml")
        assert isinstance(forms, list)

    def test_all_forms_have_required_fields(self):
        forms = load_forms("federal_forms.yaml")
        required_fields = ["form_number", "form_name", "jurisdiction", "deadline"]
        for form in forms:
            for field in required_fields:
                assert field in form, f"Form {form.get('form_number', '?')} missing field: {field}"

    def test_all_forms_have_related_benefits(self):
        forms = load_forms("federal_forms.yaml")
        for form in forms:
            related = form.get("related_benefits", [])
            assert isinstance(related, list), \
                f"Form {form['form_number']}: related_benefits must be a list"

    def test_no_duplicate_form_numbers(self):
        forms = load_forms("federal_forms.yaml")
        numbers = [f["form_number"] for f in forms]
        assert len(numbers) == len(set(numbers)), "Duplicate form numbers found"

    def test_key_forms_present(self):
        forms = load_forms("federal_forms.yaml")
        numbers = {f["form_number"] for f in forms}
        expected = {
            "Schedule C",
            "Form 4562",
            "Form 8995",
            "Form 2553",
            "Form 8824",
            "Form 8582",
            "Form 8889",
            "Form 8829",
        }
        missing = expected - numbers
        assert not missing, f"Key forms missing from registry: {missing}"

    def test_jurisdictions_are_valid(self):
        forms = load_forms("federal_forms.yaml")
        valid = {"federal", "state", "local"}
        for form in forms:
            assert form["jurisdiction"] in valid, \
                f"Form {form['form_number']}: invalid jurisdiction '{form['jurisdiction']}'"

    def test_state_forms_file_exists(self):
        assert (ROOT / "forms" / "state_forms.yaml").exists()

    def test_local_forms_file_exists(self):
        assert (ROOT / "forms" / "local_forms.yaml").exists()
