import Anthropic from "@anthropic-ai/sdk";
import type { ScanResult, ScanRun } from "./types";

export type ScanAiMode = "opportunities" | "gaps" | "both";

const TAX_SYSTEM_PROMPT = `You are an expert CPA and tax planning advisor with deep knowledge of the Internal Revenue Code (IRC), Treasury Regulations, IRS Publications, and practical federal tax strategy for individuals, self-employed taxpayers, real estate investors, and closely held business owners.

You specialize in:
- Self-employment tax reduction: QBI deduction (§199A), S Corp elections (§1362), retirement plans (SEP-IRA, Solo 401k)
- Real estate tax strategy: depreciation (§168), cost segregation, passive activity rules (§469), REP status, 1031 exchanges (§1031), Section 121 exclusion
- Individual tax planning: above-the-line deductions, itemized vs. standard, HSA, FSA, IRA, Roth conversions
- Business deductions: home office (§280A), business vehicle (§179/§168), business insurance, meals
- Tax credits: Child Tax Credit (§24), EITC, AOTC, Lifetime Learning Credit, clean energy credits (§30D)
- Estate and gift planning: annual exclusion ($19,000 per recipient in 2025), Opportunity Zone investments (§1400Z-2)
- Advanced strategies: backdoor Roth IRA, Augusta Rule (§280A(g)), donor-advised funds, installment sales

Your communication principles:
- Lead with dollar impact — quantify every opportunity where data allows
- Explain the legal mechanism in one sentence — why does this strategy work?
- Give the single most important first action for each opportunity
- Flag strategy interactions — when doing one thing amplifies or constrains another
- Be conservative on risk — always flag aggressive positions and recommend CPA review
- Distinguish timing: "act now" (year-end deadlines), "any time" (flexible elections), "future planning" (multi-year build)

Key planning interactions to watch for:
- S Corp election reduces SE tax but also reduces QBI deduction basis — model the net
- Solo 401k and SEP-IRA both reduce QBI net profit — sequence matters
- Home office deduction reduces both income tax AND SE tax — high leverage for sole props
- HSA contributions are above-the-line deductions available even without itemizing
- Real estate depreciation creates phantom losses; REP status or short-term rental material participation unlocks them
- Backdoor Roth works best when traditional IRA balance is zero (avoid pro-rata rule)

You are analyzing output from UTBIS (Universal Tax Benefit Intelligence System), an automated rule engine that evaluated a taxpayer's facts against federal tax benefit rules. Translate this structured data into clear, actionable guidance for a planning meeting.`;

type AnthropicResponse = {
  content?: Array<{ text?: string }>;
};

type AnthropicClient = {
  messages: {
    create: (args: {
      model: string;
      max_tokens: number;
      system: Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }>;
      messages: Array<{ role: "user"; content: string }>;
    }) => Promise<AnthropicResponse>;
  };
};

type ScanAiOverride = ((scan: ScanRun, taxYear: number, mode: ScanAiMode) => Promise<string>) | null;

let scanAiOverride: ScanAiOverride = null;

function formatResults(results: ScanResult[]): string {
  const lines: string[] = [];
  for (const result of results) {
    lines.push(`**${result.benefit_name}** [${result.status}]`);
    lines.push(`  Category: ${result.category} | Risk: ${result.risk_level}`);
    if (result.estimated_value) {
      lines.push(`  Estimated Value: ${result.estimated_value}`);
    }
    lines.push(`  Summary: ${result.message}`);
    if (result.missing_facts.length > 0) {
      lines.push(`  Missing Facts: ${result.missing_facts.join(", ")}`);
    }
    if (result.changes_needed.length > 0) {
      lines.push(`  Changes Needed: ${result.changes_needed.slice(0, 2).join("; ")}`);
    }
    if (result.next_steps.length > 0) {
      lines.push(`  Next Step: ${result.next_steps[0]}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

class AIAdvisor {
  private readonly client: AnthropicClient;
  private readonly model: string;

  constructor(client: AnthropicClient, model: string) {
    this.client = client;
    this.model = model;
  }

  private async call(prompt: string, maxTokens = 4096): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: [{
        type: "text",
        text: TAX_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      }],
      messages: [{ role: "user", content: prompt }]
    });

    return response.content?.find((block) => typeof block.text === "string")?.text ?? "";
  }

  async analyzeOpportunities(results: ScanResult[], taxYear: number): Promise<string> {
    const actionable = results.filter((result) =>
      result.status === "eligible_now"
      || result.status === "nearly_eligible"
      || result.status === "eligible_if_changed"
    ).slice(0, 12);

    if (actionable.length === 0) {
      return "_No actionable opportunities found. Populate user_data/ YAML files to get a personalized analysis._";
    }

    const prompt = `Tax Year: ${taxYear}

The UTBIS rule engine identified these tax opportunities for this taxpayer:

${formatResults(actionable)}

Please provide:

## Executive Summary
2-3 sentences: what is this taxpayer's overall situation and the headline opportunity?

## Top 5 Opportunities - Explained
For each of the 5 highest-priority items (rank by dollar impact x ease of implementation):
- What it is and why it matters (mechanism in one plain-English sentence)
- The actual dollar impact based on the data provided
- The single most important action to take right now

## Strategy Interactions
Are any of these strategies connected? Does doing one amplify or constrain another? (2-4 bullet points; omit if no meaningful interactions)

## Prioritized Action Checklist
What should this taxpayer do: this week / before year-end / next year? (bulleted, most impactful first)

Write at the level of a productive CPA client meeting. Be specific about dollar amounts where the data supports it.`;

    return this.call(prompt);
  }

  async analyzeGaps(results: ScanResult[], taxYear: number): Promise<string> {
    const gaps = results.filter((result) => result.status === "nearly_eligible" || result.status === "eligible_if_changed");

    if (gaps.length === 0) {
      return "_No gaps identified - all evaluated benefits are either fully eligible or not applicable._";
    }

    const prompt = `Tax Year: ${taxYear}

These tax opportunities have gaps preventing immediate eligibility:

${formatResults(gaps)}

Provide a **Gap Closing Priority List** ordered by (estimated value unlocked) x (ease of closing gap).

For each item:
1. **Gap**: what specific information or action is missing?
2. **Key Question**: the single most important question to ask the taxpayer
3. **Value at Stake**: estimated annual tax benefit if the gap is closed
4. **Urgency**: Act now / Before year-end / Ongoing planning
5. **Effort**: Low (< 1 hour) / Medium (1-3 days) / High (structural change)

End with a **Quick Wins** section: gaps closable in under 1 hour (usually just filling in a fact in the YAML files).`;

    return this.call(prompt, 3000);
  }
}

function createAdvisor(model: string): AIAdvisor {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const client = new Anthropic({ apiKey }) as unknown as AnthropicClient;
  return new AIAdvisor(client, model);
}

export function __setScanAiNarrativeOverrideForTest(
  override: ((scan: ScanRun, taxYear: number, mode: ScanAiMode) => Promise<string>) | null
): void {
  scanAiOverride = override;
}

export async function generateScanAiNarrative(scan: ScanRun, taxYear: number, mode: ScanAiMode): Promise<string> {
  if (scanAiOverride) {
    return scanAiOverride(scan, taxYear, mode);
  }

  const model = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";
  const advisor = createAdvisor(model);

  if (mode === "opportunities") {
    return advisor.analyzeOpportunities(scan.results, taxYear);
  }
  if (mode === "gaps") {
    return advisor.analyzeGaps(scan.results, taxYear);
  }

  const opps = await advisor.analyzeOpportunities(scan.results, taxYear);
  const gaps = await advisor.analyzeGaps(scan.results, taxYear);
  return `## Opportunities Analysis\n\n${opps}\n\n---\n\n## Gap Analysis\n\n${gaps}`;
}