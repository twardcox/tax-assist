import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  _parseRssDate,
  ChangeRecord,
  classifyChangeTypes,
  fetchCongressLegislation,
  fetchInternalRevenueBulletin,
  fetchIrsNews,
  fetchIrsPublications,
  fetchTaxCourt,
  fetchTreasuryRegulations,
  aiClassifyChanges,
  detectAffectedBenefits,
  loadSources,
  makeSlug,
  updateCongressLegislationState,
  updateFederalRegisterState,
  updateInternalRevenueBulletinState,
  updateIrsPublicationsState,
  updateTaxCourtState,
  updateTreasuryRegulationsState,
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

    test("irs_publications_state_tracks_item_ids", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "irs-pub-abc12345",
          source: "irs_publications",
          source_name: "IRS Publications",
          title: "Form 1040 - U.S. Individual Income Tax Return",
          url: "https://apps.irs.gov/example",
          publication_date: "2026-06-01",
          change_types: ["new_form"],
          affected_benefits: [],
          summary: "Posted 06/01/2026"
        })
      ];

      updateIrsPublicationsState(state, records);
      const source = state.irs_publications as { seen_item_ids?: string[]; last_checked?: string };
      expect(source.seen_item_ids).toContain("irs-pub-abc12345");
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

    test("internal_revenue_bulletin_state_tracks_item_ids", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "irb-2026-23",
          source: "internal_revenue_bulletin",
          source_name: "Internal Revenue Bulletin",
          title: "IRB 2026-23",
          url: "https://www.irs.gov/irb/2026-23_IRB",
          publication_date: "2026-01-01",
          change_types: ["revenue_ruling"],
          affected_benefits: [],
          summary: "New Internal Revenue Bulletin"
        })
      ];

      updateInternalRevenueBulletinState(state, records);
      const source = state.internal_revenue_bulletin as { seen_item_ids?: string[]; last_checked?: string };
      expect(source.seen_item_ids).toContain("irb-2026-23");
      expect(source.last_checked).toBeTruthy();
    });

    test("treasury_regulations_state_tracks_item_ids", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "treasury-rss-abc12345",
          source: "treasury_regulations",
          source_name: "Treasury Regulations",
          title: "Treasury announces tax regulation updates",
          url: "https://home.treasury.gov/example",
          publication_date: "2026-06-01",
          change_types: ["new_interpretation"],
          affected_benefits: [],
          summary: "Tax-related update"
        })
      ];

      updateTreasuryRegulationsState(state, records);
      const source = state.treasury_regulations as { seen_item_ids?: string[]; last_checked?: string };
      expect(source.seen_item_ids).toContain("treasury-rss-abc12345");
      expect(source.last_checked).toBeTruthy();
    });
  });

  describe("fetchIrsNews", () => {
    test("extracts dated IRS newsroom links after since date", async () => {
      const html = `
        <html><body>
          <div>
            <span>May 29, 2026</span>
            <a href="/newsroom/irs-announces-clean-vehicle-credit-update">IRS announces clean vehicle credit update</a>
          </div>
          <div>
            <span>April 2, 2026</span>
            <a href="/newsroom/irs-announces-old-item">IRS announces old item</a>
          </div>
        </body></html>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(html, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchIrsNews("2026-05-01", {});
        expect(records).toHaveLength(1);
        expect(records[0]?.source).toBe("irs_news");
        expect(records[0]?.publication_date).toBe("2026-05-29");
        expect(records[0]?.url).toContain("/newsroom/irs-announces-clean-vehicle-credit-update");
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("skips seen irs newsroom items", async () => {
      const href = "/newsroom/irs-announces-hsa-contribution-limits";
      const seenId = `irs-news-${createHash("md5").update(href).digest("hex").slice(0, 8)}`;
      const html = `
        <html><body>
          <div>
            <span>June 1, 2026</span>
            <a href="${href}">IRS announces HSA contribution limits</a>
          </div>
        </body></html>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(html, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchIrsNews("2026-05-01", {
          irs_news: {
            seen_item_ids: [seenId]
          }
        });
        expect(records).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("fetchIrsPublications", () => {
    test("extracts publication rows newer than since date", async () => {
      const html = `
        <html><body>
          <table class="pup-table">
            <tr>
              <td><a href="/app/picklist/forms/1040">Form 1040</a></td>
              <td>U.S. Individual Income Tax Return</td>
              <td>Jan 2026</td>
              <td>06/01/2026</td>
            </tr>
            <tr>
              <td><a href="/app/picklist/forms/941">Form 941</a></td>
              <td>Employer's Quarterly Federal Tax Return</td>
              <td>Jan 2025</td>
              <td>03/01/2025</td>
            </tr>
          </table>
        </body></html>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(html, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchIrsPublications("2026-01-01", {});
        expect(records).toHaveLength(1);
        expect(records[0]?.source).toBe("irs_publications");
        expect(records[0]?.publication_date).toBe("2026-06-01");
        expect(records[0]?.url).toContain("/app/picklist/forms/1040");
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("skips seen publication items", async () => {
      const formNum = "Form 1040";
      const revDate = "Jan 2026";
      const seenId = `irs-pub-${createHash("md5").update(formNum + revDate).digest("hex").slice(0, 8)}`;
      const html = `
        <html><body>
          <table>
            <tr>
              <td>${formNum}</td>
              <td>U.S. Individual Income Tax Return</td>
              <td>${revDate}</td>
              <td>06/01/2026</td>
            </tr>
          </table>
        </body></html>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(html, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchIrsPublications("2026-01-01", {
          irs_publications: {
            seen_item_ids: [seenId]
          }
        });
        expect(records).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("fetchInternalRevenueBulletin", () => {
    test("extracts IRB links from IRS IRB page", async () => {
      const html = `
        <html><body>
          <a href="/irb/2026-23_IRB">Internal Revenue Bulletin: 2026-23</a>
          <a href="/irb/2025-01_IRB">Internal Revenue Bulletin: 2025-01</a>
        </body></html>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(html, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchInternalRevenueBulletin("2026-01-01", {});
        expect(records).toHaveLength(1);
        expect(records[0]?.id).toBe("irb-2026-23");
        expect(records[0]?.source).toBe("internal_revenue_bulletin");
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("skips seen IRB links", async () => {
      const html = `
        <html><body>
          <a href="/irb/2026-23_IRB">Internal Revenue Bulletin: 2026-23</a>
        </body></html>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(html, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchInternalRevenueBulletin("2026-01-01", {
          internal_revenue_bulletin: {
            seen_item_ids: ["irb-2026-23"]
          }
        });
        expect(records).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("fetchTreasuryRegulations", () => {
    test("extracts tax-relevant treasury rss items since date", async () => {
      const xml = `
        <rss><channel>
          <item>
            <title>Treasury announces new tax regulation guidance</title>
            <link>https://home.treasury.gov/news/press-releases/jy9999</link>
            <guid>guid-tax-1</guid>
            <description>New guidance on Internal Revenue section 179.</description>
            <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate>
          </item>
          <item>
            <title>Department announces arts program</title>
            <link>https://home.treasury.gov/news/press-releases/jy0000</link>
            <guid>guid-nontax-1</guid>
            <description>Public outreach event.</description>
            <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate>
          </item>
        </channel></rss>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(xml, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchTreasuryRegulations("2026-05-01", {});
        expect(records).toHaveLength(1);
        expect(records[0]?.source).toBe("treasury_regulations");
        expect(records[0]?.url).toContain("jy9999");
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("skips seen treasury rss items", async () => {
      const guid = "guid-tax-1";
      const seenId = `treasury-rss-${createHash("md5").update(guid).digest("hex").slice(0, 8)}`;
      const xml = `
        <rss><channel>
          <item>
            <title>Treasury announces new tax regulation guidance</title>
            <link>https://home.treasury.gov/news/press-releases/jy9999</link>
            <guid>${guid}</guid>
            <description>New guidance on Internal Revenue section 179.</description>
            <pubDate>Mon, 01 Jun 2026 12:00:00 +0000</pubDate>
          </item>
        </channel></rss>
      `;

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(xml, { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchTreasuryRegulations("2026-05-01", {
          treasury_regulations: {
            seen_item_ids: [seenId]
          }
        });
        expect(records).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
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

  describe("fetchCongressLegislation", () => {
    test("extracts tax-relevant bills updated since date", async () => {
      const payload = {
        bills: [
          {
            title: "Tax Relief and Small Business Act",
            type: "HR",
            number: "1234",
            congress: "119",
            updateDate: "2026-06-01",
            originChamber: "House",
            latestAction: { text: "Referred to Ways and Means" }
          },
          {
            title: "National Parks Beautification Act",
            type: "HR",
            number: "9999",
            congress: "119",
            updateDate: "2026-06-01",
            originChamber: "House",
            latestAction: { text: "Referred to Natural Resources Committee" }
          }
        ]
      };

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(JSON.stringify(payload), { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchCongressLegislation("2026-05-01", {});
        expect(records).toHaveLength(1);
        expect(records[0]?.source).toBe("congress_legislation");
        expect(records[0]?.title).toContain("HR1234");
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("skips seen congress bills", async () => {
      const payload = {
        bills: [
          {
            title: "Tax Deduction Enhancement Act",
            type: "HR",
            number: "5678",
            congress: "119",
            updateDate: "2026-06-01",
            originChamber: "House",
            latestAction: { text: "Tax credit provisions" }
          }
        ]
      };

      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response(JSON.stringify(payload), { status: 200 }) as unknown as Promise<Response>;
        const records = await fetchCongressLegislation("2026-05-01", {
          congress_legislation: { seen_item_ids: ["congress-119-HR5678"] }
        });
        expect(records).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("returns empty on 403 rate limit", async () => {
      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response("", { status: 403 }) as unknown as Promise<Response>;
        const records = await fetchCongressLegislation("2026-05-01", {});
        expect(records).toHaveLength(0);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("fetchTaxCourt", () => {
    test("returns empty when no DAWSON credentials", async () => {
      const origUser = process.env.DAWSON_USERNAME;
      const origPass = process.env.DAWSON_PASSWORD;
      delete process.env.DAWSON_USERNAME;
      delete process.env.DAWSON_PASSWORD;
      try {
        const records = await fetchTaxCourt("2026-05-01", {});
        expect(records).toHaveLength(0);
      } finally {
        if (origUser !== undefined) process.env.DAWSON_USERNAME = origUser;
        if (origPass !== undefined) process.env.DAWSON_PASSWORD = origPass;
      }
    });

    test("fetches opinions after DAWSON login", async () => {
      const opinions = [
        {
          docketNumber: "12345-26",
          caseTitle: "Smith v. Commissioner",
          documentType: "Opinion",
          filingDate: "2026-06-01"
        }
      ];

      const originalFetch = global.fetch;
      let callCount = 0;
      try {
        process.env.DAWSON_USERNAME = "test@example.com";
        process.env.DAWSON_PASSWORD = "testpass";
        global.fetch = async (url: RequestInfo | URL) => {
          callCount += 1;
          if (String(url).includes("/auth/login")) {
            return new Response(JSON.stringify({ idToken: "fake-token-abc" }), { status: 200 }) as unknown as Promise<Response>;
          }
          return new Response(JSON.stringify(opinions), { status: 200 }) as unknown as Promise<Response>;
        };
        const state: Record<string, unknown> = {};
        const records = await fetchTaxCourt("2026-05-01", state);
        expect(callCount).toBe(2);
        expect(records).toHaveLength(1);
        expect(records[0]?.source).toBe("tax_court");
        expect(records[0]?.document_number).toBe("12345-26");
        expect(state.dawson_auth).toBeTruthy();
      } finally {
        global.fetch = originalFetch;
        delete process.env.DAWSON_USERNAME;
        delete process.env.DAWSON_PASSWORD;
      }
    });

    test("reuses cached DAWSON token", async () => {
      const originalFetch = global.fetch;
      let loginCalls = 0;
      try {
        process.env.DAWSON_USERNAME = "test@example.com";
        process.env.DAWSON_PASSWORD = "testpass";
        const futureExpiry = new Date();
        futureExpiry.setHours(futureExpiry.getHours() + 1);
        const state: Record<string, unknown> = {
          dawson_auth: {
            id_token: "cached-token",
            expires_at: futureExpiry.toISOString().slice(0, 19)
          }
        };
        global.fetch = async (url: RequestInfo | URL) => {
          if (String(url).includes("/auth/login")) {
            loginCalls += 1;
          }
          return new Response(JSON.stringify([]), { status: 200 }) as unknown as Promise<Response>;
        };
        await fetchTaxCourt("2026-05-01", state);
        expect(loginCalls).toBe(0);
      } finally {
        global.fetch = originalFetch;
        delete process.env.DAWSON_USERNAME;
        delete process.env.DAWSON_PASSWORD;
      }
    });
  });

  describe("updateCongressLegislationState", () => {
    test("tracks seen bill IDs", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "congress-119-HR1234",
          source: "congress_legislation",
          source_name: "Congress.gov — Tax Legislation",
          title: "HR1234: Tax Relief Act",
          url: "https://www.congress.gov/bill/119th-congress/house-bill/1234",
          publication_date: "2026-06-01",
          change_types: ["new_benefit"],
          affected_benefits: [],
          summary: "Tax Relief Act"
        })
      ];

      updateCongressLegislationState(state, records);
      const source = state.congress_legislation as { seen_item_ids?: string[]; last_checked?: string };
      expect(source.seen_item_ids).toContain("congress-119-HR1234");
      expect(source.last_checked).toBeTruthy();
    });
  });

  describe("updateTaxCourtState", () => {
    test("tracks seen opinion IDs", () => {
      const state: Record<string, unknown> = {};
      const records = [
        new ChangeRecord({
          id: "tax-court-abc12345",
          source: "tax_court",
          source_name: "US Tax Court (DAWSON)",
          title: "Smith v. Commissioner (Opinion)",
          url: "https://dawson.ustaxcourt.gov/case-detail/12345-26",
          publication_date: "2026-06-01",
          change_types: ["new_interpretation"],
          affected_benefits: [],
          summary: "Smith v. Commissioner — Opinion"
        })
      ];

      updateTaxCourtState(state, records);
      const source = state.tax_court as { seen_item_ids?: string[]; last_checked?: string };
      expect(source.seen_item_ids).toContain("tax-court-abc12345");
      expect(source.last_checked).toBeTruthy();
    });
  });

  describe("aiClassifyChanges", () => {
    test("returns records unchanged when ANTHROPIC_API_KEY not set", async () => {
      const orig = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      try {
        const records = [
          new ChangeRecord({
            id: "test-001",
            source: "federal_register",
            source_name: "Federal Register",
            title: "Final Regulations Under Section 168",
            url: "https://federalregister.gov/example",
            publication_date: "2026-06-01",
            change_types: ["final_rule"],
            affected_benefits: ["federal-bonus-depreciation"],
            summary: "Final regs for bonus depreciation.",
            raw_abstract: "Treasury and IRS issue final regulations under section 168(k) regarding additional first-year depreciation deductions for qualified property."
          })
        ];
        const result = await aiClassifyChanges(records);
        expect(result).toHaveLength(1);
        expect(result[0]?.ai_classified).toBe(false);
      } finally {
        if (orig !== undefined) process.env.ANTHROPIC_API_KEY = orig;
      }
    });

    test("skips records with short abstracts", async () => {
      const orig = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "test-key";
      const originalFetch = global.fetch;
      try {
        global.fetch = async () => new Response("{}", { status: 200 }) as unknown as Promise<Response>;
        const records = [
          new ChangeRecord({
            id: "test-short",
            source: "irs_news",
            source_name: "IRS Newsroom",
            title: "Brief notice",
            url: "",
            publication_date: "2026-06-01",
            change_types: ["new_interpretation"],
            affected_benefits: [],
            summary: "Brief",
            raw_abstract: "Short"
          })
        ];
        const result = await aiClassifyChanges(records);
        expect(result).toHaveLength(1);
        expect(result[0]?.ai_classified).toBe(false);
      } finally {
        global.fetch = originalFetch;
        if (orig !== undefined) process.env.ANTHROPIC_API_KEY = orig;
        else delete process.env.ANTHROPIC_API_KEY;
      }
    });
  });
});
