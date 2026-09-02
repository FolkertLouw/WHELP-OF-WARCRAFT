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

export async function loadSpecCapabilityCoverage(root) {
  const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
  if (!index.specCapabilityCoverage) return null;
  return JSON.parse(await readFile(path.join(root, "data", index.specCapabilityCoverage.record), "utf8"));
}

export async function loadSpecDungeonMatrices(root) {
  const indexPath = path.join(root, "content", "index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  const entries = (index.records ?? []).filter((entry) => entry.path.includes("/specs/") && entry.path.endsWith("-utility-matrix.json"));
  return Promise.all(entries.map(async (entry) => JSON.parse(await readFile(path.join(root, "content", entry.path), "utf8"))));
}
