"""
update_tax_law.py

Phase 4 — Tax law update monitor.

Fully implemented (6 live sources):
  - Federal Register API (federalregister.gov/api/v1) — IRS-filtered JSON API
  - IRS News (irs.gov/newsroom HTML scraper — IRS retired their RSS feeds)
  - IRS Publications (apps.irs.gov picklist, BeautifulSoup)
  - Internal Revenue Bulletin (irs.gov/irb links, BeautifulSoup)
  - Treasury Regulations (home.treasury.gov RSS, tax-keyword filtered)
  - Congress.gov tax legislation (api.congress.gov DEMO_KEY; set CONGRESS_API_KEY env for higher limits)
  - Pattern-based change classification (12 change types)
  - Claude Haiku AI classification when ANTHROPIC_API_KEY is set
  - Incremental state (state/update_state.json) — only new items each run
  - Change records written to tax_library/future_law/
  - Summary report written to reports/tax_law_updates.md

  - US Tax Court opinions (DAWSON API; set DAWSON_USERNAME + DAWSON_PASSWORD in .env)
  - 10-state revenue department scrapers (CA, NY, IL, MA, NJ, CO, OR, PA, OH, GA)

Usage:
    python scripts/update_tax_law.py
    python scripts/update_tax_law.py --source federal_register
    python scripts/update_tax_law.py --source irs_news
    python scripts/update_tax_law.py --source irs_publications
    python scripts/update_tax_law.py --source internal_revenue_bulletin
    python scripts/update_tax_law.py --source treasury_regulations
    python scripts/update_tax_law.py --source tax_court
    python scripts/update_tax_law.py --source congress_legislation
    python scripts/update_tax_law.py --dry-run
    python scripts/update_tax_law.py --since 2025-01-01
    python scripts/update_tax_law.py --days 30
    python scripts/update_tax_law.py --no-ai
"""

import argparse
import hashlib
import json
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
import yaml

try:
    import anthropic as _anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    _anthropic = None
    ANTHROPIC_AVAILABLE = False


ROOT = Path(__file__).parent.parent
STATE_FILE = ROOT / "state" / "update_state.json"
FUTURE_LAW_DIR = ROOT / "tax_library" / "future_law"
REPORT_FILE = ROOT / "reports" / "tax_law_updates.md"

FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json"
FEDERAL_REGISTER_FIELDS = [
    "title", "abstract", "html_url", "publication_date",
    "type", "document_number", "action", "agencies",
]

IRS_NEWSROOM_URL = "https://www.irs.gov/newsroom"

# Keyword patterns for each change type (applied to title + abstract, case-insensitive)
CHANGE_TYPE_PATTERNS: dict[str, list[str]] = {
    "new_benefit": [
        r"new (credit|deduction|exclusion|benefit)",
        r"(establishes?|creates?|enacts?)\s+(a\s+)?new",
        r"inflation reduction act",
    ],
    "changed_threshold": [
        r"(adjust|increas|decreas)\w+ for inflation",
        r"inflation[- ]adjusted",
        r"(annual|contribution|income|dollar)\s+limit",
        r"phaseout|phase-out|phase out",
        r"indexed to inflation",
        r"\$[\d,]+\s+(limit|threshold|maximum|minimum|cap)",
        r"2026\s+(inflation|amount|limit)",
    ],
    "expired_benefit": [
        r"(expire[sd]?|sunset|terminated|no longer\s+(available|effective))",
        r"(credit|deduction|provision)\s+expired",
    ],
    "future_effective_law": [
        r"effective\s+(date|for tax year)",
        r"will take effect",
        r"beginning\s+(in|with)\s+(tax year|january|20\d\d)",
    ],
    "new_form": [
        r"(new|revised|updated)\s+form\s+\d+",
        r"form\s+\d+\s+(revised|updated|replaced|redesigned)",
        r"schedule\s+[A-Z]+\s+(revised|new|updated)",
    ],
    "deadline_change": [
        r"(filing\s+)?deadline",
        r"due date\s+(changed|extended|modified)",
        r"extended\s+to\s+(april|march|october)",
        r"automatic\s+extension",
    ],
    "risk_change": [
        r"(increased?\s+)?(audit|examination|enforcement|scrutiny)",
        r"compliance\s+(initiative|program|campaign)",
        r"listed\s+transaction",
        r"(identified|targeted)\s+for\s+(audit|examination)",
        r"abusive\s+(tax\s+)?shelter",
    ],
    "new_interpretation": [
        r"(clarif|interpret)\w+",
        r"\bguidance\s+on\b",
        r"(rules?|regulations?)\s+under\s+(section|§)\s*\d+",
        r"frequently\s+asked\s+questions",
    ],
    "proposed_rule": [
        r"proposed\s+rule",
        r"notice\s+of\s+proposed\s+rulemaking",
        r"\bNPRM\b",
        r"\bREG-\d{6}-\d{2}\b",
    ],
    "revenue_ruling": [
        r"revenue\s+ruling",
        r"\bRev\.?\s*Rul\.?\b",
    ],
    "revenue_procedure": [
        r"revenue\s+procedure",
        r"\bRev\.?\s*Proc\.?\b",
    ],
    "final_rule": [
        r"final\s+(rule|regulations?)",
        r"\bT\.?D\.?\s*\d{4,}\b",
        r"Treasury\s+Decision",
        r"TD\s+\d{4,}",
    ],
}

# Maps benefit IDs to trigger keywords for affected-benefit detection
BENEFIT_KEYWORDS: dict[str, list[str]] = {
    "federal-qbi-deduction": ["qbi", "199a", "qualified business income", "pass-through deduction"],
    "federal-s-corp-election": ["s corp", "s-corp", "s corporation", "form 2553", "reasonable compensation"],
    "federal-sep-ira": ["sep-ira", "sep ira", "simplified employee pension"],
    "federal-solo-401k": ["solo 401k", "solo 401(k)", "individual 401k", "one-participant 401"],
    "federal-self-employed-health-insurance": ["self-employed health", "se health insurance"],
    "federal-hsa": ["hsa", "health savings account", "high deductible health", "hdhp"],
    "federal-section-179": ["section 179", "§ 179", "179 expensing", "first-year expensing"],
    "federal-bonus-depreciation": ["bonus depreciation", "additional first year", "168(k)"],
    "federal-business-vehicle": ["vehicle", "automobile", "mileage rate", "listed property", "luxury auto"],
    "federal-real-estate-depreciation": ["residential rental", "27.5 year", "rental depreciation", "rental property"],
    "federal-passive-activity-loss": ["passive activity", "passive loss", "material participation"],
    "federal-1031-exchange": ["1031", "like-kind exchange", "deferred exchange"],
    "federal-augusta-rule": ["augusta rule", "14-day rule", "section 280a", "home rental"],
    "federal-charitable-contribution": ["charitable", "donation", "501(c)(3)", "qualified charitable distribution", "qcd"],
    "federal-backdoor-roth": ["backdoor roth", "roth ira", "roth conversion", "nondeductible ira"],
    "federal-child-tax-credit": ["child tax credit", "ctc", "additional child tax credit", "actc"],
    "federal-child-care-credit": ["child care credit", "dependent care", "form 2441", "child and dependent"],
    "federal-eitc": ["earned income credit", "eitc", "earned income tax credit"],
    "federal-american-opportunity-credit": ["american opportunity", "aotc", "hope credit", "tuition credit"],
    "federal-lifetime-learning-credit": ["lifetime learning", "llc", "education credit", "qualified education"],
    "federal-clean-energy-credit": ["clean energy", "solar", "residential clean energy", "section 25d", "25d credit"],
    "federal-ev-credit": ["electric vehicle", "clean vehicle credit", "section 30d", "plug-in", "ev credit"],
    "federal-mortgage-interest": ["mortgage interest", "home mortgage", "acquisition debt", "home equity"],
    "federal-salt-deduction": ["state and local tax", "salt deduction", "property tax deduction", "$10,000 cap"],
    "federal-section-121-exclusion": ["section 121", "home sale exclusion", "primary residence exclusion"],
    "federal-foreign-earned-income": ["foreign earned income", "feie", "form 2555", "foreign housing"],
    "federal-opportunity-zone": ["opportunity zone", "qualified opportunity zone", "qoz", "qualified opportunity fund"],
    "federal-annual-gift-exclusion": ["annual gift exclusion", "gift tax exclusion", "annual exclusion amount"],
    "federal-real-estate-professional": ["real estate professional", "rep status", "750 hours", "material participation real estate"],
    "federal-cost-segregation": ["cost segregation", "component depreciation", "accelerated depreciation study"],
}


# ─── Data model ───────────────────────────────────────────────────────────────


@dataclass
class ChangeRecord:
    id: str
    source: str
    source_name: str
    title: str
    url: str
    publication_date: str
    change_types: list[str]
    affected_benefits: list[str]
    summary: str
    document_number: str = ""
    document_type: str = ""
    raw_abstract: str = ""
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    ai_classified: bool = False
    ai_summary: str = ""


# ─── State management ─────────────────────────────────────────────────────────


def load_state() -> dict:
    if STATE_FILE.exists():
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, default=str)


def load_sources() -> dict:
    with open(ROOT / "config" / "sources.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


# ─── Classification helpers ───────────────────────────────────────────────────


def classify_change_types(title: str, abstract: str = "") -> list[str]:
    """Pattern-match title+abstract to produce a list of change type labels."""
    text = (title + " " + abstract).lower()
    matched = []
    for change_type, patterns in CHANGE_TYPE_PATTERNS.items():
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            matched.append(change_type)
    return matched or ["new_interpretation"]


def detect_affected_benefits(title: str, abstract: str = "") -> list[str]:
    """Keyword-match title+abstract to the benefit IDs that may be affected."""
    text = (title + " " + abstract).lower()
    return [
        bid for bid, keywords in BENEFIT_KEYWORDS.items()
        if any(kw.lower() in text for kw in keywords)
    ]


def make_slug(title: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", title.lower())
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return slug[:50]


# ─── Change record I/O ────────────────────────────────────────────────────────


def save_change_record(record: ChangeRecord, dry_run: bool = False):
    filename = f"{record.publication_date}-{make_slug(record.title)}.yaml"
    path = FUTURE_LAW_DIR / filename
    if dry_run:
        print(f"    [DRY RUN] Would write: {path.name}")
        return
    FUTURE_LAW_DIR.mkdir(parents=True, exist_ok=True)
    data = asdict(record)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    print(f"    Saved: {path.name}")


# ─── Federal Register handler ─────────────────────────────────────────────────


def fetch_federal_register(since_date: str, state: dict) -> list[ChangeRecord]:
    """Fetch IRS documents from the Federal Register REST API since since_date."""
    seen: set[str] = set(state.get("federal_register", {}).get("seen_document_numbers", []))

    params = [
        ("conditions[agencies][]", "internal-revenue-service"),
        ("conditions[publication_date][gte]", since_date),
        ("per_page", "100"),
        ("order", "newest"),
    ]
    for f in FEDERAL_REGISTER_FIELDS:
        params.append(("fields[]", f))

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(FEDERAL_REGISTER_API, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        print(f"    Federal Register fetch error: {exc}")
        return []

    records: list[ChangeRecord] = []
    for doc in data.get("results", []):
        doc_num = doc.get("document_number", "")
        if doc_num and doc_num in seen:
            continue

        title = doc.get("title", "").strip()
        abstract = (doc.get("abstract") or "").strip()
        url = doc.get("html_url", "")
        pub_date = doc.get("publication_date", since_date)
        doc_type = doc.get("type", "")

        records.append(ChangeRecord(
            id=f"federal-register-{doc_num or make_slug(title)}",
            source="federal_register",
            source_name="Federal Register — Treasury/IRS Rules",
            title=title,
            url=url,
            publication_date=pub_date,
            change_types=classify_change_types(title, abstract),
            affected_benefits=detect_affected_benefits(title, abstract),
            summary=abstract[:500] if abstract else title,
            document_number=doc_num,
            document_type=doc_type,
            raw_abstract=abstract,
        ))

    return records


def update_federal_register_state(state: dict, records: list[ChangeRecord]):
    src = state.setdefault("federal_register", {})
    seen = set(src.get("seen_document_numbers", []))
    for r in records:
        if r.document_number:
            seen.add(r.document_number)
    src["seen_document_numbers"] = list(seen)
    src["last_checked"] = datetime.now().isoformat(timespec="seconds")


# ─── IRS News handler ────────────────────────────────────────────────────────


def _parse_rss_date(date_str: str) -> Optional[str]:
    """Convert RSS pubDate to YYYY-MM-DD string. Returns None on failure."""
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


_MONTH_ABBREV_RE = re.compile(
    r"\b(January|February|March|April|May|June|July|August|September|October|November|December"
    r"|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(20\d{2})\b",
    re.IGNORECASE,
)
_MONTH_MAP = {
    "january": "01", "jan": "01", "february": "02", "feb": "02",
    "march": "03", "mar": "03", "april": "04", "apr": "04",
    "may": "05", "june": "06", "jun": "06", "july": "07", "jul": "07",
    "august": "08", "aug": "08", "september": "09", "sep": "09",
    "october": "10", "oct": "10", "november": "11", "nov": "11",
    "december": "12", "dec": "12",
}


def _parse_month_day_year(s: str) -> Optional[str]:
    """Parse 'May 29, 2026' or 'May 29 2026' → 'YYYY-MM-DD'."""
    m = _MONTH_ABBREV_RE.search(s)
    if m:
        month = _MONTH_MAP.get(m.group(1).lower(), "01")
        return f"{m.group(3)}-{month}-{m.group(2).zfill(2)}"
    return None


def fetch_irs_news(since_date: str, state: dict) -> list[ChangeRecord]:
    """
    Scrape the IRS newsroom (irs.gov/newsroom) for recent news items.
    IRS retired their RSS feeds; this scrapes the newsroom HTML directly.
    Extracts news links matching /newsroom/irs-* with inline dates.
    """
    from bs4 import BeautifulSoup

    seen: set[str] = set(state.get("irs_news", {}).get("seen_item_ids", []))
    soup = _fetch_html(IRS_NEWSROOM_URL)
    if soup is None:
        return []

    records: list[ChangeRecord] = []
    news_link_re = re.compile(r"^/newsroom/irs-[a-z]", re.IGNORECASE)

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not news_link_re.match(href):
            continue
        title = a.get_text(strip=True)
        if not title or len(title) < 10:
            continue

        # Walk up the DOM to find the date near this link
        pub_date: Optional[str] = None
        node = a.parent
        for _ in range(5):
            if node is None:
                break
            text = node.get_text(" ", strip=True)
            pub_date = _parse_month_day_year(text)
            if pub_date:
                break
            node = node.parent

        if not pub_date or pub_date < since_date:
            continue  # skip category links and items outside the window

        full_url = f"https://www.irs.gov{href}"
        item_id = f"irs-news-{hashlib.md5(href.encode()).hexdigest()[:8]}"
        if item_id in seen:
            continue

        records.append(ChangeRecord(
            id=item_id,
            source="irs_news",
            source_name="IRS Newsroom",
            title=title,
            url=full_url,
            publication_date=pub_date,
            change_types=classify_change_types(title),
            affected_benefits=detect_affected_benefits(title),
            summary=title,
        ))

    return records


def update_irs_news_state(state: dict, records: list[ChangeRecord]):
    src = state.setdefault("irs_news", {})
    seen = set(src.get("seen_item_ids", []))
    for r in records:
        seen.add(r.id)
    src["seen_item_ids"] = list(seen)
    src["last_checked"] = datetime.now().isoformat(timespec="seconds")


# ─── AI classification ────────────────────────────────────────────────────────

_AI_SYSTEM_PROMPT = """\
You are a tax law analyst for UTBIS, a tax benefit intelligence tool.
Given a tax document title and abstract, respond with JSON only — no prose:
{
  "change_types": ["<one or more valid types>"],
  "affected_benefits": ["<zero or more benefit-id slugs from the list below>"],
  "summary": "<1-2 sentence plain-English summary for a tax professional>"
}

Valid change_types:
  new_benefit, changed_threshold, expired_benefit, future_effective_law,
  new_form, deadline_change, risk_change, new_interpretation,
  proposed_rule, revenue_ruling, revenue_procedure, final_rule

Valid benefit slugs:
  federal-qbi-deduction, federal-s-corp-election, federal-sep-ira,
  federal-solo-401k, federal-self-employed-health-insurance, federal-hsa,
  federal-section-179, federal-bonus-depreciation, federal-business-vehicle,
  federal-real-estate-depreciation, federal-passive-activity-loss,
  federal-1031-exchange, federal-augusta-rule, federal-charitable-contribution,
  federal-backdoor-roth, federal-child-tax-credit, federal-child-care-credit,
  federal-eitc, federal-american-opportunity-credit, federal-lifetime-learning-credit,
  federal-clean-energy-credit, federal-ev-credit, federal-mortgage-interest,
  federal-salt-deduction, federal-section-121-exclusion, federal-foreign-earned-income,
  federal-opportunity-zone, federal-annual-gift-exclusion,
  federal-real-estate-professional, federal-cost-segregation\
"""


def ai_classify_changes(records: list[ChangeRecord]) -> list[ChangeRecord]:
    """Refine classification via Claude for records that have a meaningful abstract."""
    if not ANTHROPIC_AVAILABLE or not os.environ.get("ANTHROPIC_API_KEY"):
        return records

    client = _anthropic.Anthropic()
    enriched: list[ChangeRecord] = []

    for record in records:
        if len(record.raw_abstract) < 50:
            enriched.append(record)
            continue
        prompt = f"Title: {record.title}\n\nAbstract: {record.raw_abstract[:2000]}"
        try:
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=[{
                    "type": "text",
                    "text": _AI_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text
            match = re.search(r"\{[\s\S]+\}", raw)
            if match:
                parsed = json.loads(match.group())
                if parsed.get("change_types"):
                    record.change_types = parsed["change_types"]
                record.affected_benefits = parsed.get("affected_benefits", record.affected_benefits)
                record.ai_summary = parsed.get("summary", "")
                record.ai_classified = True
        except Exception as exc:
            print(f"    AI classification skipped ({type(exc).__name__}): {record.title[:60]}")
        enriched.append(record)

    return enriched


# ─── Scraper helpers ─────────────────────────────────────────────────────────

_HEADERS = {"User-Agent": "UTBIS/1.0 tax-research-tool (t.ward.cox@gmail.com)"}


def _fetch_html(url: str, timeout: int = 30) -> Optional["BeautifulSoup"]:
    """Fetch a page and return a BeautifulSoup object, or None on failure."""
    from bs4 import BeautifulSoup
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url, headers=_HEADERS)
            resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as exc:
        print(f"    Fetch error ({url[:60]}): {exc}")
        return None


def _simple_state(state: dict, key: str, records: list[ChangeRecord]):
    """Generic state updater: tracks seen IDs in state[key]['seen_item_ids']."""
    src = state.setdefault(key, {})
    seen = set(src.get("seen_item_ids", []))
    for r in records:
        seen.add(r.id)
    src["seen_item_ids"] = list(seen)
    src["last_checked"] = datetime.now().isoformat(timespec="seconds")


# ─── IRS Publications ────────────────────────────────────────────────────────


def fetch_irs_publications(since_date: str, state: dict) -> list[ChangeRecord]:
    """
    Scrape the IRS forms/publications picklist filtered by posted year.
    URL: apps.irs.gov/app/picklist/list/formsPublications.html
    Table columns: Product Number | Title | Revision Date | Posted Date (MM/DD/YYYY)

    Uses criteria=postedDate&value=YYYY to fetch publications posted in each
    year from since_date's year through the current year.
    """
    seen: set[str] = set(state.get("irs_publications", {}).get("seen_item_ids", []))
    base = "https://apps.irs.gov/app/picklist/list/formsPublications.html"
    since_year = int(since_date[:4])
    current_year = datetime.now().year
    years = list(range(since_year, current_year + 1))

    records: list[ChangeRecord] = []
    for year in years:
        url = (
            f"{base}?value={year}&criteria=postedDate&results="
            f"&resultsPerPage=200&indexOfFirstRow=0"
            f"&sortColumn=postedDate&isDescending=true"
        )
        soup = _fetch_html(url)
        if soup is None:
            continue

        table = soup.find("table", class_="pup-table") or soup.find("table")
        if table is None:
            continue

        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            form_num = cells[0].get_text(strip=True)
            title = cells[1].get_text(strip=True)
            rev_date_str = cells[2].get_text(strip=True)
            posted_date_str = cells[3].get_text(strip=True) if len(cells) > 3 else ""

            pub_date = _parse_mm_dd_yyyy(posted_date_str) or _parse_month_year(rev_date_str)
            if not pub_date or pub_date < since_date:
                continue

            link_tag = cells[1].find("a") or cells[0].find("a")
            href = link_tag["href"] if link_tag and link_tag.get("href") else ""
            full_url = f"https://apps.irs.gov{href}" if href.startswith("/") else href

            # Deduplicate across years using form number + revision date
            item_id = f"irs-pub-{hashlib.md5((form_num + rev_date_str).encode()).hexdigest()[:8]}"
            if item_id in seen:
                continue

            records.append(ChangeRecord(
                id=item_id,
                source="irs_publications",
                source_name="IRS Publications",
                title=f"{form_num} — {title}",
                url=full_url,
                publication_date=pub_date,
                change_types=classify_change_types(title),
                affected_benefits=detect_affected_benefits(title),
                summary=f"Posted {posted_date_str or rev_date_str}: {form_num} {title}",
            ))

    return records


def _parse_mm_dd_yyyy(s: str) -> Optional[str]:
    """Parse 'MM/DD/YYYY' → 'YYYY-MM-DD'. Returns None on failure."""
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", s.strip())
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    return None


def _parse_month_year(s: str) -> Optional[str]:
    """Parse 'Jan 2026' or 'January 2026' or '01/2026' → 'YYYY-MM-01'."""
    s = s.strip()
    for fmt in ("%b %Y", "%B %Y", "%m/%Y", "%Y-%m"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-01")
        except ValueError:
            continue
    # Try plain year
    m = re.search(r"\b(20\d{2})\b", s)
    return f"{m.group()}-01-01" if m else None


def update_irs_publications_state(state: dict, records: list[ChangeRecord]):
    _simple_state(state, "irs_publications", records)


# ─── Internal Revenue Bulletin ───────────────────────────────────────────────


def fetch_internal_revenue_bulletin(since_date: str, state: dict) -> list[ChangeRecord]:
    """
    Scrape irs.gov/irb/ for new Internal Revenue Bulletins.
    Looks for links matching /irb/YYYY-NN_IRB and extracts their dates.
    """
    seen: set[str] = set(state.get("internal_revenue_bulletin", {}).get("seen_item_ids", []))
    soup = _fetch_html("https://www.irs.gov/irb/")
    if soup is None:
        return []

    since_year = int(since_date[:4])
    records: list[ChangeRecord] = []

    for a in soup.find_all("a", href=re.compile(r"/irb/", re.I)):
        href = a["href"]
        text = a.get_text(strip=True)

        # Extract bulletin number/year from href, e.g. /irb/2026-23_IRB or /irb/2026-23
        m = re.search(r"/irb/(\d{4})-(\d+)", href, re.I)
        if not m:
            continue
        year, num = int(m.group(1)), int(m.group(2))
        if year < since_year:
            continue

        full_url = f"https://www.irs.gov{href}" if href.startswith("/") else href
        item_id = f"irb-{year}-{num:02d}"
        if item_id in seen:
            continue

        # Approximate date: bulletins are weekly, use year + week estimate
        pub_date = f"{year}-01-01"
        records.append(ChangeRecord(
            id=item_id,
            source="internal_revenue_bulletin",
            source_name="Internal Revenue Bulletin",
            title=text or f"IRB {year}-{num:02d}",
            url=full_url,
            publication_date=pub_date,
            change_types=["revenue_ruling"],  # IRBs contain rulings and procedures
            affected_benefits=detect_affected_benefits(text),
            summary=f"New Internal Revenue Bulletin {year}-{num:02d}: {text}",
        ))

    return records


def update_internal_revenue_bulletin_state(state: dict, records: list[ChangeRecord]):
    _simple_state(state, "internal_revenue_bulletin", records)


# ─── Treasury Regulations ────────────────────────────────────────────────────


_TAX_KEYWORDS_RE = re.compile(
    r"\b(tax|IRS|Internal Revenue|Treasury|deduction|credit|depreciation|"
    r"regulation|ruling|T\.D\.|REG-|Rev\. Proc|section \d+)\b",
    re.IGNORECASE,
)


def fetch_treasury_regulations(since_date: str, state: dict) -> list[ChangeRecord]:
    """
    Monitor Treasury's RSS feed (rss.xml) filtered for tax-relevant announcements.
    Falls back to the tax regulatory process page for additional links.
    """
    seen: set[str] = set(state.get("treasury_regulations", {}).get("seen_item_ids", []))
    records: list[ChangeRecord] = []

    # ── RSS feed ──────────────────────────────────────────────────────────────
    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.get("https://home.treasury.gov/rss.xml", headers=_HEADERS)
            resp.raise_for_status()
        root = ET.fromstring(resp.text)
        for item in root.findall(".//item"):
            def _t(tag: str) -> str:
                el = item.find(tag)
                return (el.text or "").strip() if el is not None else ""

            title = _t("title")
            link = _t("link")
            description = re.sub(r"<[^>]+>", "", _t("description"))
            guid = _t("guid") or link
            pub_date = _parse_rss_date(_t("pubDate")) or since_date

            if pub_date < since_date:
                continue
            # Only keep items that mention tax topics
            if not _TAX_KEYWORDS_RE.search(title + " " + description):
                continue

            item_id = f"treasury-rss-{hashlib.md5(guid.encode()).hexdigest()[:8]}"
            if item_id in seen:
                continue

            records.append(ChangeRecord(
                id=item_id,
                source="treasury_regulations",
                source_name="Treasury Regulations",
                title=title,
                url=link,
                publication_date=pub_date,
                change_types=classify_change_types(title, description),
                affected_benefits=detect_affected_benefits(title, description),
                summary=description[:500],
                raw_abstract=description,
            ))
    except Exception as exc:
        print(f"    Treasury RSS error: {exc}")

    return records


def update_treasury_regulations_state(state: dict, records: list[ChangeRecord]):
    _simple_state(state, "treasury_regulations", records)


# ─── US Tax Court ────────────────────────────────────────────────────────────


_DAWSON_BASE = "https://public-api-green.dawson.ustaxcourt.gov"


def _dawson_id_token(state: dict) -> Optional[str]:
    """Return a valid DAWSON idToken, authenticating if needed. Caches in state['dawson_auth']."""
    username = os.environ.get("DAWSON_USERNAME")
    password = os.environ.get("DAWSON_PASSWORD")
    if not username or not password:
        return None

    auth = state.get("dawson_auth", {})
    id_token = auth.get("id_token")
    expires_at = auth.get("expires_at", "")

    if id_token and expires_at > datetime.now().isoformat(timespec="seconds"):
        return id_token

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{_DAWSON_BASE}/auth/login",
                json={"email": username, "password": password},
                headers=_HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
        id_token = data.get("idToken") or data.get("token") or data.get("id_token")
        if not id_token:
            print(f"    Tax Court: DAWSON login succeeded but no idToken in response: {list(data.keys())}")
            return None
        expires_at = (datetime.now() + timedelta(minutes=55)).isoformat(timespec="seconds")
        state["dawson_auth"] = {"id_token": id_token, "expires_at": expires_at}
        return id_token
    except Exception as exc:
        print(f"    Tax Court: DAWSON login failed: {exc}")
        return None


def fetch_tax_court(since_date: str, state: dict) -> list[ChangeRecord]:
    """Fetch US Tax Court opinions via the DAWSON API (public-api-green.dawson.ustaxcourt.gov)."""
    id_token = _dawson_id_token(state)
    if not id_token:
        print("    Tax Court: set DAWSON_USERNAME + DAWSON_PASSWORD in .env to enable.")
        return []

    seen: set[str] = set(state.get("tax_court", {}).get("seen_item_ids", []))

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{_DAWSON_BASE}/case-documents/opinion-search",
                params={"dateRange.startDate": since_date},
                headers={**_HEADERS, "Authorization": f"Bearer {id_token}"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        print(f"    Tax Court: opinion search failed: {exc}")
        return []

    opinions = data if isinstance(data, list) else data.get("results", data.get("items", []))
    records: list[ChangeRecord] = []

    for opinion in opinions:
        docket = str(opinion.get("docketNumber") or opinion.get("docketNo") or "").strip()
        case_title = str(opinion.get("caseTitle") or opinion.get("caseName") or opinion.get("title") or "").strip()
        doc_type = str(opinion.get("documentType") or opinion.get("eventCode") or "Opinion").strip()
        raw_date = str(opinion.get("filingDate") or opinion.get("receivedAt") or "")
        filing_date = raw_date[:10] if len(raw_date) >= 10 else ""

        if not docket or not case_title or not filing_date or filing_date < since_date:
            continue

        item_id = f"tax-court-{hashlib.md5(docket.encode()).hexdigest()[:8]}"
        if item_id in seen:
            continue

        abstract = f"{case_title} — {doc_type}"
        url = f"https://dawson.ustaxcourt.gov/case-detail/{docket.replace(' ', '-')}"
        records.append(ChangeRecord(
            id=item_id,
            source="tax_court",
            source_name="US Tax Court (DAWSON)",
            title=f"{case_title} ({doc_type})",
            url=url,
            publication_date=filing_date,
            change_types=classify_change_types(case_title, abstract),
            affected_benefits=detect_affected_benefits(case_title, abstract),
            summary=abstract[:500],
            document_number=docket,
            document_type=doc_type,
            raw_abstract=abstract,
        ))

    return records


def update_tax_court_state(state: dict, records: list[ChangeRecord]):
    _simple_state(state, "tax_court", records)


# ─── Congress.gov ────────────────────────────────────────────────────────────

# Congress.gov API — free anonymous access via DEMO_KEY (250 req/hr limit).
# For higher limits: register at https://api.congress.gov/ for a personal key
# and set CONGRESS_API_KEY in environment.
_CONGRESS_API = "https://api.congress.gov/v3/bill"
_CONGRESS_KEY = os.environ.get("CONGRESS_API_KEY", "DEMO_KEY")


def fetch_congress_legislation(since_date: str, state: dict) -> list[ChangeRecord]:
    """
    Fetch recently updated tax-related legislation from the Congress.gov API.
    Filters to bills with policyArea 'Taxation' updated since since_date.
    Uses DEMO_KEY by default (250 req/hr); set CONGRESS_API_KEY env var for more.
    """
    seen: set[str] = set(state.get("congress_legislation", {}).get("seen_item_ids", []))
    params = {
        "format": "json",
        "limit": "50",
        "sort": "updateDate desc",
        "api_key": _CONGRESS_KEY,
        "fromDateTime": f"{since_date}T00:00:00Z",
    }
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(_CONGRESS_API, params=params, headers=_HEADERS)
            if resp.status_code == 403:
                print("    Congress API: rate limit hit (DEMO_KEY). Set CONGRESS_API_KEY env var.")
                return []
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        print(f"    Congress API error: {exc}")
        return []

    records: list[ChangeRecord] = []
    for bill in data.get("bills", []):
        title = bill.get("title", "").strip()
        bill_num = f"{bill.get('type','')}{bill.get('number','')}"
        congress_num = bill.get("congress", "")
        update_date = (bill.get("updateDate") or "")[:10]
        url = f"https://www.congress.gov/bill/{congress_num}th-congress/{bill.get('originChamber','house').lower()}-bill/{bill.get('number','')}"

        # Skip obviously non-tax bills
        if not _TAX_KEYWORDS_RE.search(title):
            latest_action = (bill.get("latestAction") or {}).get("text", "")
            if not _TAX_KEYWORDS_RE.search(latest_action):
                continue

        if update_date < since_date:
            continue

        item_id = f"congress-{congress_num}-{bill_num}"
        if item_id in seen:
            continue

        records.append(ChangeRecord(
            id=item_id,
            source="congress_legislation",
            source_name="Congress.gov — Tax Legislation",
            title=f"{bill_num}: {title}",
            url=url,
            publication_date=update_date or since_date,
            change_types=classify_change_types(title),
            affected_benefits=detect_affected_benefits(title),
            summary=title,
        ))

    return records


def update_congress_legislation_state(state: dict, records: list[ChangeRecord]):
    _simple_state(state, "congress_legislation", records)


# ─── Report generation ────────────────────────────────────────────────────────


def generate_report(records: list[ChangeRecord], since_date: str):
    lines = [
        "# UTBIS Tax Law Update Report",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Period:** Since {since_date}",
        f"**Total changes detected:** {len(records)}",
        "",
    ]

    if not records:
        lines.append("No new tax law changes detected in this period.")
    else:
        by_type: dict[str, list[ChangeRecord]] = {}
        for r in records:
            for ct in r.change_types:
                by_type.setdefault(ct, []).append(r)

        for change_type, recs in sorted(by_type.items()):
            label = change_type.replace("_", " ").title()
            lines += [f"## {label}", ""]
            for r in recs:
                lines += [
                    f"### {r.title}",
                    f"- **Source:** {r.source_name}",
                    f"- **Date:** {r.publication_date}",
                    f"- **URL:** {r.url}",
                ]
                if r.affected_benefits:
                    lines.append(f"- **Affects:** {', '.join(r.affected_benefits)}")
                summary = r.ai_summary or r.summary
                if summary:
                    lines += ["", summary]
                lines.append("")

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\nReport written: {REPORT_FILE.relative_to(ROOT)}")


# ─── State revenue department scrapers ───────────────────────────────────────


def _scrape_state_news_page(
    url: str, source: str, source_name: str, state: dict, since_date: str
) -> list[ChangeRecord]:
    """Generic state revenue department news page scraper.

    Tries two DOM patterns common across state revenue websites:
    1. Container elements (article/li/div) with class names containing news/press/release
       — extracts the first link + nearest date text.
    2. Heading + sibling/nearby date — finds h2/h3/h4 headings with links and date text nearby.
    Returns an empty list gracefully on any fetch or parse failure.
    """
    from bs4 import BeautifulSoup

    seen: set[str] = set(state.get(source, {}).get("seen_item_ids", []))
    soup = _fetch_html(url)
    if soup is None:
        return []

    candidates: list[tuple[str, str, str]] = []  # (title, href, pub_date)

    # Pattern 1: class-named containers
    for container in soup.find_all(
        ["article", "li", "div"],
        class_=re.compile(r"news|press|release|article|item|update|entry", re.I),
    ):
        links = container.find_all("a", href=True)
        if not links:
            continue
        a = links[0]
        title = a.get_text(strip=True)
        href = a.get("href", "")
        if not title or len(title) < 10:
            continue
        text = container.get_text(" ", strip=True)
        pub_date = _parse_month_day_year(text) or _parse_mm_dd_yyyy(text)
        if pub_date and pub_date >= since_date:
            candidates.append((title, href, pub_date))

    # Pattern 2: headings with nearby date text
    if not candidates:
        for heading in soup.find_all(["h2", "h3", "h4"]):
            a = heading.find("a", href=True)
            if not a:
                continue
            title = heading.get_text(strip=True)
            href = a.get("href", "")
            if not title or len(title) < 10:
                continue
            node = heading.parent
            text = node.get_text(" ", strip=True) if node else ""
            pub_date = _parse_month_day_year(text) or _parse_mm_dd_yyyy(text)
            if pub_date and pub_date >= since_date:
                candidates.append((title, href, pub_date))

    records: list[ChangeRecord] = []
    base = url.split("/")[0] + "//" + url.split("/")[2]  # scheme + host
    for title, href, pub_date in candidates[:20]:
        if href.startswith("http"):
            full_url = href
        elif href.startswith("/"):
            full_url = base + href
        else:
            full_url = url.rstrip("/") + "/" + href.lstrip("/")

        item_id = f"{source}-{hashlib.md5(href.encode()).hexdigest()[:8]}"
        if item_id in seen:
            continue
        records.append(ChangeRecord(
            id=item_id,
            source=source,
            source_name=source_name,
            title=title,
            url=full_url,
            publication_date=pub_date,
            change_types=classify_change_types(title),
            affected_benefits=detect_affected_benefits(title),
            summary=title,
        ))
    return records


# State fetchers — one per revenue department. All delegate to _scrape_state_news_page.

def fetch_state_ca(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://www.ftb.ca.gov/about-ftb/newsroom/news-releases/",
        "state_ca", "California Franchise Tax Board", state, since_date,
    )

def fetch_state_ny(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://www.tax.ny.gov/press/releases/",
        "state_ny", "New York Department of Taxation and Finance", state, since_date,
    )

def fetch_state_il(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://tax.illinois.gov/about/newsroom.html",
        "state_il", "Illinois Department of Revenue", state, since_date,
    )

def fetch_state_ma(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://www.mass.gov/lists/dor-news-and-updates",
        "state_ma", "Massachusetts Department of Revenue", state, since_date,
    )

def fetch_state_nj(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://www.nj.gov/treasury/taxation/news.shtml",
        "state_nj", "New Jersey Division of Taxation", state, since_date,
    )

def fetch_state_co(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://tax.colorado.gov/news",
        "state_co", "Colorado Department of Revenue", state, since_date,
    )

def fetch_state_or(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://www.oregon.gov/dor/news/Pages/default.aspx",
        "state_or", "Oregon Department of Revenue", state, since_date,
    )

def fetch_state_pa(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://www.revenue.pa.gov/GeneralTaxInformation/News/Pages/default.aspx",
        "state_pa", "Pennsylvania Department of Revenue", state, since_date,
    )

def fetch_state_oh(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://tax.ohio.gov/latest-news",
        "state_oh", "Ohio Department of Taxation", state, since_date,
    )

def fetch_state_ga(since_date: str, state: dict) -> list[ChangeRecord]:
    return _scrape_state_news_page(
        "https://dor.georgia.gov/news",
        "state_ga", "Georgia Department of Revenue", state, since_date,
    )


def _make_state_updater(source_key: str):
    def updater(state: dict, records: list[ChangeRecord]):
        _simple_state(state, source_key, records)
    return updater


_STATE_KEYS = ["state_ca", "state_ny", "state_il", "state_ma", "state_nj",
               "state_co", "state_or", "state_pa", "state_oh", "state_ga"]
_STATE_FETCHERS = [
    fetch_state_ca, fetch_state_ny, fetch_state_il, fetch_state_ma, fetch_state_nj,
    fetch_state_co, fetch_state_or, fetch_state_pa, fetch_state_oh, fetch_state_ga,
]


# ─── Source dispatch ──────────────────────────────────────────────────────────

_LIVE_HANDLERS = {
    "federal_register": (fetch_federal_register, update_federal_register_state),
    "irs_news": (fetch_irs_news, update_irs_news_state),
    "irs_publications": (fetch_irs_publications, update_irs_publications_state),
    "internal_revenue_bulletin": (fetch_internal_revenue_bulletin, update_internal_revenue_bulletin_state),
    "treasury_regulations": (fetch_treasury_regulations, update_treasury_regulations_state),
    "tax_court": (fetch_tax_court, update_tax_court_state),
    "congress_legislation": (fetch_congress_legislation, update_congress_legislation_state),
    **{key: (fn, _make_state_updater(key)) for key, fn in zip(_STATE_KEYS, _STATE_FETCHERS)},
}


# ─── Main ─────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="UTBIS Tax Law Update Monitor")
    parser.add_argument("--source", help="Check only this source key")
    parser.add_argument("--dry-run", action="store_true", help="Detect and print changes without writing files")
    parser.add_argument("--since", help="Check from this date (YYYY-MM-DD). Overrides --days.")
    parser.add_argument("--days", type=int, default=30, help="How many days back to check (default: 30)")
    parser.add_argument("--no-ai", action="store_true", help="Skip Claude AI classification")
    args = parser.parse_args()

    since_date = args.since or (datetime.now() - timedelta(days=args.days)).strftime("%Y-%m-%d")

    sources_config = load_sources()
    federal_sources: dict = sources_config.get("federal_sources", {})
    state_sources: dict = sources_config.get("state_sources", {})
    all_sources = {**federal_sources, **state_sources}

    if args.source:
        if args.source not in all_sources:
            print(f"Unknown source: {args.source}")
            print(f"Available: {list(all_sources.keys())}")
            return
        sources_to_check = {args.source: all_sources[args.source]}
    else:
        sources_to_check = all_sources

    print(f"\nUTBIS Tax Law Update — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Period:  since {since_date}")
    print(f"Sources: {len(sources_to_check)}")
    if args.dry_run:
        print("Mode:    dry-run (no files written)")
    print()

    state = load_state()
    all_new_records: list[ChangeRecord] = []

    for key, config in sources_to_check.items():
        print(f"[{key}]  {config.get('name', key)}")
        if key not in _LIVE_HANDLERS:
            print(f"    No handler registered for this source")
            continue

        fetch_fn, update_state_fn = _LIVE_HANDLERS[key]
        records = fetch_fn(since_date, state)
        update_state_fn(state, records)

        if records:
            print(f"    {len(records)} new item(s) found")
            all_new_records.extend(records)
        else:
            last = state.get(key, {}).get("last_checked", "never")
            print(f"    No new items  (last checked: {last})")

    # AI classification
    if all_new_records and not args.no_ai:
        if ANTHROPIC_AVAILABLE and os.environ.get("ANTHROPIC_API_KEY"):
            print(f"\nAI classification — {len(all_new_records)} item(s)...")
            all_new_records = ai_classify_changes(all_new_records)
        elif not args.no_ai:
            print("\nAI classification skipped (ANTHROPIC_API_KEY not set; use --no-ai to suppress this message)")

    # Save change records
    if all_new_records:
        print(f"\nSaving {len(all_new_records)} change record(s) to tax_library/future_law/...")
        for record in all_new_records:
            save_change_record(record, dry_run=args.dry_run)

    # Persist state
    if not args.dry_run:
        save_state(state)
        print(f"State saved: {STATE_FILE.relative_to(ROOT)}")

    # Report
    generate_report(all_new_records, since_date)

    print(f"\nDone. {len(all_new_records)} change(s) detected.")


if __name__ == "__main__":
    main()
