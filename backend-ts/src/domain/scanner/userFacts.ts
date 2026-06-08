import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { projectPaths } from "../../lib/paths";
import { getSectionData } from "../../db/sectionRepo";

const SCAN_SECTIONS = [
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
] as const;

export type FactsData = Record<string, Record<string, unknown>>;

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toNumber(value: unknown): number {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replaceAll(",", "").replaceAll("$", "").trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

export class UserFacts {
  data: FactsData;
  taxYear: number;

  private constructor(data: FactsData, taxYear: number) {
    this.data = data;
    this.taxYear = taxYear;
  }

  static fromUserSections(userId: string, taxYear: number): UserFacts {
    const data: FactsData = {};
    for (const section of SCAN_SECTIONS) {
      data[section] = getSectionData(userId, taxYear, section);
    }
    return new UserFacts(data, taxYear);
  }

  static fromYaml(taxYear: number): UserFacts {
    const data: FactsData = {};

    for (const section of SCAN_SECTIONS) {
      const sectionPath = path.join(projectPaths.userData, `${section}.yaml`);
      if (!fs.existsSync(sectionPath)) {
        data[section] = {};
        continue;
      }

      try {
        const parsed = yaml.load(fs.readFileSync(sectionPath, "utf8"));
        data[section] = toObject(parsed);
      } catch {
        data[section] = {};
      }
    }

    return new UserFacts(data, taxYear);
  }

  filingStatus(): string | null {
    const hh = toObject(this.data.household);
    const status = hh.filing_status;
    return typeof status === "string" ? status : null;
  }

  estimatedAgi(): number | null {
    const hh = toObject(this.data.household);
    const agi = toNumber(hh.estimated_agi);
    return agi > 0 ? agi : null;
  }

  businesses(): Array<Record<string, unknown>> {
    const businessesSection = toObject(this.data.businesses);
    const list = businessesSection.businesses;
    return Array.isArray(list) ? list.filter((x) => x && typeof x === "object") as Array<Record<string, unknown>> : [];
  }

  firstBusiness(): Record<string, unknown> {
    return this.businesses()[0] ?? {};
  }

  hasAnyRealEstate(): boolean {
    const realEstate = toObject(this.data.real_estate);
    const properties = realEstate.properties;
    return Array.isArray(properties) && properties.length > 0;
  }

  hasRentalProperty(): boolean {
    return this.properties().some((property) => {
      const type = String(property.property_type ?? "");
      return ["rental_residential", "rental_commercial", "mixed_use"].includes(type);
    });
  }

  properties(): Array<Record<string, unknown>> {
    const realEstate = toObject(this.data.real_estate);
    const list = realEstate.properties;
    return Array.isArray(list) ? list.filter((x) => x && typeof x === "object") as Array<Record<string, unknown>> : [];
  }

  firstProperty(): Record<string, unknown> {
    return this.properties()[0] ?? {};
  }

  itemizing(): boolean | null {
    const hh = toObject(this.data.household);
    const itemizing = hh.itemizing_deductions;
    if (itemizing === true) {
      return true;
    }
    if (itemizing === false) {
      return false;
    }
    return null;
  }

  hasSelfEmployment(): boolean {
    const seTypes = new Set([
      "sole_prop",
      "llc_single",
      "llc_multi",
      "s_corp",
      "partnership"
    ]);

    return this.businesses().some((biz) => seTypes.has(String(biz.entity_type ?? "")));
  }

  taxpayerAge(): number | null {
    const hh = toObject(this.data.household);
    const taxpayer = toObject(hh.taxpayer);
    const age = toNumber(taxpayer.age);
    return age > 0 ? age : null;
  }

  healthcareCoverage(): string | null {
    const hc = toObject(this.data.healthcare);
    const insurance = toObject(hc.insurance);
    const value = insurance.coverage_type ?? hc.coverage_type;
    return typeof value === "string" ? value : null;
  }

  hdhpEnrolled(): boolean {
    const hc = toObject(this.data.healthcare);
    const insurance = toObject(hc.insurance);
    const value = insurance.hdhp_enrolled ?? hc.hdhp_enrolled;
    return value === true;
  }

  hdhpCoverageLevel(): "self" | "family" {
    const hc = toObject(this.data.healthcare);
    const insurance = toObject(hc.insurance);
    const level = insurance.hdhp_coverage_level ?? hc.hdhp_coverage_level;
    return level === "family" ? "family" : "self";
  }

  hsaContributionsYtd(): number {
    const hc = toObject(this.data.healthcare);
    const hsa = toObject(hc.health_savings_account);
    return toNumber(hsa.contributions_ytd);
  }

  sepIraEstablished(): boolean {
    const retirement = toObject(this.data.retirement);
    const selfEmployedPlans = toObject(retirement.self_employed_plans);
    const sepA = toObject(selfEmployedPlans.sep_ira);
    const sepB = toObject(retirement.sep_ira);
    return sepA.established === true || sepB.established === true;
  }

  sepIraContributionsYtd(): number {
    const retirement = toObject(this.data.retirement);
    const selfEmployedPlans = toObject(retirement.self_employed_plans);
    const sepA = toObject(selfEmployedPlans.sep_ira);
    const sepB = toObject(retirement.sep_ira);
    return toNumber(sepA.contributions_ytd ?? sepB.contributions_ytd);
  }

  firstBusinessNetProfit(): number {
    const biz = this.firstBusiness();
    const financials = toObject(biz.financials);
    return toNumber(financials.net_profit_loss);
  }

  businessHealthInsurancePremium(): number {
    const biz = this.firstBusiness();
    const healthInsurance = toObject(biz.health_insurance);
    if (healthInsurance.premium_amount != null) {
      return toNumber(healthInsurance.premium_amount);
    }

    const healthcare = toObject(this.data.healthcare);
    const seHealth = toObject(healthcare.self_employed_health_insurance);
    return toNumber(seHealth.owner_health_insurance_premium);
  }

  businessHealthInsuranceClaimed(): boolean {
    const biz = this.firstBusiness();
    const healthInsurance = toObject(biz.health_insurance);
    return healthInsurance.owner_health_insurance_deducted === true;
  }
}
