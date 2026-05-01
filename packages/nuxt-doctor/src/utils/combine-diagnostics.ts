import type { Diagnostic, NuxtDoctorConfig } from "../types.js";
import { createNodeReadFileLinesSync } from "./read-file-lines-node.js";
import { mergeAndFilterDiagnostics } from "./merge-and-filter-diagnostics.js";

export { computeJsxIncludePaths } from "./jsx-include-paths.js";

export const combineDiagnostics = (
  lintDiagnostics: Diagnostic[],
  deadCodeDiagnostics: Diagnostic[],
  directory: string,
  isDiffMode: boolean,
  userConfig: NuxtDoctorConfig | null,
  readFileLinesSync: (filePath: string) => string[] | null = createNodeReadFileLinesSync(directory),
): Diagnostic[] => {
  const merged = [...lintDiagnostics, ...deadCodeDiagnostics];
  return mergeAndFilterDiagnostics(merged, directory, userConfig, readFileLinesSync);
};
