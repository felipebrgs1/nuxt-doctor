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
interface DiffInfo {
  currentBranch: string;
  baseBranch: string;
  changedFiles: string[];
  isCurrentChanges?: boolean;
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
//#region src/utils/get-diff-files.d.ts
declare const getDiffInfo: (directory: string, explicitBaseBranch?: string) => DiffInfo | null;
declare const filterSourceFiles: (filePaths: string[]) => string[];
//#endregion
//#region src/index.d.ts
interface DiagnoseOptions {
  lint?: boolean;
  deadCode?: boolean;
  includePaths?: string[];
}
interface DiagnoseResult {
  diagnostics: Diagnostic[];
  score: ScoreResult | null;
  project: ProjectInfo;
  elapsedMilliseconds: number;
}
declare const diagnose: (directory: string, options?: DiagnoseOptions) => Promise<DiagnoseResult>;
//#endregion
export { DiagnoseOptions, DiagnoseResult, type Diagnostic, type DiffInfo, type NuxtDoctorConfig, type ProjectInfo, type ScoreResult, diagnose, filterSourceFiles, getDiffInfo };
//# sourceMappingURL=index.d.ts.map