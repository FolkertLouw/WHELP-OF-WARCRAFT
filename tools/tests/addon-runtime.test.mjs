import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import fengari from "fengari";

const { lua, lauxlib, lualib, to_luastring } = fengari;
const root = path.resolve(import.meta.dirname, "..", "..");
const addonRoot = path.join(root, "addon", "WHELPCollector");

function runChunk(state, source, name, withAddonArguments = false) {
  const status = lauxlib.luaL_loadbuffer(state, to_luastring(source), null, to_luastring(name));
  assert.equal(status, lua.LUA_OK, `could not load ${name}: ${lua.lua_tojsstring(state, -1)}`);
  let argumentCount = 0;
  if (withAddonArguments) {
    lua.lua_pushstring(state, to_luastring("WHELPCollector"));
    lua.lua_getglobal(state, to_luastring("WHELP_TEST_NAMESPACE"));
    argumentCount = 2;
  }
  const callStatus = lua.lua_pcall(state, argumentCount, 0, 0);
  assert.equal(callStatus, lua.LUA_OK, `${name} failed: ${lua.lua_tojsstring(state, -1)}`);
}

test("executes a complete collector lifecycle in exact addon manifest order", async () => {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  try {
    const mock = await readFile(path.join(import.meta.dirname, "fixtures", "mock-wow.lua"), "utf8");
    runChunk(state, mock, "mock-wow.lua");
    const toc = await readFile(path.join(addonRoot, "WHELPCollector.toc"), "utf8");
    const entries = toc.split(/\r?\n/).filter((line) => line.endsWith(".lua"));
    for (const entry of entries) {
      const source = await readFile(path.join(addonRoot, ...entry.split("\\")), "utf8");
      runChunk(state, source, entry, true);
    }
    const spec = await readFile(path.join(import.meta.dirname, "fixtures", "collector-lifecycle.spec.lua"), "utf8");
    runChunk(state, spec, "collector-lifecycle.spec.lua");
  } finally {
    lua.lua_close(state);
  }
});
