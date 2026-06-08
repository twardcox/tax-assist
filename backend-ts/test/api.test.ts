import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../src/app";
import { getDb } from "../src/db/client";

beforeEach(() => {
  const db = getDb();
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
});
