import type { Diagnostic, NuxtDoctorConfig } from "../types.js";
import { filterIgnoredDiagnostics, filterInlineSuppressions } from "./filter-diagnostics.js";

export const mergeAndFilterDiagnostics = (
  mergedDiagnostics: Diagnostic[],
  directory: string,
  userConfig: NuxtDoctorConfig | null,
  readFileLinesSync: (filePath: string) => string[] | null,
): Diagnostic[] => {
  const filtered = userConfig
    ? filterIgnoredDiagnostics(mergedDiagnostics, userConfig, directory, readFileLinesSync)
    : mergedDiagnostics;
  return filterInlineSuppressions(filtered, directory, readFileLinesSync);
};
