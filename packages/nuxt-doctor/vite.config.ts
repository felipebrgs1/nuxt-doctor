import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite-plus";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  version: string;
};

const copySkillToDist = () => {
  const packageRoot = process.cwd();
  const skillSource = path.resolve(packageRoot, "../../skills/nuxt-doctor");
  const skillTarget = path.resolve(packageRoot, "dist/skills/nuxt-doctor");
  if (!fs.existsSync(skillSource)) return;
  fs.rmSync(skillTarget, { recursive: true, force: true });
  fs.mkdirSync(skillTarget, { recursive: true });
  fs.cpSync(skillSource, skillTarget, { recursive: true });
};

export default defineConfig({
  pack: [
    {
      entry: { cli: "./src/cli.ts" },
      deps: { neverBundle: ["oxlint", "knip", "knip/session"] },
      dts: true,
      target: "node18",
      platform: "node",
      env: {
        VERSION: process.env.VERSION ?? packageJson.version,
      },
      fixedExtension: false,
      banner: "#!/usr/bin/env node",
      hooks: {
        "build:done": () => {
          copySkillToDist();
        },
      },
    },
    {
      entry: { index: "./src/index.ts" },
      deps: { neverBundle: ["oxlint", "knip", "knip/session"] },
      dts: true,
      target: "node18",
      platform: "node",
      fixedExtension: false,
    },
    {
      entry: { browser: "./src/browser.ts", worker: "./src/worker.ts" },
      dts: true,
      target: "es2022",
      platform: "browser",
      fixedExtension: false,
    },
    {
      entry: { "nuxt-doctor-plugin": "./src/plugin/index.ts" },
      target: "node18",
      platform: "node",
      fixedExtension: false,
    },
  ],
  test: {
    testTimeout: 30_000,
  },
});
