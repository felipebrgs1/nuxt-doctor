import fs from "node:fs";
import path from "node:path";
import type { NuxtDoctorConfig } from "../types.js";
import { isFile } from "./is-file.js";
import { isPlainObject } from "./is-plain-object.js";

const CONFIG_FILENAME = "nuxt-doctor.config.json";
const PACKAGE_JSON_CONFIG_KEY = "nuxtDoctor";

const loadConfigFromDirectory = (directory: string): NuxtDoctorConfig | null => {
  const configFilePath = path.join(directory, CONFIG_FILENAME);

  if (isFile(configFilePath)) {
    try {
      const fileContent = fs.readFileSync(configFilePath, "utf-8");
      const parsed: unknown = JSON.parse(fileContent);
      if (isPlainObject(parsed)) {
        return parsed as NuxtDoctorConfig;
      }
      console.warn(`Warning: ${CONFIG_FILENAME} must be a JSON object, ignoring.`);
    } catch (error) {
      console.warn(
        `Warning: Failed to parse ${CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const packageJsonPath = path.join(directory, "package.json");
  if (isFile(packageJsonPath)) {
    try {
      const fileContent = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(fileContent);
      const embeddedConfig = packageJson[PACKAGE_JSON_CONFIG_KEY];
      if (isPlainObject(embeddedConfig)) {
        return embeddedConfig as NuxtDoctorConfig;
      }
    } catch {
      return null;
    }
  }

  return null;
};

export const loadConfig = (rootDirectory: string): NuxtDoctorConfig | null => {
  const localConfig = loadConfigFromDirectory(rootDirectory);
  if (localConfig) return localConfig;

  let ancestorDirectory = path.dirname(rootDirectory);
  while (ancestorDirectory !== path.dirname(ancestorDirectory)) {
    const ancestorConfig = loadConfigFromDirectory(ancestorDirectory);
    if (ancestorConfig) return ancestorConfig;
    ancestorDirectory = path.dirname(ancestorDirectory);
  }

  return null;
};
