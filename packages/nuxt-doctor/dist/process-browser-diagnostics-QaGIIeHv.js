//#region src/constants.ts
const SCRIPT_FILE_PATTERN = /\.(tsx|jsx|ts|js)$/;
const SCORE_API_URL = "https://www.nuxt.doctor/api/score";
const FETCH_TIMEOUT_MS = 1e4;
const ERROR_RULE_PENALTY = 1.5;
const WARNING_RULE_PENALTY = .75;
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
//#region src/utils/calculate-score-browser.ts
const calculateScore = async (diagnostics) => await tryScoreFromApi(diagnostics, fetch) ?? calculateScoreLocally(diagnostics);
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
//#region src/adapters/browser/create-browser-read-file-lines.ts
const normalizeKey = (rootDirectory, filePath) => {
	const normalizedRoot = rootDirectory.replace(/\\/g, "/").replace(/\/$/, "");
	const normalizedPath = filePath.replace(/\\/g, "/");
	if (normalizedPath.startsWith(normalizedRoot + "/")) return normalizedPath.slice(normalizedRoot.length + 1);
	return normalizedPath.replace(/^\.\//, "");
};
const createBrowserReadFileLinesSync = (rootDirectory, projectFiles) => {
	return (absoluteOrRelativePath) => {
		const content = projectFiles[normalizeKey(rootDirectory, absoluteOrRelativePath)];
		if (content === void 0) return null;
		return content.split("\n");
	};
};
//#endregion
//#region src/adapters/browser/diagnose.ts
const diagnose = async (input) => {
	if (!input.project.vueVersion) throw new Error("No Vue dependency found in package.json");
	const readFileLinesSync = createBrowserReadFileLinesSync(input.rootDirectory, input.projectFiles);
	const userConfig = input.userConfig ?? null;
	const deadCodeDiagnostics = input.deadCodeDiagnostics ?? [];
	const mergedDiagnostics = [...input.lintDiagnostics, ...deadCodeDiagnostics];
	const startTime = globalThis.performance.now();
	const timed = await buildDiagnoseTimedResult({
		mergedDiagnostics,
		rootDirectory: input.rootDirectory,
		userConfig,
		readFileLinesSync,
		startTime,
		score: input.score,
		calculateDiagnosticsScore: calculateScore
	});
	return {
		diagnostics: timed.diagnostics,
		score: timed.score,
		project: input.project,
		elapsedMilliseconds: timed.elapsedMilliseconds
	};
};
//#endregion
//#region src/core/build-diagnose-result.ts
const buildDiagnoseResult = (params) => ({
	diagnostics: params.diagnostics,
	score: params.score,
	project: params.project,
	elapsedMilliseconds: params.elapsedMilliseconds
});
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
//#region src/adapters/browser/diagnose-browser.ts
const diagnoseBrowser = async (input, options = {}) => {
	const readFileLinesSync = createBrowserReadFileLinesSync(input.rootDirectory, input.projectFiles);
	return diagnoseCore({
		rootDirectory: input.rootDirectory,
		readFileLinesSync,
		loadUserConfig: () => input.userConfig ?? null,
		discoverProjectInfo: () => input.project,
		calculateDiagnosticsScore: calculateScore,
		createRunners: ({ lintIncludePaths, userConfig }) => ({
			runLint: () => input.runOxlint({
				lintIncludePaths,
				customRulesOnly: userConfig?.customRulesOnly ?? false
			}),
			runDeadCode: async () => []
		})
	}, options);
};
//#endregion
//#region src/adapters/browser/process-browser-diagnostics.ts
const processBrowserDiagnostics = async (input) => {
	const readFileLinesSync = createBrowserReadFileLinesSync(input.rootDirectory, input.projectFiles);
	const userConfig = input.userConfig ?? null;
	const timed = await buildDiagnoseTimedResult({
		mergedDiagnostics: input.diagnostics,
		rootDirectory: input.rootDirectory,
		userConfig,
		readFileLinesSync,
		startTime: globalThis.performance.now(),
		score: input.score,
		calculateDiagnosticsScore: calculateScore
	});
	return {
		diagnostics: timed.diagnostics,
		score: timed.score
	};
};
//#endregion
export { calculateScore as a, diagnose as i, diagnoseBrowser as n, calculateScoreLocally as o, diagnoseCore as r, processBrowserDiagnostics as t };

//# sourceMappingURL=process-browser-diagnostics-QaGIIeHv.js.map