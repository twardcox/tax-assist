import { beforeEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildApp } from "../src/app";
import { getDb } from "../src/db/client";
import { initDb } from "../src/db/init";
import { addTransaction } from "../src/db/transactionsRepo";
import { __setDocumentAiExtractionOverrideForTest } from "../src/domain/documents/aiExecutor";
import { __setTaxLawUpdateRunningForTest } from "../src/routes/taxLaw";

beforeEach(() => {
  initDb();
  __setDocumentAiExtractionOverrideForTest(null);
  const db = getDb();
  db.exec("DELETE FROM transactions;");
  db.exec("DELETE FROM section_data;");
  db.exec("DELETE FROM documents;");
  db.exec("DELETE FROM revoked_tokens;");
  db.exec("DELETE FROM users;");
});

describe("API baseline", () => {
  test("GET /api/health returns ok", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await app.close();
  });

  test("GET /api/config returns expected contract keys", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/config" });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload).toHaveProperty("ai_available");
    expect(payload).toHaveProperty("tax_year");
    expect(payload).toHaveProperty("benefit_count");

    await app.close();
  });

  test("auth register, login, me, and logout flow", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "test@example.com",
        password: "Test1234!",
        display_name: "Test User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const registerPayload = registerRes.json();
    expect(registerPayload).toHaveProperty("token");
    expect(registerPayload).toHaveProperty("token_type", "bearer");
    expect(registerPayload).toHaveProperty("user_id");

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "test@example.com",
        password: "Test1234!"
      }
    });

    expect(loginRes.statusCode).toBe(200);
    const loginPayload = loginRes.json();
    expect(loginPayload).toHaveProperty("token");
    expect(loginPayload).toHaveProperty("display_name", "Test User");

    const meRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${loginPayload.token}`
      }
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json()).toEqual({
      id: loginPayload.user_id,
      email: "test@example.com",
      display_name: "Test User"
    });

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        authorization: `Bearer ${loginPayload.token}`
      }
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toEqual({ logged_out: true });

    const meAfterLogoutRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${loginPayload.token}`
      }
    });

    expect(meAfterLogoutRes.statusCode).toBe(401);
    expect(meAfterLogoutRes.json()).toEqual({ detail: "Token revoked" });

    await app.close();
  });

  test("user-data list and parsed read works without auth", async () => {
    const app = buildApp();

    const listRes = await app.inject({ method: "GET", url: "/api/user-data" });
    expect(listRes.statusCode).toBe(200);
    const listPayload = listRes.json() as { sections: string[] };
    expect(listPayload.sections).toContain("household");
    expect(listPayload.sections).not.toContain("documents_index");

    const parsedRes = await app.inject({
      method: "GET",
      url: "/api/user-data/household/parsed"
    });
    expect(parsedRes.statusCode).toBe(200);
    const parsedPayload = parsedRes.json() as {
      section: string;
      data: Record<string, unknown>;
    };
    expect(parsedPayload.section).toBe("household");
    expect(parsedPayload.data).toBeTypeOf("object");

    await app.close();
  });

  test("user-data authenticated write then read uses DB-backed section data", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "data-user@example.com",
        password: "Test1234!",
        display_name: "Data User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    const writeRes = await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        data: {
          filing_status: "married_filing_jointly",
          estimated_agi: 180000
        }
      }
    });

    expect(writeRes.statusCode).toBe(200);
    expect(writeRes.json()).toEqual({ section: "household", saved: true });

    const parsedReadRes = await app.inject({
      method: "GET",
      url: "/api/user-data/household/parsed",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(parsedReadRes.statusCode).toBe(200);
    const parsedPayload = parsedReadRes.json() as {
      section: string;
      data: Record<string, unknown>;
    };
    expect(parsedPayload.section).toBe("household");
    expect(parsedPayload.data).toMatchObject({
      filing_status: "married_filing_jointly",
      estimated_agi: 180000
    });

    const rawReadRes = await app.inject({
      method: "GET",
      url: "/api/user-data/household",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(rawReadRes.statusCode).toBe(200);
    const rawPayload = rawReadRes.json() as { section: string; content: string };
    expect(rawPayload.section).toBe("household");
    expect(rawPayload.content).toContain("filing_status");

    await app.close();
  });

  test("documents upload, list, extract, apply, and delete routes work", async () => {
    const previousKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    __setDocumentAiExtractionOverrideForTest(async () => ({
      document_type: "receipt",
      merchant_or_payer: "Office Depot",
      date: "2026-01-01",
      total_amount: 100,
      description: "Office supplies receipt",
      tax_category: "business_expense",
      deductible_pct: 0.5,
      benefit_ids: [],
      form_line: "Schedule C:18",
      suggested_updates: [],
      confidence: "medium",
      notes: "stubbed in API test"
    }));

    const app = buildApp();

    try {
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "doc-user@example.com",
          password: "Test1234!",
          display_name: "Doc User"
        }
      });

      expect(registerRes.statusCode).toBe(201);
      const token = (registerRes.json() as { token: string }).token;

      const uploadRes = await app.inject({
        method: "POST",
        url: "/api/documents/upload",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        payload: {
          filename: "office-supplies-receipt.pdf",
          content: "sample receipt data"
        }
      });

      expect(uploadRes.statusCode).toBe(200);
      const uploaded = uploadRes.json() as { file_id: string; category: string; confidence: string };
      expect(uploaded.category).toBe("business_expense");
      expect(uploaded.confidence).toBe("medium");

      const listRes = await app.inject({
        method: "GET",
        url: "/api/documents",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(listRes.statusCode).toBe(200);
      const listPayload = listRes.json() as { files: Array<Record<string, unknown>> };
      expect(listPayload.files).toHaveLength(1);
      expect(listPayload.files[0]?.file_id).toBe(uploaded.file_id);

      const extractRes = await app.inject({
        method: "POST",
        url: `/api/documents/${uploaded.file_id}/extract`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(extractRes.statusCode).toBe(200);
      const extractPayload = extractRes.json() as { job_id: string };
      expect(extractPayload.job_id).toBeTypeOf("string");

      await new Promise((resolve) => setTimeout(resolve, 0));

      const statusRes = await app.inject({
        method: "GET",
        url: `/api/documents/extract/${extractPayload.job_id}`
      });

      expect(statusRes.statusCode).toBe(200);
      const statusPayload = statusRes.json() as { status: string; extracted: Record<string, unknown> };
      expect(statusPayload.status).toBe("complete");
      expect(statusPayload.extracted.document_type).toBe("receipt");
      expect(statusPayload.extracted.tax_category).toBe("business_expense");

      const seedSectionRes = await app.inject({
        method: "PUT",
        url: "/api/user-data/household",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          data: {
            expenses: {
              office_supplies: 0
            }
          }
        }
      });

      expect(seedSectionRes.statusCode).toBe(200);

      const applyRes = await app.inject({
        method: "POST",
        url: "/api/documents/apply",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        payload: {
          meta: {
            file_id: uploaded.file_id,
            filename: "office-supplies-receipt.pdf",
            date: "2026-01-01",
            merchant: "Office Depot",
            total_amount: 100,
            deductible_pct: 0.5,
            tax_category: "business_expense",
            benefit_ids: [],
            form_line: "Schedule C:18"
          },
          updates: [
            {
              label: "Office supplies",
              section: "household",
              dot_path: "expenses.office_supplies",
              operation: "add",
              value: 100
            }
          ]
        }
      });

      expect(applyRes.statusCode).toBe(200);
      const applyPayload = applyRes.json() as { duplicate: boolean; applied: string[] };
      expect(applyPayload.duplicate).toBe(false);
      expect(applyPayload.applied).toContain("Office supplies");

      const parsedRes = await app.inject({
        method: "GET",
        url: "/api/user-data/household/parsed",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(parsedRes.statusCode).toBe(200);
      const parsedPayload = parsedRes.json() as { data: Record<string, unknown> };
      expect(parsedPayload.data).toMatchObject({
        expenses: {
          office_supplies: 50
        }
      });

      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/documents/${uploaded.file_id}`,
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.json()).toEqual({ deleted: true, file_id: uploaded.file_id });
    } finally {
      process.env.ANTHROPIC_API_KEY = previousKey;
      await app.close();
    }
  });

  test("transactions list and summary work with auth and filters", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "txn-user@example.com",
        password: "Test1234!",
        display_name: "Txn User"
      }
    });
    expect(registerRes.statusCode).toBe(201);

    const registerPayload = registerRes.json() as { token: string; user_id: string };
    const token = registerPayload.token;
    const userId = registerPayload.user_id;

    const firstTxnId = addTransaction({
      user_id: userId,
      file_id: "f-1",
      filename: "receipt-1.jpg",
      date: "2026-01-01",
      merchant: "Office Depot",
      total_amount: 100,
      deductible_pct: 1,
      deductible_amount: 100,
      tax_category: "business_expense",
      benefit_ids: ["federal-home-office-deduction"],
      form_line: "Schedule C:18",
      section: "businesses",
      dot_path: "expenses.office_supplies",
      status: "applied",
      label: "Office supplies"
    });

    addTransaction({
      user_id: userId,
      file_id: "f-2",
      filename: "receipt-2.jpg",
      date: "2026-01-02",
      merchant: "Hospital",
      total_amount: 50,
      deductible_pct: 1,
      deductible_amount: 50,
      tax_category: "medical",
      benefit_ids: ["federal-medical-expense-deduction"],
      form_line: "Schedule A:1",
      section: "healthcare",
      dot_path: "medical.out_of_pocket",
      status: "applied",
      label: "Medical"
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/transactions?tax_category=business_expense",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(listRes.statusCode).toBe(200);
    const listPayload = listRes.json() as {
      transactions: Array<Record<string, unknown>>;
    };
    expect(listPayload.transactions).toHaveLength(1);
    expect(listPayload.transactions[0]?.tax_category).toBe("business_expense");

    const summaryRes = await app.inject({
      method: "GET",
      url: "/api/transactions/summary",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(summaryRes.statusCode).toBe(200);
    const summaryPayload = summaryRes.json() as {
      by_category: Array<Record<string, unknown>>;
      total_applied: Record<string, unknown>;
    };
    expect(summaryPayload.by_category).toHaveLength(2);
    expect(summaryPayload.total_applied.count).toBe(2);
    expect(summaryPayload.total_applied.total_deductible).toBe(150);

    const reverseRes = await app.inject({
      method: "DELETE",
      url: `/api/transactions/${firstTxnId}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(reverseRes.statusCode).toBe(200);
    expect(reverseRes.json()).toEqual({ reversed: true, id: firstTxnId });

    const summaryAfterReverseRes = await app.inject({
      method: "GET",
      url: "/api/transactions/summary",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(summaryAfterReverseRes.statusCode).toBe(200);
    const afterPayload = summaryAfterReverseRes.json() as {
      total_applied: Record<string, unknown>;
    };
    expect(afterPayload.total_applied.count).toBe(1);
    expect(afterPayload.total_applied.total_deductible).toBe(50);

    await app.close();
  });

  test("transactions endpoints return empty unauthenticated defaults", async () => {
    const app = buildApp();

    const listRes = await app.inject({ method: "GET", url: "/api/transactions" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toEqual({ transactions: [] });

    const summaryRes = await app.inject({ method: "GET", url: "/api/transactions/summary" });
    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.json()).toEqual({
      by_category: [],
      total_applied: { count: 0, total_deductible: 0 }
    });

    await app.close();
  });

  test("reconciliation combines ledger summary and unprocessed income documents", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "recon-user@example.com",
        password: "Test1234!",
        display_name: "Recon User"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const payload = registerRes.json() as { token: string; user_id: string };

    addTransaction({
      user_id: payload.user_id,
      file_id: "doc-a",
      filename: "w2.pdf",
      date: "2026-01-03",
      merchant: "Employer",
      total_amount: 1,
      deductible_pct: 1,
      deductible_amount: 1,
      tax_category: "income_reconciliation",
      benefit_ids: ["federal-american-opportunity-credit"],
      form_line: "W2:1",
      section: "income",
      dot_path: "w2[0].wages",
      status: "applied",
      label: "W2 import"
    });

    const writeDocsIndexRes = await app.inject({
      method: "PUT",
      url: "/api/user-data/documents_index",
      headers: {
        authorization: `Bearer ${payload.token}`
      },
      payload: {
        data: {
          income_documents: {
            w2_forms: [{ employer: "Acme Corp", processed: false }],
            form_1099_int: { processed: false }
          }
        }
      }
    });
    expect(writeDocsIndexRes.statusCode).toBe(200);

    const reconRes = await app.inject({
      method: "GET",
      url: "/api/reconciliation",
      headers: {
        authorization: `Bearer ${payload.token}`
      }
    });

    expect(reconRes.statusCode).toBe(200);
    const reconPayload = reconRes.json() as Record<string, unknown>;
    expect(reconPayload.total_transactions).toBe(1);
    expect(reconPayload.total_deductible_in_ledger).toBe(1);
    expect(reconPayload).toHaveProperty("ledger_by_category");

    const unprocessed = reconPayload.unprocessed_income_documents as Array<Record<string, string>>;
    expect(unprocessed).toEqual(
      expect.arrayContaining([
        { form: "W-2", detail: "Acme Corp" },
        { form: "1099-INT", detail: "not uploaded" }
      ])
    );

    await app.close();
  });

  test("planning route returns contract-compatible payload shape", async () => {
    const app = buildApp();

    const planRes = await app.inject({
      method: "GET",
      url: "/api/planning/year-end?tax_year=2025"
    });

    expect(planRes.statusCode).toBe(200);
    const payload = planRes.json() as Record<string, unknown>;
    expect(payload).toHaveProperty("tax_year", 2025);
    expect(payload).toHaveProperty("today");
    expect(payload).toHaveProperty("days_until_dec_31");
    expect(payload).toHaveProperty("days_until_apr_15");
    expect(payload).toHaveProperty("actions");
    expect(payload).toHaveProperty("summary");

    const summary = payload.summary as Record<string, unknown>;
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("overdue");
    expect(summary).toHaveProperty("critical");
    expect(summary).toHaveProperty("soon");
    expect(summary).toHaveProperty("normal");
    expect(summary).toHaveProperty("dec_31_count");
    expect(summary).toHaveProperty("apr_15_count");

    await app.close();
  });

  test("scan route returns dashboard-compatible payload", async () => {
    const app = buildApp();

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025"
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as Record<string, unknown>;
    expect(payload).toHaveProperty("tax_year", 2025);
    expect(payload).toHaveProperty("total");
    expect(payload).toHaveProperty("counts");
    expect(payload).toHaveProperty("results");

    const results = payload.results as Array<Record<string, unknown>>;
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("benefit_name");
      expect(results[0]).toHaveProperty("status");
      expect(results[0]).toHaveProperty("category");
      expect(results[0]).toHaveProperty("jurisdiction");
    }

    await app.close();
  });

  test("scan route evaluates real benefit rules for seeded YAML facts", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;");
    db.exec("DELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "scanner-user@example.com",
        password: "Test1234!",
        display_name: "Scanner User"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string; user_id: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          filing_status: "single",
          estimated_agi: 90000,
          residence: {
            state: "PA",
            county: "Allegheny"
          },
          taxpayer: { age: 45, veteran: true, disabled: true }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "Solo Consulting",
              entity_type: "sole_prop",
              financials: { net_profit_loss: 100000 },
              home_office: { claimed: true, square_footage: 120, home_total_sqft: 2000 },
              vehicle: {
                business_vehicle: true,
                business_miles: 1200
              },
              health_insurance: {
                owner_health_insurance_deducted: true,
                premium_amount: 8400
              }
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/retirement",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          self_employed_plans: {
            sep_ira: { established: false, contributions_ytd: 0 }
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/healthcare",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          insurance: {
            coverage_type: "self_purchased",
            hdhp_enrolled: true,
            hdhp_coverage_level: "self"
          },
          health_savings_account: {
            contributions_ytd: 1000,
            existing_balance: 5000,
            investment_account_within_hsa: false
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/real_estate",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          properties: [
            {
              property_type: "primary_residence",
              acquisition: {
                purchase_price: 220000,
                current_market_value: 380000
              },
              primary_residence: {
                years_lived_in: 3,
                used_as_primary_for_2_of_last_5: true
              }
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/real_estate",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          properties: [
            {
              property_type: "rental_residential",
              acquisition: {
                purchase_price: 400000,
                current_market_value: 520000
              },
              financing: {
                mortgage_interest_paid: 18000,
                property_tax_paid: 9000
              }
            },
            {
              property_type: "primary_residence",
              acquisition: {
                purchase_price: 280000,
                current_market_value: 340000
              },
              financing: {
                property_tax_paid: 4200
              },
              primary_residence: {
                years_lived_in: 7,
                used_as_primary_for_2_of_last_5: true,
                section_121_exclusion_available: true
              }
            },
            {
              property_type: "land",
              description: "Open pasture land",
              current_value: 250000
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/income",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          retirement_distributions: {
            traditional_ira: 12000,
            pension: 0,
            "401k": 0
          },
          social_security: {
            gross_benefits: 18000
          }
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const ids = payload.results.map((r) => String(r.benefit_id));
    expect(ids).toContain("sep-ira-contribution");
    expect(ids).toContain("hsa-triple-tax-advantage");
    expect(ids).toContain("self-employed-health-insurance");

    const sep = payload.results.find((r) => r.benefit_id === "sep-ira-contribution");
    expect(sep?.status).toBe("nearly_eligible");

    const solo401k = payload.results.find((r) => r.benefit_id === "solo-401k");
    expect(solo401k?.status).toBe("nearly_eligible");

    const homeOffice = payload.results.find((r) => r.benefit_id === "home-office-deduction");
    expect(homeOffice?.status).toBe("eligible_now");

    const countyHomestead = payload.results.find((r) => r.benefit_id === "county-homestead-exemption");
    expect(countyHomestead?.status).toBe("eligible_now");

    const agUse = payload.results.find((r) => r.benefit_id === "county-agricultural-use-valuation");
    expect(agUse?.status).toBe("nearly_eligible");

    const veteran = payload.results.find((r) => r.benefit_id === "county-veteran-property-tax-exemption");
    expect(veteran?.status).toBe("nearly_eligible");

    const disability = payload.results.find((r) => r.benefit_id === "county-disability-property-tax-exemption");
    expect(disability?.status).toBe("nearly_eligible");

    const solar = payload.results.find((r) => r.benefit_id === "county-solar-exemption");
    expect(solar?.status).toBe("nearly_eligible");

    const stateHomestead = payload.results.find((r) => r.benefit_id === "state-homestead-exemption");
    expect(stateHomestead?.status).toBe("eligible_now");

    const seniorFreeze = payload.results.find((r) => r.benefit_id === "county-senior-property-tax-freeze");
    expect(seniorFreeze?.status).toBe("not_applicable");

    const qbi = payload.results.find((r) => r.benefit_id === "qbi-deduction");
    expect(qbi?.status).toBe("eligible_now");

    const sCorp = payload.results.find((r) => r.benefit_id === "s-corp-election");
    expect(sCorp?.status).toBe("eligible_if_changed");

    const vehicle = payload.results.find((r) => r.benefit_id === "business-vehicle-deduction");
    expect(vehicle?.status).toBe("eligible_now");

    const section179 = payload.results.find((r) => r.benefit_id === "section-179-expensing");
    expect(section179?.status).toBe("nearly_eligible");

    const bonus = payload.results.find((r) => r.benefit_id === "bonus-depreciation");
    expect(bonus?.status).toBe("nearly_eligible");

    const rentalDep = payload.results.find((r) => r.benefit_id === "real-estate-depreciation");
    expect(rentalDep?.status).toBe("eligible_now");

    const passive = payload.results.find((r) => r.benefit_id === "passive-activity-loss");
    expect(passive?.status).toBe("eligible_now");

    const exchange1031 = payload.results.find((r) => r.benefit_id === "1031-exchange");
    expect(exchange1031?.status).toBe("eligible_now");

    const rep = payload.results.find((r) => r.benefit_id === "real-estate-professional-status");
    expect(rep?.status).toBe("future_opportunity");

    const pte = payload.results.find((r) => r.benefit_id === "pte-election");
    expect(pte?.status).toBe("eligible_if_changed");

    const costSeg = payload.results.find((r) => r.benefit_id === "cost-segregation");
    expect(costSeg?.status).toBe("eligible_if_changed");

    const augusta = payload.results.find((r) => r.benefit_id === "augusta-rule");
    expect(augusta?.status).toBe("eligible_if_changed");

    const state529 = payload.results.find((r) => r.benefit_id === "state-529-deduction");
    expect(state529?.status).toBe("eligible_if_changed");

    const retirementExemption = payload.results.find((r) => r.benefit_id === "state-retirement-income-exemption");
    expect(retirementExemption?.status).toBe("eligible_now");

    const hsa = payload.results.find((r) => r.benefit_id === "hsa-triple-tax-advantage");
    expect(hsa?.status).toBe("eligible_now");
    expect(Array.isArray(hsa?.next_steps) ? hsa?.next_steps : []).toContain("Invest HSA balance ($5,000) — don't leave it in cash");

    const health = payload.results.find((r) => r.benefit_id === "self-employed-health-insurance");
    expect(health?.status).toBe("eligible_now");

    await app.close();
  });

  test("ai analysis endpoint returns 503 when anthropic key is absent", async () => {
    const app = buildApp();

    const aiRes = await app.inject({
      method: "POST",
      url: "/api/scan/ai-analysis?tax_year=2025&mode=opportunities"
    });

    if (aiRes.statusCode === 503) {
      expect(aiRes.json()).toEqual({ detail: "ANTHROPIC_API_KEY is not set" });
    } else {
      // If key exists in local env, endpoint should still succeed with job creation.
      expect(aiRes.statusCode).toBe(200);
      expect(aiRes.json()).toHaveProperty("job_id");
    }

    await app.close();
  });

  test("scan route evaluates federal family and education credit rules", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;\nDELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "credit-user@example.com",
        password: "Test1234!",
        display_name: "Credit User"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          filing_status: "single",
          estimated_agi: 35000,
          residence: {
            state: "PA",
            county: "Allegheny"
          },
          taxpayer: { age: 30 }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/income",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          w2_employment: [
            {
              employer_name: "Acme",
              wages: 30000
            }
          ],
          investment_income: {
            interest: 100,
            long_term_capital_gains: 10000
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/dependents",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          dependents: [
            {
              name: "Child One",
              age_at_year_end: 10,
              ssn_obtained: true,
              care_expenses: {
                daycare_cost: 3000,
                after_school_care_cost: 1000,
                summer_camp_cost: 500
              }
            },
            {
              name: "College Student",
              age_at_year_end: 19,
              ssn_obtained: true,
              education: {
                school_level: "undergraduate",
                tuition_paid: 6000
              }
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/retirement",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          employer_plans: {
            traditional_401k: {
              employee_contribution_ytd: 1000
            }
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/healthcare",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          flexible_spending_accounts: {
            dependent_care_fsa: {
              election_amount: 1000
            }
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/real_estate",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          properties: [
            {
              property_type: "primary_residence",
              acquisition: {
                purchase_price: 220000,
                current_market_value: 380000
              },
              primary_residence: {
                years_lived_in: 3,
                used_as_primary_for_2_of_last_5: true
              }
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };

    const ctc = payload.results.find((r) => r.benefit_id === "child-tax-credit");
    expect(ctc?.status).toBe("eligible_now");

    const cdcc = payload.results.find((r) => r.benefit_id === "child-dependent-care-credit");
    expect(cdcc?.status).toBe("eligible_now");

    const eitc = payload.results.find((r) => r.benefit_id === "earned-income-tax-credit");
    expect(eitc?.status).toBe("eligible_now");

    const aotc = payload.results.find((r) => r.benefit_id === "american-opportunity-credit");
    expect(aotc?.status).toBe("eligible_now");

    const llc = payload.results.find((r) => r.benefit_id === "lifetime-learning-credit");
    expect(llc?.status).toBe("nearly_eligible");

    const savers = payload.results.find((r) => r.benefit_id === "savers-credit");
    expect(savers?.status).toBe("eligible_now");

    const energy25c = payload.results.find((r) => r.benefit_id === "25c-energy-home-improvement");
    expect(energy25c?.status).toBe("eligible_now");

    const ev = payload.results.find((r) => r.benefit_id === "clean-vehicle-credit");
    expect(ev?.status).toBe("nearly_eligible");

    const sec121 = payload.results.find((r) => r.benefit_id === "section-121-exclusion");
    expect(sec121?.status).toBe("eligible_now");

    const cleanEnergy = payload.results.find((r) => r.benefit_id === "residential-clean-energy-credit");
    expect(cleanEnergy?.status).toBe("nearly_eligible");

    const oz = payload.results.find((r) => r.benefit_id === "opportunity-zone-investment");
    expect(oz?.status).toBe("eligible_now");

    const harvesting = payload.results.find((r) => r.benefit_id === "capital-gains-harvesting");
    expect(harvesting?.status).toBe("eligible_now");

    const premium = payload.results.find((r) => r.benefit_id === "premium-tax-credit");
    expect(premium?.status).toBe("not_applicable");

    const backdoor = payload.results.find((r) => r.benefit_id === "backdoor-roth-ira");
    expect(backdoor?.status).toBe("not_applicable");

    const feie = payload.results.find((r) => r.benefit_id === "foreign-earned-income-exclusion");
    expect(feie?.status).toBe("not_applicable");

    const gift = payload.results.find((r) => r.benefit_id === "annual-gift-tax-exclusion");
    expect(gift?.status).toBe("nearly_eligible");

    const charitable = payload.results.find((r) => r.benefit_id === "charitable-contribution-deduction");
    expect(charitable?.status).toBe("nearly_eligible");

    const mortgage = payload.results.find((r) => r.benefit_id === "mortgage-interest-deduction");
    expect(mortgage?.status).toBe("nearly_eligible");

    const salt = payload.results.find((r) => r.benefit_id === "salt-deduction");
    expect(salt?.status).toBe("nearly_eligible");

    await app.close();
  });

  test("scan route evaluates premium tax credit and backdoor Roth positive paths", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;\nDELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "ptc-backdoor@example.com",
        password: "Test1234!",
        display_name: "PTC Backdoor"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          filing_status: "single",
          estimated_agi: 200000,
          residence: {
            state: "TX",
            county: "Travis"
          },
          taxpayer: { age: 42 }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/healthcare",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          insurance: {
            coverage_type: "marketplace"
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/retirement",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          individual_retirement_accounts: {
            traditional_ira: {
              accounts: [
                {
                  balance: 0
                }
              ]
            }
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/goals",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          primary_goals: {
            transfer_wealth_to_heirs: true
          }
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };

    const premium = payload.results.find((r) => r.benefit_id === "premium-tax-credit");
    expect(premium?.status).toBe("eligible_now");

    const backdoor = payload.results.find((r) => r.benefit_id === "backdoor-roth-ira");
    expect(backdoor?.status).toBe("eligible_now");

    const gift = payload.results.find((r) => r.benefit_id === "annual-gift-tax-exclusion");
    expect(gift?.status).toBe("eligible_now");

    await app.close();
  });

  test("scan route recognizes the small employer retirement startup credit", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "startup-credit@example.com",
        password: "Test1234!",
        display_name: "Startup Credit User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "Growth LLC",
              entity_type: "llc",
              employees: {
                w2_employees_count: 3
              },
              retirement_plans: {
                sep_ira: false,
                simple_ira: false,
                solo_401k: false,
                defined_benefit: false
              }
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const credit = payload.results.find((r) => r.benefit_id === "small-employer-retirement-startup-credit");
    expect(credit?.status).toBe("eligible_now");
    expect(credit?.message).toContain("§45E applies");

    await app.close();
  });

  test("scan route recognizes the work opportunity tax credit", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "wotc@example.com",
        password: "Test1234!",
        display_name: "WOTC User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "Hiring LLC",
              entity_type: "llc",
              employees: {
                w2_employees_count: 5
              }
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const wotc = payload.results.find((r) => r.benefit_id === "work-opportunity-tax-credit");
    expect(wotc?.status).toBe("nearly_eligible");
    expect(wotc?.missing_facts).toContain("businesses.employees.wotc_hires");

    await app.close();
  });

  test("scan route recognizes the employer childcare credit", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "childcare-credit@example.com",
        password: "Test1234!",
        display_name: "Childcare Credit User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "Childcare LLC",
              entity_type: "llc",
              employees: {
                w2_employees_count: 5
              }
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const childcare = payload.results.find((r) => r.benefit_id === "employer-childcare-credit");
    expect(childcare?.status).toBe("nearly_eligible");
    expect(childcare?.missing_facts).toContain("businesses.financials.childcare_expenses");

    await app.close();
  });

  test("scan route recognizes the excess fica refund", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "fica-refund@example.com",
        password: "Test1234!",
        display_name: "FICA Refund User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/income",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          w2_employment: [
            { employer_name: "Alpha Inc", wages: 120000, social_security_withheld: 3000 },
            { employer_name: "Beta LLC", wages: 130000, social_security_withheld: 3000 }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const fica = payload.results.find((r) => r.benefit_id === "excess-fica-refund");
    expect(fica?.status).toBe("nearly_eligible");
    expect(fica?.missing_facts).toContain("income.w2_employment[*].social_security_withheld");

    await app.close();
  });

  test("scan route recognizes the installment sale opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "installment-sale@example.com",
        password: "Test1234!",
        display_name: "Installment Sale User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/real_estate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          properties: [
            {
              property_type: "investment_property",
              acquisition: {
                purchase_price: 250000,
                current_market_value: 400000
              }
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const installment = payload.results.find((r) => r.benefit_id === "installment-sale");
    expect(installment?.status).toBe("eligible_if_changed");
    expect(installment?.changes_needed).toContain("Negotiate seller financing terms when selling real estate or business");

    await app.close();
  });

  test("scan route recognizes the nol carryforward opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "nol-carryforward@example.com",
        password: "Test1234!",
        display_name: "NOL Carryforward User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "NOL LLC",
              entity_type: "llc"
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const nol = payload.results.find((r) => r.benefit_id === "nol-carryforward");
    expect(nol?.status).toBe("nearly_eligible");
    expect(nol?.missing_facts).toContain("businesses.financials.net_profit_loss");

    await app.close();
  });

  test("scan route recognizes the qlac opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "qlac@example.com",
        password: "Test1234!",
        display_name: "QLAC User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          taxpayer: {
            age: 62
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/retirement",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          employer_plans: {
            traditional_401k: {
              employee_contribution_ytd: 5000
            }
          }
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const qlac = payload.results.find((r) => r.benefit_id === "qlac");
    expect(qlac?.status).toBe("nearly_eligible");
    expect(qlac?.missing_facts).toContain("retirement.individual_retirement_accounts.traditional_ira.balance");

    await app.close();
  });

  test("scan route recognizes the qsbs exclusion opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "qsbs@example.com",
        password: "Test1234!",
        display_name: "QSBS User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "FounderCo",
              entity_type: "llc"
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const qsbs = payload.results.find((r) => r.benefit_id === "qsbs-exclusion");
    expect(qsbs?.status).toBe("future_opportunity");
    expect(qsbs?.message).toContain("Set investments.has_qualified_small_business_stock: true if applicable.");

    await app.close();
  });

  test("scan route recognizes the conservation easement opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "easement@example.com",
        password: "Test1234!",
        display_name: "Easement User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/real_estate",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          properties: [
            {
              property_type: "land",
              description: "Undeveloped scenic corridor",
              current_value: 500000
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          estimated_agi: 200000
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const easement = payload.results.find((r) => r.benefit_id === "conservation-easement");
    expect(easement?.status).toBe("nearly_eligible");
    expect(easement?.message).toContain("Annual deduction limit");

    await app.close();
  });

  test("scan route recognizes the net unrealized appreciation opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "nua@example.com",
        password: "Test1234!",
        display_name: "NUA User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/income",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          w2_employment: [
            {
              employer_name: "Employer Inc",
              wages: 120000
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/retirement",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          employer_plans: {
            traditional_401k: {
              employer_stock_nua: 50000
            }
          }
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const nua = payload.results.find((r) => r.benefit_id === "net-unrealized-appreciation");
    expect(nua?.status).toBe("eligible_now");
    expect(nua?.message).toContain("NUA strategy available");

    await app.close();
  });

  test("scan route recognizes the ichra qsehra opportunity", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "ichra-qsehra@example.com",
        password: "Test1234!",
        display_name: "ICHRA QSEHRA User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "Benefits LLC",
              entity_type: "llc",
              employees: {
                w2_employees_count: 12
              }
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/healthcare",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          employer_group_plan: false
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const hra = payload.results.find((r) => r.benefit_id === "ichra-qsehra");
    expect(hra?.status).toBe("nearly_eligible");
    expect(hra?.message).toContain("QSEHRA allows you to reimburse");

    await app.close();
  });

  test("scan route recognizes a no-income-tax state", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;\nDELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "tax-free-state@example.com",
        password: "Test1234!",
        display_name: "Tax Free State"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          filing_status: "single",
          residence: {
            state: "TX",
            county: "Travis"
          },
          taxpayer: { age: 39 }
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const noTax = payload.results.find((r) => r.benefit_id === "no-income-tax-state");
    expect(noTax?.status).toBe("eligible_now");

    await app.close();
  });

  test("scan route recognizes the state EV credit", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "state-ev@example.com",
        password: "Test1234!",
        display_name: "State EV User"
      }
    });

    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          residence: {
            state: "CA"
          },
          estimated_agi: 120000,
          has_electric_vehicle: true
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const evCredit = payload.results.find((r) => r.benefit_id === "state-ev-credit");
    expect(evCredit?.status).toBe("eligible_now");
    expect(evCredit?.message).toContain("CA offers a state EV credit/rebate");

    await app.close();
  });

  test("scan route recognizes bonus depreciation and state 529 contribution positive paths", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;\nDELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "bonus-529@example.com",
        password: "Test1234!",
        display_name: "Bonus 529"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          filing_status: "single",
          estimated_agi: 120000,
          residence: {
            state: "PA",
            county: "Allegheny"
          },
          taxpayer: { age: 41 }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/businesses",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          businesses: [
            {
              name: "Bonus Corp",
              entity_type: "sole_prop",
              financials: {
                net_profit_loss: 90000
              },
              depreciation: {
                assets_placed_in_service: [
                  {
                    name: "Equipment",
                    cost: 25000,
                    placed_in_service_date: "2025-09-15"
                  }
                ]
              }
            }
          ]
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/investments",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          "529_plans": [
            {
              beneficiary: "Child One",
              balance: 5000,
              contributions_this_year: 3000
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };

    const section179 = payload.results.find((r) => r.benefit_id === "section-179-expensing");
    expect(section179?.status).toBe("eligible_now");

    const bonus = payload.results.find((r) => r.benefit_id === "bonus-depreciation");
    expect(bonus?.status).toBe("eligible_now");

    const state529 = payload.results.find((r) => r.benefit_id === "state-529-deduction");
    expect(state529?.status).toBe("eligible_now");

    await app.close();
  });

  test("scan route flags 529 account with zero annual contributions as eligible_if_changed", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;\nDELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "529-zero@example.com",
        password: "Test1234!",
        display_name: "529 Zero"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/household",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          filing_status: "single",
          estimated_agi: 90000,
          residence: {
            state: "PA",
            county: "Allegheny"
          }
        }
      }
    });

    await app.inject({
      method: "PUT",
      url: "/api/user-data/investments",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          "529_plans": [
            {
              beneficiary: "Child Zero",
              balance: 10000,
              contributions_this_year: 0
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const state529 = payload.results.find((r) => r.benefit_id === "state-529-deduction");
    expect(state529?.status).toBe("eligible_if_changed");

    await app.close();
  });

  test("scan route recognizes the 529 to Roth rollover", async () => {
    const app = buildApp();

    const db = getDb();
    db.exec("DELETE FROM section_data;\nDELETE FROM users;");

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "529-rollover@example.com",
        password: "Test1234!",
        display_name: "529 Rollover"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const tokenPayload = registerRes.json() as { token: string };

    await app.inject({
      method: "PUT",
      url: "/api/user-data/investments",
      headers: { authorization: `Bearer ${tokenPayload.token}` },
      payload: {
        data: {
          "529_plans": [
            {
              beneficiary: "Child Rollover",
              balance: 12000,
              contributions_this_year: 0,
              opened_date: "2009-06-15"
            }
          ]
        }
      }
    });

    const scanRes = await app.inject({
      method: "POST",
      url: "/api/scan?tax_year=2025",
      headers: { authorization: `Bearer ${tokenPayload.token}` }
    });

    expect(scanRes.statusCode).toBe(200);
    const payload = scanRes.json() as { results: Array<Record<string, unknown>> };
    const rollover = payload.results.find((r) => r.benefit_id === "529-to-roth-rollover");
    expect(rollover?.status).toBe("eligible_now");
    expect(rollover?.message).toContain("529 account present");

    await app.close();
  });

  test("tax law route exposes changes, status, and alert count contracts", async () => {
    const app = buildApp();

    const changesRes = await app.inject({
      method: "GET",
      url: "/api/tax-law/changes?limit=5"
    });
    expect(changesRes.statusCode).toBe(200);
    const changesPayload = changesRes.json() as {
      changes: Array<Record<string, unknown>>;
      total: number;
    };
    expect(Array.isArray(changesPayload.changes)).toBe(true);
    expect(typeof changesPayload.total).toBe("number");

    const statusRes = await app.inject({ method: "GET", url: "/api/tax-law/status" });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json()).toHaveProperty("running");

    const alertCountRes = await app.inject({
      method: "GET",
      url: "/api/tax-law/alert-count?since_days=30"
    });
    expect(alertCountRes.statusCode).toBe(200);
    expect(alertCountRes.json()).toHaveProperty("count");
    expect(alertCountRes.json()).toHaveProperty("since_days", 30);

    await app.close();
  });

  test("tax law update validates source and starts background update", async () => {
    const app = buildApp();

    const badSourceRes = await app.inject({
      method: "POST",
      url: "/api/tax-law/update?source=not_real"
    });
    expect(badSourceRes.statusCode).toBe(400);
    expect((badSourceRes.json() as { detail: string }).detail).toContain("Unknown source");

    const triggerRes = await app.inject({
      method: "POST",
      url: "/api/tax-law/update?source=irs_news&days=14&dry_run=true"
    });
    expect(triggerRes.statusCode).toBe(200);
    expect(triggerRes.json()).toEqual({
      status: "started",
      dry_run: true,
      days: 14,
      source: "irs_news"
    });

    await app.close();
  });

  test("tax law route rejects invalid bounds and surfaces already running state", async () => {
    const app = buildApp();

    const invalidLimitRes = await app.inject({
      method: "GET",
      url: "/api/tax-law/changes?limit=0"
    });
    expect(invalidLimitRes.statusCode).toBe(400);
    expect((invalidLimitRes.json() as { detail: string }).detail).toContain("limit must be between 1 and 100");

    const invalidDaysRes = await app.inject({
      method: "POST",
      url: "/api/tax-law/update?days=0"
    });
    expect(invalidDaysRes.statusCode).toBe(400);
    expect((invalidDaysRes.json() as { detail: string }).detail).toContain("days must be between 1 and 365");

    const invalidSinceDaysRes = await app.inject({
      method: "GET",
      url: "/api/tax-law/alert-count?since_days=0"
    });
    expect(invalidSinceDaysRes.statusCode).toBe(400);
    expect((invalidSinceDaysRes.json() as { detail: string }).detail).toContain("since_days must be between 1 and 365");

    __setTaxLawUpdateRunningForTest(true);
    try {
      const alreadyRunningRes = await app.inject({
        method: "POST",
        url: "/api/tax-law/update?source=irs_news&days=14&dry_run=true"
      });
      expect(alreadyRunningRes.statusCode).toBe(200);
      expect(alreadyRunningRes.json()).toEqual({
        status: "already_running",
        dry_run: true,
        days: 14,
        source: "irs_news"
      });
    } finally {
      __setTaxLawUpdateRunningForTest(false);
    }

    await app.close();
  });

  test("reports route lists markdown reports and fetches report content", async () => {
    const app = buildApp();

    const listRes = await app.inject({ method: "GET", url: "/api/reports" });
    expect(listRes.statusCode).toBe(200);
    const listPayload = listRes.json() as { reports: Array<{ name: string }> };
    expect(listPayload.reports.length).toBeGreaterThan(0);

    const reportName = listPayload.reports[0]?.name;
    expect(reportName).toMatch(/\.md$/);

    if (reportName) {
      const getRes = await app.inject({ method: "GET", url: `/api/reports/${reportName}` });
      expect(getRes.statusCode).toBe(200);
      const getPayload = getRes.json() as { name: string; content: string };
      expect(getPayload.name).toBe(reportName);
      expect(getPayload.content.length).toBeGreaterThan(0);
    }

    await app.close();
  });

  test("reports cpa packet job completes and exposes status", async () => {
    const app = buildApp();

    const triggerRes = await app.inject({
      method: "POST",
      url: "/api/reports/cpa-packet?tax_year=2025&with_ai=true"
    });
    expect(triggerRes.statusCode).toBe(200);
    const triggerPayload = triggerRes.json() as { job_id: string };
    expect(triggerPayload.job_id).toBeTruthy();

    const statusRes = await app.inject({
      method: "GET",
      url: `/api/reports/cpa-packet/${triggerPayload.job_id}`
    });
    expect(statusRes.statusCode).toBe(200);
    const statusPayload = statusRes.json() as { status: string; report_name: string | null; error: string | null };
    expect(statusPayload.status === "running" || statusPayload.status === "complete").toBe(true);

    if (statusPayload.status !== "complete") {
      const completeRes = await app.inject({
        method: "GET",
        url: `/api/reports/cpa-packet/${triggerPayload.job_id}`
      });
      expect(completeRes.statusCode).toBe(200);
    }

    const finalStatusRes = await app.inject({
      method: "GET",
      url: `/api/reports/cpa-packet/${triggerPayload.job_id}`
    });
    const finalStatus = finalStatusRes.json() as { status: string; report_name: string | null };
    expect(finalStatus.status).toBe("complete");
    expect(finalStatus.report_name).toMatch(/^cpa_packet_.*\.md$/);

    if (finalStatus.report_name) {
      const reportPath = path.join(process.cwd(), "..", "reports", finalStatus.report_name);
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
    }

    await app.close();
  });

  test("scenarios route lists scenario contracts and runs a scenario diff", async () => {
    const app = buildApp();

    const listRes = await app.inject({ method: "GET", url: "/api/scenarios" });
    expect(listRes.statusCode).toBe(200);
    const listPayload = listRes.json() as { scenarios: Array<{ key: string; description: string }> };
    expect(listPayload.scenarios.length).toBeGreaterThan(0);
    expect(listPayload.scenarios.some((scenario) => scenario.key === "start_llc")).toBe(true);

    const runRes = await app.inject({ method: "POST", url: "/api/scenarios/start_llc?tax_year=2025" });
    expect(runRes.statusCode).toBe(200);
    const runPayload = runRes.json() as {
      scenario: string;
      description: string;
      baseline_counts: Record<string, number>;
      scenario_counts: Record<string, number>;
      diff: {
        newly_added: Array<Record<string, unknown>>;
        improved: Array<Record<string, unknown>>;
        degraded: Array<Record<string, unknown>>;
        removed: Array<Record<string, unknown>>;
      };
    };
    expect(runPayload.scenario).toBe("start_llc");
    expect(runPayload.description.length).toBeGreaterThan(0);
    expect(typeof runPayload.baseline_counts).toBe("object");
    expect(typeof runPayload.scenario_counts).toBe("object");
    expect(runPayload.diff).toHaveProperty("newly_added");
    expect(runPayload.diff).toHaveProperty("improved");
    expect(runPayload.diff).toHaveProperty("degraded");
    expect(runPayload.diff).toHaveProperty("removed");

    const badRes = await app.inject({ method: "POST", url: "/api/scenarios/not_real" });
    expect(badRes.statusCode).toBe(404);
    expect((badRes.json() as { detail: string }).detail).toContain("Scenario 'not_real' not found");

    await app.close();
  });

  test("tax forms route saves filing details and returns computed summaries", async () => {
    const app = buildApp();

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "tax-forms-user@example.com",
        password: "Test1234!",
        display_name: "Tax Forms User"
      }
    });
    expect(registerRes.statusCode).toBe(201);
    const token = (registerRes.json() as { token: string }).token;

    const saveRes = await app.inject({
      method: "PUT",
      url: "/api/filing-details?tax_year=2025",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        pec_fund_taxpayer: true,
        pec_fund_spouse: false,
        direct_deposit_routing: "111000025",
        direct_deposit_account: "123456789",
        direct_deposit_type: "checking",
        allow_third_party: true,
        designee_name: "Tax Preparer",
        designee_phone: "555-123-4567",
        designee_pin: "4321"
      }
    });
    expect(saveRes.statusCode).toBe(200);
    expect(saveRes.json()).toEqual({ ok: true });

    const getRes = await app.inject({
      method: "GET",
      url: "/api/filing-details?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toMatchObject({
      pec_fund_taxpayer: true,
      pec_fund_spouse: false,
      direct_deposit_routing: "111000025",
      direct_deposit_account: "123456789",
      direct_deposit_type: "checking",
      allow_third_party: true,
      designee_name: "Tax Preparer",
      designee_phone: "555-123-4567",
      designee_pin: "4321"
    });

    const computeRes = await app.inject({
      method: "GET",
      url: "/api/tax-forms/compute?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(computeRes.statusCode).toBe(200);
    const computePayload = computeRes.json() as {
      tax_year: number;
      filing_details: Record<string, unknown>;
      summary: Record<string, unknown>;
    };
    expect(computePayload.tax_year).toBe(2025);
    expect(computePayload.filing_details).toHaveProperty("pec_fund_taxpayer", true);
    expect(computePayload.summary).toHaveProperty("counts");

    const previewRes = await app.inject({
      method: "GET",
      url: "/api/tax-forms/preview-pdf?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(previewRes.statusCode).toBe(200);
    expect(previewRes.headers["content-type"]).toContain("application/pdf");

    const jobRes = await app.inject({
      method: "POST",
      url: "/api/reports/tax-forms?tax_year=2025",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(jobRes.statusCode).toBe(200);
    const jobPayload = jobRes.json() as { job_id: string };
    expect(jobPayload.job_id).toBeTruthy();

    const statusRes = await app.inject({
      method: "GET",
      url: `/api/reports/tax-forms/${jobPayload.job_id}`
    });
    expect(statusRes.statusCode).toBe(200);
    const statusPayload = statusRes.json() as { status: string; zip_name: string | null };
    expect(statusPayload.status).toBe("complete");
    expect(statusPayload.zip_name).toMatch(/\.zip$/);

    const downloadRes = await app.inject({
      method: "GET",
      url: `/api/reports/tax-forms/${jobPayload.job_id}/download`
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers["content-type"]).toContain("application/zip");

    await app.close();
  });

  test("tax forms route rejects unauthenticated access", async () => {
    const app = buildApp();

    const getRes = await app.inject({ method: "GET", url: "/api/filing-details?tax_year=2025" });
    expect(getRes.statusCode).toBe(401);

    const postRes = await app.inject({ method: "POST", url: "/api/reports/tax-forms?tax_year=2025" });
    expect(postRes.statusCode).toBe(401);

    await app.close();
  });
});
