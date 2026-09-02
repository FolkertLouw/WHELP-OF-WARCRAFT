import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");

test("keeps the LLM discovery manifest aligned and resolvable", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "whelp.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const season = JSON.parse(await readFile(path.join(root, "data", "seasons", `${manifest.currentSeason}.json`), "utf8"));
  assert.equal(manifest.datasetVersion, packageJson.version);
  assert.equal(manifest.currentBuild, season.validity.fromBuild);
  for (const entrypoint of Object.values(manifest.entrypoints)) {
    assert.ok((await stat(path.join(root, entrypoint))).isFile(), `missing manifest entrypoint ${entrypoint}`);
  }
});
