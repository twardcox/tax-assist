// Offline authoring aid: mines the benefit library's stacking_rules graph for
// candidate strategy stacks. Advisory output only — a candidate becomes a real
// stack only when an author writes the tax_library/stacks/ YAML by hand.
//
// Usage (from backend-ts/): npm run suggest:stacks
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const { toMinerBenefit, mineCandidateStacks } = await import("../src/domain/scanner/stackMiner.ts");

const taxLibrary = path.resolve(process.cwd(), "..", "tax_library");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".yaml") && !entry.name.startsWith("example-")) files.push(full);
  }
  return files;
}

const benefits = [];
const authoredMemberIds = new Set();
for (const file of walk(taxLibrary)) {
  const parsed = yaml.load(fs.readFileSync(file, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
  if (parsed.kind === "strategy_stack") {
    for (const m of parsed.members ?? []) {
      if (m?.benefit_id) authoredMemberIds.add(m.benefit_id);
    }
    continue;
  }
  const mb = toMinerBenefit(parsed);
  if (mb) benefits.push(mb);
}

const { candidates, dangling } = mineCandidateStacks(benefits, authoredMemberIds);

if (dangling.length > 0) {
  console.log("⚠ DANGLING compatible_with references (fix these in the YAMLs):");
  for (const d of dangling) console.log(`  ${d.from} -> ${d.to} (no such benefit id)`);
  console.log("");
}

console.log(`Candidate stacks (${candidates.length} pairs, ranked by shared-fact Jaccard):\n`);
for (const c of candidates) {
  const authored = c.inAuthoredStack.length > 0 ? ` [already stacked: ${c.inAuthoredStack.join(", ")}]` : " [NEW]";
  console.log(`${c.jaccard.toFixed(2)}  ${c.members.join(" + ")}  risk:${c.maxRisk}${authored}`);
  if (c.sharedFacts.length > 0) console.log(`      shared facts: ${c.sharedFacts.join(", ")}`);
}
