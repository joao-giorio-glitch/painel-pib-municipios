import fs from "node:fs/promises";
import path from "node:path";

export async function loadPibData() {
  const filePath = path.join(process.cwd(), "public", "data", "pib.json");
  const file = await fs.readFile(filePath, "utf-8");
  return JSON.parse(file);
}

export async function loadDashboardData() {
  const [pib, perCapita] = await Promise.all([
    loadPibData(),
    fs.readFile(path.join(process.cwd(), "public", "data", "pib-per-capita.json"), "utf-8").then(JSON.parse)
  ]);

  return { pib, perCapita };
}
