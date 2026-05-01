import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ERROR_PREVIEW_LENGTH_CHARS,
  OXLINT_MAX_FILES_PER_BATCH,
  SOURCE_FILE_PATTERN,
  SPAWN_ARGS_MAX_LENGTH_CHARS,
} from "../constants.js";
import { createOxlintConfig } from "../oxlint-config.js";
import type { CleanedDiagnostic, Diagnostic, Framework, OxlintOutput } from "../types.js";
import { neutralizeDisableDirectives } from "./neutralize-disable-directives.js";

const esmRequire = createRequire(import.meta.url);

const PLUGIN_CATEGORY_MAP: Record<string, string> = {
  vue: "Vue Best Practices",
  "jsx-a11y": "Accessibility",
  import: "Correctness",
};

const RULE_CATEGORY_MAP: Record<string, string> = {
  "nuxt-doctor/no-derived-state-effect": "Correctness",
  "nuxt-doctor/no-fetch-in-effect": "Correctness",
  "nuxt-doctor/no-cascading-set-state": "Correctness",
  "nuxt-doctor/no-effect-event-handler": "Correctness",
  "nuxt-doctor/no-derived-ref": "Vue Best Practices",
  "nuxt-doctor/prefer-computed": "Vue Best Practices",
  "nuxt-doctor/rerender-lazy-state-init": "Performance",
  "nuxt-doctor/rerender-dependencies": "Vue Best Practices",

  "nuxt-doctor/no-giant-component": "Architecture",
  "nuxt-doctor/no-render-in-render": "Architecture",
  "nuxt-doctor/no-nested-component-definition": "Correctness",

  "nuxt-doctor/no-secrets-in-client-code": "Security",

  "nuxt-doctor/js-flatmap-filter": "JS Performance",

  "nuxt-doctor/no-barrel-import": "Bundle Size",
  "nuxt-doctor/no-moment": "Bundle Size",
  "nuxt-doctor/prefer-dynamic-import": "Bundle Size",
  "nuxt-doctor/use-lazy-motion": "Bundle Size",
  "nuxt-doctor/no-undeferred-third-party": "Bundle Size",

  "nuxt-doctor/no-array-index-as-key": "Correctness",
  "nuxt-doctor/rendering-conditional-render": "Correctness",
  "nuxt-doctor/no-prevent-default": "Correctness",

  "nuxt-doctor/server-auth-actions": "Security",
  "nuxt-doctor/server-after-nonblocking": "Server",

  "nuxt-doctor/client-passive-event-listeners": "Performance",

  "nuxt-doctor/no-transition-all": "CSS / Design",
  "nuxt-doctor/no-global-css-variable-animation": "CSS / Design",
  "nuxt-doctor/no-large-animated-blur": "CSS / Design",
  "nuxt-doctor/no-scale-from-zero": "CSS / Design",
  "nuxt-doctor/no-permanent-will-change": "CSS / Design",

  "nuxt-doctor/no-inline-bounce-easing": "CSS / Design",
  "nuxt-doctor/no-z-index-9999": "Architecture",
  "nuxt-doctor/no-inline-exhaustive-style": "Architecture",
  "nuxt-doctor/no-side-tab-border": "CSS / Design",
  "nuxt-doctor/no-pure-black-background": "CSS / Design",
  "nuxt-doctor/no-gradient-text": "CSS / Design",
  "nuxt-doctor/no-dark-mode-glow": "CSS / Design",
  "nuxt-doctor/no-justified-text": "Accessibility",
  "nuxt-doctor/no-tiny-text": "Accessibility",
  "nuxt-doctor/no-wide-letter-spacing": "CSS / Design",
  "nuxt-doctor/no-gray-on-colored-background": "Accessibility",
  "nuxt-doctor/no-layout-transition-inline": "CSS / Design",
  "nuxt-doctor/no-disabled-zoom": "Accessibility",
  "nuxt-doctor/no-outline-none": "Accessibility",
  "nuxt-doctor/no-long-transition-duration": "CSS / Design",

  "nuxt-doctor/async-parallel": "JS Performance",
  "nuxt-doctor/no-duplicate-storage-read": "JS Performance",
  "nuxt-doctor/no-sequential-await": "JS Performance",

  "nuxt-doctor/no-async-data-side-effects": "Nuxt Best Practices",
  "nuxt-doctor/no-sync-fetch-in-asyncdata": "Nuxt Best Practices",
  "nuxt-doctor/no-duplicate-use-fetch": "Nuxt Best Practices",
  "nuxt-doctor/use-nuxt-link-for-internal-routes": "Nuxt Best Practices",
  "nuxt-doctor/use-nuxt-img": "Nuxt Best Practices",
  "nuxt-doctor/use-page-meta": "Nuxt Best Practices",
  "nuxt-doctor/no-global-style-in-component": "Nuxt Best Practices",
  "nuxt-doctor/no-use-fetch-without-key": "Nuxt Best Practices",
  "nuxt-doctor/no-middleware-in-component": "Nuxt Best Practices",
  "nuxt-doctor/no-raw-dollar-fetch": "Nuxt Best Practices",
  "nuxt-doctor/prefer-use-fetch-over-use-async-data": "Nuxt Best Practices",

  "nuxt-doctor/vue-no-deprecated-v-bind-sync": "Vue Best Practices",
  "nuxt-doctor/vue-prefer-composition-api": "Vue Best Practices",
  "nuxt-doctor/vue-no-deprecated-events-api": "Vue Best Practices",
  "nuxt-doctor/vue-no-deprecated-filter": "Vue Best Practices",

  "nuxt-doctor/vitepress-no-relative-img": "Architecture",
  "nuxt-doctor/vitepress-use-theme-config": "Architecture",

  "nuxt-doctor/quasar-no-deprecated-props": "Vue Best Practices",
  "nuxt-doctor/quasar-prefer-vue3-patterns": "Vue Best Practices",
};

const RULE_HELP_MAP: Record<string, string> = {
  "no-derived-state-effect":
    "For derived state, compute inline in `<script setup>` or use `computed()`: `const total = computed(() => items.value.length)`. See https://vuejs.org/guide/essentials/computed.html",
  "no-fetch-in-effect":
    "Use `useFetch()` or `useAsyncData()` from Nuxt, or fetch with top-level await in `<script setup>`. Avoid `watchEffect` or `onMounted` for data fetching",
  "no-cascading-set-state":
    "Combine related state into a single reactive object or use `computed()` for derived values. Avoid chains of watchers updating each other",
  "no-effect-event-handler":
    "Move the conditional logic directly into the event handler (`@click`, `@submit`) instead of using `watch` or `watchEffect`",
  "no-derived-ref":
    "Use `computed()` instead of manually creating a `ref()` and updating it via `watch()`. `computed()` is reactive, lazy, and dependency-tracked",
  "prefer-computed":
    "Replace `watch` + ref assignment with a single `computed()` — it updates automatically and caches until dependencies change",
  "rerender-lazy-state-init":
    "Wrap expensive reactive initialisation in a lazy function or use `shallowRef()` for large objects — Vue's `ref()` is lazy by default for deeply nested data",
  "rerender-dependencies":
    "Ensure all reactive dependencies are explicitly referenced in the `computed()` or `watch()` callback. Use `watch(() => [a, b], ...)` for multiple sources",

  "no-giant-component":
    "Extract logical sections into focused components: `<UserHeader />`, `<UserActions />`, `<UserProfile />`, etc.",
  "no-render-in-render":
    "Extract to a named component: `const MyListItem = defineComponent({ ... })` or a separate SFC file",
  "no-nested-component-definition":
    "Move to a separate `.vue` file or to module scope above the parent component. Nested definitions break hot-module reloading and hurt readability",

  "no-secrets-in-client-code":
    "Move secrets to `process.env.SECRET_NAME` or Nuxt `runtimeConfig`. Only `NUXT_PUBLIC_*` vars are safe for the client (and must never contain secrets)",

  "js-flatmap-filter":
    "Use `.flatMap(item => condition ? [value] : [])` — transforms and filters in a single pass instead of creating an intermediate array",

  "no-barrel-import":
    "Import from the direct path: `import { Button } from './components/Button'` instead of `./components`",
  "no-moment":
    "Replace with `import { format } from 'date-fns'` (tree-shakeable) or `import dayjs from 'dayjs'` (2kb)",
  "prefer-dynamic-import":
    "Use `defineAsyncComponent(() => import('library'))` from Vue or dynamic imports with `import()` syntax — reduces initial bundle size",
  "use-lazy-motion":
    "Use `import { LazyMotion, m } from 'framer-motion'` with `domAnimation` features — saves ~30kb",
  "no-undeferred-third-party":
    "Use `ClientOnly` component in Nuxt or add the `defer` attribute for non-critical third-party scripts",

  "no-array-index-as-key":
    "Use a stable unique identifier: `key={item.id}` or `key={item.slug}` — index keys break on reorder/filter",
  "rendering-conditional-render":
    "Use `v-if=\"items.length > 0\"` for conditional rendering in Vue templates instead of computed booleans",
  "no-prevent-default":
    "Use Nuxt's built-in form handling or `<form @submit.prevent=\"handler\">` instead of manual `preventDefault` calls",

  "server-auth-actions":
    "Add `const session = await auth()` at the top of server routes and throw/redirect if unauthorized before any data access",
  "server-after-nonblocking":
    "Use `import { after } from 'nitro'` then wrap: `after(() => analytics.track(...))` — response isn't blocked",

  "client-passive-event-listeners":
    "Add `{ passive: true }` as the third argument: `addEventListener('scroll', handler, { passive: true })`",

  "no-transition-all":
    "List specific properties: `transition: \"opacity 200ms, transform 200ms\"` — or in Tailwind use `transition-colors`, `transition-opacity`, or `transition-transform`",
  "no-global-css-variable-animation":
    "Set the variable on the nearest element instead of a parent, or use `@property` with `inherits: false` to prevent cascade. Better yet, use targeted `element.style.transform` updates",
  "no-large-animated-blur":
    "Keep blur radius under 10px, or apply blur to a smaller element. Large blurs multiply GPU memory usage with layer size",
  "no-scale-from-zero":
    "Use a visible starting scale such as `0.95` — elements should deflate like a balloon, not vanish into a point",
  "no-permanent-will-change":
    "Add `will-change` on interaction start and remove on end. Permanent promotion wastes GPU memory and can degrade performance",

  "no-inline-bounce-easing":
    "Use `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for natural deceleration — objects in the real world don't bounce",
  "no-z-index-9999":
    "Define a z-index scale in your design tokens (e.g. dropdown: 10, modal: 20, toast: 30). Create a new stacking context with `isolation: isolate` instead of escalating values",
  "no-inline-exhaustive-style":
    "Move styles to a CSS class, CSS module, Scoped style block, or Tailwind utilities — inline objects with many properties hurt readability",
  "no-side-tab-border":
    "Use a subtler accent (box-shadow inset, background gradient, or border-bottom) instead of a thick one-sided border",
  "no-pure-black-background":
    "Tint the background slightly toward your brand hue — e.g. `#0a0a0f` or Tailwind's `bg-gray-950`. Pure black looks harsh on modern displays",
  "no-gradient-text":
    "Use solid text colors for readability. If you need emphasis, use font weight, size, or a distinct color instead of gradients",
  "no-dark-mode-glow":
    "Use a subtle `box-shadow` with neutral colors for depth, or `border` with low opacity. Colored glows on dark backgrounds are the default AI-generated aesthetic",
  "no-justified-text":
    "Use `text-align: left` for body text, or add `hyphens: auto` and `overflow-wrap: break-word` if you must justify",
  "no-tiny-text":
    "Use at least 12px for body content, 16px is ideal. Small text is hard to read, especially on high-DPI mobile screens",
  "no-wide-letter-spacing":
    "Reserve wide tracking (letter-spacing > 0.05em) for short uppercase labels, navigation items, and buttons — not body text",
  "no-gray-on-colored-background":
    "Use a darker shade of the background color for text, or white/near-white for contrast. Gray text on colored backgrounds looks washed out",
  "no-layout-transition-inline":
    "Use `transform` and `opacity` for transitions — they run on the compositor thread. For height animations, use `grid-template-rows: 0fr → 1fr`",
  "no-disabled-zoom":
    "Remove `user-scalable=no` and `maximum-scale` from the viewport meta tag. If your layout breaks at 200% zoom, fix the layout — don't punish users with disabilities",
  "no-outline-none":
    "Use `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }` to show focus only for keyboard users while hiding it for mouse clicks",
  "no-long-transition-duration":
    "Keep UI transitions under 1s — 100-150ms for instant feedback, 200-300ms for state changes, 300-500ms for layout changes. Use longer durations only for page-load hero animations",

  "async-parallel":
    "Use `const [a, b] = await Promise.all([fetchA(), fetchB()])` to run independent operations concurrently",
  "no-duplicate-storage-read":
    "Read `localStorage`/`sessionStorage` once into a reactive variable instead of reading it multiple times across different functions",
  "no-sequential-await":
    "Use `Promise.all()` for independent async operations: `const [a, b] = await Promise.all([fnA(), fnB()])`",

  "no-async-data-side-effects":
    "Avoid side effects (mutating external state) inside `useAsyncData` or `useFetch` callbacks — keep them pure and use the returned data ref",
  "no-sync-fetch-in-asyncdata":
    "Use `useFetch()` or `useAsyncData()` with `await` instead of synchronous fetches inside `asyncData` — they integrate with Nuxt's SSR hydration",
  "no-duplicate-use-fetch":
    "Reuse fetched data via `useNuxtData()` or `useFetch` with the same key, or lift the fetch to a parent component. Duplicate fetches waste bandwidth and slow hydration",
  "use-nuxt-link-for-internal-routes":
    "Replace `<a href=\"/about\">` with `<NuxtLink to=\"/about\">` — enables prefetching, client-side navigation, and preserves scroll position",
  "use-nuxt-img":
    "Replace `<img>` with `<NuxtImg>` — provides automatic WebP/AVIF, lazy loading, responsive srcset, and cloud provider optimization",
  "use-page-meta":
    "Use `definePageMeta({ title: '...', description: '...' })` in page components for SEO metadata instead of `useHead` in each component",
  "no-global-style-in-component":
    "Move global styles to `app.vue` or a `assets/css/main.css` file. Component scoped styles should use `<style scoped>` to avoid leaking",
  "no-use-fetch-without-key":
    "Provide a unique key as the first argument to `useFetch('/api/data', { key: 'unique-key' })` — enables deduplication and cache control",
  "no-middleware-in-component":
    "Define route middleware in the `middleware/` directory instead of inline in components. Middleware should be declarative and route-scoped",
  "no-raw-dollar-fetch":
    "Use `useFetch()` or `$fetch()` from Nuxt instead of raw `fetch()` — they handle base URL, cookies, headers, and error handling consistently",
  "prefer-use-fetch-over-use-async-data":
    "Use `useFetch()` instead of `useAsyncData()` + `$fetch()` — it's a convenience wrapper that reduces boilerplate and handles typing better",

  "vue-no-deprecated-v-bind-sync":
    "Replace `v-bind:prop.sync=\"value\"` with `v-model:prop=\"value\"` — the `.sync` modifier was removed in Vue 3",
  "vue-prefer-composition-api":
    "Migrate from Options API to Composition API (`<script setup>`) — better TypeScript inference, improved tree-shaking, and more reusable logic",
  "vue-no-deprecated-events-api":
    "Replace `$on`, `$once`, and `$off` with component-emitted events or a third-party event bus — these instance methods were removed in Vue 3",
  "vue-no-deprecated-filter":
    "Replace Vue 2 filters with computed properties or method calls — filters were removed in Vue 3",

  "vitepress-no-relative-img":
    "Use the public directory or absolute paths for images in VitePress — relative image paths may break during SSR or in production builds",
  "vitepress-use-theme-config":
    "Use `defineConfigWithTheme()` and the theme config object for site customisation instead of manual theme overrides",

  "quasar-no-deprecated-props":
    "Check the Quasar migration guide for upgraded prop names — deprecated props may be removed in future Quasar versions",
  "quasar-prefer-vue3-patterns":
    "Use Quasar v2+ patterns with Composition API and `<script setup>` — Quasar v1 Options API patterns are deprecated",
};

const FILEPATH_WITH_LOCATION_PATTERN = /\S+\.\w+:\d+:\d+[\s\S]*$/;

const cleanDiagnosticMessage = (
  message: string,
  help: string,
  plugin: string,
  rule: string,
): CleanedDiagnostic => {
  const cleaned = message.replace(FILEPATH_WITH_LOCATION_PATTERN, "").trim();
  return { message: cleaned || message, help: help || RULE_HELP_MAP[rule] || "" };
};

const parseRuleCode = (code: string): { plugin: string; rule: string } => {
  const match = code.match(/^(.+)\((.+)\)$/);
  if (!match) return { plugin: "unknown", rule: code };
  return { plugin: match[1].replace(/^eslint-plugin-/, ""), rule: match[2] };
};

const resolveOxlintBinary = (): string => {
  const oxlintMainPath = esmRequire.resolve("oxlint");
  const oxlintPackageDirectory = path.resolve(path.dirname(oxlintMainPath), "..");
  return path.join(oxlintPackageDirectory, "bin", "oxlint");
};

const resolvePluginPath = (): string => {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const pluginPath = path.join(currentDirectory, "nuxt-doctor-plugin.js");
  if (fs.existsSync(pluginPath)) return pluginPath;

  const distPluginPath = path.resolve(currentDirectory, "../../dist/nuxt-doctor-plugin.js");
  if (fs.existsSync(distPluginPath)) return distPluginPath;

  return pluginPath;
};

const resolveDiagnosticCategory = (plugin: string, rule: string): string => {
  const ruleKey = `${plugin}/${rule}`;
  return RULE_CATEGORY_MAP[ruleKey] ?? PLUGIN_CATEGORY_MAP[plugin] ?? "Other";
};

const estimateArgsLength = (args: string[]): number =>
  args.reduce((total, argument) => total + argument.length + 1, 0);

const batchIncludePaths = (baseArgs: string[], includePaths: string[]): string[][] => {
  const baseArgsLength = estimateArgsLength(baseArgs);
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentBatchLength = baseArgsLength;

  for (const filePath of includePaths) {
    const entryLength = filePath.length + 1;
    const exceedsArgLength =
      currentBatch.length > 0 && currentBatchLength + entryLength > SPAWN_ARGS_MAX_LENGTH_CHARS;
    const exceedsFileCount = currentBatch.length >= OXLINT_MAX_FILES_PER_BATCH;

    if (exceedsArgLength || exceedsFileCount) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchLength = baseArgsLength;
    }
    currentBatch.push(filePath);
    currentBatchLength += entryLength;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

const spawnOxlint = (
  args: string[],
  rootDirectory: string,
  nodeBinaryPath: string,
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(nodeBinaryPath, args, {
      cwd: rootDirectory,
    });

    const stdoutBuffers: Buffer[] = [];
    const stderrBuffers: Buffer[] = [];

    child.stdout.on("data", (buffer: Buffer) => stdoutBuffers.push(buffer));
    child.stderr.on("data", (buffer: Buffer) => stderrBuffers.push(buffer));

    child.on("error", (error) => reject(new Error(`Failed to run oxlint: ${error.message}`)));
    child.on("close", (code, signal) => {
      if (signal) {
        const stderrOutput = Buffer.concat(stderrBuffers).toString("utf-8").trim();
        const hint =
          signal === "SIGABRT" ? " (out of memory — try scanning fewer files with --diff)" : "";
        const detail = stderrOutput ? `: ${stderrOutput}` : "";
        reject(new Error(`oxlint was killed by ${signal}${hint}${detail}`));
        return;
      }
      const output = Buffer.concat(stdoutBuffers).toString("utf-8").trim();
      if (!output) {
        const stderrOutput = Buffer.concat(stderrBuffers).toString("utf-8").trim();
        if (stderrOutput) {
          reject(new Error(`Failed to run oxlint: ${stderrOutput}`));
          return;
        }
      }
      resolve(output);
    });
  });

const parseOxlintOutput = (stdout: string): Diagnostic[] => {
  if (!stdout) return [];

  let output: OxlintOutput;
  try {
    output = JSON.parse(stdout) as OxlintOutput;
  } catch {
    throw new Error(
      `Failed to parse oxlint output: ${stdout.slice(0, ERROR_PREVIEW_LENGTH_CHARS)}`,
    );
  }

  return output.diagnostics
    .filter((diagnostic) => diagnostic.code && SOURCE_FILE_PATTERN.test(diagnostic.filename))
    .map((diagnostic) => {
      const { plugin, rule } = parseRuleCode(diagnostic.code);
      const primaryLabel = diagnostic.labels[0];

      const cleaned = cleanDiagnosticMessage(diagnostic.message, diagnostic.help, plugin, rule);

      return {
        filePath: diagnostic.filename,
        plugin,
        rule,
        severity: diagnostic.severity,
        message: cleaned.message,
        help: cleaned.help,
        line: primaryLabel?.span.line ?? 0,
        column: primaryLabel?.span.column ?? 0,
        category: resolveDiagnosticCategory(plugin, rule),
      };
    });
};

export const runOxlint = async (
  rootDirectory: string,
  hasTypeScript: boolean,
  framework: Framework,
  includePaths?: string[],
  nodeBinaryPath: string = process.execPath,
  customRulesOnly = false,
): Promise<Diagnostic[]> => {
  if (includePaths !== undefined && includePaths.length === 0) {
    return [];
  }

  const configPath = path.join(os.tmpdir(), `nuxt-doctor-oxlintrc-${process.pid}.json`);
  const pluginPath = resolvePluginPath();
  const config = createOxlintConfig({ pluginPath, framework, customRulesOnly });
  const restoreDisableDirectives = neutralizeDisableDirectives(rootDirectory, includePaths);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const oxlintBinary = resolveOxlintBinary();
    const baseArgs = [oxlintBinary, "-c", configPath, "--format", "json"];

    if (hasTypeScript) {
      baseArgs.push("--tsconfig", "./tsconfig.json");
    }

    const fileBatches =
      includePaths !== undefined ? batchIncludePaths(baseArgs, includePaths) : [["."]];

    const allDiagnostics: Diagnostic[] = [];
    for (const batch of fileBatches) {
      const batchArgs = [...baseArgs, ...batch];
      const stdout = await spawnOxlint(batchArgs, rootDirectory, nodeBinaryPath);
      allDiagnostics.push(...parseOxlintOutput(stdout));
    }

    return allDiagnostics;
  } finally {
    restoreDisableDirectives();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
};
