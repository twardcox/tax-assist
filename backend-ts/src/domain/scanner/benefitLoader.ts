import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { projectPaths } from "../../lib/paths";

type RawBenefit = Record<string, unknown>;

function walkYamlFiles(dirPath: string, files: string[]): void {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkYamlFiles(full, files);
    } else if (entry.isFile() && entry.name.endsWith(".yaml")) {
      files.push(full);
    }
  }
}

export function loadBenefitLibrary(): RawBenefit[] {
  if (!fs.existsSync(projectPaths.taxLibrary)) {
    return [];
  }

  const files: string[] = [];
  walkYamlFiles(projectPaths.taxLibrary, files);

  const benefits: RawBenefit[] = [];
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        benefits.push(parsed as RawBenefit);
      }
    } catch {
      // Skip invalid YAML files to keep scanner resilient.
    }
  }

  return benefits;
}
