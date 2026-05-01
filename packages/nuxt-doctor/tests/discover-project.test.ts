import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  discoverProject,
  discoverVueSubprojects,
  formatFrameworkName,
  listWorkspacePackages,
} from "../src/utils/discover-project.js";

const FIXTURES_DIRECTORY = path.resolve(import.meta.dirname, "fixtures");
const VALID_FRAMEWORKS = ["nuxt", "vue", "vite", "vitepress", "quasar", "unknown"];

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nuxt-doctor-discover-test-"));

afterAll(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe("discoverProject", () => {
  it("detects Vue version from package.json", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-vue"));
    expect(projectInfo.vueVersion).toBe("^3.5.0");
  });

  it("returns a valid framework", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-vue"));
    expect(VALID_FRAMEWORKS).toContain(projectInfo.framework);
  });

  it("detects framework as nuxt when nuxt dependency is present", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-nuxt"));
    expect(projectInfo.framework).toBe("nuxt");
  });

  it("detects framework as vitepress when vitepress dependency is present", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "vitepress-project"));
    expect(projectInfo.framework).toBe("vitepress");
  });

  it("detects framework as quasar when quasar dependency is present", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "quasar-project"));
    expect(projectInfo.framework).toBe("quasar");
  });

  it("detects TypeScript when tsconfig.json exists", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-vue"));
    expect(projectInfo.hasTypeScript).toBe(true);
  });

  it("detects TypeScript as false when tsconfig.json is missing", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-nuxt"));
    expect(projectInfo.hasTypeScript).toBe(false);
  });

  it("detects Vue version from peerDependencies", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "component-library"));
    expect(projectInfo.vueVersion).toBe("^3.4.0 || ^3.5.0");
  });

  it("detects Vue SFC compiler for projects with vue dependency", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-vue"));
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
  });

  it("detects Vue SFC compiler for nuxt projects", () => {
    const projectInfo = discoverProject(path.join(FIXTURES_DIRECTORY, "basic-nuxt"));
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
  });

  it("detects Vue SFC compiler when @vue/compiler-sfc is a dependency", () => {
    const projectDirectory = path.join(tempDirectory, "vue-compiler-sfc-dep");
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({
        name: "sfc-project",
        devDependencies: { "@vue/compiler-sfc": "^3.5.0" },
      }),
    );

    const projectInfo = discoverProject(projectDirectory);
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
  });

  it("detects Vue SFC compiler when nuxt config file exists", () => {
    const projectDirectory = path.join(tempDirectory, "nuxt-config-present");
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ name: "nuxt-config-test", dependencies: { vue: "^3.5.0" } }),
    );
    fs.writeFileSync(path.join(projectDirectory, "nuxt.config.ts"), "export default {}");

    const projectInfo = discoverProject(projectDirectory);
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
  });

  it("detects Vue SFC compiler when vite config file exists", () => {
    const projectDirectory = path.join(tempDirectory, "vite-config-present");
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ name: "vite-config-test", dependencies: { vue: "^3.5.0" } }),
    );
    fs.writeFileSync(path.join(projectDirectory, "vite.config.ts"), "export default {}");

    const projectInfo = discoverProject(projectDirectory);
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
  });

  it("returns Vue SFC compiler false for projects without any Vue-related files", () => {
    const projectDirectory = path.join(tempDirectory, "no-vue-at-all");
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ name: "plain-project", dependencies: { lodash: "^4.0.0" } }),
    );

    const projectInfo = discoverProject(projectDirectory);
    expect(projectInfo.hasVueCompilerSfc).toBe(false);
  });

  it("detects Vue SFC compiler from ancestor package.json", () => {
    const ancestorDirectory = path.join(tempDirectory, "ancestor-compiler");
    const childDirectory = path.join(ancestorDirectory, "packages", "child");
    fs.mkdirSync(childDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(ancestorDirectory, "package.json"),
      JSON.stringify({ name: "monorepo-root", private: true }),
    );
    fs.writeFileSync(
      path.join(childDirectory, "package.json"),
      JSON.stringify({
        name: "child-package",
        devDependencies: { "@vue/compiler-sfc": "^3.5.0" },
      }),
    );

    const projectInfo = discoverProject(childDirectory);
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
  });

  it("throws when package.json is missing", () => {
    expect(() => discoverProject("/nonexistent/path")).toThrow("No package.json found");
  });

  it("throws when package.json is a directory instead of a file", () => {
    const projectDirectory = path.join(tempDirectory, "eisdir-root");
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.mkdirSync(path.join(projectDirectory, "package.json"), { recursive: true });

    expect(() => discoverProject(projectDirectory)).toThrow("No package.json found");
  });

  it("resolves Vue version from pnpm workspace default catalog", () => {
    const projectInfo = discoverProject(
      path.join(FIXTURES_DIRECTORY, "pnpm-catalog-workspace", "packages", "ui"),
    );
    expect(projectInfo.vueVersion).toBe("^3.5.0");
  });

  it("resolves Vue version from pnpm workspace named catalog", () => {
    const projectInfo = discoverProject(
      path.join(FIXTURES_DIRECTORY, "pnpm-named-catalog", "packages", "app"),
    );
    expect(projectInfo.vueVersion).toBe("^3.5.0");
  });

  it("handles empty pnpm-workspace.yaml gracefully", () => {
    const monorepoRoot = path.join(tempDirectory, "empty-workspace-yaml");
    fs.mkdirSync(monorepoRoot, { recursive: true });
    fs.writeFileSync(path.join(monorepoRoot, "pnpm-workspace.yaml"), "");
    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({ name: "app", dependencies: { vue: "^3.5.0" } }),
    );

    const projectInfo = discoverProject(monorepoRoot);
    expect(projectInfo.vueVersion).toBe("^3.5.0");
  });

  it("handles malformed package.json gracefully during workspace discovery", () => {
    const monorepoRoot = path.join(tempDirectory, "malformed-workspace-pkg");
    const subdirectory = path.join(monorepoRoot, "packages", "broken");
    fs.mkdirSync(subdirectory, { recursive: true });
    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({
        name: "monorepo",
        dependencies: { vue: "^3.5.0" },
        workspaces: ["packages/*"],
      }),
    );
    fs.writeFileSync(path.join(subdirectory, "package.json"), "{ invalid json }}}");

    expect(() => discoverProject(monorepoRoot)).not.toThrow();
    const projectInfo = discoverProject(monorepoRoot);
    expect(projectInfo.vueVersion).toBe("^3.5.0");
  });

  it("resolves Vue when catalog reference name does not exist (falls back to default)", () => {
    const monorepoRoot = path.join(tempDirectory, "nonexistent-catalog-name");
    fs.mkdirSync(path.join(monorepoRoot, "packages", "app"), { recursive: true });
    fs.writeFileSync(
      path.join(monorepoRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n\ncatalog:\n  vue: ^3.5.0\n",
    );
    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({ name: "monorepo", private: true }),
    );
    fs.writeFileSync(
      path.join(monorepoRoot, "packages", "app", "package.json"),
      JSON.stringify({
        name: "app",
        dependencies: { vue: "catalog:nonexistent" },
      }),
    );

    const projectInfo = discoverProject(path.join(monorepoRoot, "packages", "app"));
    expect(projectInfo.vueVersion).toBe("^3.5.0");
  });

  it("resolves Vue version from Bun workspace catalog", () => {
    const projectDirectory = path.join(tempDirectory, "bun-catalog-workspace");
    const appDirectory = path.join(projectDirectory, "apps", "web");
    fs.mkdirSync(appDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({
        name: "bun-catalog-workspace",
        private: true,
        workspaces: {
          packages: ["apps/*"],
          catalog: { vue: "^3.5.13" },
        },
      }),
    );
    fs.writeFileSync(
      path.join(appDirectory, "package.json"),
      JSON.stringify({
        name: "web",
        private: true,
        dependencies: { vue: "catalog:" },
      }),
    );

    const projectInfo = discoverProject(appDirectory);
    expect(projectInfo.vueVersion).toBe("^3.5.13");
  });

  it("resolves Vue version when only in peerDependencies with catalog reference", () => {
    const monorepoRoot = path.join(tempDirectory, "peer-deps-catalog");
    fs.mkdirSync(path.join(monorepoRoot, "packages", "ui"), { recursive: true });
    fs.writeFileSync(
      path.join(monorepoRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n\ncatalog:\n  vue: ^3.5.13\n",
    );
    fs.writeFileSync(
      path.join(monorepoRoot, "package.json"),
      JSON.stringify({ name: "monorepo", private: true }),
    );
    fs.writeFileSync(
      path.join(monorepoRoot, "packages", "ui", "package.json"),
      JSON.stringify({
        name: "ui",
        peerDependencies: { vue: "catalog:" },
        devDependencies: { vue: "catalog:" },
      }),
    );

    const projectInfo = discoverProject(path.join(monorepoRoot, "packages", "ui"));
    expect(projectInfo.vueVersion).toBe("^3.5.13");
  });

  it("detects @nuxt/* packages as having vue dependency", () => {
    const projectDirectory = path.join(tempDirectory, "nuxt-module");
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({
        name: "nuxt-module-project",
        dependencies: { "@nuxt/kit": "^3.16.0" },
      }),
    );

    const projectInfo = discoverProject(projectDirectory);
    expect(projectInfo.hasVueCompilerSfc).toBe(true);
    expect(projectInfo.framework).toBe("unknown");
  });
});

describe("listWorkspacePackages", () => {
  it("resolves nested workspace patterns like apps/*/ClientApp", () => {
    const workspacePackages = listWorkspacePackages(
      path.join(FIXTURES_DIRECTORY, "nested-workspaces"),
    );
    const packageNames = workspacePackages.map((workspacePackage) => workspacePackage.name);

    expect(packageNames).toContain("my-app-client");
    expect(packageNames).toContain("ui");
    expect(workspacePackages).toHaveLength(2);
  });

  it("includes monorepo root when it has a Vue dependency", () => {
    const workspacePackages = listWorkspacePackages(
      path.join(FIXTURES_DIRECTORY, "monorepo-with-root-vue"),
    );
    const packageNames = workspacePackages.map((workspacePackage) => workspacePackage.name);

    expect(packageNames).toContain("monorepo-root");
    expect(packageNames).toContain("ui");
    expect(workspacePackages).toHaveLength(2);
  });

  it("returns empty when no workspace patterns configured", () => {
    const workspacePackages = listWorkspacePackages(
      path.join(FIXTURES_DIRECTORY, "basic-vue"),
    );
    expect(workspacePackages).toHaveLength(0);
  });

  it("filters packages without Vue dependencies", () => {
    const workspaceDirectory = path.join(tempDirectory, "mixed-workspace");
    const packagesUi = path.join(workspaceDirectory, "packages", "ui");
    const packagesUtils = path.join(workspaceDirectory, "packages", "utils");
    fs.mkdirSync(packagesUi, { recursive: true });
    fs.mkdirSync(packagesUtils, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceDirectory, "package.json"),
      JSON.stringify({ name: "mixed", private: true, workspaces: ["packages/*"] }),
    );
    fs.writeFileSync(
      path.join(packagesUi, "package.json"),
      JSON.stringify({ name: "ui", dependencies: { vue: "^3.5.0" } }),
    );
    fs.writeFileSync(
      path.join(packagesUtils, "package.json"),
      JSON.stringify({ name: "utils", dependencies: { lodash: "^4.0.0" } }),
    );

    const workspacePackages = listWorkspacePackages(workspaceDirectory);
    const packageNames = workspacePackages.map((workspacePackage) => workspacePackage.name);

    expect(packageNames).toContain("ui");
    expect(packageNames).not.toContain("utils");
    expect(workspacePackages).toHaveLength(1);
  });
});

describe("discoverVueSubprojects", () => {
  it("skips subdirectories where package.json is a directory (EISDIR)", () => {
    const rootDirectory = path.join(tempDirectory, "eisdir-package-json");
    const subdirectory = path.join(rootDirectory, "broken-sub");
    fs.mkdirSync(rootDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "my-app", dependencies: { vue: "^3.5.0" } }),
    );
    fs.mkdirSync(subdirectory, { recursive: true });
    fs.mkdirSync(path.join(subdirectory, "package.json"), { recursive: true });

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toHaveLength(1);
    expect(workspacePackages[0].name).toBe("my-app");
  });

  it("includes root directory when it has a vue dependency", () => {
    const rootDirectory = path.join(tempDirectory, "root-with-vue");
    fs.mkdirSync(rootDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "my-app", dependencies: { vue: "^3.5.0" } }),
    );

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toContainEqual({ name: "my-app", directory: rootDirectory });
  });

  it("includes both root and subdirectory when both have vue", () => {
    const rootDirectory = path.join(tempDirectory, "root-and-sub");
    const subdirectory = path.join(rootDirectory, "extension");
    fs.mkdirSync(subdirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "my-app", dependencies: { vue: "^3.5.0" } }),
    );
    fs.writeFileSync(
      path.join(subdirectory, "package.json"),
      JSON.stringify({ name: "my-extension", dependencies: { vue: "^3.4.0" } }),
    );

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toHaveLength(2);
    expect(workspacePackages[0]).toEqual({ name: "my-app", directory: rootDirectory });
    expect(workspacePackages[1]).toEqual({ name: "my-extension", directory: subdirectory });
  });

  it("does not match packages without Vue-related dependencies", () => {
    const rootDirectory = path.join(tempDirectory, "non-vue");
    fs.mkdirSync(rootDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "non-vue", devDependencies: { typescript: "^5.0.0" } }),
    );

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toHaveLength(0);
  });

  it("matches packages with nuxt dependency", () => {
    const rootDirectory = path.join(tempDirectory, "nuxt-sub");
    fs.mkdirSync(rootDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "nuxt-sub", dependencies: { nuxt: "^3.16.0" } }),
    );

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toHaveLength(1);
  });

  it("matches packages with @nuxt/* dependency", () => {
    const rootDirectory = path.join(tempDirectory, "nuxt-module-sub");
    fs.mkdirSync(rootDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "nuxt-module-sub", dependencies: { "@nuxt/kit": "^3.16.0" } }),
    );

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toHaveLength(1);
  });

  it("handles nonexistent root directory without crashing", () => {
    const workspacePackages = discoverVueSubprojects("/nonexistent/path/that/doesnt/exist");
    expect(workspacePackages).toHaveLength(0);
  });

  it("skips subdirectory entries that are files instead of directories", () => {
    const rootDirectory = path.join(tempDirectory, "file-as-subdir");
    fs.mkdirSync(rootDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rootDirectory, "package.json"),
      JSON.stringify({ name: "my-app", dependencies: { vue: "^3.5.0" } }),
    );
    fs.writeFileSync(path.join(rootDirectory, "not-a-dir"), "just a file");

    const workspacePackages = discoverVueSubprojects(rootDirectory);
    expect(workspacePackages).toHaveLength(1);
    expect(workspacePackages[0].name).toBe("my-app");
  });
});

describe("formatFrameworkName", () => {
  it("formats known frameworks", () => {
    expect(formatFrameworkName("nuxt")).toBe("Nuxt");
    expect(formatFrameworkName("vue")).toBe("Vue");
    expect(formatFrameworkName("vite")).toBe("Vite");
    expect(formatFrameworkName("vitepress")).toBe("VitePress");
    expect(formatFrameworkName("quasar")).toBe("Quasar");
  });

  it("formats unknown framework as Vue", () => {
    expect(formatFrameworkName("unknown")).toBe("Vue");
  });
});
