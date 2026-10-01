import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectLinuxRuntime } from "../src/main/linux-runtime";

function executable(file: string): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "#!/bin/sh\nexit 0\n");
  chmodSync(file, 0o755);
  return file;
}

test("Linux runtime: explicit Wine overrides auto-detected Proton", () => {
  const home = mkdtempSync(path.join(tmpdir(), "dr-linux-runtime-"));
  try {
    const wine = executable(path.join(home, "custom", "wine64"));
    executable(path.join(home, ".local", "share", "Steam", "compatibilitytools.d", "GE-Proton99", "proton"));
    const userData = path.join(home, "data");
    const runtime = detectLinuxRuntime(userData, { HOME: home, USER: "slayer", PATH: "", DAUNTLESS_REVIVED_WINE: wine }, home);
    assert.equal(runtime?.kind, "wine");
    assert.equal(runtime?.command, wine);
    assert.equal(runtime?.env.WINEPREFIX, path.join(userData, "compat", "wine"));
    assert.match(runtime?.env.WINEDLLOVERRIDES ?? "", /(?:^|;)dxgi=n,b(?:;|$)/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("Linux runtime: auto-detects Steam compatibility tools and prepares Proton environment", () => {
  const home = mkdtempSync(path.join(tmpdir(), "dr-linux-proton-"));
  try {
    const proton = executable(path.join(home, ".local", "share", "Steam", "compatibilitytools.d", "GE-Proton10-1", "proton"));
    const userData = path.join(home, "data");
    const runtime = detectLinuxRuntime(userData, { HOME: home, USER: "slayer", PATH: "" }, home);
    assert.equal(runtime?.kind, "proton");
    assert.equal(runtime?.command, proton);
    assert.equal(runtime?.compatDataDir, path.join(userData, "compat", "proton"));
    assert.equal(runtime?.prefixDir, path.join(userData, "compat", "proton", "pfx"));
    assert.equal(runtime?.env.STEAM_COMPAT_DATA_PATH, path.join(userData, "compat", "proton"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
