import { createRequire } from "node:module";
import path from "node:path";
import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { main } from "knip";
import { createOptions } from "knip/session";
import os from "node:os";
import { fileURLToPath } from "node:url";
//#region src/core/build-diagnose-result.ts
const buildDiagnoseResult = (params) => ({
	diagnostics: params.diagnostics,
	score: params.score,
	project: params.project,
	elapsedMilliseconds: params.elapsedMilliseconds
});
//#endregion
//#region src/utils/match-glob-pattern.ts
const REGEX_SPECIAL_CHARACTERS = /[.+^${}()|[\]\\]/g;
const compileGlobPattern = (pattern) => {
	const normalizedPattern = pattern.replace(/\\/g, "/").replace(/^\//, "");
	let regexSource = "^";
	let characterIndex = 0;
	while (characterIndex < normalizedPattern.length) if (normalizedPattern[characterIndex] === "*" && normalizedPattern[characterIndex + 1] === "*") if (normalizedPattern[characterIndex + 2] === "/") {
		regexSource += "(?:.+/)?";
		characterIndex += 3;
	} else {
		regexSource += ".*";
		characterIndex += 2;
	}
	else if (normalizedPattern[characterIndex] === "*") {
		regexSource += "[^/]*";
		characterIndex++;
	} else if (normalizedPattern[characterIndex] === "?") {
		regexSource += "[^/]";
		characterIndex++;
	} else {
		regexSource += normalizedPattern[characterIndex].replace(REGEX_SPECIAL_CHARACTERS, "\\$&");
		characterIndex++;
	}
	regexSource += "$";
	return new RegExp(regexSource);
};
//#endregion
//#region src/utils/is-ignored-file.ts
const toRelativePath = (filePath, rootDirectory) => {
	const normalizedFilePath = filePath.replace(/\\/g, "/");
	const normalizedRoot = rootDirectory.replace(/\\/g, "/").replace(/\/$/, "") + "/";
	if (normalizedFilePath.startsWith(normalizedRoot)) return normalizedFilePath.slice(normalizedRoot.length);
	return normalizedFilePath.replace(/^\.\//, "");
};
const compileIgnoredFilePatterns = (userConfig) => Array.isArray(userConfig?.ignore?.files) ? userConfig.ignore.files.map(compileGlobPattern) : [];
const isFileIgnoredByPatterns = (filePath, rootDirectory, patterns) => {
	if (patterns.length === 0) return false;
	const relativePath = toRelativePath(filePath, rootDirectory);
	return patterns.some((pattern) => pattern.test(relativePath));
};
//#endregion
//#region src/utils/filter-diagnostics.ts
const resolveCandidateReadPath = (rootDirectory, filePath) => {
	const normalizedFile = filePath.replace(/\\/g, "/");
	if (normalizedFile.startsWith("/") || /^[a-zA-Z]:\//.test(normalizedFile) || /^[a-zA-Z]:\\/.test(filePath)) return filePath;
	return `${rootDirectory.replace(/\\/g, "/").replace(/\/$/, "")}/${normalizedFile.replace(/^\.\//, "")}`;
};
const OPENING_TAG_PATTERN = /<([A-Z][\w.]*)/;
const DISABLE_NEXT_LINE_PATTERN = /\/\/\s*nuxt-doctor-disable-next-line\b(?:\s+(.+))?/;
const DISABLE_LINE_PATTERN = /\/\/\s*nuxt-doctor-disable-line\b(?:\s+(.+))?/;
const createFileLinesCache = (rootDirectory, readFileLinesSync) => {
	const cache = /* @__PURE__ */ new Map();
	return (filePath) => {
		const cached = cache.get(filePath);
		if (cached !== void 0) return cached;
		const lines = readFileLinesSync(resolveCandidateReadPath(rootDirectory, filePath));
		cache.set(filePath, lines);
		return lines;
	};
};
const isInsideTextComponent = (lines, diagnosticLine, textComponentNames) => {
	for (let lineIndex = diagnosticLine - 1; lineIndex >= 0; lineIndex--) {
		const match = lines[lineIndex].match(OPENING_TAG_PATTERN);
		if (!match) continue;
		const fullTagName = match[1];
		const leafTagName = fullTagName.includes(".") ? fullTagName.split(".").at(-1) ?? fullTagName : fullTagName;
		return textComponentNames.has(fullTagName) || textComponentNames.has(leafTagName);
	}
	return false;
};
const isRuleSuppressed = (commentRules, ruleId) => {
	if (!commentRules?.trim()) return true;
	return commentRules.split(/[,\s]+/).some((rule) => rule.trim() === ruleId);
};
const filterIgnoredDiagnostics = (diagnostics, config, rootDirectory, readFileLinesSync) => {
	const ignoredRules = new Set(Array.isArray(config.ignore?.rules) ? config.ignore.rules : []);
	const ignoredFilePatterns = compileIgnoredFilePatterns(config);
	const textComponentNames = new Set(Array.isArray(config.textComponents) ? config.textComponents : []);
	const hasTextComponents = textComponentNames.size > 0;
	const getFileLines = createFileLinesCache(rootDirectory, readFileLinesSync);
	return diagnostics.filter((diagnostic) => {
		const ruleIdentifier = `${diagnostic.plugin}/${diagnostic.rule}`;
		if (ignoredRules.has(ruleIdentifier)) return false;
		if (isFileIgnoredByPatterns(diagnostic.filePath, rootDirectory, ignoredFilePatterns)) return false;
		if (hasTextComponents && diagnostic.rule === "rn-no-raw-text" && diagnostic.line > 0) {
			const lines = getFileLines(diagnostic.filePath);
			if (lines && isInsideTextComponent(lines, diagnostic.line, textComponentNames)) return false;
		}
		return true;
	});
};
const filterInlineSuppressions = (diagnostics, rootDirectory, readFileLinesSync) => {
	const getFileLines = createFileLinesCache(rootDirectory, readFileLinesSync);
	return diagnostics.filter((diagnostic) => {
		if (diagnostic.line <= 0) return true;
		const lines = getFileLines(diagnostic.filePath);
		if (!lines) return true;
		const ruleId = `${diagnostic.plugin}/${diagnostic.rule}`;
		const currentLine = lines[diagnostic.line - 1];
		if (currentLine) {
			const lineMatch = currentLine.match(DISABLE_LINE_PATTERN);
			if (lineMatch && isRuleSuppressed(lineMatch[1], ruleId)) return false;
		}
		if (diagnostic.line >= 2) {
			const previousLine = lines[diagnostic.line - 2];
			if (previousLine) {
				const nextLineMatch = previousLine.match(DISABLE_NEXT_LINE_PATTERN);
				if (nextLineMatch && isRuleSuppressed(nextLineMatch[1], ruleId)) return false;
			}
		}
		return true;
	});
};
//#endregion
//#region src/utils/merge-and-filter-diagnostics.ts
const mergeAndFilterDiagnostics = (mergedDiagnostics, directory, userConfig, readFileLinesSync) => {
	return filterInlineSuppressions(userConfig ? filterIgnoredDiagnostics(mergedDiagnostics, userConfig, directory, readFileLinesSync) : mergedDiagnostics, directory, readFileLinesSync);
};
//#endregion
//#region src/core/build-result.ts
const buildDiagnoseTimedResult = async (input) => {
	const diagnostics = mergeAndFilterDiagnostics(input.mergedDiagnostics, input.rootDirectory, input.userConfig, input.readFileLinesSync);
	const elapsedMilliseconds = globalThis.performance.now() - input.startTime;
	return {
		diagnostics,
		score: input.score !== void 0 ? input.score : await input.calculateDiagnosticsScore(diagnostics),
		elapsedMilliseconds
	};
};
//#endregion
//#region src/constants.ts
const SOURCE_FILE_PATTERN = /\.(vue|tsx?|jsx?)$/;
const SCRIPT_FILE_PATTERN = /\.(tsx|jsx|ts|js)$/;
const SCORE_API_URL = "https://www.nuxt.doctor/api/score";
const FETCH_TIMEOUT_MS = 1e4;
const GIT_LS_FILES_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const DEFAULT_BRANCH_CANDIDATES = ["main", "master"];
const ERROR_RULE_PENALTY = 1.5;
const WARNING_RULE_PENALTY = .75;
const KNIP_CONFIG_LOCATIONS = [
	"knip.json",
	"knip.jsonc",
	".knip.json",
	".knip.jsonc",
	"knip.ts",
	"knip.js",
	"knip.config.ts",
	"knip.config.js"
];
const IGNORED_DIRECTORIES = new Set([
	"node_modules",
	"dist",
	"build",
	"coverage"
]);
//#endregion
//#region src/utils/jsx-include-paths.ts
const computeJsxIncludePaths = (includePaths) => includePaths.length > 0 ? includePaths.filter((filePath) => SCRIPT_FILE_PATTERN.test(filePath)) : void 0;
//#endregion
//#region src/core/diagnose-core.ts
const diagnoseCore = async (deps, options = {}) => {
	const { includePaths = [] } = options;
	const isDiffMode = includePaths.length > 0;
	const startTime = globalThis.performance.now();
	const resolvedDirectory = deps.rootDirectory;
	const projectInfo = deps.discoverProjectInfo();
	const userConfig = deps.loadUserConfig();
	const effectiveLint = options.lint ?? userConfig?.lint ?? true;
	const effectiveDeadCode = options.deadCode ?? userConfig?.deadCode ?? true;
	if (!projectInfo.vueVersion) throw new Error("No Vue dependency found in package.json");
	const lintIncludePaths = options.lintIncludePaths !== void 0 ? options.lintIncludePaths : computeJsxIncludePaths(includePaths);
	const { runLint, runDeadCode } = deps.createRunners({
		resolvedDirectory,
		projectInfo,
		userConfig,
		lintIncludePaths,
		isDiffMode
	});
	const emptyDiagnostics = [];
	const lintPromise = effectiveLint ? runLint().catch((error) => {
		console.error("Lint failed:", error);
		return emptyDiagnostics;
	}) : Promise.resolve(emptyDiagnostics);
	const deadCodePromise = effectiveDeadCode && !isDiffMode ? runDeadCode().catch((error) => {
		console.error("Dead code analysis failed:", error);
		return emptyDiagnostics;
	}) : Promise.resolve(emptyDiagnostics);
	const [lintDiagnostics, deadCodeDiagnostics] = await Promise.all([lintPromise, deadCodePromise]);
	const environmentDiagnostics = deps.getExtraDiagnostics?.() ?? [];
	const timed = await buildDiagnoseTimedResult({
		mergedDiagnostics: [
			...lintDiagnostics,
			...deadCodeDiagnostics,
			...environmentDiagnostics
		],
		rootDirectory: resolvedDirectory,
		userConfig,
		readFileLinesSync: deps.readFileLinesSync,
		startTime,
		calculateDiagnosticsScore: deps.calculateDiagnosticsScore
	});
	return buildDiagnoseResult({
		diagnostics: timed.diagnostics,
		score: timed.score,
		project: projectInfo,
		elapsedMilliseconds: timed.elapsedMilliseconds
	});
};
//#endregion
//#region src/plugin/constants.ts
const MOTION_LIBRARY_PACKAGES = new Set(["@vueuse/motion", "vueuse-motion"]);
//#endregion
//#region src/utils/is-file.ts
const isFile = (filePath) => {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
};
//#endregion
//#region src/utils/read-package-json.ts
const readPackageJson = (packageJsonPath) => {
	try {
		return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	} catch (error) {
		if (error instanceof SyntaxError) return {};
		if (error instanceof Error && "code" in error) {
			const { code } = error;
			if (code === "EISDIR" || code === "EACCES") return {};
		}
		throw error;
	}
};
//#endregion
//#region src/utils/check-reduced-motion.ts
const REDUCED_MOTION_GREP_PATTERN = "prefers-reduced-motion|useReducedMotion|MotionConfig|reducedMotion";
const REDUCED_MOTION_FILE_GLOBS = "\"*.ts\" \"*.tsx\" \"*.js\" \"*.jsx\" \"*.css\" \"*.scss\"";
const MISSING_REDUCED_MOTION_DIAGNOSTIC = {
	filePath: "package.json",
	plugin: "nuxt-doctor",
	rule: "require-reduced-motion",
	severity: "error",
	message: "Project uses a motion library but has no prefers-reduced-motion handling — required for accessibility (WCAG 2.3.3)",
	help: "Add `useReducedMotion()` from your animation library, or a `@media (prefers-reduced-motion: reduce)` CSS query",
	line: 0,
	column: 0,
	category: "Accessibility",
	weight: 2
};
const checkReducedMotion = (rootDirectory) => {
	const packageJsonPath = path.join(rootDirectory, "package.json");
	if (!isFile(packageJsonPath)) return [];
	let hasMotionLibrary = false;
	try {
		const packageJson = readPackageJson(packageJsonPath);
		const allDependencies = {
			...packageJson.dependencies,
			...packageJson.devDependencies
		};
		hasMotionLibrary = Object.keys(allDependencies).some((packageName) => MOTION_LIBRARY_PACKAGES.has(packageName));
	} catch {
		return [];
	}
	if (!hasMotionLibrary) return [];
	try {
		execSync(`git grep -ql -E "${REDUCED_MOTION_GREP_PATTERN}" -- ${REDUCED_MOTION_FILE_GLOBS}`, {
			cwd: rootDirectory,
			stdio: "pipe"
		});
		return [];
	} catch {
		return [MISSING_REDUCED_MOTION_DIAGNOSTIC];
	}
};
//#endregion
//#region src/utils/find-monorepo-root.ts
const isMonorepoRoot = (directory) => {
	if (isFile(path.join(directory, "pnpm-workspace.yaml"))) return true;
	if (isFile(path.join(directory, "nx.json"))) return true;
	const packageJsonPath = path.join(directory, "package.json");
	if (!isFile(packageJsonPath)) return false;
	const packageJson = readPackageJson(packageJsonPath);
	return Array.isArray(packageJson.workspaces) || Boolean(packageJson.workspaces?.packages);
};
const findMonorepoRoot = (startDirectory) => {
	let currentDirectory = path.dirname(startDirectory);
	while (currentDirectory !== path.dirname(currentDirectory)) {
		if (isMonorepoRoot(currentDirectory)) return currentDirectory;
		currentDirectory = path.dirname(currentDirectory);
	}
	return null;
};
//#endregion
//#region src/utils/is-plain-object.ts
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
//#endregion
//#region src/utils/discover-project.ts
const VUE_SFC_COMPILER_PACKAGES = new Set(["@vue/compiler-sfc"]);
const NUXT_CONFIG_FILENAMES = [
	"nuxt.config.ts",
	"nuxt.config.mjs",
	"nuxt.config.js",
	"nuxt.config.cjs"
];
const VITE_CONFIG_FILENAMES = [
	"vite.config.js",
	"vite.config.ts",
	"vite.config.mjs",
	"vite.config.cjs"
];
const FRAMEWORK_PACKAGES = {
	nuxt: "nuxt",
	vitepress: "vitepress",
	quasar: "quasar",
	"vite-plugin-vue": "vite",
	"@vue/compat": "vue",
	vue: "vue"
};
const countSourceFilesViaFilesystem = (rootDirectory) => {
	let count = 0;
	const stack = [rootDirectory];
	while (stack.length > 0) {
		const currentDirectory = stack.pop();
		const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!entry.name.startsWith(".") && !IGNORED_DIRECTORIES.has(entry.name)) stack.push(path.join(currentDirectory, entry.name));
				continue;
			}
			if (entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name)) count++;
		}
	}
	return count;
};
const countSourceFilesViaGit = (rootDirectory) => {
	const result = spawnSync("git", [
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard"
	], {
		cwd: rootDirectory,
		encoding: "utf-8",
		maxBuffer: GIT_LS_FILES_MAX_BUFFER_BYTES
	});
	if (result.error || result.status !== 0) return null;
	return result.stdout.split("\n").filter((filePath) => filePath.length > 0 && SOURCE_FILE_PATTERN.test(filePath)).length;
};
const countSourceFiles = (rootDirectory) => countSourceFilesViaGit(rootDirectory) ?? countSourceFilesViaFilesystem(rootDirectory);
const collectAllDependencies = (packageJson) => ({
	...packageJson.peerDependencies,
	...packageJson.dependencies,
	...packageJson.devDependencies
});
const detectFramework = (dependencies) => {
	for (const [packageName, frameworkName] of Object.entries(FRAMEWORK_PACKAGES)) if (dependencies[packageName]) return frameworkName;
	return "unknown";
};
const isCatalogReference = (version) => version.startsWith("catalog:");
const extractCatalogName = (version) => {
	if (!isCatalogReference(version)) return null;
	const name = version.slice(8).trim();
	return name.length > 0 ? name : null;
};
const resolveVersionFromCatalog = (catalog, packageName) => {
	const version = catalog[packageName];
	if (typeof version === "string" && !isCatalogReference(version)) return version;
	return null;
};
const parsePnpmWorkspaceCatalogs = (rootDirectory) => {
	const workspacePath = path.join(rootDirectory, "pnpm-workspace.yaml");
	if (!isFile(workspacePath)) return {
		defaultCatalog: {},
		namedCatalogs: {}
	};
	const content = fs.readFileSync(workspacePath, "utf-8");
	const defaultCatalog = {};
	const namedCatalogs = {};
	let currentSection = "none";
	let currentCatalogName = "";
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
		const indentLevel = line.search(/\S/);
		if (indentLevel === 0 && trimmed === "catalog:") {
			currentSection = "catalog";
			continue;
		}
		if (indentLevel === 0 && trimmed === "catalogs:") {
			currentSection = "catalogs";
			continue;
		}
		if (indentLevel === 0) {
			currentSection = "none";
			continue;
		}
		if (currentSection === "catalog" && indentLevel > 0) {
			const colonIndex = trimmed.indexOf(":");
			if (colonIndex > 0) {
				const key = trimmed.slice(0, colonIndex).trim().replace(/["']/g, "");
				const value = trimmed.slice(colonIndex + 1).trim().replace(/["']/g, "");
				if (key && value) defaultCatalog[key] = value;
			}
			continue;
		}
		if (currentSection === "catalogs" && indentLevel > 0) {
			if (trimmed.endsWith(":") && !trimmed.includes(" ")) {
				currentCatalogName = trimmed.slice(0, -1).replace(/["']/g, "");
				currentSection = "named-catalog";
				namedCatalogs[currentCatalogName] = {};
				continue;
			}
		}
		if (currentSection === "named-catalog" && indentLevel > 0) {
			if (indentLevel <= 2 && trimmed.endsWith(":") && !trimmed.includes(" ")) {
				currentCatalogName = trimmed.slice(0, -1).replace(/["']/g, "");
				namedCatalogs[currentCatalogName] = {};
				continue;
			}
			const colonIndex = trimmed.indexOf(":");
			if (colonIndex > 0 && currentCatalogName) {
				const key = trimmed.slice(0, colonIndex).trim().replace(/["']/g, "");
				const value = trimmed.slice(colonIndex + 1).trim().replace(/["']/g, "");
				if (key && value) namedCatalogs[currentCatalogName][key] = value;
			}
		}
	}
	return {
		defaultCatalog,
		namedCatalogs
	};
};
const resolveCatalogVersionFromCollection = (catalogs, packageName, catalogReference) => {
	if (catalogReference) {
		const namedCatalog = catalogs.namedCatalogs[catalogReference];
		if (namedCatalog?.[packageName]) return namedCatalog[packageName];
	}
	if (catalogs.defaultCatalog[packageName]) return catalogs.defaultCatalog[packageName];
	for (const namedCatalog of Object.values(catalogs.namedCatalogs)) if (namedCatalog[packageName]) return namedCatalog[packageName];
	return null;
};
const resolveCatalogVersion = (packageJson, packageName, rootDirectory) => {
	const rawVersion = collectAllDependencies(packageJson)[packageName];
	const catalogName = rawVersion ? extractCatalogName(rawVersion) : null;
	const raw = packageJson;
	if (isPlainObject(raw.catalog)) {
		const version = resolveVersionFromCatalog(raw.catalog, packageName);
		if (version) return version;
	}
	if (isPlainObject(raw.catalogs)) {
		if (catalogName && isPlainObject(raw.catalogs[catalogName])) {
			const version = resolveVersionFromCatalog(raw.catalogs[catalogName], packageName);
			if (version) return version;
		}
		for (const catalogEntries of Object.values(raw.catalogs)) if (isPlainObject(catalogEntries)) {
			const version = resolveVersionFromCatalog(catalogEntries, packageName);
			if (version) return version;
		}
	}
	const workspaces = packageJson.workspaces;
	if (workspaces && !Array.isArray(workspaces) && isPlainObject(workspaces.catalog)) {
		const version = resolveVersionFromCatalog(workspaces.catalog, packageName);
		if (version) return version;
	}
	if (rootDirectory) {
		const pnpmVersion = resolveCatalogVersionFromCollection(parsePnpmWorkspaceCatalogs(rootDirectory), packageName, catalogName);
		if (pnpmVersion) return pnpmVersion;
	}
	return null;
};
const extractDependencyInfo = (packageJson) => {
	const allDependencies = collectAllDependencies(packageJson);
	const rawVersion = allDependencies.vue ?? null;
	return {
		vueVersion: rawVersion && !isCatalogReference(rawVersion) ? rawVersion : null,
		framework: detectFramework(allDependencies)
	};
};
const parsePnpmWorkspacePatterns = (rootDirectory) => {
	const workspacePath = path.join(rootDirectory, "pnpm-workspace.yaml");
	if (!isFile(workspacePath)) return [];
	const content = fs.readFileSync(workspacePath, "utf-8");
	const patterns = [];
	let isInsidePackagesBlock = false;
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "packages:") {
			isInsidePackagesBlock = true;
			continue;
		}
		if (isInsidePackagesBlock && trimmed.startsWith("-")) patterns.push(trimmed.replace(/^-\s*/, "").replace(/["']/g, ""));
		else if (isInsidePackagesBlock && trimmed.length > 0 && !trimmed.startsWith("#")) isInsidePackagesBlock = false;
	}
	return patterns;
};
const getWorkspacePatterns = (rootDirectory, packageJson) => {
	const pnpmPatterns = parsePnpmWorkspacePatterns(rootDirectory);
	if (pnpmPatterns.length > 0) return pnpmPatterns;
	if (Array.isArray(packageJson.workspaces)) return packageJson.workspaces;
	if (packageJson.workspaces?.packages) return packageJson.workspaces.packages;
	return [];
};
const resolveWorkspaceDirectories = (rootDirectory, pattern) => {
	const cleanPattern = pattern.replace(/["']/g, "").replace(/\/\*\*$/, "/*");
	if (!cleanPattern.includes("*")) {
		const directoryPath = path.join(rootDirectory, cleanPattern);
		if (fs.existsSync(directoryPath) && isFile(path.join(directoryPath, "package.json"))) return [directoryPath];
		return [];
	}
	const wildcardIndex = cleanPattern.indexOf("*");
	const baseDirectory = path.join(rootDirectory, cleanPattern.slice(0, wildcardIndex));
	const suffixAfterWildcard = cleanPattern.slice(wildcardIndex + 1);
	if (!fs.existsSync(baseDirectory) || !fs.statSync(baseDirectory).isDirectory()) return [];
	return fs.readdirSync(baseDirectory).map((entry) => path.join(baseDirectory, entry, suffixAfterWildcard)).filter((entryPath) => fs.existsSync(entryPath) && fs.statSync(entryPath).isDirectory() && isFile(path.join(entryPath, "package.json")));
};
const findDependencyInfoFromMonorepoRoot = (directory) => {
	const monorepoRoot = findMonorepoRoot(directory);
	if (!monorepoRoot) return {
		vueVersion: null,
		framework: "unknown"
	};
	const monorepoPackageJsonPath = path.join(monorepoRoot, "package.json");
	if (!isFile(monorepoPackageJsonPath)) return {
		vueVersion: null,
		framework: "unknown"
	};
	const rootPackageJson = readPackageJson(monorepoPackageJsonPath);
	const rootInfo = extractDependencyInfo(rootPackageJson);
	const catalogVersion = resolveCatalogVersion(rootPackageJson, "vue", monorepoRoot);
	const workspaceInfo = findVueInWorkspaces(monorepoRoot, rootPackageJson);
	return {
		vueVersion: rootInfo.vueVersion ?? catalogVersion ?? workspaceInfo.vueVersion,
		framework: rootInfo.framework !== "unknown" ? rootInfo.framework : workspaceInfo.framework
	};
};
const findVueInWorkspaces = (rootDirectory, packageJson) => {
	const patterns = getWorkspacePatterns(rootDirectory, packageJson);
	const result = {
		vueVersion: null,
		framework: "unknown"
	};
	for (const pattern of patterns) {
		const directories = resolveWorkspaceDirectories(rootDirectory, pattern);
		for (const workspaceDirectory of directories) {
			const info = extractDependencyInfo(readPackageJson(path.join(workspaceDirectory, "package.json")));
			if (info.vueVersion && !result.vueVersion) result.vueVersion = info.vueVersion;
			if (info.framework !== "unknown" && result.framework === "unknown") result.framework = info.framework;
			if (result.vueVersion && result.framework !== "unknown") return result;
		}
	}
	return result;
};
const VUE_DEPENDENCY_NAMES = new Set([
	"vue",
	"nuxt",
	"vitepress",
	"quasar"
]);
const hasVueDependency = (packageJson) => {
	const allDependencies = collectAllDependencies(packageJson);
	return Object.keys(allDependencies).some((packageName) => VUE_DEPENDENCY_NAMES.has(packageName) || packageName.startsWith("@nuxt/"));
};
const hasCompilerPackage = (packageJson) => {
	const allDependencies = collectAllDependencies(packageJson);
	return Object.keys(allDependencies).some((packageName) => VUE_SFC_COMPILER_PACKAGES.has(packageName));
};
const hasCompilerInConfigFiles = (directory, filenames) => filenames.some((filename) => isFile(path.join(directory, filename)));
const detectVueSfcCompiler = (directory, packageJson) => {
	if (hasVueDependency(packageJson)) return true;
	if (hasCompilerPackage(packageJson)) return true;
	if (hasCompilerInConfigFiles(directory, NUXT_CONFIG_FILENAMES)) return true;
	if (hasCompilerInConfigFiles(directory, VITE_CONFIG_FILENAMES)) return true;
	let ancestorDirectory = path.dirname(directory);
	while (ancestorDirectory !== path.dirname(ancestorDirectory)) {
		const ancestorPackagePath = path.join(ancestorDirectory, "package.json");
		if (isFile(ancestorPackagePath)) {
			const ancestorPackageJson = readPackageJson(ancestorPackagePath);
			if (hasVueDependency(ancestorPackageJson)) return true;
			if (hasCompilerPackage(ancestorPackageJson)) return true;
		}
		ancestorDirectory = path.dirname(ancestorDirectory);
	}
	return false;
};
const discoverProject = (directory) => {
	const packageJsonPath = path.join(directory, "package.json");
	if (!isFile(packageJsonPath)) throw new Error(`No package.json found in ${directory}`);
	const packageJson = readPackageJson(packageJsonPath);
	let { vueVersion, framework } = extractDependencyInfo(packageJson);
	if (!vueVersion) vueVersion = resolveCatalogVersion(packageJson, "vue", directory);
	if (!vueVersion) {
		const monorepoRoot = findMonorepoRoot(directory);
		if (monorepoRoot) {
			const monorepoPackageJsonPath = path.join(monorepoRoot, "package.json");
			if (isFile(monorepoPackageJsonPath)) vueVersion = resolveCatalogVersion(readPackageJson(monorepoPackageJsonPath), "vue", monorepoRoot);
		}
	}
	if (!vueVersion || framework === "unknown") {
		const workspaceInfo = findVueInWorkspaces(directory, packageJson);
		if (!vueVersion && workspaceInfo.vueVersion) vueVersion = workspaceInfo.vueVersion;
		if (framework === "unknown" && workspaceInfo.framework !== "unknown") framework = workspaceInfo.framework;
	}
	if ((!vueVersion || framework === "unknown") && !isMonorepoRoot(directory)) {
		const monorepoInfo = findDependencyInfoFromMonorepoRoot(directory);
		if (!vueVersion) vueVersion = monorepoInfo.vueVersion;
		if (framework === "unknown") framework = monorepoInfo.framework;
	}
	const projectName = packageJson.name ?? path.basename(directory);
	const hasTypeScript = fs.existsSync(path.join(directory, "tsconfig.json"));
	const sourceFileCount = countSourceFiles(directory);
	const hasVueCompilerSfc = detectVueSfcCompiler(directory, packageJson);
	return {
		rootDirectory: directory,
		projectName,
		vueVersion,
		framework,
		hasTypeScript,
		hasVueCompilerSfc,
		sourceFileCount
	};
};
//#endregion
//#region src/utils/load-config.ts
const CONFIG_FILENAME = "nuxt-doctor.config.json";
const PACKAGE_JSON_CONFIG_KEY = "nuxtDoctor";
const loadConfigFromDirectory = (directory) => {
	const configFilePath = path.join(directory, CONFIG_FILENAME);
	if (isFile(configFilePath)) try {
		const fileContent = fs.readFileSync(configFilePath, "utf-8");
		const parsed = JSON.parse(fileContent);
		if (isPlainObject(parsed)) return parsed;
		console.warn(`Warning: ${CONFIG_FILENAME} must be a JSON object, ignoring.`);
	} catch (error) {
		console.warn(`Warning: Failed to parse ${CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`);
	}
	const packageJsonPath = path.join(directory, "package.json");
	if (isFile(packageJsonPath)) try {
		const fileContent = fs.readFileSync(packageJsonPath, "utf-8");
		const embeddedConfig = JSON.parse(fileContent)[PACKAGE_JSON_CONFIG_KEY];
		if (isPlainObject(embeddedConfig)) return embeddedConfig;
	} catch {
		return null;
	}
	return null;
};
const loadConfig = (rootDirectory) => {
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
//#endregion
//#region src/utils/read-file-lines-node.ts
const createNodeReadFileLinesSync = (rootDirectory) => {
	return (filePath) => {
		const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(rootDirectory, filePath);
		try {
			return fs.readFileSync(absolutePath, "utf-8").split("\n");
		} catch {
			return null;
		}
	};
};
//#endregion
//#region src/utils/resolve-lint-include-paths.ts
const listSourceFilesViaGit = (rootDirectory) => {
	const result = spawnSync("git", [
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard"
	], {
		cwd: rootDirectory,
		encoding: "utf-8",
		maxBuffer: GIT_LS_FILES_MAX_BUFFER_BYTES
	});
	if (result.error || result.status !== 0) return null;
	return result.stdout.split("\n").filter((filePath) => filePath.length > 0 && SOURCE_FILE_PATTERN.test(filePath));
};
const listSourceFilesViaFilesystem = (rootDirectory) => {
	const filePaths = [];
	const stack = [rootDirectory];
	while (stack.length > 0) {
		const currentDirectory = stack.pop();
		const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
		for (const entry of entries) {
			const absolutePath = path.join(currentDirectory, entry.name);
			if (entry.isDirectory()) {
				if (!entry.name.startsWith(".") && !IGNORED_DIRECTORIES.has(entry.name)) stack.push(absolutePath);
				continue;
			}
			if (entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name)) filePaths.push(path.relative(rootDirectory, absolutePath).replace(/\\/g, "/"));
		}
	}
	return filePaths;
};
const listSourceFiles = (rootDirectory) => listSourceFilesViaGit(rootDirectory) ?? listSourceFilesViaFilesystem(rootDirectory);
const resolveLintIncludePaths = (rootDirectory, userConfig) => {
	if (!Array.isArray(userConfig?.ignore?.files) || userConfig.ignore.files.length === 0) return;
	const ignoredPatterns = compileIgnoredFilePatterns(userConfig);
	return listSourceFiles(rootDirectory).filter((filePath) => {
		if (!SCRIPT_FILE_PATTERN.test(filePath)) return false;
		return !isFileIgnoredByPatterns(filePath, rootDirectory, ignoredPatterns);
	});
};
//#endregion
//#region src/core/calculate-score-locally.ts
const getScoreLabel = (score) => {
	if (score >= 75) return "Great";
	if (score >= 50) return "Needs work";
	return "Critical";
};
const countUniqueRules = (diagnostics) => {
	const errorRules = /* @__PURE__ */ new Set();
	const warningRules = /* @__PURE__ */ new Set();
	for (const diagnostic of diagnostics) {
		const ruleKey = `${diagnostic.plugin}/${diagnostic.rule}`;
		if (diagnostic.severity === "error") errorRules.add(ruleKey);
		else warningRules.add(ruleKey);
	}
	return {
		errorRuleCount: errorRules.size,
		warningRuleCount: warningRules.size
	};
};
const scoreFromRuleCounts = (errorRuleCount, warningRuleCount) => {
	const penalty = errorRuleCount * ERROR_RULE_PENALTY + warningRuleCount * WARNING_RULE_PENALTY;
	return Math.max(0, Math.round(100 - penalty));
};
const calculateScoreLocally = (diagnostics) => {
	const { errorRuleCount, warningRuleCount } = countUniqueRules(diagnostics);
	const score = scoreFromRuleCounts(errorRuleCount, warningRuleCount);
	return {
		score,
		label: getScoreLabel(score)
	};
};
//#endregion
//#region src/core/try-score-from-api.ts
const parseScoreResult = (value) => {
	if (typeof value !== "object" || value === null) return null;
	if (!("score" in value) || !("label" in value)) return null;
	const scoreValue = Reflect.get(value, "score");
	const labelValue = Reflect.get(value, "label");
	if (typeof scoreValue !== "number" || typeof labelValue !== "string") return null;
	return {
		score: scoreValue,
		label: labelValue
	};
};
const tryScoreFromApi = async (diagnostics, fetchImplementation) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetchImplementation(SCORE_API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ diagnostics }),
			signal: controller.signal
		});
		if (!response.ok) return null;
		return parseScoreResult(await response.json());
	} catch {
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
};
//#endregion
//#region src/utils/proxy-fetch.ts
const getGlobalProcess = () => {
	const candidate = globalThis.process;
	return candidate?.versions?.node ? candidate : void 0;
};
const readEnvProxy = () => {
	const proc = getGlobalProcess();
	if (!proc?.env) return void 0;
	return proc.env.HTTPS_PROXY ?? proc.env.https_proxy ?? proc.env.HTTP_PROXY ?? proc.env.http_proxy;
};
let isProxyUrlResolved = false;
let resolvedProxyUrl;
const getProxyUrl = () => {
	if (isProxyUrlResolved) return resolvedProxyUrl;
	isProxyUrlResolved = true;
	resolvedProxyUrl = readEnvProxy();
	return resolvedProxyUrl;
};
const createProxyDispatcher = async (proxyUrl) => {
	try {
		const { ProxyAgent } = await import("undici");
		return new ProxyAgent(proxyUrl);
	} catch {
		return null;
	}
};
const proxyFetch = async (url, init) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const proxyUrl = getProxyUrl();
		const dispatcher = proxyUrl ? await createProxyDispatcher(proxyUrl) : null;
		return await fetch(url, {
			...init,
			signal: controller.signal,
			...dispatcher ? { dispatcher } : {}
		});
	} finally {
		clearTimeout(timeoutId);
	}
};
//#endregion
//#region src/utils/calculate-score-node.ts
const calculateScore = async (diagnostics) => {
	const apiScore = await tryScoreFromApi(diagnostics, proxyFetch);
	if (apiScore) return apiScore;
	return calculateScoreLocally(diagnostics);
};
//#endregion
//#region src/utils/collect-unused-file-paths.ts
const collectUnusedFilePaths = (filesIssues) => {
	if (filesIssues instanceof Set) return [...filesIssues];
	if (Array.isArray(filesIssues)) return filesIssues.filter((entry) => typeof entry === "string");
	if (!isPlainObject(filesIssues)) return [];
	const unusedFilePaths = [];
	for (const innerValue of Object.values(filesIssues)) {
		if (!isPlainObject(innerValue)) continue;
		for (const issue of Object.values(innerValue)) if (isPlainObject(issue) && typeof issue.filePath === "string") unusedFilePaths.push(issue.filePath);
	}
	return unusedFilePaths;
};
//#endregion
//#region src/utils/format-error-chain.ts
const collectErrorChain = (rootError) => {
	const errorChain = [];
	const visitedErrors = /* @__PURE__ */ new Set();
	let currentError = rootError;
	while (currentError !== void 0 && !visitedErrors.has(currentError)) {
		visitedErrors.add(currentError);
		errorChain.push(currentError);
		currentError = currentError instanceof Error ? currentError.cause : void 0;
	}
	return errorChain;
};
const formatErrorMessage = (error) => error instanceof Error ? error.message || error.name : String(error);
const getErrorChainMessages = (rootError) => collectErrorChain(rootError).map(formatErrorMessage);
//#endregion
//#region src/utils/extract-failed-plugin-name.ts
const PLUGIN_CONFIG_PATTERN = /(?:^|[\/\\\s])([a-z][a-z0-9-]*)\.config\./i;
const extractFailedPluginName = (error) => {
	for (const errorMessage of getErrorChainMessages(error)) {
		const pluginNameMatch = errorMessage.match(PLUGIN_CONFIG_PATTERN);
		if (pluginNameMatch?.[1]) return pluginNameMatch[1].toLowerCase();
	}
	return null;
};
//#endregion
//#region src/utils/has-knip-config.ts
const hasKnipConfig = (directory) => KNIP_CONFIG_LOCATIONS.some((configFilename) => isFile(path.join(directory, configFilename)));
//#endregion
//#region src/utils/run-knip.ts
const KNIP_CATEGORY_MAP = {
	files: "Dead Code",
	exports: "Dead Code",
	types: "Dead Code",
	duplicates: "Dead Code"
};
const KNIP_MESSAGE_MAP = {
	files: "Unused file",
	exports: "Unused export",
	types: "Unused type",
	duplicates: "Duplicate export"
};
const KNIP_SEVERITY_MAP = {
	files: "warning",
	exports: "warning",
	types: "warning",
	duplicates: "warning"
};
const collectIssueRecords = (records, issueType, rootDirectory) => {
	const diagnostics = [];
	for (const issues of Object.values(records)) for (const issue of Object.values(issues)) diagnostics.push({
		filePath: path.relative(rootDirectory, issue.filePath),
		plugin: "knip",
		rule: issueType,
		severity: KNIP_SEVERITY_MAP[issueType] ?? "warning",
		message: `${KNIP_MESSAGE_MAP[issueType]}: ${issue.symbol}`,
		help: "",
		line: 0,
		column: 0,
		category: KNIP_CATEGORY_MAP[issueType] ?? "Dead Code",
		weight: 1
	});
	return diagnostics;
};
const silenced = async (fn) => {
	const originalLog = console.log;
	const originalInfo = console.info;
	const originalWarn = console.warn;
	const originalError = console.error;
	console.log = () => {};
	console.info = () => {};
	console.warn = () => {};
	console.error = () => {};
	try {
		return await fn();
	} finally {
		console.log = originalLog;
		console.info = originalInfo;
		console.warn = originalWarn;
		console.error = originalError;
	}
};
const TSCONFIG_FILENAMES = ["tsconfig.base.json", "tsconfig.json"];
const resolveTsConfigFile = (directory) => TSCONFIG_FILENAMES.find((filename) => fs.existsSync(path.join(directory, filename)));
const tryDisableFailedPlugin = (error, parsedConfig, disabledPlugins) => {
	const failedPlugin = extractFailedPluginName(error);
	if (!failedPlugin || !(failedPlugin in parsedConfig) || disabledPlugins.has(failedPlugin)) return false;
	disabledPlugins.add(failedPlugin);
	parsedConfig[failedPlugin] = false;
	return true;
};
const runKnipWithOptions = async (knipCwd, workspaceName) => {
	const tsConfigFile = resolveTsConfigFile(knipCwd);
	const options = await silenced(() => createOptions({
		cwd: knipCwd,
		isShowProgress: false,
		...workspaceName ? { workspace: workspaceName } : {},
		...tsConfigFile ? { tsConfigFile } : {}
	}));
	const parsedConfig = options.parsedConfig;
	const disabledPlugins = /* @__PURE__ */ new Set();
	let lastKnipError;
	for (let attempt = 0; attempt <= 5; attempt++) try {
		return await silenced(() => main(options));
	} catch (error) {
		lastKnipError = error;
		if (!tryDisableFailedPlugin(error, parsedConfig, disabledPlugins)) throw error;
	}
	throw lastKnipError;
};
const hasNodeModules = (directory) => {
	const nodeModulesPath = path.join(directory, "node_modules");
	return fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isDirectory();
};
const resolveWorkspaceName = (rootDirectory) => {
	const packageJsonPath = path.join(rootDirectory, "package.json");
	return (isFile(packageJsonPath) ? readPackageJson(packageJsonPath) : {}).name ?? path.basename(rootDirectory);
};
const runKnipForProject = async (rootDirectory, monorepoRoot) => {
	if (!monorepoRoot || hasKnipConfig(rootDirectory)) return runKnipWithOptions(rootDirectory);
	try {
		return await runKnipWithOptions(monorepoRoot, resolveWorkspaceName(rootDirectory));
	} catch {
		return runKnipWithOptions(rootDirectory);
	}
};
const runKnip = async (rootDirectory) => {
	const monorepoRoot = findMonorepoRoot(rootDirectory);
	if (!(hasNodeModules(rootDirectory) || monorepoRoot !== null && hasNodeModules(monorepoRoot))) return [];
	const { issues } = await runKnipForProject(rootDirectory, monorepoRoot);
	const diagnostics = [];
	for (const unusedFilePath of collectUnusedFilePaths(issues.files)) diagnostics.push({
		filePath: path.relative(rootDirectory, unusedFilePath),
		plugin: "knip",
		rule: "files",
		severity: KNIP_SEVERITY_MAP["files"],
		message: KNIP_MESSAGE_MAP["files"],
		help: "This file is not imported by any other file in the project.",
		line: 0,
		column: 0,
		category: KNIP_CATEGORY_MAP["files"],
		weight: 1
	});
	for (const issueType of [
		"exports",
		"types",
		"duplicates"
	]) diagnostics.push(...collectIssueRecords(issues[issueType], issueType, rootDirectory));
	return diagnostics;
};
//#endregion
//#region src/oxlint-config.ts
const NUXT_RULES = {
	"nuxt-doctor/no-async-data-side-effects": "error",
	"nuxt-doctor/no-sync-fetch-in-asyncdata": "error",
	"nuxt-doctor/no-duplicate-use-fetch": "warn",
	"nuxt-doctor/use-nuxt-link-for-internal-routes": "warn",
	"nuxt-doctor/use-nuxt-img": "warn",
	"nuxt-doctor/use-page-meta": "warn",
	"nuxt-doctor/no-global-style-in-component": "warn",
	"nuxt-doctor/no-use-fetch-without-key": "warn",
	"nuxt-doctor/no-middleware-in-component": "warn",
	"nuxt-doctor/no-raw-dollar-fetch": "warn",
	"nuxt-doctor/prefer-use-fetch-over-use-async-data": "warn"
};
const VUE_RULES = {
	"nuxt-doctor/vue-no-deprecated-v-bind-sync": "error",
	"nuxt-doctor/vue-prefer-composition-api": "warn",
	"nuxt-doctor/vue-no-deprecated-events-api": "warn",
	"nuxt-doctor/vue-no-deprecated-filter": "error"
};
const VITEPRESS_RULES = {
	"nuxt-doctor/vitepress-no-relative-img": "warn",
	"nuxt-doctor/vitepress-use-theme-config": "warn"
};
const QUASAR_RULES = {
	"nuxt-doctor/quasar-no-deprecated-props": "warn",
	"nuxt-doctor/quasar-prefer-vue3-patterns": "warn"
};
const BUILTIN_VUE_RULES = {
	"vue/valid-v-model": "error",
	"vue/no-mutating-props": "error",
	"vue/no-side-effects-in-computed-properties": "error",
	"vue/require-v-for-key": "error",
	"vue/require-valid-default-prop": "warn",
	"vue/no-useless-template-keys": "warn",
	"vue/no-duplicate-attr-inheritance": "warn",
	"vue/no-parsing-error": "error",
	"vue/no-reserved-component-names": "error",
	"vue/no-unused-components": "warn",
	"vue/no-unused-vars": "warn",
	"vue/return-in-computed-property": "error",
	"vue/no-template-shadow": "warn",
	"vue/no-multiple-template-root": "warn",
	"vue/valid-template-root": "error",
	"vue/valid-v-bind": "error",
	"vue/valid-v-if": "error",
	"vue/valid-v-else-if": "error",
	"vue/valid-v-else": "error",
	"vue/valid-v-for": "error",
	"vue/valid-v-on": "error",
	"vue/valid-v-slot": "error",
	"vue/valid-v-show": "error",
	"vue/valid-v-text": "error",
	"vue/valid-v-html": "error",
	"vue/valid-v-pre": "error",
	"vue/valid-v-cloak": "error",
	"vue/valid-v-once": "error",
	"vue/valid-v-memo": "warn",
	"vue/no-ref-as-operand": "error",
	"vue/require-explicit-emits": "warn",
	"vue/require-prop-types": "warn",
	"vue/require-prop-type-constructor": "warn",
	"vue/no-arrow-functions-in-watch": "warn",
	"vue/no-setup-props-destructure": "warn",
	"vue/no-lifecycle-after-await": "error",
	"vue/no-watch-after-await": "error",
	"vue/no-v-text-v-html-on-component": "warn",
	"vue/prop-name-casing": "warn",
	"vue/custom-event-name-casing": "warn",
	"vue/attributes-order": "warn",
	"vue/component-tags-order": "warn",
	"vue/padding-line-between-blocks": "warn",
	"vue/no-unused-refs": "warn",
	"vue/no-useless-v-bind": "warn",
	"vue/no-useless-mustaches": "warn",
	"vue/no-lone-template": "warn",
	"vue/no-restricted-block": "warn",
	"vue/no-child-content": "warn",
	"vue/no-potential-component-option-typo": "warn",
	"vue/no-ref-object-destructure": "warn",
	"vue/no-required-prop-with-default": "warn",
	"vue/no-template-target-blank": "warn",
	"vue/no-this-in-before-route-enter": "error",
	"vue/require-component-is": "warn"
};
const A11Y_RULES = {
	"jsx-a11y/alt-text": "error",
	"jsx-a11y/anchor-is-valid": "warn",
	"jsx-a11y/click-events-have-key-events": "warn",
	"jsx-a11y/no-static-element-interactions": "warn",
	"jsx-a11y/role-has-required-aria-props": "error",
	"jsx-a11y/no-autofocus": "warn",
	"jsx-a11y/heading-has-content": "warn",
	"jsx-a11y/html-has-lang": "warn",
	"jsx-a11y/no-redundant-roles": "warn",
	"jsx-a11y/scope": "warn",
	"jsx-a11y/tabindex-no-positive": "warn",
	"jsx-a11y/label-has-associated-control": "warn",
	"jsx-a11y/no-distracting-elements": "error",
	"jsx-a11y/iframe-has-title": "warn"
};
const createOxlintConfig = ({ pluginPath, framework, customRulesOnly = false }) => ({
	categories: {
		correctness: "off",
		suspicious: "off",
		pedantic: "off",
		perf: "off",
		restriction: "off",
		style: "off",
		nursery: "off"
	},
	plugins: [
		"vue",
		"jsx-a11y",
		"import"
	],
	jsPlugins: [pluginPath],
	rules: {
		...customRulesOnly ? {} : BUILTIN_VUE_RULES,
		...customRulesOnly ? {} : A11Y_RULES,
		"nuxt-doctor/no-derived-state-effect": "error",
		"nuxt-doctor/no-fetch-in-effect": "error",
		"nuxt-doctor/no-cascading-set-state": "warn",
		"nuxt-doctor/no-effect-event-handler": "warn",
		"nuxt-doctor/no-derived-ref": "warn",
		"nuxt-doctor/prefer-computed": "warn",
		"nuxt-doctor/rerender-lazy-state-init": "warn",
		"nuxt-doctor/rerender-dependencies": "error",
		"nuxt-doctor/no-giant-component": "warn",
		"nuxt-doctor/no-render-in-render": "warn",
		"nuxt-doctor/no-nested-component-definition": "error",
		"nuxt-doctor/no-secrets-in-client-code": "error",
		"nuxt-doctor/js-flatmap-filter": "warn",
		"nuxt-doctor/no-barrel-import": "warn",
		"nuxt-doctor/no-moment": "warn",
		"nuxt-doctor/prefer-dynamic-import": "warn",
		"nuxt-doctor/use-lazy-motion": "warn",
		"nuxt-doctor/no-undeferred-third-party": "warn",
		"nuxt-doctor/no-array-index-as-key": "warn",
		"nuxt-doctor/rendering-conditional-render": "warn",
		"nuxt-doctor/no-prevent-default": "warn",
		"nuxt-doctor/server-auth-actions": "error",
		"nuxt-doctor/server-after-nonblocking": "warn",
		"nuxt-doctor/client-passive-event-listeners": "warn",
		"nuxt-doctor/no-transition-all": "warn",
		"nuxt-doctor/no-global-css-variable-animation": "error",
		"nuxt-doctor/no-large-animated-blur": "warn",
		"nuxt-doctor/no-scale-from-zero": "warn",
		"nuxt-doctor/no-permanent-will-change": "warn",
		"nuxt-doctor/no-inline-bounce-easing": "warn",
		"nuxt-doctor/no-z-index-9999": "warn",
		"nuxt-doctor/no-inline-exhaustive-style": "warn",
		"nuxt-doctor/no-side-tab-border": "warn",
		"nuxt-doctor/no-pure-black-background": "warn",
		"nuxt-doctor/no-gradient-text": "warn",
		"nuxt-doctor/no-dark-mode-glow": "warn",
		"nuxt-doctor/no-justified-text": "warn",
		"nuxt-doctor/no-tiny-text": "warn",
		"nuxt-doctor/no-wide-letter-spacing": "warn",
		"nuxt-doctor/no-gray-on-colored-background": "warn",
		"nuxt-doctor/no-layout-transition-inline": "warn",
		"nuxt-doctor/no-disabled-zoom": "error",
		"nuxt-doctor/no-outline-none": "warn",
		"nuxt-doctor/no-long-transition-duration": "warn",
		"nuxt-doctor/async-parallel": "warn",
		"nuxt-doctor/no-duplicate-storage-read": "warn",
		"nuxt-doctor/no-sequential-await": "warn",
		...framework === "nuxt" ? NUXT_RULES : {},
		...framework === "vue" ? VUE_RULES : {},
		...framework === "vitepress" ? VITEPRESS_RULES : {},
		...framework === "quasar" ? QUASAR_RULES : {}
	}
});
//#endregion
//#region src/utils/neutralize-disable-directives.ts
const findFilesWithDisableDirectives = (rootDirectory, includePaths) => {
	const grepArgs = [
		"grep",
		"-l",
		"--untracked",
		"-E",
		"(eslint|oxlint)-disable"
	];
	if (includePaths && includePaths.length > 0) grepArgs.push("--", ...includePaths);
	const result = spawnSync("git", grepArgs, {
		cwd: rootDirectory,
		encoding: "utf-8",
		maxBuffer: GIT_LS_FILES_MAX_BUFFER_BYTES
	});
	if (result.error || result.status === null) return [];
	if (result.status !== 0 && result.stdout.trim().length === 0) return [];
	return result.stdout.split("\n").filter((filePath) => filePath.length > 0 && SOURCE_FILE_PATTERN.test(filePath));
};
const neutralizeContent = (content) => content.replaceAll("eslint-disable", "eslint_disable").replaceAll("oxlint-disable", "oxlint_disable");
const neutralizeDisableDirectives = (rootDirectory, includePaths) => {
	const filePaths = findFilesWithDisableDirectives(rootDirectory, includePaths);
	const originalContents = /* @__PURE__ */ new Map();
	for (const relativePath of filePaths) {
		const absolutePath = path.join(rootDirectory, relativePath);
		let originalContent;
		try {
			originalContent = fs.readFileSync(absolutePath, "utf-8");
		} catch {
			continue;
		}
		const neutralizedContent = neutralizeContent(originalContent);
		if (neutralizedContent !== originalContent) {
			originalContents.set(absolutePath, originalContent);
			fs.writeFileSync(absolutePath, neutralizedContent);
		}
	}
	return () => {
		for (const [absolutePath, originalContent] of originalContents) fs.writeFileSync(absolutePath, originalContent);
	};
};
//#endregion
//#region src/utils/run-oxlint.ts
const esmRequire = createRequire(import.meta.url);
const PLUGIN_CATEGORY_MAP = {
	vue: "Vue Best Practices",
	"jsx-a11y": "Accessibility",
	import: "Correctness"
};
const RULE_CATEGORY_MAP = {
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
	"nuxt-doctor/quasar-prefer-vue3-patterns": "Vue Best Practices"
};
const RULE_HELP_MAP = {
	"no-derived-state-effect": "For derived state, compute inline in `<script setup>` or use `computed()`: `const total = computed(() => items.value.length)`. See https://vuejs.org/guide/essentials/computed.html",
	"no-fetch-in-effect": "Use `useFetch()` or `useAsyncData()` from Nuxt, or fetch with top-level await in `<script setup>`. Avoid `watchEffect` or `onMounted` for data fetching",
	"no-cascading-set-state": "Combine related state into a single reactive object or use `computed()` for derived values. Avoid chains of watchers updating each other",
	"no-effect-event-handler": "Move the conditional logic directly into the event handler (`@click`, `@submit`) instead of using `watch` or `watchEffect`",
	"no-derived-ref": "Use `computed()` instead of manually creating a `ref()` and updating it via `watch()`. `computed()` is reactive, lazy, and dependency-tracked",
	"prefer-computed": "Replace `watch` + ref assignment with a single `computed()` — it updates automatically and caches until dependencies change",
	"rerender-lazy-state-init": "Wrap expensive reactive initialisation in a lazy function or use `shallowRef()` for large objects — Vue's `ref()` is lazy by default for deeply nested data",
	"rerender-dependencies": "Ensure all reactive dependencies are explicitly referenced in the `computed()` or `watch()` callback. Use `watch(() => [a, b], ...)` for multiple sources",
	"no-giant-component": "Extract logical sections into focused components: `<UserHeader />`, `<UserActions />`, `<UserProfile />`, etc.",
	"no-render-in-render": "Extract to a named component: `const MyListItem = defineComponent({ ... })` or a separate SFC file",
	"no-nested-component-definition": "Move to a separate `.vue` file or to module scope above the parent component. Nested definitions break hot-module reloading and hurt readability",
	"no-secrets-in-client-code": "Move secrets to `process.env.SECRET_NAME` or Nuxt `runtimeConfig`. Only `NUXT_PUBLIC_*` vars are safe for the client (and must never contain secrets)",
	"js-flatmap-filter": "Use `.flatMap(item => condition ? [value] : [])` — transforms and filters in a single pass instead of creating an intermediate array",
	"no-barrel-import": "Import from the direct path: `import { Button } from './components/Button'` instead of `./components`",
	"no-moment": "Replace with `import { format } from 'date-fns'` (tree-shakeable) or `import dayjs from 'dayjs'` (2kb)",
	"prefer-dynamic-import": "Use `defineAsyncComponent(() => import('library'))` from Vue or dynamic imports with `import()` syntax — reduces initial bundle size",
	"use-lazy-motion": "Use `import { LazyMotion, m } from 'framer-motion'` with `domAnimation` features — saves ~30kb",
	"no-undeferred-third-party": "Use `ClientOnly` component in Nuxt or add the `defer` attribute for non-critical third-party scripts",
	"no-array-index-as-key": "Use a stable unique identifier: `key={item.id}` or `key={item.slug}` — index keys break on reorder/filter",
	"rendering-conditional-render": "Use `v-if=\"items.length > 0\"` for conditional rendering in Vue templates instead of computed booleans",
	"no-prevent-default": "Use Nuxt's built-in form handling or `<form @submit.prevent=\"handler\">` instead of manual `preventDefault` calls",
	"server-auth-actions": "Add `const session = await auth()` at the top of server routes and throw/redirect if unauthorized before any data access",
	"server-after-nonblocking": "Use `import { after } from 'nitro'` then wrap: `after(() => analytics.track(...))` — response isn't blocked",
	"client-passive-event-listeners": "Add `{ passive: true }` as the third argument: `addEventListener('scroll', handler, { passive: true })`",
	"no-transition-all": "List specific properties: `transition: \"opacity 200ms, transform 200ms\"` — or in Tailwind use `transition-colors`, `transition-opacity`, or `transition-transform`",
	"no-global-css-variable-animation": "Set the variable on the nearest element instead of a parent, or use `@property` with `inherits: false` to prevent cascade. Better yet, use targeted `element.style.transform` updates",
	"no-large-animated-blur": "Keep blur radius under 10px, or apply blur to a smaller element. Large blurs multiply GPU memory usage with layer size",
	"no-scale-from-zero": "Use a visible starting scale such as `0.95` — elements should deflate like a balloon, not vanish into a point",
	"no-permanent-will-change": "Add `will-change` on interaction start and remove on end. Permanent promotion wastes GPU memory and can degrade performance",
	"no-inline-bounce-easing": "Use `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for natural deceleration — objects in the real world don't bounce",
	"no-z-index-9999": "Define a z-index scale in your design tokens (e.g. dropdown: 10, modal: 20, toast: 30). Create a new stacking context with `isolation: isolate` instead of escalating values",
	"no-inline-exhaustive-style": "Move styles to a CSS class, CSS module, Scoped style block, or Tailwind utilities — inline objects with many properties hurt readability",
	"no-side-tab-border": "Use a subtler accent (box-shadow inset, background gradient, or border-bottom) instead of a thick one-sided border",
	"no-pure-black-background": "Tint the background slightly toward your brand hue — e.g. `#0a0a0f` or Tailwind's `bg-gray-950`. Pure black looks harsh on modern displays",
	"no-gradient-text": "Use solid text colors for readability. If you need emphasis, use font weight, size, or a distinct color instead of gradients",
	"no-dark-mode-glow": "Use a subtle `box-shadow` with neutral colors for depth, or `border` with low opacity. Colored glows on dark backgrounds are the default AI-generated aesthetic",
	"no-justified-text": "Use `text-align: left` for body text, or add `hyphens: auto` and `overflow-wrap: break-word` if you must justify",
	"no-tiny-text": "Use at least 12px for body content, 16px is ideal. Small text is hard to read, especially on high-DPI mobile screens",
	"no-wide-letter-spacing": "Reserve wide tracking (letter-spacing > 0.05em) for short uppercase labels, navigation items, and buttons — not body text",
	"no-gray-on-colored-background": "Use a darker shade of the background color for text, or white/near-white for contrast. Gray text on colored backgrounds looks washed out",
	"no-layout-transition-inline": "Use `transform` and `opacity` for transitions — they run on the compositor thread. For height animations, use `grid-template-rows: 0fr → 1fr`",
	"no-disabled-zoom": "Remove `user-scalable=no` and `maximum-scale` from the viewport meta tag. If your layout breaks at 200% zoom, fix the layout — don't punish users with disabilities",
	"no-outline-none": "Use `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }` to show focus only for keyboard users while hiding it for mouse clicks",
	"no-long-transition-duration": "Keep UI transitions under 1s — 100-150ms for instant feedback, 200-300ms for state changes, 300-500ms for layout changes. Use longer durations only for page-load hero animations",
	"async-parallel": "Use `const [a, b] = await Promise.all([fetchA(), fetchB()])` to run independent operations concurrently",
	"no-duplicate-storage-read": "Read `localStorage`/`sessionStorage` once into a reactive variable instead of reading it multiple times across different functions",
	"no-sequential-await": "Use `Promise.all()` for independent async operations: `const [a, b] = await Promise.all([fnA(), fnB()])`",
	"no-async-data-side-effects": "Avoid side effects (mutating external state) inside `useAsyncData` or `useFetch` callbacks — keep them pure and use the returned data ref",
	"no-sync-fetch-in-asyncdata": "Use `useFetch()` or `useAsyncData()` with `await` instead of synchronous fetches inside `asyncData` — they integrate with Nuxt's SSR hydration",
	"no-duplicate-use-fetch": "Reuse fetched data via `useNuxtData()` or `useFetch` with the same key, or lift the fetch to a parent component. Duplicate fetches waste bandwidth and slow hydration",
	"use-nuxt-link-for-internal-routes": "Replace `<a href=\"/about\">` with `<NuxtLink to=\"/about\">` — enables prefetching, client-side navigation, and preserves scroll position",
	"use-nuxt-img": "Replace `<img>` with `<NuxtImg>` — provides automatic WebP/AVIF, lazy loading, responsive srcset, and cloud provider optimization",
	"use-page-meta": "Use `definePageMeta({ title: '...', description: '...' })` in page components for SEO metadata instead of `useHead` in each component",
	"no-global-style-in-component": "Move global styles to `app.vue` or a `assets/css/main.css` file. Component scoped styles should use `<style scoped>` to avoid leaking",
	"no-use-fetch-without-key": "Provide a unique key as the first argument to `useFetch('/api/data', { key: 'unique-key' })` — enables deduplication and cache control",
	"no-middleware-in-component": "Define route middleware in the `middleware/` directory instead of inline in components. Middleware should be declarative and route-scoped",
	"no-raw-dollar-fetch": "Use `useFetch()` or `$fetch()` from Nuxt instead of raw `fetch()` — they handle base URL, cookies, headers, and error handling consistently",
	"prefer-use-fetch-over-use-async-data": "Use `useFetch()` instead of `useAsyncData()` + `$fetch()` — it's a convenience wrapper that reduces boilerplate and handles typing better",
	"vue-no-deprecated-v-bind-sync": "Replace `v-bind:prop.sync=\"value\"` with `v-model:prop=\"value\"` — the `.sync` modifier was removed in Vue 3",
	"vue-prefer-composition-api": "Migrate from Options API to Composition API (`<script setup>`) — better TypeScript inference, improved tree-shaking, and more reusable logic",
	"vue-no-deprecated-events-api": "Replace `$on`, `$once`, and `$off` with component-emitted events or a third-party event bus — these instance methods were removed in Vue 3",
	"vue-no-deprecated-filter": "Replace Vue 2 filters with computed properties or method calls — filters were removed in Vue 3",
	"vitepress-no-relative-img": "Use the public directory or absolute paths for images in VitePress — relative image paths may break during SSR or in production builds",
	"vitepress-use-theme-config": "Use `defineConfigWithTheme()` and the theme config object for site customisation instead of manual theme overrides",
	"quasar-no-deprecated-props": "Check the Quasar migration guide for upgraded prop names — deprecated props may be removed in future Quasar versions",
	"quasar-prefer-vue3-patterns": "Use Quasar v2+ patterns with Composition API and `<script setup>` — Quasar v1 Options API patterns are deprecated"
};
const FILEPATH_WITH_LOCATION_PATTERN = /\S+\.\w+:\d+:\d+[\s\S]*$/;
const cleanDiagnosticMessage = (message, help, plugin, rule) => {
	return {
		message: message.replace(FILEPATH_WITH_LOCATION_PATTERN, "").trim() || message,
		help: help || RULE_HELP_MAP[rule] || ""
	};
};
const parseRuleCode = (code) => {
	const match = code.match(/^(.+)\((.+)\)$/);
	if (!match) return {
		plugin: "unknown",
		rule: code
	};
	return {
		plugin: match[1].replace(/^eslint-plugin-/, ""),
		rule: match[2]
	};
};
const resolveOxlintBinary = () => {
	const oxlintMainPath = esmRequire.resolve("oxlint");
	const oxlintPackageDirectory = path.resolve(path.dirname(oxlintMainPath), "..");
	return path.join(oxlintPackageDirectory, "bin", "oxlint");
};
const resolvePluginPath = () => {
	const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
	const pluginPath = path.join(currentDirectory, "nuxt-doctor-plugin.js");
	if (fs.existsSync(pluginPath)) return pluginPath;
	const distPluginPath = path.resolve(currentDirectory, "../../dist/nuxt-doctor-plugin.js");
	if (fs.existsSync(distPluginPath)) return distPluginPath;
	return pluginPath;
};
const resolveDiagnosticCategory = (plugin, rule) => {
	return RULE_CATEGORY_MAP[`${plugin}/${rule}`] ?? PLUGIN_CATEGORY_MAP[plugin] ?? "Other";
};
const estimateArgsLength = (args) => args.reduce((total, argument) => total + argument.length + 1, 0);
const batchIncludePaths = (baseArgs, includePaths) => {
	const baseArgsLength = estimateArgsLength(baseArgs);
	const batches = [];
	let currentBatch = [];
	let currentBatchLength = baseArgsLength;
	for (const filePath of includePaths) {
		const entryLength = filePath.length + 1;
		const exceedsArgLength = currentBatch.length > 0 && currentBatchLength + entryLength > 24e3;
		const exceedsFileCount = currentBatch.length >= 500;
		if (exceedsArgLength || exceedsFileCount) {
			batches.push(currentBatch);
			currentBatch = [];
			currentBatchLength = baseArgsLength;
		}
		currentBatch.push(filePath);
		currentBatchLength += entryLength;
	}
	if (currentBatch.length > 0) batches.push(currentBatch);
	return batches;
};
const spawnOxlint = (args, rootDirectory, nodeBinaryPath) => new Promise((resolve, reject) => {
	const child = spawn(nodeBinaryPath, args, { cwd: rootDirectory });
	const stdoutBuffers = [];
	const stderrBuffers = [];
	child.stdout.on("data", (buffer) => stdoutBuffers.push(buffer));
	child.stderr.on("data", (buffer) => stderrBuffers.push(buffer));
	child.on("error", (error) => reject(/* @__PURE__ */ new Error(`Failed to run oxlint: ${error.message}`)));
	child.on("close", (code, signal) => {
		if (signal) {
			const stderrOutput = Buffer.concat(stderrBuffers).toString("utf-8").trim();
			const hint = signal === "SIGABRT" ? " (out of memory — try scanning fewer files with --diff)" : "";
			const detail = stderrOutput ? `: ${stderrOutput}` : "";
			reject(/* @__PURE__ */ new Error(`oxlint was killed by ${signal}${hint}${detail}`));
			return;
		}
		const output = Buffer.concat(stdoutBuffers).toString("utf-8").trim();
		if (!output) {
			const stderrOutput = Buffer.concat(stderrBuffers).toString("utf-8").trim();
			if (stderrOutput) {
				reject(/* @__PURE__ */ new Error(`Failed to run oxlint: ${stderrOutput}`));
				return;
			}
		}
		resolve(output);
	});
});
const parseOxlintOutput = (stdout) => {
	if (!stdout) return [];
	let output;
	try {
		output = JSON.parse(stdout);
	} catch {
		throw new Error(`Failed to parse oxlint output: ${stdout.slice(0, 200)}`);
	}
	return output.diagnostics.filter((diagnostic) => diagnostic.code && SOURCE_FILE_PATTERN.test(diagnostic.filename)).map((diagnostic) => {
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
			category: resolveDiagnosticCategory(plugin, rule)
		};
	});
};
const runOxlint = async (rootDirectory, hasTypeScript, framework, includePaths, nodeBinaryPath = process.execPath, customRulesOnly = false) => {
	if (includePaths !== void 0 && includePaths.length === 0) return [];
	const configPath = path.join(os.tmpdir(), `nuxt-doctor-oxlintrc-${process.pid}.json`);
	const config = createOxlintConfig({
		pluginPath: resolvePluginPath(),
		framework,
		customRulesOnly
	});
	const restoreDisableDirectives = neutralizeDisableDirectives(rootDirectory, includePaths);
	try {
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		const baseArgs = [
			resolveOxlintBinary(),
			"-c",
			configPath,
			"--format",
			"json"
		];
		if (hasTypeScript) baseArgs.push("--tsconfig", "./tsconfig.json");
		const fileBatches = includePaths !== void 0 ? batchIncludePaths(baseArgs, includePaths) : [["."]];
		const allDiagnostics = [];
		for (const batch of fileBatches) {
			const stdout = await spawnOxlint([...baseArgs, ...batch], rootDirectory, nodeBinaryPath);
			allDiagnostics.push(...parseOxlintOutput(stdout));
		}
		return allDiagnostics;
	} finally {
		restoreDisableDirectives();
		if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
	}
};
//#endregion
//#region src/utils/get-diff-files.ts
const getCurrentBranch = (directory) => {
	try {
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd: directory,
			stdio: "pipe"
		}).toString().trim();
		return branch === "HEAD" ? null : branch;
	} catch {
		return null;
	}
};
const detectDefaultBranch = (directory) => {
	try {
		return execSync("git symbolic-ref refs/remotes/origin/HEAD", {
			cwd: directory,
			stdio: "pipe"
		}).toString().trim().replace("refs/remotes/origin/", "");
	} catch {
		for (const candidate of DEFAULT_BRANCH_CANDIDATES) try {
			execSync(`git rev-parse --verify ${candidate}`, {
				cwd: directory,
				stdio: "pipe"
			});
			return candidate;
		} catch {}
		return null;
	}
};
const getChangedFilesSinceBranch = (directory, baseBranch) => {
	try {
		const output = execSync(`git diff --name-only --diff-filter=ACMR --relative ${execSync(`git merge-base ${baseBranch} HEAD`, {
			cwd: directory,
			stdio: "pipe"
		}).toString().trim()}`, {
			cwd: directory,
			stdio: "pipe"
		}).toString().trim();
		if (!output) return [];
		return output.split("\n").filter(Boolean);
	} catch {
		return [];
	}
};
const getUncommittedChangedFiles = (directory) => {
	try {
		const output = execSync("git diff --name-only --diff-filter=ACMR --relative HEAD", {
			cwd: directory,
			stdio: "pipe"
		}).toString().trim();
		if (!output) return [];
		return output.split("\n").filter(Boolean);
	} catch {
		return [];
	}
};
const getDiffInfo = (directory, explicitBaseBranch) => {
	const currentBranch = getCurrentBranch(directory);
	if (!currentBranch) return null;
	const baseBranch = explicitBaseBranch ?? detectDefaultBranch(directory);
	if (!baseBranch) return null;
	if (currentBranch === baseBranch) {
		const uncommittedFiles = getUncommittedChangedFiles(directory);
		if (uncommittedFiles.length === 0) return null;
		return {
			currentBranch,
			baseBranch,
			changedFiles: uncommittedFiles,
			isCurrentChanges: true
		};
	}
	return {
		currentBranch,
		baseBranch,
		changedFiles: getChangedFilesSinceBranch(directory, baseBranch)
	};
};
const filterSourceFiles = (filePaths) => filePaths.filter((filePath) => SOURCE_FILE_PATTERN.test(filePath));
//#endregion
//#region src/index.ts
const diagnose = async (directory, options = {}) => {
	const resolvedDirectory = path.resolve(directory);
	const userConfig = loadConfig(resolvedDirectory);
	const includePaths = options.includePaths ?? [];
	const isDiffMode = includePaths.length > 0;
	const lintIncludePaths = computeJsxIncludePaths(includePaths) ?? resolveLintIncludePaths(resolvedDirectory, userConfig);
	return diagnoseCore({
		rootDirectory: resolvedDirectory,
		readFileLinesSync: createNodeReadFileLinesSync(resolvedDirectory),
		loadUserConfig: () => userConfig,
		discoverProjectInfo: () => discoverProject(resolvedDirectory),
		calculateDiagnosticsScore: calculateScore,
		getExtraDiagnostics: () => isDiffMode ? [] : checkReducedMotion(resolvedDirectory),
		createRunners: ({ resolvedDirectory: projectRoot, projectInfo, userConfig: config }) => ({
			runLint: () => runOxlint(projectRoot, projectInfo.hasTypeScript, projectInfo.framework, false, lintIncludePaths, void 0, config?.customRulesOnly ?? false),
			runDeadCode: () => runKnip(projectRoot)
		})
	}, {
		...options,
		lintIncludePaths
	});
};
//#endregion
export { diagnose, filterSourceFiles, getDiffInfo };

//# sourceMappingURL=index.js.map