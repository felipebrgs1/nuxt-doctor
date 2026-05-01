# Nuxt Doctor

Let coding agents diagnose and fix your Vue / Nuxt code.

One command scans your codebase for security, performance, correctness, and architecture issues, then outputs a **0–100 score** with actionable diagnostics.

## How it works

Nuxt Doctor detects your framework (Nuxt, Vue, VitePress, Quasar, etc.), Vue version, and SFC compiler setup, then runs two analysis passes **in parallel**:

1. **Lint**: Checks 60+ rules across architecture, bundle size, correctness, design, JS performance, security, and framework-specific categories (Nuxt, Vue). Rules are toggled automatically based on your project setup.
2. **Dead code**: Detects unused files, exports, types, and duplicates.

Diagnostics are filtered through your config, then scored by severity (errors weigh more than warnings) to produce a **0–100 health score** (75+ Great, 50–74 Needs work, <50 Critical).

## Install

Run this at your project root:

```bash
npx github:felipeb/nuxt-doctor .
```

Use `--verbose` to see affected files and line numbers:

```bash
npx github:felipeb/nuxt-doctor . --verbose
```

## Options

```
Usage: nuxt-doctor [directory] [options]

Options:
  -v, --version     display the version number
  --no-lint         skip linting
  --no-dead-code    skip dead code detection
  --verbose         show file details per rule
  --score           output only the score
  -y, --yes         skip prompts, scan all workspace projects
  --project <name>  select workspace project (comma-separated for multiple)
  --diff [base]     scan only files changed vs base branch
  --offline         skip telemetry (anonymous, not stored, only used to calculate score)
  --staged          scan only staged (git index) files for pre-commit hooks
  --fail-on <level> exit with error code on diagnostics: error, warning, none
  --annotations     output diagnostics as GitHub Actions annotations
  -h, --help        display help for command
```

Commands:
  install           install the nuxt-doctor skill into your coding agents

## Configuration

Create a `nuxt-doctor.config.json` in your project root to customize behavior:

```json
{
  "ignore": {
    "rules": ["nuxt/no-danger", "knip/exports"],
    "files": ["src/generated/**"]
  }
}
```

You can also use the `"nuxtDoctor"` key in your `package.json`:

```json
{
  "nuxtDoctor": {
    "ignore": { "rules": ["nuxt/no-danger"] }
  }
}
```

## Node.js API

```js
import { diagnose } from "nuxt-doctor/api";

const result = await diagnose("./path/to/your/vue-project");

console.log(result.score);        // { score: 82, label: "Good" }
console.log(result.diagnostics);  // Array of Diagnostic objects
console.log(result.project);      // { vueVersion, framework, hasTypeScript, ... }
```

## Contributing

```bash
git clone https://github.com/felipeb/nuxt-doctor
cd nuxt-doctor
pnpm install
pnpm -r run build
```

Run locally:

```bash
node packages/nuxt-doctor/dist/cli.js /path/to/your/vue-project
```

### License

MIT
