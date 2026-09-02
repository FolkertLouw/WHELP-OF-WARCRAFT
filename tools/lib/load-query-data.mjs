import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadResponseRecords(root) {
  const indexPath = path.join(root, "content", "mythic-plus", "midnight-season-2", "abilities", "response-index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  return Promise.all(index.entries.map(async (entry) => JSON.parse(await readFile(path.resolve(path.dirname(indexPath), entry.path), "utf8"))));
}

export async function loadSpecCapabilities(root) {
  const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
  return Promise.all((index.specCapabilities ?? []).map(async (entry) => JSON.parse(await readFile(path.join(root, "data", entry.record), "utf8"))));
}
