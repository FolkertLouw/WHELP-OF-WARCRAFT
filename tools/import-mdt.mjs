import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseMdtDungeon } from "./lib/mdt-parser.mjs";

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const outputIndex = args.indexOf("--output");
if (inputIndex < 0 || !args[inputIndex + 1]) {
  console.error("Usage: npm run import:mdt -- --input <Dungeon.lua> [--output <extract.json>]");
  process.exit(2);
}

const input = path.resolve(args[inputIndex + 1]);
const parsed = parseMdtDungeon(await readFile(input, "utf8"));
const json = `${JSON.stringify(parsed, null, 2)}\n`;

if (outputIndex >= 0 && args[outputIndex + 1]) {
  const output = path.resolve(args[outputIndex + 1]);
  await writeFile(output, json, "utf8");
  console.log(`Wrote ${parsed.enemies.length} enemies from ${parsed.name} to ${output}`);
} else {
  process.stdout.write(json);
}
