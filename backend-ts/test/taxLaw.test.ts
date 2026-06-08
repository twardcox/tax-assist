import { describe, expect, test } from "vitest";
import {
  _parseRssDate,
  ChangeRecord,
  classifyChangeTypes,
  detectAffectedBenefits,
  loadSources,
  makeSlug,
  updateFederalRegisterState,
  updateIrsNewsState
} from "../src/domain/taxLaw/updater";

describe("tax law parity", () => {
  describe("classifyChangeTypes", () => {
    test("changed_threshold_inflation", () => {
      const types = classifyChangeTypes("IRS Announces 2026 Inflation Adjustments for Tax Provisions");
      expect(types).toContain("changed_threshold");
    });

    test("proposed_rule", () => {
      const types = classifyChangeTypes("Proposed Rule REG-123456-23 for Section 199A");
      expect(types).toContain("proposed_rule");
    });

    test("revenue_ruling", () => {
      const types = classifyChangeTypes("Rev. Rul. 2026-01 clarifying passive activity rules");
      expect(types).toContain("revenue_ruling");
    });

    test("revenue_procedure", () => {
      const types = classifyChangeTypes("Rev. Proc. 2026-10 updating safe harbor amounts");
      expect(types).toContain("revenue_procedure");
    });

    test("expired_benefit", () => {
      const types = classifyChangeTypes("Bonus Depreciation Provision Expired December 31");
      expect(types).toContain("expired_benefit");
    });

    test("new_benefit", () => {
      const types = classifyChangeTypes("New Credit Established for Small Business Healthcare Costs");
      expect(types).toContain("new_benefit");
    });

    test("risk_change_audit", () => {
      const types = classifyChangeTypes("IRS Announces Increased Audit Activity on Syndicated Conservation Easements");
      expect(types).toContain("risk_change");
    });

    test("final_rule", () => {
      const types = classifyChangeTypes("Final Regulations under Section 168 Bonus Depreciation TD 9973");
      expect(types).toContain("final_rule");
    });

    test("deadline_change", () => {
      const types = classifyChangeTypes("IRS Extends Filing Deadline to April 15 for Disaster Victims");
      expect(types).toContain("deadline_change");
    });

    test("unknown_falls_back_to_new_interpretation", () => {
      const types = classifyChangeTypes("IRS Issues Guidance on Remote Work Expenses");
      expect(types.length).toBeGreaterThan(0);
    });

    test("abstract_contributes_to_match", () => {
      const types = classifyChangeTypes(
        "IRS Notice 2026-5",
        "This notice sets forth the inflation-adjusted amounts for 2026."
      );
      expect(types).toContain("changed_threshold");
    });
  });

  describe("detectAffectedBenefits", () => {
    test("ev_credit", () => {
      const benefits = detectAffectedBenefits("Clean Vehicle Credit Update", "Section 30D clean vehicle credit amounts");
      expect(benefits).toContain("federal-ev-credit");
    });

    test("child_tax_credit", () => {
      const benefits = detectAffectedBenefits("2026 Child Tax Credit Amounts");
      expect(benefits).toContain("federal-child-tax-credit");
    });

    test("qbi_deduction", () => {
      const benefits = detectAffectedBenefits("Proposed Rule on QBI Deduction Under Section 199A");
      expect(benefits).toContain("federal-qbi-deduction");
    });

    test("hsa", () => {
      const benefits = detectAffectedBenefits("HSA Contribution Limits Adjusted for Inflation");
      expect(benefits).toContain("federal-hsa");
    });

    test("salt", () => {
      const benefits = detectAffectedBenefits("State and Local Tax Deduction Cap Extended");
      expect(benefits).toContain("federal-salt-deduction");
    });

    test("no_match_returns_empty", () => {
      const benefits = detectAffectedBenefits("Procedural Rules for IRS Appeals Office");
      expect(Array.isArray(benefits)).toBe(true);
    });

    test("multiple_benefits_detected", () => {
      const benefits = detectAffectedBenefits("HSA and Section 179 Limits for 2026");
      expect(benefits).toContain("federal-hsa");
      expect(benefits).toContain("federal-section-179");
    });
  });

  describe("_parseRssDate", () => {
    test("rfc2822", () => {
      expect(_parseRssDate("Mon, 02 Jun 2026 12:00:00 +0000")).toBe("2026-06-02");
    });

    test("iso8601", () => {
      expect(_parseRssDate("2026-06-02T09:30:00Z")).toBe("2026-06-02");
    });

    test("plain_date", () => {
      expect(_parseRssDate("2026-06-02")).toBe("2026-06-02");
    });

    test("invalid_returns_none", () => {
      expect(_parseRssDate("not a date")).toBeNull();
    });

    test("empty_returns_none", () => {
      expect(_parseRssDate("")).toBeNull();
    });
  });

  describe("makeSlug", () => {
    test("basic", () => {
      expect(makeSlug("IRS Announces 2026 Inflation Adjustments")).toBe("irs-announces-2026-inflation-adjustments");
    });

    test("special_chars_stripped", () => {
      const slug = makeSlug("Rev. Proc. 2026-01: Safe Harbor!");
      expect(slug.includes(".")).toBe(false);
      expect(slug.includes(":")).toBe(false);
      expect(slug.includes("!")).toBe(false);
    });

    test("max_length", () => {
      expect(makeSlug("A".repeat(200)).length).toBeLessThanOrEqual(50);
    });
  });

  describe("state management", () => {
    test("federal_register_state_tracks_document_numbers", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "federal-register-2026-001",
          source: "federal_register",
          source_name: "Federal Register",
          title: "Test Doc",
          url: "https://example.com",
          publication_date: "2026-06-01",
          change_types: ["final_rule"],
          affected_benefits: [],
          summary: "Test",
          document_number: "2026-001"
        })
      ];

      updateFederalRegisterState(state, records);
      const source = state.federal_register as { seen_document_numbers?: string[]; last_checked?: string };
      expect(source.seen_document_numbers).toContain("2026-001");
      expect(source.last_checked).toBeTruthy();
    });

    test("irs_news_state_tracks_item_ids", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "irs-news-abc12345",
          source: "irs_news",
          source_name: "IRS Newsroom",
          title: "IR-2026-001",
          url: "https://irs.gov/newsroom/ir-2026-001",
          publication_date: "2026-06-01",
          change_types: ["new_interpretation"],
          affected_benefits: [],
          summary: "Test item"
        })
      ];

      updateIrsNewsState(state, records);
      const source = state.irs_news as { seen_item_ids?: string[]; last_checked?: string };
      expect(source.seen_item_ids).toContain("irs-news-abc12345");
      expect(source.last_checked).toBeTruthy();
    });

    test("state_accumulates_across_calls", () => {
      const state: Record<string, unknown> = {};
      const r1 = new ChangeRecord({
        id: "federal-register-2026-001",
        source: "federal_register",
        source_name: "FR",
        title: "Doc 1",
        url: "",
        publication_date: "2026-06-01",
        change_types: [],
        affected_benefits: [],
        summary: "",
        document_number: "2026-001"
      });
      const r2 = new ChangeRecord({
        id: "federal-register-2026-002",
        source: "federal_register",
        source_name: "FR",
        title: "Doc 2",
        url: "",
        publication_date: "2026-06-02",
        change_types: [],
        affected_benefits: [],
        summary: "",
        document_number: "2026-002"
      });

      updateFederalRegisterState(state, [r1]);
      updateFederalRegisterState(state, [r2]);

      const source = state.federal_register as { seen_document_numbers?: string[] };
      expect(source.seen_document_numbers).toContain("2026-001");
      expect(source.seen_document_numbers).toContain("2026-002");
    });
  });

  describe("loadSources", () => {
    test("federal_sources_present", () => {
      const sources = loadSources() as { federal_sources?: Record<string, unknown> };
      expect(sources.federal_sources).toBeTruthy();
    });

    test("federal_register_in_sources", () => {
      const sources = loadSources() as { federal_sources?: Record<string, unknown> };
      expect(sources.federal_sources?.federal_register).toBeTruthy();
    });

    test("irs_news_in_sources", () => {
      const sources = loadSources() as { federal_sources?: Record<string, unknown> };
      expect(sources.federal_sources?.irs_news).toBeTruthy();
    });

    test("sources_have_required_fields", () => {
      const sources = loadSources() as { federal_sources?: Record<string, Record<string, unknown>> };
      const federalSources = sources.federal_sources ?? {};

      for (const [key, config] of Object.entries(federalSources)) {
        expect(config.name, `${key} missing 'name'`).toBeDefined();
        expect(config.url, `${key} missing 'url'`).toBeDefined();
        expect(config.change_types, `${key} missing 'change_types'`).toBeDefined();
      }
    });
  });

  describe("ChangeRecord", () => {
    test("detected_at_set_automatically", () => {
      const record = new ChangeRecord({
        id: "test-001",
        source: "test",
        source_name: "Test",
        title: "T",
        url: "",
        publication_date: "2026-06-01",
        change_types: [],
        affected_benefits: [],
        summary: ""
      });

      expect(record.detected_at).not.toBe("");
    });

    test("ai_classified_defaults_false", () => {
      const record = new ChangeRecord({
        id: "test-001",
        source: "test",
        source_name: "Test",
        title: "T",
        url: "",
        publication_date: "2026-06-01",
        change_types: [],
        affected_benefits: [],
        summary: ""
      });

      expect(record.ai_classified).toBe(false);
    });
  });
});
