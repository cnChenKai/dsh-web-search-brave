import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("DSH 0.2.2-rc.1 compatibility", () => {
  it("declares the verified runtime and peer versions", () => {
    expect(manifest.engines.dsh).toBe("0.2.2-rc.1");
    for (const name of ["dsh-credentials", "dsh-launch-environment", "dsh-web"]) {
      expect(manifest.peerDependencies[`@deepseek-ai/${name}`]).toBe("0.2.2-rc.1");
    }
    expect(manifest.peerDependencies["@deepseek-ai/schemastery"]).toBe("~3.19.0");
  });
});
