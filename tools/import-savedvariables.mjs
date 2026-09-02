import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { importWhelpSavedVariables } from "./lib/savedvariables-import.mjs";

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const outputIndex = args.indexOf("--output");
if (inputIndex < 0 || !args[inputIndex + 1]) {
  console.error("Usage: npm run import:savedvariables -- --input <WHELPCollector.lua> [--output <sanitized-bundle.json>]");
  process.exit(2);
}

try {
  const input = path.resolve(args[inputIndex + 1]);
  const metadata = await stat(input);
  if (!metadata.isFile() || metadata.size > 16 * 1024 * 1024) throw new Error("input must be a SavedVariables file no larger than 16 MiB");
  const bundle = importWhelpSavedVariables(await readFile(input, "utf8"));
  const json = `${JSON.stringify(bundle, null, 2)}\n`;
  if (outputIndex >= 0 && args[outputIndex + 1]) {
    const output = path.resolve(args[outputIndex + 1]);
    await writeFile(output, json, { encoding: "utf8", flag: "wx" });
    console.log(`Wrote ${bundle.audit.exportedRunCount} sanitized run(s) to ${output}; ${bundle.audit.rejectedRunCount} rejected, ${bundle.audit.duplicateRunCount} duplicate.`);
  } else {
    process.stdout.write(json);
  }
} catch (error) {
  console.error(`Cannot import SavedVariables: ${error.message}`);
  process.exit(1);
}
