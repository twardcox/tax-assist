// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/updateTaxParams.mjs
// Source: https://github.com/PolicyEngine/policyengine-us @ 1207664ef2c010ae08a1f10073d9894f4408bd5b
// Generated: 2026-07-06
// Review the git diff against IRS revenue procedures before committing.
import type { TaxParams } from "./taxParams";

export const TAX_PARAMS: Record<number, TaxParams> = {
  "2024": {
    "standard_deduction": {
      "single": 14600,
      "married_filing_jointly": 29200,
      "married_filing_separately": 14600,
      "head_of_household": 21900,
      "qualifying_surviving_spouse": 29200
    },
    "extra_deduction_65": {
      "single": 1950,
      "married": 1550
    },
    "brackets": {
      "single": [
        [
          11600,
          0.1
        ],
        [
          47150,
          0.12
        ],
        [
          100525,
          0.22
        ],
        [
          191950,
          0.24
        ],
        [
          243725,
          0.32
        ],
        [
          609350,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "married_filing_jointly": [
        [
          23200,
          0.1
        ],
        [
          94300,
          0.12
        ],
        [
          201050,
          0.22
        ],
        [
          383900,
          0.24
        ],
        [
          487450,
          0.32
        ],
        [
          731200,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "married_filing_separately": [
        [
          11600,
          0.1
        ],
        [
          47150,
          0.12
        ],
        [
          100525,
          0.22
        ],
        [
          191950,
          0.24
        ],
        [
          243725,
          0.32
        ],
        [
          365600,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "head_of_household": [
        [
          16550,
          0.1
        ],
        [
          63100,
          0.12
        ],
        [
          100500,
          0.22
        ],
        [
          191950,
          0.24
        ],
        [
          243700,
          0.32
        ],
        [
          609350,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "qualifying_surviving_spouse": [
        [
          23200,
          0.1
        ],
        [
          94300,
          0.12
        ],
        [
          201050,
          0.22
        ],
        [
          383900,
          0.24
        ],
        [
          487450,
          0.32
        ],
        [
          731200,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ]
    },
    "ltcg_thresholds": {
      "single": [
        47025,
        518900
      ],
      "married_filing_jointly": [
        94050,
        583750
      ],
      "married_filing_separately": [
        47025,
        291850
      ],
      "head_of_household": [
        63000,
        551350
      ],
      "qualifying_surviving_spouse": [
        94050,
        583750
      ]
    },
    "se_ss_wage_base": 168600,
    "child_tax_credit": 2000,
    "ctc_phaseout": {
      "single": 200000,
      "married_filing_jointly": 400000
    },
    "niit_threshold": {
      "single": 200000,
      "married_filing_jointly": 250000
    },
    "amt_exemption": {
      "single": 85700,
      "married_filing_jointly": 133300
    },
    "salt_cap": {
      "single": 10000,
      "married_filing_jointly": 10000,
      "married_filing_separately": 5000,
      "head_of_household": 10000,
      "qualifying_surviving_spouse": 10000
    },
    "salt_phase_threshold": null,
    "salt_phase_rate": null
  },
  "2025": {
    "standard_deduction": {
      "single": 15750,
      "married_filing_jointly": 31500,
      "married_filing_separately": 15750,
      "head_of_household": 23625,
      "qualifying_surviving_spouse": 31500
    },
    "extra_deduction_65": {
      "single": 2000,
      "married": 1600
    },
    "brackets": {
      "single": [
        [
          11925,
          0.1
        ],
        [
          48475,
          0.12
        ],
        [
          103350,
          0.22
        ],
        [
          197300,
          0.24
        ],
        [
          250525,
          0.32
        ],
        [
          626350,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "married_filing_jointly": [
        [
          23850,
          0.1
        ],
        [
          96950,
          0.12
        ],
        [
          206700,
          0.22
        ],
        [
          394600,
          0.24
        ],
        [
          501050,
          0.32
        ],
        [
          751600,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "married_filing_separately": [
        [
          11925,
          0.1
        ],
        [
          48475,
          0.12
        ],
        [
          103350,
          0.22
        ],
        [
          197300,
          0.24
        ],
        [
          250525,
          0.32
        ],
        [
          375800,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "head_of_household": [
        [
          17000,
          0.1
        ],
        [
          64850,
          0.12
        ],
        [
          103350,
          0.22
        ],
        [
          197300,
          0.24
        ],
        [
          250500,
          0.32
        ],
        [
          626350,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ],
      "qualifying_surviving_spouse": [
        [
          23850,
          0.1
        ],
        [
          96950,
          0.12
        ],
        [
          206700,
          0.22
        ],
        [
          394600,
          0.24
        ],
        [
          501050,
          0.32
        ],
        [
          751600,
          0.35
        ],
        [
          1000000000000000000,
          0.37
        ]
      ]
    },
    "ltcg_thresholds": {
      "single": [
        48350,
        533400
      ],
      "married_filing_jointly": [
        96700,
        600050
      ],
      "married_filing_separately": [
        48350,
        300000
      ],
      "head_of_household": [
        64750,
        566700
      ],
      "qualifying_surviving_spouse": [
        96700,
        600050
      ]
    },
    "se_ss_wage_base": 176100,
    "child_tax_credit": 2200,
    "ctc_phaseout": {
      "single": 200000,
      "married_filing_jointly": 400000
    },
    "niit_threshold": {
      "single": 200000,
      "married_filing_jointly": 250000
    },
    "amt_exemption": {
      "single": 88100,
      "married_filing_jointly": 137000
    },
    "salt_cap": {
      "single": 40000,
      "married_filing_jointly": 40000,
      "married_filing_separately": 20000,
      "head_of_household": 40000,
      "qualifying_surviving_spouse": 40000
    },
    "salt_phase_threshold": 500000,
    "salt_phase_rate": 0.3
  }
};
