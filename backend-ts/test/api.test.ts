import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../src/app";
import { getDb } from "../src/db/client";
import { initDb } from "../src/db/init";
import { addTransaction } from "../src/db/transactionsRepo";

beforeEach(() => {
  initDb();
  const db = getDb();
  db.exec("DELETE FROM transactions;");
  db.exec("DELETE FROM section_data;");
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
          taxpayer: { age: 45 }
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

    const homeOffice = payload.results.find((r) => r.benefit_id === "home-office-deduction");
    expect(homeOffice?.status).toBe("eligible_now");

    const countyHomestead = payload.results.find((r) => r.benefit_id === "county-homestead-exemption");
    expect(countyHomestead?.status).toBe("eligible_now");

    const stateHomestead = payload.results.find((r) => r.benefit_id === "state-homestead-exemption");
    expect(stateHomestead?.status).toBe("eligible_now");

    const seniorFreeze = payload.results.find((r) => r.benefit_id === "county-senior-property-tax-freeze");
    expect(seniorFreeze?.status).toBe("not_applicable");

    const qbi = payload.results.find((r) => r.benefit_id === "qbi-deduction");
    expect(qbi?.status).toBe("eligible_now");

    const vehicle = payload.results.find((r) => r.benefit_id === "business-vehicle-deduction");
    expect(vehicle?.status).toBe("eligible_now");

    const rentalDep = payload.results.find((r) => r.benefit_id === "real-estate-depreciation");
    expect(rentalDep?.status).toBe("eligible_now");

    const passive = payload.results.find((r) => r.benefit_id === "passive-activity-loss");
    expect(passive?.status).toBe("eligible_now");

    const retirementExemption = payload.results.find((r) => r.benefit_id === "state-retirement-income-exemption");
    expect(retirementExemption?.status).toBe("eligible_now");

    const hsa = payload.results.find((r) => r.benefit_id === "hsa-triple-tax-advantage");
    expect(hsa?.status).toBe("eligible_now");

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
});
