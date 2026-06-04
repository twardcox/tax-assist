"""
validate_documents.py

Cross-checks user_data/documents_index.yaml against documents/ directory
to identify which required documents are present vs. missing.

Usage:
    python scripts/validate_documents.py
    python scripts/validate_documents.py --benefit home-office-deduction
"""

import argparse
from pathlib import Path

import yaml


ROOT = Path(__file__).parent.parent


def load_documents_index() -> dict:
    index_file = ROOT / "user_data" / "documents_index.yaml"
    with open(index_file, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_benefit_library() -> list[dict]:
    benefits = []
    for f in (ROOT / "tax_library").rglob("*.yaml"):
        if "example" in f.name:
            continue
        with open(f, encoding="utf-8") as fh:
            rec = yaml.safe_load(fh)
            if rec and rec.get("id"):
                benefits.append(rec)
    return benefits


def check_file_exists(file_path: str) -> bool:
    if not file_path:
        return False
    full_path = ROOT / file_path
    return full_path.exists()


def validate(benefit_filter: str = None):
    index = load_documents_index()
    benefits = load_benefit_library()

    if benefit_filter:
        benefits = [b for b in benefits if b.get("id") == benefit_filter]
        if not benefits:
            print(f"No benefit found with id: {benefit_filter}")
            return

    print(f"\nUTBIS Document Validation")
    print(f"Benefits with document requirements: {len([b for b in benefits if b.get('required_documents')])}\n")

    for benefit in benefits:
        required = benefit.get("required_documents", [])
        if not required:
            continue
        print(f"  {benefit.get('name', benefit.get('id'))}")
        for doc_entry in required:
            doc = doc_entry.get("document") if isinstance(doc_entry, dict) else doc_entry
            print(f"    [ ] {doc}")
        print()

    print("Document index files referenced:")
    for section_key, section_val in index.items():
        if isinstance(section_val, list):
            for item in section_val:
                if isinstance(item, dict) and item.get("file"):
                    exists = check_file_exists(item["file"])
                    status = "FOUND" if exists else "MISSING"
                    print(f"  [{status}] {item['file']}")
        elif isinstance(section_val, dict) and section_val.get("file"):
            exists = check_file_exists(section_val["file"])
            status = "FOUND" if exists else "MISSING"
            print(f"  [{status}] {section_val['file']}")


def main():
    parser = argparse.ArgumentParser(description="UTBIS Document Validator")
    parser.add_argument("--benefit", type=str, default=None, help="Validate documents for a specific benefit ID")
    args = parser.parse_args()
    validate(benefit_filter=args.benefit)


if __name__ == "__main__":
    main()
