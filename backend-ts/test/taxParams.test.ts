/**
 * Pins the PolicyEngine-derived parameter snapshot against values verified by
 * hand from primary sources. If regenerating taxParams.generated.ts changes
 * any of these, the diff is either an upstream data fix (verify against the
 * cited source, then update here) or an upstream bug (report it, don't ship).
 *
 * Sources:
 *   2024 — Rev. Proc. 2023-34 (https://www.irs.gov/pub/irs-drop/rp-23-34.pdf)
 *   2025 — Rev. Proc. 2024-40 (https://www.irs.gov/pub/irs-drop/rp-24-40.pdf)
 *          as amended by OBBBA, H.R.1 (119th Congress): standard deduction,
 *          CTC $2,200, SALT cap $40k with 30% phase-down above $500k MAGI
 */
import { describe, expect, test } from "vitest";
import { getTaxParams, getTaxParamsClosest, SUPPORTED_TAX_YEARS } from "../src/domain/taxForms/taxParams";

describe("tax parameter snapshot pins", () => {
  test("supported years", () => {
    expect(SUPPORTED_TAX_YEARS).toEqual([2024, 2025]);
  });

  test("2024 pins (Rev. Proc. 2023-34)", () => {
    const p = getTaxParams(2024);
    expect(p.standard_deduction.single).toBe(14600);
    expect(p.standard_deduction.married_filing_jointly).toBe(29200);
    expect(p.standard_deduction.head_of_household).toBe(21900);
    expect(p.extra_deduction_65).toEqual({ single: 1950, married: 1550 });
    expect(p.brackets.single[0]).toEqual([11600, 0.10]);
    expect(p.brackets.married_filing_jointly[5]).toEqual([731200, 0.35]);
    expect(p.ltcg_thresholds.single).toEqual([47025, 518900]);
    expect(p.se_ss_wage_base).toBe(168600);
    expect(p.child_tax_credit).toBe(2000);
    expect(p.amt_exemption).toEqual({ single: 85700, married_filing_jointly: 133300 });
    expect(p.salt_cap.married_filing_jointly).toBe(10000);
    expect(p.salt_cap.married_filing_separately).toBe(5000);
    expect(p.salt_phase_threshold).toBeNull();
  });

  test("2025 pins (Rev. Proc. 2024-40 + OBBBA)", () => {
    const p = getTaxParams(2025);
    expect(p.standard_deduction.single).toBe(15750);
    expect(p.standard_deduction.married_filing_jointly).toBe(31500);
    expect(p.standard_deduction.head_of_household).toBe(23625);
    expect(p.extra_deduction_65).toEqual({ single: 2000, married: 1600 });
    expect(p.brackets.single[0]).toEqual([11925, 0.10]);
    expect(p.brackets.married_filing_jointly[5]).toEqual([751600, 0.35]);
    expect(p.brackets.single[6][1]).toBe(0.37);
    expect(p.ltcg_thresholds.single).toEqual([48350, 533400]);
    expect(p.ltcg_thresholds.married_filing_jointly).toEqual([96700, 600050]);
    expect(p.se_ss_wage_base).toBe(176100);
    expect(p.child_tax_credit).toBe(2200);
    expect(p.ctc_phaseout).toEqual({ single: 200000, married_filing_jointly: 400000 });
    expect(p.niit_threshold).toEqual({ single: 200000, married_filing_jointly: 250000 });
    expect(p.amt_exemption).toEqual({ single: 88100, married_filing_jointly: 137000 });
    expect(p.salt_cap.married_filing_jointly).toBe(40000);
    expect(p.salt_cap.married_filing_separately).toBe(20000);
    expect(p.salt_phase_threshold).toBe(500000);
    expect(p.salt_phase_rate).toBe(0.3);
  });

  test("getTaxParams rejects unsupported years", () => {
    expect(() => getTaxParams(2023)).toThrow("not supported");
    expect(() => getTaxParams(2030)).toThrow("not supported");
  });

  test("getTaxParamsClosest clamps to nearest supported year", () => {
    expect(getTaxParamsClosest(2023)).toBe(getTaxParams(2024));
    expect(getTaxParamsClosest(2030)).toBe(getTaxParams(2025));
    expect(getTaxParamsClosest(2025)).toBe(getTaxParams(2025));
  });
});
