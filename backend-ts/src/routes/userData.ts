import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import yaml from "js-yaml";
import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { getSectionData, saveSectionData } from "../db/sectionRepo";

const VALID_SECTIONS = new Set([
  "household",
  "income",
  "businesses",
  "real_estate",
  "investments",
  "retirement",
  "healthcare",
  "dependents",
  "goals",
  "documents_index"
]);

const DataBodySchema = z.object({
  data: z.record(z.unknown()).optional(),
  content: z.string().optional()
}).superRefine((value, ctx) => {
  const hasData = value.data !== undefined;
  const hasContent = value.content !== undefined;

  if (hasData === hasContent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one of 'data' (JSON) or 'content' (YAML string)"
    });
  }
});

const LooseObjectSchema = z.object({}).catchall(z.unknown());
const LooseObjectArraySchema = z.array(LooseObjectSchema);

const SECTION_DATA_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  household: LooseObjectSchema.extend({
    taxpayer: LooseObjectSchema.optional(),
    residence: LooseObjectSchema.optional(),
    spouse: LooseObjectSchema.optional(),
    payments: LooseObjectSchema.optional()
  }),
  income: LooseObjectSchema.extend({
    w2_employment: LooseObjectArraySchema.optional(),
    other_wages: LooseObjectSchema.optional(),
    self_employment: LooseObjectArraySchema.optional(),
    rental_income: LooseObjectArraySchema.optional(),
    investment_income: LooseObjectSchema.optional(),
    retirement_distributions: LooseObjectSchema.optional(),
    social_security: LooseObjectSchema.optional(),
    passive_income: LooseObjectSchema.optional(),
    other_income: LooseObjectSchema.optional(),
    farm: LooseObjectSchema.optional(),
    adjustments_to_income: LooseObjectSchema.optional()
  }),
  businesses: LooseObjectSchema.extend({
    businesses: LooseObjectArraySchema.optional()
  }),
  real_estate: LooseObjectSchema.extend({
    properties: LooseObjectArraySchema.optional()
  }),
  investments: LooseObjectSchema.extend({
    taxable_accounts: LooseObjectArraySchema.optional(),
    "529_plans": LooseObjectArraySchema.optional(),
    opportunity_zone_investments: LooseObjectArraySchema.optional(),
    crypto: LooseObjectSchema.optional()
  }),
  retirement: LooseObjectSchema.extend({
    employer_plans: LooseObjectSchema.optional(),
    individual_retirement_accounts: LooseObjectSchema.optional(),
    self_employed_plans: LooseObjectSchema.optional(),
    roth_conversion: LooseObjectSchema.optional()
  }),
  healthcare: LooseObjectSchema.extend({
    insurance: LooseObjectSchema.optional(),
    health_savings_account: LooseObjectSchema.optional(),
    flexible_spending_accounts: LooseObjectSchema.optional(),
    long_term_care: LooseObjectSchema.optional(),
    medical_expenses: LooseObjectSchema.optional(),
    self_employed_health_insurance: LooseObjectSchema.optional(),
    premium_tax_credit: LooseObjectSchema.optional()
  }),
  dependents: LooseObjectSchema.extend({
    dependents: LooseObjectArraySchema.optional()
  }),
  goals: LooseObjectSchema.extend({
    primary_goals: LooseObjectSchema.optional(),
    timeline: LooseObjectSchema.optional(),
    risk_tolerance: LooseObjectSchema.optional(),
    professional_advisors: LooseObjectSchema.optional(),
    major_life_events_this_year: LooseObjectSchema.optional(),
    anticipated_changes_next_year: LooseObjectSchema.optional()
  }),
  documents_index: LooseObjectSchema
};

const SectionParamsSchema = z.object({
  section: z.string().min(1)
});

function sectionFilePath(section: string): string {
  return path.join(projectPaths.userData, `${section}.yaml`);
}

function assertSection(section: string): void {
  if (!VALID_SECTIONS.has(section)) {
    throw new AppError(404, `Section '${section}' not found`);
  }
}

function parseYamlContent(content: string): Record<string, unknown> {
  const loaded = yaml.load(content);
  if (loaded == null) {
    return {};
  }
  if (typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new AppError(422, "Invalid YAML: expected mapping object");
  }
  return loaded as Record<string, unknown>;
}

function validateSectionData(section: string, data: Record<string, unknown>): Record<string, unknown> {
  const schema = SECTION_DATA_SCHEMAS[section] ?? LooseObjectSchema;
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }

  const firstIssue = parsed.error.issues[0];
  const issuePath = firstIssue?.path?.join(".") || "data";
  const issueMsg = firstIssue?.message || "Invalid section payload";
  throw new AppError(422, `Invalid payload for section '${section}' at '${issuePath}': ${issueMsg}`);
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getByPath(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath
    .split(".")
    .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function sumIncomeGrossRents(incomeData: Record<string, unknown>): number | null {
  const rentals = incomeData["rental_income"];
  if (!Array.isArray(rentals)) return null;

  let total = 0;
  let found = false;
  for (const entry of rentals) {
    if (!entry || typeof entry !== "object") continue;
    const gross = toNumberOrNull((entry as Record<string, unknown>)["gross_rents"]);
    if (gross == null) continue;
    total += gross;
    found = true;
  }

  return found ? total : null;
}

function sumRealEstateGrossRents(realEstateData: Record<string, unknown>): number | null {
  const properties = realEstateData["properties"];
  if (!Array.isArray(properties)) return null;

  let total = 0;
  let found = false;
  for (const entry of properties) {
    if (!entry || typeof entry !== "object") continue;
    const rentalUse = (entry as Record<string, unknown>)["rental_use"];
    if (!rentalUse || typeof rentalUse !== "object") continue;
    const gross = toNumberOrNull((rentalUse as Record<string, unknown>)["gross_rental_income"]);
    if (gross == null) continue;
    total += gross;
    found = true;
  }

  return found ? total : null;
}

function buildCrossSectionWarnings(
  currentSection: string,
  dataBySection: Record<string, Record<string, unknown>>
): string[] {
  const warnings: string[] = [];
  const touched = new Set(["income", "real_estate", "healthcare", "investments"]);
  if (!touched.has(currentSection)) return warnings;

  const income = dataBySection["income"] ?? {};
  const realEstate = dataBySection["real_estate"] ?? {};
  const healthcare = dataBySection["healthcare"] ?? {};
  const investments = dataBySection["investments"] ?? {};

  const incomeGross = sumIncomeGrossRents(income);
  const realEstateGross = sumRealEstateGrossRents(realEstate);
  if (incomeGross != null && realEstateGross != null && Math.abs(incomeGross - realEstateGross) > 0.01) {
    warnings.push(
      "Rental income mismatch: Income > rental_income.gross_rents total differs from Real Estate > rental_use.gross_rental_income total. Tax calculations use Income values."
    );
  }

  const incomeOutsideHsa = toNumberOrNull(getByPath(income, "adjustments_to_income.hsa_contributions_outside_payroll"));
  const healthcareHsa = toNumberOrNull(getByPath(healthcare, "health_savings_account.contributions_ytd"));
  if (incomeOutsideHsa != null && healthcareHsa != null && Math.abs(incomeOutsideHsa - healthcareHsa) > 0.01) {
    warnings.push(
      "HSA contribution mismatch: Income > adjustments_to_income.hsa_contributions_outside_payroll differs from Healthcare > health_savings_account.contributions_ytd. Schedule 1 deduction uses Income values."
    );
  }

  const incomeShortGains = toNumberOrNull(getByPath(income, "investment_income.short_term_capital_gains"));
  const incomeLongGains = toNumberOrNull(getByPath(income, "investment_income.long_term_capital_gains"));
  const investmentsShortGains = toNumberOrNull(getByPath(investments, "realized_gains_losses_this_year.short_term_gains"));
  const investmentsLongGains = toNumberOrNull(getByPath(investments, "realized_gains_losses_this_year.long_term_gains"));

  if (investmentsShortGains != null) {
    if (incomeShortGains == null || Math.abs(incomeShortGains - investmentsShortGains) > 0.01) {
      warnings.push(
        "Capital gains mismatch: Investments short-term gains differ from Income > investment_income.short_term_capital_gains. Tax calculations use Income values."
      );
    }
  }

  if (investmentsLongGains != null) {
    if (incomeLongGains == null || Math.abs(incomeLongGains - investmentsLongGains) > 0.01) {
      warnings.push(
        "Capital gains mismatch: Investments long-term gains differ from Income > investment_income.long_term_capital_gains. Tax calculations use Income values."
      );
    }
  }

  return warnings;
}

export async function registerUserDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/user-data", { preHandler: app.authenticateOptional }, async () => {
    return {
      sections: [...VALID_SECTIONS].filter((name) => name !== "documents_index").sort()
    };
  });

  app.get(
    "/user-data/:section",
    { preHandler: app.authenticateOptional },
    async (request) => {
      const { section } = SectionParamsSchema.parse(request.params ?? {});
      assertSection(section);

      if (request.currentUser) {
        const data = getSectionData(request.currentUser.id, env.TAX_YEAR, section);
        const content = Object.keys(data).length
          ? yaml.dump(data, { noRefs: true, lineWidth: -1 })
          : "";

        return {
          section,
          content
        };
      }

      const filePath = sectionFilePath(section);
      if (!fs.existsSync(filePath)) {
        throw new AppError(404, `Section '${section}' not found`);
      }

      return {
        section,
        content: fs.readFileSync(filePath, "utf8")
      };
    }
  );

  app.put(
    "/user-data/:section",
    { preHandler: app.authenticateOptional },
    async (request) => {
      const { section } = SectionParamsSchema.parse(request.params ?? {});
      if (!VALID_SECTIONS.has(section)) {
        throw new AppError(400, `'${section}' is not an editable section`);
      }

      const body = DataBodySchema.parse(request.body ?? {});

      let data: Record<string, unknown>;
      if (body.data !== undefined) {
        data = body.data;
      } else {
        const { content } = body;
        if (content === undefined) {
          throw new AppError(422, "Provide exactly one of 'data' (JSON) or 'content' (YAML string)");
        }
        try {
          data = parseYamlContent(content);
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }
          throw new AppError(422, `Invalid YAML: ${(error as Error).message}`);
        }
      }

      data = validateSectionData(section, data);

      if (request.currentUser) {
        saveSectionData(request.currentUser.id, env.TAX_YEAR, section, data);
        const dataBySection: Record<string, Record<string, unknown>> = {
          income: section === "income" ? data : getSectionData(request.currentUser.id, env.TAX_YEAR, "income"),
          real_estate: section === "real_estate" ? data : getSectionData(request.currentUser.id, env.TAX_YEAR, "real_estate"),
          healthcare: section === "healthcare" ? data : getSectionData(request.currentUser.id, env.TAX_YEAR, "healthcare"),
          investments: section === "investments" ? data : getSectionData(request.currentUser.id, env.TAX_YEAR, "investments")
        };

        const warnings = buildCrossSectionWarnings(section, dataBySection);
        if (warnings.length > 0) {
          return {
            section,
            saved: true,
            warnings
          };
        }
      } else {
        const filePath = sectionFilePath(section);
        if (!fs.existsSync(filePath)) {
          throw new AppError(404, `Section '${section}' not found`);
        }

        fs.writeFileSync(filePath, yaml.dump(data, { noRefs: true, lineWidth: -1 }), "utf8");

        const readSection = (name: string): Record<string, unknown> => {
          if (name === section) return data;
          const fp = sectionFilePath(name);
          if (!fs.existsSync(fp)) return {};
          const raw = fs.readFileSync(fp, "utf8");
          return raw.trim() ? parseYamlContent(raw) : {};
        };

        const dataBySection: Record<string, Record<string, unknown>> = {
          income: readSection("income"),
          real_estate: readSection("real_estate"),
          healthcare: readSection("healthcare"),
          investments: readSection("investments")
        };

        const warnings = buildCrossSectionWarnings(section, dataBySection);
        if (warnings.length > 0) {
          return {
            section,
            saved: true,
            warnings
          };
        }
      }

      return {
        section,
        saved: true
      };
    }
  );

  app.get(
    "/user-data/:section/parsed",
    { preHandler: app.authenticateOptional },
    async (request) => {
      const { section } = SectionParamsSchema.parse(request.params ?? {});
      assertSection(section);

      if (request.currentUser) {
        const data = getSectionData(request.currentUser.id, env.TAX_YEAR, section);
        return {
          section,
          data
        };
      }

      const filePath = sectionFilePath(section);
      if (!fs.existsSync(filePath)) {
        throw new AppError(404, `Section '${section}' not found`);
      }

      const content = fs.readFileSync(filePath, "utf8");
      let parsed: Record<string, unknown> = {};
      if (content.trim()) {
        parsed = parseYamlContent(content);
      }

      return {
        section,
        data: parsed
      };
    }
  );
}
