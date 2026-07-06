import { AppError } from "../../lib/errors";
import { TAX_PARAMS } from "./taxParams.generated";

export type TaxParams = {
  standard_deduction: Record<string, number>;
  extra_deduction_65: { single: number; married: number };
  brackets: Record<string, Array<[number, number]>>;
  ltcg_thresholds: Record<string, [number, number]>;
  se_ss_wage_base: number;
  child_tax_credit: number;
  ctc_phaseout: Record<string, number>;
  niit_threshold: Record<string, number>;
  amt_exemption: Record<string, number>;
  salt_cap: Record<string, number>;
  salt_phase_threshold: number | null;
  salt_phase_rate: number | null;
};

export const SUPPORTED_TAX_YEARS = Object.keys(TAX_PARAMS).map(Number);

export function getTaxParams(taxYear: number): TaxParams {
  const params = TAX_PARAMS[taxYear];
  if (!params) {
    // Refuse rather than silently compute with another year's numbers.
    throw new AppError(400, `Tax year ${taxYear} is not supported (supported: ${SUPPORTED_TAX_YEARS.join(", ")})`);
  }
  return params;
}

/**
 * Nearest supported year's params — for advisory contexts (scanner messages)
 * where an approximate figure beats a failed scan. Form math must use
 * getTaxParams.
 */
export function getTaxParamsClosest(taxYear: number): TaxParams {
  if (TAX_PARAMS[taxYear]) return TAX_PARAMS[taxYear];
  const closest = SUPPORTED_TAX_YEARS.reduce((best, y) =>
    Math.abs(y - taxYear) < Math.abs(best - taxYear) ? y : best
  );
  return TAX_PARAMS[closest];
}
