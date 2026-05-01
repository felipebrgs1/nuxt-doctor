import path from "node:path";
import { describe, expect, it } from "vitest";
import { findMonorepoRoot, isMonorepoRoot } from "../src/utils/find-monorepo-root.js";

const FIXTURES_DIRECTORY = path.resolve(import.meta.dirname, "fixtures");

describe("isMonorepoRoot", () => {
  it("returns true for a directory with pnpm-workspace.yaml", () => {
    const pnpmCatalogWorkspace = path.join(FIXTURES_DIRECTORY, "pnpm-catalog-workspace");
    expect(isMonorepoRoot(pnpmCatalogWorkspace)).toBe(true);
  });

  it("returns true for a directory with workspaces in package.json", () => {
    const nestedWorkspaces = path.join(FIXTURES_DIRECTORY, "nested-workspaces");
    expect(isMonorepoRoot(nestedWorkspaces)).toBe(true);
  });

  it("returns true for a directory with both workspaces and packages field", () => {
    const monorepoWithRootVue = path.join(FIXTURES_DIRECTORY, "monorepo-with-root-vue");
    expect(isMonorepoRoot(monorepoWithRootVue)).toBe(true);
  });

  it("returns false for a non-monorepo project", () => {
    const basicVue = path.join(FIXTURES_DIRECTORY, "basic-vue");
    expect(isMonorepoRoot(basicVue)).toBe(false);
  });

  it("returns false for a nonexistent directory", () => {
    expect(isMonorepoRoot("/nonexistent/path")).toBe(false);
  });
});

describe("findMonorepoRoot", () => {
  it("returns null when no monorepo root exists above directory", () => {
    expect(findMonorepoRoot("/tmp")).toBeNull();
  });

  it("finds monorepo root from a nested workspace package", () => {
    const nestedPackage = path.join(
      FIXTURES_DIRECTORY,
      "nested-workspaces",
      "packages",
      "ui",
    );
    const monorepoRoot = findMonorepoRoot(nestedPackage);
    expect(monorepoRoot).toBe(path.join(FIXTURES_DIRECTORY, "nested-workspaces"));
  });

  it("finds monorepo root from deeply nested workspace packages", () => {
    const nestedApp = path.join(
      FIXTURES_DIRECTORY,
      "nested-workspaces",
      "apps",
      "my-app",
      "ClientApp",
    );
    const monorepoRoot = findMonorepoRoot(nestedApp);
    expect(monorepoRoot).toBe(path.join(FIXTURES_DIRECTORY, "nested-workspaces"));
  });
});
