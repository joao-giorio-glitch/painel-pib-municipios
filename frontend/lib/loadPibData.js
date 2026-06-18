import fs from "node:fs/promises";
import path from "node:path";

export async function loadPibData() {
  const filePath = path.join(process.cwd(), "public", "data", "pib.json");
  const file = await fs.readFile(filePath, "utf-8");
  return JSON.parse(file);
}
