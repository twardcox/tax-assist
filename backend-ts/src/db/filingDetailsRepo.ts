import { queryOne, execute } from "./client";

export type FilingDetails = {
  pec_fund_taxpayer?: boolean;
  pec_fund_spouse?: boolean;
  direct_deposit_routing?: string | null;
  direct_deposit_account?: string | null;
  direct_deposit_type?: string | null;
  allow_third_party?: boolean;
  designee_name?: string | null;
  designee_phone?: string | null;
  designee_pin?: string | null;
};

export async function saveFilingDetails(userId: string, taxYear: number, data: FilingDetails): Promise<void> {
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO households (user_id, tax_year, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(user_id, tax_year)
     DO UPDATE SET updated_at = EXCLUDED.updated_at`,
    [userId, taxYear, now]
  );

  await execute(
    `UPDATE households SET
      pec_fund_taxpayer = $1,
      pec_fund_spouse = $2,
      direct_deposit_routing = $3,
      direct_deposit_account = $4,
      direct_deposit_type = $5,
      allow_third_party = $6,
      designee_name = $7,
      designee_phone = $8,
      designee_pin = $9,
      updated_at = $10
     WHERE user_id = $11 AND tax_year = $12`,
    [
      data.pec_fund_taxpayer ? 1 : 0,
      data.pec_fund_spouse ? 1 : 0,
      data.direct_deposit_routing ?? null,
      data.direct_deposit_account ?? null,
      data.direct_deposit_type ?? null,
      data.allow_third_party ? 1 : 0,
      data.designee_name ?? null,
      data.designee_phone ?? null,
      data.designee_pin ?? null,
      now,
      userId,
      taxYear,
    ]
  );
}

export async function getFilingDetails(userId: string, taxYear: number): Promise<FilingDetails> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT pec_fund_taxpayer, pec_fund_spouse, direct_deposit_routing,
            direct_deposit_account, direct_deposit_type, allow_third_party,
            designee_name, designee_phone, designee_pin
     FROM households
     WHERE user_id = $1 AND tax_year = $2`,
    [userId, taxYear]
  );

  if (!row) {
    return {};
  }

  return {
    pec_fund_taxpayer: row.pec_fund_taxpayer === 1,
    pec_fund_spouse: row.pec_fund_spouse === 1,
    direct_deposit_routing: (row.direct_deposit_routing as string | null) ?? null,
    direct_deposit_account: (row.direct_deposit_account as string | null) ?? null,
    direct_deposit_type: (row.direct_deposit_type as string | null) ?? null,
    allow_third_party: row.allow_third_party === 1,
    designee_name: (row.designee_name as string | null) ?? null,
    designee_phone: (row.designee_phone as string | null) ?? null,
    designee_pin: (row.designee_pin as string | null) ?? null,
  };
}
