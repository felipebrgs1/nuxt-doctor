# Nuxt Doctor: Discover Project Utility

## Objective

Create a `discover-project.ts` utility for nuxt-doctor, modeled after react-doctor's proven pattern, that detects Nuxt/Vue project characteristics (Vue version, framework type, TypeScript usage, Vue compiler support, source file count) and provides workspace/subproject discovery for monorepo support. Also add the companion `select-projects.ts` utility for interactive project selection.

The types in `packages/nuxt-doctor/src/types.ts` already define `Framework`, `ProjectInfo`, `DependencyInfo`, and `WorkspacePackage` with the Nuxt/Vue equivalents. This plan fills the implementation gap.

## Implementation Plan

### Phase 1: Low-Level Shared Utilities

- [ ] Create `packages/nuxt-doctor/src/utils/is-file.ts` — Port the safe file existence check from react-doctor. This is a fundamental building block used by every other utility.
- [ ] Create `packages/nuxt-doctor/src/utils/read-package-json.ts` — Port the package.json reader with graceful error handling for malformed JSON and EISDIR/EACCES errors.
- [ ] Create `packages/nuxt-doctor/src/utils/is-plain-object.ts` — Port the 2-line type guard for plain object checks, needed for catalog parsing.
- [ ] Create `packages/nuxt-doctor/src/utils/find-monorepo-root.ts` — Port the monorepo root detection utility that walks up directories looking for `pnpm-workspace.yaml`, `nx.json`, or `workspaces` in package.json.

### Phase 2: Core Discover-Project Engine

- [ ] Create `packages/nuxt-doctor/src/utils/discover-project.ts` with the following framework detection map and dependency constants:
  - Define `FRAMEWORK_PACKAGES` mapping: `{ nuxt: "nuxt", vue: "vue", vite: "vite", vitepress: "vitepress", quasar: "quasar" }`
  - Define `FRAMEWORK_DISPLAY_NAMES` mapping for human-readable framework names
  - Define `VUE_DEPENDENCY_NAMES` set: `{ "vue", "nuxt", "vitepress", "quasar" }` for filtering relevant packages
  - Define `VUE_COMPILER_PACKAGES` set: `{ "@vue/compiler-sfc", "@vitejs/plugin-vue", "vue-loader" }` for detecting SFC compiler support
- [ ] Implement `extractDependencyInfo()` — Collects all dependency categories and returns `{ vueVersion, framework }` using the same `collectAllDependencies` helper pattern as react-doctor but checking for `vue` instead of `react`, and detecting framework from the dependency set.
- [ ] Implement `resolveCatalogVersion()` — Port the pnpm workspace catalog resolution logic (unchanged algorithm), but target the `vue` package name instead of `react`. This parses `pnpm-workspace.yaml` for `catalog:` and `catalogs:` blocks.
- [ ] Implement `parsePnpmWorkspacePatterns()` — Port the YAML parser for workspace package patterns (identical to react-doctor, no changes needed).
- [ ] Implement `getWorkspacePatterns()` — Port the workspace pattern resolver checking pnpm-workspace.yaml, then package.json workspaces array, then workspaces.packages object.
- [ ] Implement `resolveWorkspaceDirectories()` — Port the glob/wildcard pattern resolver that finds actual directories matching workspace patterns.
- [ ] Implement `findDependencyInfoFromMonorepoRoot()` — Port the monorepo root walker that checks parent directories for Vue version + framework info.
- [ ] Implement `findVueInWorkspaces()` — Port the workspace scanner from react-doctor, but search for Vue dependencies instead of React.
- [ ] Implement `hasVueDependency()` — Port the dependency checker using VUE_DEPENDENCY_NAMES set.
- [ ] Implement `discoverVueSubprojects()` — Port `discoverReactSubprojects()` — scans root and immediate subdirectories for Vue/Nuxt projects by checking package.json dependencies.
- [ ] Implement `listWorkspacePackages()` — Port the workspace package lister, filtering for Vue dependency presence.
- [ ] Implement `detectVueCompilerSfc()` — Detect Vue SFC compiler support by checking:
  - Presence of compiler packages in dependencies
  - Nuxt/Vite config files for Vue plugin references
  - Ancestor package.json files (for monorepo scenarios)
  - Config filenames: `nuxt.config.ts`, `nuxt.config.js`, `nuxt.config.mjs`, `vite.config.ts`, `vite.config.js`
- [ ] Implement `countSourceFiles()` — Count Vue/JS/TS source files using the existing `SOURCE_FILE_PATTERN` from constants, preferring git ls-files with fallback to filesystem walk.
- [ ] Implement the main `discoverProject()` function:
  - Read and parse package.json
  - Extract dependency info (vue version, framework)
  - Fall back to catalog resolution if no direct vue version
  - Fall back to monorepo root catalog if still not found
  - Fall back to workspace scanning as last resort
  - Detect TypeScript via tsconfig.json
  - Detect Vue SFC compiler
  - Count source files
  - Return full `ProjectInfo` object
- [ ] Implement `formatFrameworkName()` — Map framework enum values to human-readable display names (e.g., "nuxt" → "Nuxt", "vue" → "Vue", "vitepress" → "VitePress").

### Phase 3: Project Selection Utility

- [ ] Create `packages/nuxt-doctor/src/utils/select-projects.ts`:
  - Implement `selectProjects()` that attempts `listWorkspacePackages()` first, then falls back to `discoverVueSubprojects()`
  - Handle single-project case (auto-select without prompt)
  - Handle `--project` flag resolution (comma-separated name matching)
  - Handle `skipPrompts` mode (CI/automated environments)
  - Fall back to interactive prompt via the existing `prompts` dependency
- [ ] Implement `resolveProjectFlag()` — Parse comma-separated project names and match against workspace package names or directory basenames.
- [ ] Implement `printDiscoveredProjects()` — Log discovered package names for CI/skipPrompts mode.
- [ ] Implement `promptProjectSelection()` — Interactive multiselect prompt for workspace package selection.

### Phase 4: Tests and Fixtures

- [ ] Create test fixtures directory structure with representative projects:
  - `basic-vue/` — Simple Vue project with vue dependency in package.json and tsconfig.json
  - `basic-nuxt/` — Nuxt project with nuxt dependency
  - `component-library/` — Vue component library using peerDependencies
  - `pnpm-catalog-workspace/` — pnpm workspace with catalog and nested packages
  - `pnpm-named-catalog/` — pnpm workspace with named catalogs
  - `nested-workspaces/` — Non-trivial workspace patterns like `apps/*/ClientApp`
  - `monorepo-with-root-vue/` — Monorepo where root also has vue dependency
  - `vitepress-project/` — VitePress documentation project
  - `quasar-project/` — Quasar framework project
- [ ] Write `tests/discover-project.test.ts`:
  - Test basic Vue version detection
  - Test framework detection for all framework types
  - Test TypeScript detection
  - Test peerDependencies version resolution
  - Test missing package.json error handling
  - Test catalog reference resolution
  - Test monorepo root fallback
  - Test workspace scanning
  - Test `discoverVueSubprojects()`
  - Test `listWorkspacePackages()`
  - Test `formatFrameworkName()`
- [ ] Write `tests/find-monorepo-root.test.ts`:
  - Test monorepo root detection with pnpm-workspace.yaml and nx.json
  - Test that non-monorepo directories return false/null
  - Test walking up from nested packages

## Verification Criteria

- `discoverProject()` correctly returns Vue version, framework, TypeScript flag, Vue compiler flag, and source file count for all test fixtures
- `listWorkspacePackages()` correctly discovers workspace packages with Vue dependencies in monorepo structures
- `discoverVueSubprojects()` finds Vue projects in flat directories without workspace configs
- `selectProjects()` correctly falls through from workspaces → subprojects → root directory
- Catalog resolution works for both default and named pnpm catalogs
- All edge cases handled: missing package.json, malformed JSON, EISDIR, empty workspaces, no Vue dependency
- `formatFrameworkName()` provides human-readable names for all framework types
- 100% of tests pass for both discover-project and find-monorepo-root

## Potential Risks and Mitigations

1. **Over-coupling to react-doctor internals**
   Mitigation: The nuxt-doctor version should be an independent implementation tailored for Vue/Nuxt, not a blind copy. Framework detection, compiler detection, and dependency names are all Nuxt/Vue specific.

2. **pnpm-workspace.yaml parsing fragility**
   Mitigation: The parser is already battle-tested in react-doctor and handles comments, nested catalogs, and named catalogs. Port as-is with only the package name changed from `react` to `vue`.

3. **Missing Nuxt-specific configuration detection**
   Mitigation: Phase 2 already includes Nuxt config file detection. Future iterations can add detection for Nuxt-specific features like modules, ssr, nitro, etc.

4. **Windows path handling**
   Mitigation: Port the normalized-to-relative-path pattern from react-doctor's `is-ignored-file.ts` if path matching becomes necessary in workspace resolutions.

## Alternative Approaches

1. **Shared utility package**: Extract `is-file`, `read-package-json`, `is-plain-object`, `find-monorepo-root` into a shared `@nuxt-doctor/shared` package that both react-doctor and nuxt-doctor consume. Trade-off: More refactoring now, but eliminates duplication long-term. Not recommended until both packages are stable.

2. **Separate catalog parsing module**: Extract `pnpm-workspace.yaml` catalog parsing into its own utility since it's identical between react-doctor and nuxt-doctor. Good for a follow-up refactor but adds unnecessary complexity now.

3. **Simpler single-project-only discovery**: Skip workspace/subproject discovery entirely and only support single-directory scanning. Trade-off: Loses monorepo support which is critical for real-world Nuxt projects. Not recommended.
