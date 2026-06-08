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
});
