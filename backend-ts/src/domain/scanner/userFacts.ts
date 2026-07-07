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

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((x) => x && typeof x === "object") as Array<Record<string, unknown>>
    : [];
}

function placedInServiceYear(asset: Record<string, unknown>): number | null {
  const yearValue = asset.placed_in_service_year ?? asset.year ?? asset.tax_year;
  if (typeof yearValue === "number" && Number.isFinite(yearValue)) {
    return yearValue;
  }
  if (typeof yearValue === "string" && yearValue.trim()) {
    const parsedYear = Number(yearValue.trim());
    if (Number.isFinite(parsedYear)) {
      return parsedYear;
    }
  }

  const dateValue = asset.placed_in_service_date ?? asset.placed_in_service ?? asset.service_date;
  if (typeof dateValue === "string" && dateValue.trim()) {
    const dateText = dateValue.trim();
    const yearText = dateText.slice(0, 4);
    const parsedYear = Number(yearText);
    if (Number.isFinite(parsedYear)) {
      return parsedYear;
    }
  }

  return null;
}

function parseDateValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class UserFacts {
  data: FactsData;
  taxYear: number;

  private constructor(data: FactsData, taxYear: number) {
    this.data = data;
    this.taxYear = taxYear;
  }

  static fromData(data: FactsData, taxYear: number): UserFacts {
    return new UserFacts(data, taxYear);
  }

  static async fromUserSections(userId: string, taxYear: number): Promise<UserFacts> {
    const data: FactsData = {};
    for (const section of SCAN_SECTIONS) {
      data[section] = await getSectionData(userId, taxYear, section);
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

  stateCode(): string | null {
    const hh = toObject(this.data.household);
    const residence = toObject(hh.residence);
    const state = residence.state;
    return typeof state === "string" && state.trim() ? state.trim().toUpperCase() : null;
  }

  county(): string | null {
    const hh = toObject(this.data.household);
    const residence = toObject(hh.residence);
    const county = residence.county;
    return typeof county === "string" && county.trim() ? county.trim() : null;
  }

  estimatedAgi(): number | null {
    const hh = toObject(this.data.household);
    const agi = toNumber(hh.estimated_agi);
    return agi > 0 ? agi : null;
  }

  businesses(): Array<Record<string, unknown>> {
    const businessesSection = toObject(this.data.businesses);
    const list = businessesSection.businesses;
    return toObjectArray(list);
  }

  firstBusiness(): Record<string, unknown> {
    return this.businesses()[0] ?? {};
  }

  businessNexusStates(): Set<string> {
    const states = new Set<string>();
    const residence = this.stateCode();
    if (residence) {
      states.add(residence);
    }

    for (const business of this.businesses()) {
      const operating = business.operating_states;
      if (Array.isArray(operating)) {
        for (const entry of operating) {
          if (typeof entry === "string" && entry.trim()) {
            states.add(entry.trim().toUpperCase());
          }
        }
      } else if (typeof operating === "string" && operating.trim()) {
        for (const part of operating.split(",")) {
          if (part.trim()) {
            states.add(part.trim().toUpperCase());
          }
        }
      }
    }

    return states;
  }

  hasAnyRealEstate(): boolean {
    const realEstate = toObject(this.data.real_estate);
    const properties = realEstate.properties;
    return Array.isArray(properties) && properties.length > 0;
  }

  primaryResidenceProperty(): Record<string, unknown> {
    return this.properties().find((property) => String(property.property_type ?? "") === "primary_residence") ?? {};
  }

  hasPrimaryResidence(): boolean {
    return Object.keys(this.primaryResidenceProperty()).length > 0;
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
    return toObjectArray(list);
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

  taxpayerVeteranStatus(): boolean | null {
    const hh = toObject(this.data.household);
    const taxpayer = toObject(hh.taxpayer);
    if (taxpayer.veteran === true) {
      return true;
    }
    if (taxpayer.veteran === false) {
      return false;
    }
    return null;
  }

  taxpayerDisabilityStatus(): boolean | null {
    const hh = toObject(this.data.household);
    const taxpayer = toObject(hh.taxpayer);
    if (taxpayer.disabled === true) {
      return true;
    }
    if (taxpayer.disabled === false) {
      return false;
    }
    return null;
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

  hsaExistingBalance(): number {
    const hc = toObject(this.data.healthcare);
    const hsa = toObject(hc.health_savings_account);
    return toNumber(hsa.existing_balance);
  }

  employerGroupPlan(): boolean {
    const hc = toObject(this.data.healthcare);
    return hc.employer_group_plan === true;
  }

  hsaInvestmentAccountWithinHsa(): boolean {
    const hc = toObject(this.data.healthcare);
    const hsa = toObject(hc.health_savings_account);
    return hsa.investment_account_within_hsa === true;
  }

  hasElectricVehicle(): boolean {
    const hh = toObject(this.data.household);
    if (hh.has_electric_vehicle === true) {
      return true;
    }

    const investments = toObject(this.data.investments);
    const vehicles = toObjectArray(investments.vehicles);
    return vehicles.some((vehicle) => {
      const fuelType = String(vehicle.fuel_type ?? "").trim().toLowerCase();
      return ["electric", "ev", "bev", "phev"].includes(fuelType);
    });
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

  firstBusinessChildcareExpenses(): number {
    const biz = this.firstBusiness();
    const financials = toObject(biz.financials);
    return toNumber(financials.childcare_expenses);
  }

  firstBusinessW2EmployeesCount(): number {
    const biz = this.firstBusiness();
    const employees = toObject(biz.employees);
    return toNumber(employees.w2_employees_count);
  }

  firstBusinessHasQualifiedRetirementPlan(): boolean {
    const biz = this.firstBusiness();
    const retirementPlans = toObject(biz.retirement_plans);
    return ["sep_ira", "simple_ira", "solo_401k", "defined_benefit"].some(
      (key) => retirementPlans[key] === true
    );
  }

  solo401kEstablished(): boolean {
    const retirement = toObject(this.data.retirement);
    const selfEmployedPlans = toObject(retirement.self_employed_plans);
    const soloA = toObject(selfEmployedPlans.solo_401k);
    const soloB = toObject(retirement.solo_401k);
    return soloA.established === true || soloB.established === true;
  }

  firstBusinessAssetsPlacedInServiceCount(): number {
    return this.firstBusinessAssetsPlacedInServiceCountForTaxYear();
  }

  firstBusinessAssetsPlacedInServiceCountForTaxYear(): number {
    const biz = this.firstBusiness();
    const depreciation = toObject(biz.depreciation);
    const assets = toObjectArray(depreciation.assets_placed_in_service);
    return assets.filter((asset) => {
      const year = placedInServiceYear(asset);
      return year === null || year === this.taxYear;
    }).length;
  }

  firstBusinessAssetsPlacedInServiceTotalCost(): number {
    const biz = this.firstBusiness();
    const depreciation = toObject(biz.depreciation);
    const assets = toObjectArray(depreciation.assets_placed_in_service);
    return assets.reduce((sum, asset) => {
      const year = placedInServiceYear(asset);
      if (year !== null && year !== this.taxYear) {
        return sum;
      }
      const cost = toNumber(asset.cost ?? asset.purchase_price ?? asset.basis ?? asset.amount);
      return sum + cost;
    }, 0);
  }

  firstBusinessOwnerW2Salary(): number {
    const biz = this.firstBusiness();
    const employees = toObject(biz.employees);
    return toNumber(employees.owner_w2_salary);
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

  incomeSection(): Record<string, unknown> {
    return toObject(this.data.income);
  }

  retirementDistributions(): Record<string, unknown> {
    const income = this.incomeSection();
    return toObject(income.retirement_distributions);
  }

  socialSecurityBenefits(): number {
    const income = this.incomeSection();
    const socialSecurity = toObject(income.social_security);
    return toNumber(socialSecurity.gross_benefits);
  }

  hasRetirementIncome(): boolean {
    const distributions = this.retirementDistributions();
    const retirementTotal = Object.values(distributions).some((value) => toNumber(value) > 0);
    return retirementTotal || this.socialSecurityBenefits() > 0;
  }

  hasRetirementDistributions(): boolean {
    const distributions = this.retirementDistributions();
    return Object.values(distributions).some((value) => toNumber(value) > 0);
  }

  dependents(): Array<Record<string, unknown>> {
    const deps = toObject(this.data.dependents);
    return toObjectArray(deps.dependents);
  }

  hasDependents(): boolean {
    return this.dependents().length > 0;
  }

  hasW2Income(): boolean {
    const w2 = this.w2EmploymentEntries();
    return w2.some((entry) => toNumber(entry.wages) > 0);
  }

  w2EmploymentEntries(): Array<Record<string, unknown>> {
    const income = this.incomeSection();
    return toObjectArray(income.w2_employment);
  }

  totalInvestmentIncome(): number {
    const income = this.incomeSection();
    const investment = toObject(income.investment_income);
    return toNumber(investment.qualified_dividends)
      + toNumber(investment.ordinary_dividends)
      + toNumber(investment.interest)
      + toNumber(investment.short_term_capital_gains)
      + toNumber(investment.long_term_capital_gains);
  }

  longTermCapitalGains(): number {
    const income = this.incomeSection();
    const investment = toObject(income.investment_income);
    return toNumber(investment.long_term_capital_gains);
  }

  hasAppreciatedTaxableStock(): boolean {
    const investments = toObject(this.data.investments);
    const taxableAccounts = toObjectArray(investments.taxable_accounts);
    return taxableAccounts.some((account) => toNumber(account.unrealized_gains) > 0);
  }

  totalUnrealizedTaxableGains(): number {
    const investments = toObject(this.data.investments);
    const taxableAccounts = toObjectArray(investments.taxable_accounts);
    return taxableAccounts.reduce((sum, account) => sum + toNumber(account.unrealized_gains), 0);
  }

  hasStartupEquity(): boolean {
    const investments = toObject(this.data.investments);
    if (investments.has_qualified_small_business_stock === true) {
      return true;
    }

    const taxableAccounts = toObjectArray(investments.taxable_accounts);
    return taxableAccounts.some((account) => {
      if (account.has_startup_stock === true) {
        return true;
      }

      const holdings = toObject(account.holdings);
      const individualStocks = holdings.individual_stocks;
      return Array.isArray(individualStocks) ? individualStocks.length > 0 : individualStocks === true;
    });
  }

  firstPropertyMortgageInterestPaid(): number {
    const property = this.firstProperty();
    const financing = toObject(property.financing);
    return toNumber(financing.mortgage_interest_paid);
  }

  firstPropertyPropertyTaxPaid(): number {
    const property = this.firstProperty();
    const financing = toObject(property.financing);
    return toNumber(financing.property_tax_paid);
  }

  has529Account(): boolean {
    const investments = toObject(this.data.investments);
    const plans = [
      ...toObjectArray(investments["529_plans"]),
      ...toObjectArray(investments.education_accounts)
    ];
    return plans.some((plan) => {
      const beneficiary = plan.beneficiary;
      const balance = toNumber(plan.balance);
      return (typeof beneficiary === "string" && beneficiary.trim().length > 0) || balance > 0;
    });
  }

  total529ContributionsThisYear(): number {
    const investments = toObject(this.data.investments);
    const plans = [
      ...toObjectArray(investments["529_plans"]),
      ...toObjectArray(investments.education_accounts)
    ];
    return plans.reduce((sum, plan) => sum + toNumber(plan.contributions_this_year), 0);
  }

  oldest529PlanAgeYears(): number | null {
    const investments = toObject(this.data.investments);
    const plans = [
      ...toObjectArray(investments["529_plans"]),
      ...toObjectArray(investments.education_accounts)
    ];

    let oldestOpenedDate: Date | null = null;
    for (const plan of plans) {
      const openedDate = parseDateValue(plan.opened_date ?? plan.account_opened_date ?? plan.open_date);
      if (!openedDate) {
        continue;
      }
      if (!oldestOpenedDate || openedDate < oldestOpenedDate) {
        oldestOpenedDate = openedDate;
      }
    }

    if (!oldestOpenedDate) {
      return null;
    }

    const cutoff = new Date(Date.UTC(this.taxYear - 15, 11, 31, 23, 59, 59, 999));
    return oldestOpenedDate.getTime() <= cutoff.getTime() ? 15 : Math.max(0, this.taxYear - oldestOpenedDate.getUTCFullYear());
  }

  householdSize(): number {
    const hh = toObject(this.data.household);
    let size = 1;
    const spouse = toObject(hh.spouse);
    if (spouse.present === true) {
      size += 1;
    }

    const dependentsInHousehold = toObject(hh.dependents);
    const counted = toNumber(dependentsInHousehold.count);
    if (counted > 0) {
      size += counted;
    } else {
      size += this.dependents().length;
    }

    return Math.max(1, size);
  }

  transferWealthGoal(): boolean | null {
    const goals = toObject(this.data.goals);
    const primaryGoals = toObject(goals.primary_goals);
    const goal = primaryGoals.transfer_wealth_to_heirs ?? goals.transfer_wealth_to_heirs;
    if (goal === true) {
      return true;
    }
    if (goal === false) {
      return false;
    }
    return null;
  }

  traditionalIraBalance(): number {
    const retirement = toObject(this.data.retirement);
    const individual = toObject(retirement.individual_retirement_accounts);
    const traditional = toObject(individual.traditional_ira);
    const accounts = toObjectArray(traditional.accounts);
    if (accounts.length > 0) {
      return toNumber(accounts[0].balance);
    }

    const legacyTraditional = toObject(retirement.traditional_ira);
    const legacyAccounts = toObjectArray(legacyTraditional.accounts);
    if (legacyAccounts.length > 0) {
      return toNumber(legacyAccounts[0].balance);
    }

    return toNumber(legacyTraditional.balance);
  }

  employerStockNuaAmount(): number {
    const retirement = toObject(this.data.retirement);
    const employerPlans = toObject(retirement.employer_plans);
    const traditional401k = toObject(employerPlans.traditional_401k);
    return toNumber(traditional401k.employer_stock_nua);
  }

  qlacEligibleRetirementBalance(): number {
    const retirement = toObject(this.data.retirement);
    const employerPlans = toObject(retirement.employer_plans);
    const employerPlanBalance = ["traditional_401k", "403b", "457b"].reduce((sum, key) => {
      const plan = toObject(employerPlans[key]);
      return sum + toNumber(plan.balance);
    }, 0);

    return this.traditionalIraBalance() + employerPlanBalance;
  }

  dependentCareFsaElection(): number {
    const healthcare = toObject(this.data.healthcare);
    const fsa = toObject(toObject(healthcare.flexible_spending_accounts).dependent_care_fsa);
    return toNumber(fsa.election_amount);
  }

  hasRetirementContributions(): boolean {
    const retirement = toObject(this.data.retirement);

    const employerPlans = toObject(retirement.employer_plans);
    const employerPlanKeys = ["traditional_401k", "403b", "457b", "simple_ira"];
    for (const key of employerPlanKeys) {
      const plan = toObject(employerPlans[key]);
      if (toNumber(plan.employee_contribution_ytd) > 0 || toNumber(plan.contribution_ytd) > 0) {
        return true;
      }
    }

    const individual = toObject(retirement.individual_retirement_accounts);
    for (const key of ["traditional_ira", "roth_ira"]) {
      const acct = toObject(individual[key]);
      if (toNumber(acct.contributions_ytd) > 0) {
        return true;
      }
    }

    const selfEmployed = toObject(retirement.self_employed_plans);
    const sep = toObject(selfEmployed.sep_ira);
    if (toNumber(sep.contributions_ytd) > 0) {
      return true;
    }
    const solo = toObject(selfEmployed.solo_401k);
    if (toNumber(solo.employee_contributions_ytd) > 0 || toNumber(solo.employer_contributions_ytd) > 0) {
      return true;
    }

    return false;
  }
}
