//#region src/types.d.ts
type FailOnLevel = "error" | "warning" | "none";
type Framework = "nuxt" | "vue" | "vite" | "vitepress" | "quasar" | "unknown";
interface ProjectInfo {
  rootDirectory: string;
  projectName: string;
  vueVersion: string | null;
  framework: Framework;
  hasTypeScript: boolean;
  hasVueCompilerSfc: boolean;
  sourceFileCount: number;
}
interface Diagnostic {
  filePath: string;
  plugin: string;
  rule: string;
  severity: "error" | "warning";
  message: string;
  help: string;
  line: number;
  column: number;
  category: string;
  weight?: number;
}
interface ScoreResult {
  score: number;
  label: string;
}
interface NuxtDoctorIgnoreConfig {
  rules?: string[];
  files?: string[];
}
interface NuxtDoctorConfig {
  ignore?: NuxtDoctorIgnoreConfig;
  lint?: boolean;
  deadCode?: boolean;
  verbose?: boolean;
  diff?: boolean | string;
  failOn?: FailOnLevel;
  customRulesOnly?: boolean;
  share?: boolean;
}
//#endregion
//#region src/core/calculate-score-locally.d.ts
declare const calculateScoreLocally: (diagnostics: Diagnostic[]) => ScoreResult;
//#endregion
//#region src/utils/calculate-score-browser.d.ts
declare const calculateScore: (diagnostics: Diagnostic[]) => Promise<ScoreResult | null>;
//#endregion
//#region src/adapters/browser/diagnose.d.ts
interface BrowserDiagnoseInput {
  rootDirectory: string;
  project: ProjectInfo;
  projectFiles: Record<string, string>;
  lintDiagnostics: Diagnostic[];
  deadCodeDiagnostics?: Diagnostic[];
  userConfig?: NuxtDoctorConfig | null;
  score?: ScoreResult | null;
}
interface BrowserDiagnoseResult {
  diagnostics: Diagnostic[];
  score: ScoreResult | null;
  project: ProjectInfo;
  elapsedMilliseconds: number;
}
declare const diagnose: (input: BrowserDiagnoseInput) => Promise<BrowserDiagnoseResult>;
//#endregion
//#region src/core/diagnose-core.d.ts
interface DiagnoseCoreOptions {
  lint?: boolean;
  deadCode?: boolean;
  includePaths?: string[];
  lintIncludePaths?: string[] | undefined;
}
interface DiagnoseCoreResult {
  diagnostics: Diagnostic[];
  score: ScoreResult | null;
  project: ProjectInfo;
  elapsedMilliseconds: number;
}
interface DiagnoseRunnerContext {
  resolvedDirectory: string;
  projectInfo: ProjectInfo;
  userConfig: NuxtDoctorConfig | null;
  lintIncludePaths: string[] | undefined;
  isDiffMode: boolean;
}
interface DiagnoseCoreDeps {
  rootDirectory: string;
  readFileLinesSync: (filePath: string) => string[] | null;
  loadUserConfig: () => NuxtDoctorConfig | null;
  discoverProjectInfo: () => ProjectInfo;
  calculateDiagnosticsScore: (diagnostics: Diagnostic[]) => Promise<ScoreResult | null>;
  getExtraDiagnostics?: () => Diagnostic[];
  createRunners: (context: DiagnoseRunnerContext) => {
    runLint: () => Promise<Diagnostic[]>;
    runDeadCode: () => Promise<Diagnostic[]>;
  };
}
declare const diagnoseCore: (deps: DiagnoseCoreDeps, options?: DiagnoseCoreOptions) => Promise<DiagnoseCoreResult>;
//#endregion
//#region src/adapters/browser/process-browser-diagnostics.d.ts
interface ProcessBrowserDiagnosticsInput {
  rootDirectory: string;
  projectFiles: Record<string, string>;
  diagnostics: Diagnostic[];
  userConfig?: NuxtDoctorConfig | null;
  score?: ScoreResult | null;
}
interface ProcessBrowserDiagnosticsResult {
  diagnostics: Diagnostic[];
  score: ScoreResult | null;
}
declare const processBrowserDiagnostics: (input: ProcessBrowserDiagnosticsInput) => Promise<ProcessBrowserDiagnosticsResult>;
//#endregion
//#region src/adapters/browser/diagnose-browser.d.ts
interface DiagnoseBrowserInput {
  rootDirectory: string;
  project: ProjectInfo;
  projectFiles: Record<string, string>;
  userConfig?: NuxtDoctorConfig | null;
  runOxlint: (input: {
    lintIncludePaths: string[] | undefined;
    customRulesOnly: boolean;
  }) => Promise<Diagnostic[]>;
}
declare const diagnoseBrowser: (input: DiagnoseBrowserInput, options?: DiagnoseCoreOptions) => Promise<DiagnoseCoreResult>;
//#endregion
export { ScoreResult as _, processBrowserDiagnostics as a, diagnoseCore as c, diagnose as d, calculateScore as f, ProjectInfo as g, NuxtDoctorConfig as h, ProcessBrowserDiagnosticsResult as i, BrowserDiagnoseInput as l, Diagnostic as m, diagnoseBrowser as n, DiagnoseCoreOptions as o, calculateScoreLocally as p, ProcessBrowserDiagnosticsInput as r, DiagnoseCoreResult as s, DiagnoseBrowserInput as t, BrowserDiagnoseResult as u };
//# sourceMappingURL=diagnose-browser-BBFZPyET.d.ts.map