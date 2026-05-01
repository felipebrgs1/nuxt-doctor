//#region src/plugin/constants.ts
const HEAVY_LIBRARIES = new Set([
	"@monaco-editor/react",
	"monaco-editor",
	"recharts",
	"@react-pdf/renderer",
	"vue-quill",
	"@codemirror/view",
	"@codemirror/state",
	"chart.js",
	"vue-chartjs",
	"@toast-ui/editor",
	"draft-js"
]);
const INDEX_PARAMETER_NAMES = new Set([
	"index",
	"idx",
	"i"
]);
const BARREL_INDEX_SUFFIXES = [
	"/index",
	"/index.js",
	"/index.ts",
	"/index.tsx",
	"/index.mjs"
];
const LOOP_TYPES = [
	"ForStatement",
	"ForInStatement",
	"ForOfStatement",
	"WhileStatement",
	"DoWhileStatement"
];
const SECRET_PATTERNS = [
	/^sk_live_/,
	/^sk_test_/,
	/^AKIA[0-9A-Z]{16}$/,
	/^ghp_[a-zA-Z0-9]{36}$/,
	/^gho_[a-zA-Z0-9]{36}$/,
	/^github_pat_/,
	/^glpat-/,
	/^xox[bporas]-/,
	/^sk-[a-zA-Z0-9]{32,}$/
];
const SECRET_VARIABLE_PATTERN = /(?:api_?key|secret|token|password|credential|auth)/i;
const SECRET_FALSE_POSITIVE_SUFFIXES = new Set([
	"modal",
	"label",
	"text",
	"title",
	"name",
	"id",
	"key",
	"url",
	"path",
	"route",
	"page",
	"param",
	"field",
	"column",
	"header",
	"placeholder",
	"description",
	"type",
	"icon",
	"class",
	"style",
	"variant",
	"event",
	"action",
	"status",
	"state",
	"mode",
	"flag",
	"option",
	"config",
	"message",
	"error",
	"display",
	"view",
	"component",
	"element",
	"container",
	"wrapper",
	"button",
	"link",
	"input",
	"select",
	"dialog",
	"menu",
	"form",
	"step",
	"index",
	"count",
	"length",
	"role",
	"scope",
	"context",
	"provider",
	"ref",
	"handler",
	"query",
	"schema",
	"constant"
]);
const PAGE_FILE_PATTERN = /\/pages\//;
const VUE_LIFECYCLE_HOOKS = new Set([
	"onMounted",
	"onUnmounted",
	"onBeforeMount",
	"onBeforeUnmount",
	"onUpdated",
	"onBeforeUpdate",
	"onActivated",
	"onDeactivated",
	"onErrorCaptured",
	"onRenderTracked",
	"onRenderTriggered"
]);
const VUE_WATCH_HOOKS = new Set(["watch", "watchEffect"]);
const VUE_COMPOSABLES = new Set([
	"ref",
	"reactive",
	"computed",
	"shallowRef",
	"shallowReactive",
	"toRef",
	"toRefs",
	"readonly",
	"shallowReadonly",
	"provide",
	"inject",
	"useAttrs",
	"useSlots",
	"useCssModule",
	"useCssVars",
	"useTemplateRef"
]);
const CHAINABLE_ITERATION_METHODS = new Set([
	"map",
	"filter",
	"forEach",
	"flatMap"
]);
const STORAGE_OBJECTS = new Set(["localStorage", "sessionStorage"]);
const GENERIC_EVENT_SUFFIXES = new Set([
	"Click",
	"Change",
	"Input",
	"Blur",
	"Focus"
]);
const RENDER_FUNCTION_PATTERN = /^render[A-Z]/;
const SETTER_PATTERN = /^set[A-Z]/;
const UPPERCASE_PATTERN = /^[A-Z]/;
const TEST_FILE_PATTERN = /\.(?:test|spec|stories)\.[tj]sx?$/;
const NUXT_IMG_COMPONENT = "NuxtImg";
const NUXT_LINK_COMPONENT = "NuxtLink";
const LONG_TRANSITION_DURATION_THRESHOLD_MS = 1e3;
const BOUNCE_ANIMATION_NAMES = new Set([
	"bounce",
	"elastic",
	"wobble",
	"jiggle",
	"spring"
]);
const MOTION_LIBRARY_PACKAGES = new Set(["@vueuse/motion", "vueuse-motion"]);
//#endregion
//#region src/plugin/helpers.ts
const walkAst = (node, visitor) => {
	if (!node || typeof node !== "object") return;
	visitor(node);
	for (const key of Object.keys(node)) {
		if (key === "parent") continue;
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child) if (item && typeof item === "object" && item.type) walkAst(item, visitor);
		} else if (child && typeof child === "object" && child.type) walkAst(child, visitor);
	}
};
const isUppercaseName = (name) => UPPERCASE_PATTERN.test(name);
const isMemberProperty = (node, propertyName) => node.type === "MemberExpression" && node.property?.type === "Identifier" && node.property.name === propertyName;
const getEffectCallback = (node) => {
	if (!node.arguments?.length) return null;
	const callback = node.arguments[0];
	if (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression") return callback;
	return null;
};
const isComponentDeclaration = (node) => node.type === "FunctionDeclaration" && Boolean(node.id?.name) && isUppercaseName(node.id.name);
const isComponentAssignment = (node) => node.type === "VariableDeclarator" && node.id?.type === "Identifier" && isUppercaseName(node.id.name) && Boolean(node.init) && (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression");
const getCalleeName = (node) => {
	if (node.callee?.type === "Identifier") return node.callee.name;
	if (node.callee?.type === "MemberExpression" && node.callee.property?.type === "Identifier") return node.callee.property.name;
	return null;
};
const isHookCall = (node, hookName) => {
	if (node.type !== "CallExpression") return false;
	const calleeName = getCalleeName(node);
	if (!calleeName) return false;
	return typeof hookName === "string" ? calleeName === hookName : hookName.has(calleeName);
};
const findJsxAttribute = (attributes, attributeName) => attributes?.find((attr) => attr.type === "JSXAttribute" && attr.name?.type === "JSXIdentifier" && attr.name.name === attributeName);
const hasJsxAttribute = (attributes, attributeName) => Boolean(findJsxAttribute(attributes, attributeName));
const createLoopAwareVisitors = (innerVisitors) => {
	let loopDepth = 0;
	const incrementLoopDepth = () => {
		loopDepth++;
	};
	const decrementLoopDepth = () => {
		loopDepth--;
	};
	const visitors = {};
	for (const loopType of LOOP_TYPES) {
		visitors[loopType] = incrementLoopDepth;
		visitors[`${loopType}:exit`] = decrementLoopDepth;
	}
	for (const [nodeType, handler] of Object.entries(innerVisitors)) visitors[nodeType] = (node) => {
		if (loopDepth > 0) handler(node);
	};
	return visitors;
};
const findSideEffect = (node) => {
	let sideEffect = null;
	walkAst(node, (child) => {
		if (sideEffect) return;
		if (child.type === "CallExpression" && child.callee?.type === "Identifier") {
			const name = child.callee.name;
			if (name === "fetch" || name === "$fetch") sideEffect = name;
		}
		if (child.type === "AssignmentExpression" && child.left?.type === "MemberExpression") {
			if ((child.left.object?.type === "Identifier" ? child.left.object.name : null) === "process" && child.left.property?.type === "Identifier" && child.left.property.name === "env") sideEffect = "process.env mutation";
		}
	});
	return sideEffect;
};
//#endregion
//#region src/plugin/rules/architecture.ts
const noGenericHandlerNames = { create: (context) => ({ JSXAttribute(node) {
	if (node.name?.type !== "JSXIdentifier" || !node.name.name.startsWith("on")) return;
	if (!node.value || node.value.type !== "JSXExpressionContainer") return;
	const eventSuffix = node.name.name.slice(2);
	if (!GENERIC_EVENT_SUFFIXES.has(eventSuffix)) return;
	const mirroredHandlerName = `handle${eventSuffix}`;
	const expression = node.value.expression;
	if (expression?.type === "Identifier" && expression.name === mirroredHandlerName) context.report({
		node,
		message: `Non-descriptive handler name "${expression.name}" — name should describe what it does, not when it runs`
	});
} }) };
const noGiantComponent = { create: (context) => {
	const reportOversizedComponent = (nameNode, componentName, bodyNode) => {
		if (!bodyNode.loc) return;
		const lineCount = bodyNode.loc.end.line - bodyNode.loc.start.line + 1;
		if (lineCount > 300) context.report({
			node: nameNode,
			message: `Component "${componentName}" is ${lineCount} lines — consider breaking it into smaller focused components`
		});
	};
	return {
		FunctionDeclaration(node) {
			if (!node.id?.name || !isUppercaseName(node.id.name)) return;
			reportOversizedComponent(node.id, node.id.name, node);
		},
		VariableDeclarator(node) {
			if (!isComponentAssignment(node)) return;
			reportOversizedComponent(node.id, node.id.name, node.init);
		}
	};
} };
const noRenderInRender = { create: (context) => ({ JSXExpressionContainer(node) {
	const expression = node.expression;
	if (expression?.type !== "CallExpression") return;
	let calleeName = null;
	if (expression.callee?.type === "Identifier") calleeName = expression.callee.name;
	else if (expression.callee?.type === "MemberExpression" && expression.callee.property?.type === "Identifier") calleeName = expression.callee.property.name;
	if (calleeName && RENDER_FUNCTION_PATTERN.test(calleeName)) context.report({
		node: expression,
		message: `Inline render function "${calleeName}()" — extract to a separate component for proper reconciliation`
	});
} }) };
const noNestedComponentDefinition = { create: (context) => {
	const componentStack = [];
	return {
		FunctionDeclaration(node) {
			if (!isComponentDeclaration(node)) return;
			if (componentStack.length > 0) context.report({
				node: node.id,
				message: `Component "${node.id.name}" defined inside "${componentStack[componentStack.length - 1]}" — creates new instance every render, destroying state`
			});
			componentStack.push(node.id.name);
		},
		"FunctionDeclaration:exit"(node) {
			if (isComponentDeclaration(node)) componentStack.pop();
		},
		VariableDeclarator(node) {
			if (!isComponentAssignment(node)) return;
			if (componentStack.length > 0) context.report({
				node: node.id,
				message: `Component "${node.id.name}" defined inside "${componentStack[componentStack.length - 1]}" — creates new instance every render, destroying state`
			});
			componentStack.push(node.id.name);
		},
		"VariableDeclarator:exit"(node) {
			if (isComponentAssignment(node)) componentStack.pop();
		}
	};
} };
//#endregion
//#region src/plugin/rules/bundle-size.ts
const noBarrelImport = { create: (context) => {
	let didReportForFile = false;
	return { ImportDeclaration(node) {
		if (didReportForFile) return;
		const source = node.source?.value;
		if (typeof source !== "string" || !source.startsWith(".")) return;
		if (BARREL_INDEX_SUFFIXES.some((suffix) => source.endsWith(suffix))) {
			didReportForFile = true;
			context.report({
				node,
				message: "Import from barrel/index file — import directly from the source module for better tree-shaking"
			});
		}
	} };
} };
const noFullLodashImport = { create: (context) => ({ ImportDeclaration(node) {
	const source = node.source?.value;
	if (source === "lodash" || source === "lodash-es") context.report({
		node,
		message: "Importing entire lodash library — import from 'lodash/functionName' instead"
	});
} }) };
const noMoment = { create: (context) => ({ ImportDeclaration(node) {
	if (node.source?.value === "moment") context.report({
		node,
		message: "moment.js is 300kb+ — use \"date-fns\" or \"dayjs\" instead"
	});
} }) };
const preferDynamicImport = { create: (context) => ({ ImportDeclaration(node) {
	const source = node.source?.value;
	if (typeof source === "string" && HEAVY_LIBRARIES.has(source)) context.report({
		node,
		message: `"${source}" is a heavy library — use lazy loading for code splitting`
	});
} }) };
const useLazyMotion = { create: (context) => ({ ImportDeclaration(node) {
	const source = node.source?.value;
	if (typeof source !== "string" || !MOTION_LIBRARY_PACKAGES.has(source)) return;
	context.report({
		node,
		message: `"${source}" adds significant bundle weight — use dynamic import or consider lighter alternatives`
	});
} }) };
const noUndeferredThirdParty = { create: (context) => ({ JSXOpeningElement(node) {
	if (node.name?.type !== "JSXIdentifier" || node.name.name !== "script") return;
	const attributes = node.attributes ?? [];
	if (!findJsxAttribute(attributes, "src")) return;
	if (!hasJsxAttribute(attributes, "defer") && !hasJsxAttribute(attributes, "async")) context.report({
		node,
		message: "Synchronous <script> with src — add defer or async to avoid blocking first paint"
	});
} }) };
//#endregion
//#region src/plugin/rules/correctness.ts
const extractIndexName = (node) => {
	if (node.type === "Identifier" && INDEX_PARAMETER_NAMES.has(node.name)) return node.name;
	if (node.type === "TemplateLiteral") {
		const indexExpression = node.expressions?.find((expression) => expression.type === "Identifier" && INDEX_PARAMETER_NAMES.has(expression.name));
		if (indexExpression) return indexExpression.name;
	}
	if (node.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.object?.type === "Identifier" && INDEX_PARAMETER_NAMES.has(node.callee.object.name) && node.callee.property?.type === "Identifier" && node.callee.property.name === "toString") return node.callee.object.name;
	if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "String" && node.arguments?.[0]?.type === "Identifier" && INDEX_PARAMETER_NAMES.has(node.arguments[0].name)) return node.arguments[0].name;
	return null;
};
const isInsideStaticPlaceholderMap = (node) => {
	let current = node;
	while (current.parent) {
		current = current.parent;
		if (current.type === "CallExpression" && current.callee?.type === "MemberExpression" && current.callee.property?.name === "map") {
			const receiver = current.callee.object;
			if (receiver?.type === "CallExpression") {
				const callee = receiver.callee;
				if (callee?.type === "MemberExpression" && callee.object?.type === "Identifier" && callee.object.name === "Array" && callee.property?.name === "from") return true;
			}
			if (receiver?.type === "NewExpression" && receiver.callee?.type === "Identifier" && receiver.callee.name === "Array") return true;
		}
	}
	return false;
};
const noArrayIndexAsKey = { create: (context) => ({
	JSXAttribute(node) {
		if (node.name?.type !== "JSXIdentifier" || node.name.name !== "key") return;
		if (!node.value || node.value.type !== "JSXExpressionContainer") return;
		if (!extractIndexName(node.value.expression)) return;
		if (isInsideStaticPlaceholderMap(node)) return;
		context.report({
			node,
			message: "Array index used as key in v-for — causes bugs when list is reordered or filtered"
		});
	},
	VDirective(node) {
		if (node.key?.type !== "VDirectiveKey") return;
		if (node.key.name?.type !== "VIdentifier" || node.key.name.name !== "bind") return;
		if (node.key.argument?.type !== "VIdentifier" || node.key.argument.name !== "key") return;
		if (!node.value || node.value.type !== "VExpressionContainer") return;
		if (!extractIndexName(node.value.expression)) return;
		context.report({
			node,
			message: "Array index used as key in v-for — causes bugs when list is reordered or filtered"
		});
	}
}) };
const PREVENT_DEFAULT_ELEMENTS = {
	form: "onSubmit",
	a: "onClick"
};
const containsPreventDefaultCall = (node) => {
	let didFindPreventDefault = false;
	walkAst(node, (child) => {
		if (didFindPreventDefault) return;
		if (child.type === "CallExpression" && child.callee?.type === "MemberExpression" && child.callee.property?.type === "Identifier" && child.callee.property.name === "preventDefault") didFindPreventDefault = true;
	});
	return didFindPreventDefault;
};
const noPreventDefault = { create: (context) => ({ JSXOpeningElement(node) {
	const elementName = node.name?.type === "JSXIdentifier" ? node.name.name : null;
	if (!elementName) return;
	const targetEventProp = PREVENT_DEFAULT_ELEMENTS[elementName];
	if (!targetEventProp) return;
	const eventAttribute = findJsxAttribute(node.attributes ?? [], targetEventProp);
	if (!eventAttribute?.value || eventAttribute.value.type !== "JSXExpressionContainer") return;
	const expression = eventAttribute.value.expression;
	if (expression?.type !== "ArrowFunctionExpression" && expression?.type !== "FunctionExpression") return;
	if (!containsPreventDefaultCall(expression)) return;
	const message = elementName === "form" ? "preventDefault() on <form> onSubmit — form won't work without JavaScript. Consider using a server action for progressive enhancement" : "preventDefault() on <a> onClick — use a <button> or routing component instead";
	context.report({
		node,
		message
	});
} }) };
//#endregion
//#region src/plugin/rules/design.ts
const isOvershootCubicBezier = (value) => {
	const match = value.match(/cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
	if (!match) return false;
	const controlY1 = parseFloat(match[2]);
	const controlY2 = parseFloat(match[4]);
	return controlY1 < -.1 || controlY1 > 1.1 || controlY2 < -.1 || controlY2 > 1.1;
};
const hasBounceAnimationName = (value) => {
	const lowerValue = value.toLowerCase();
	for (const name of BOUNCE_ANIMATION_NAMES) if (lowerValue.includes(name)) return true;
	return false;
};
const getStringFromClassNameAttr = (node) => {
	const classAttr = findJsxAttribute(node.attributes ?? [], "className");
	if (!classAttr?.value) return null;
	if (classAttr.value.type === "Literal" && typeof classAttr.value.value === "string") return classAttr.value.value;
	if (classAttr.value.type === "JSXExpressionContainer" && classAttr.value.expression?.type === "Literal" && typeof classAttr.value.expression.value === "string") return classAttr.value.expression.value;
	if (classAttr.value.type === "JSXExpressionContainer" && classAttr.value.expression?.type === "TemplateLiteral" && classAttr.value.expression.quasis?.length === 1) return classAttr.value.expression.quasis[0].value?.raw ?? null;
	return null;
};
const getInlineStyleExpression = (node) => {
	if (node.name?.type !== "JSXIdentifier" || node.name.name !== "style") return null;
	if (node.value?.type !== "JSXExpressionContainer") return null;
	const expression = node.value.expression;
	if (expression?.type !== "ObjectExpression") return null;
	return expression;
};
const getStylePropertyStringValue = (property) => {
	if (property.value?.type === "Literal" && typeof property.value.value === "string") return property.value.value;
	return null;
};
const getStylePropertyNumberValue = (property) => {
	if (property.value?.type === "Literal" && typeof property.value.value === "number") return property.value.value;
	if (property.value?.type === "UnaryExpression" && property.value.operator === "-" && property.value.argument?.type === "Literal" && typeof property.value.argument.value === "number") return -property.value.argument.value;
	return null;
};
const getStylePropertyKey = (property) => {
	if (property.type !== "Property") return null;
	if (property.key?.type === "Identifier") return property.key.name;
	if (property.key?.type === "Literal" && typeof property.key.value === "string") return property.key.value;
	return null;
};
const parseColorToRgb = (value) => {
	const trimmed = value.trim().toLowerCase();
	const hex6Match = trimmed.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
	if (hex6Match) return {
		red: parseInt(hex6Match[1], 16),
		green: parseInt(hex6Match[2], 16),
		blue: parseInt(hex6Match[3], 16)
	};
	const hex3Match = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
	if (hex3Match) return {
		red: parseInt(hex3Match[1] + hex3Match[1], 16),
		green: parseInt(hex3Match[2] + hex3Match[2], 16),
		blue: parseInt(hex3Match[3] + hex3Match[3], 16)
	};
	const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (rgbMatch) return {
		red: parseInt(rgbMatch[1], 10),
		green: parseInt(rgbMatch[2], 10),
		blue: parseInt(rgbMatch[3], 10)
	};
	return null;
};
const hasColorChroma = (parsed) => Math.max(parsed.red, parsed.green, parsed.blue) - Math.min(parsed.red, parsed.green, parsed.blue) >= 30;
const isNeutralBorderColor = (value) => {
	const trimmed = value.trim().toLowerCase();
	if ([
		"gray",
		"grey",
		"silver",
		"white",
		"black",
		"transparent",
		"currentcolor"
	].includes(trimmed)) return true;
	const parsed = parseColorToRgb(trimmed);
	if (parsed) return !hasColorChroma(parsed);
	return false;
};
const extractBorderColorFromShorthand = (shorthandValue) => {
	const afterSolid = shorthandValue.match(/solid\s+(.+)$/i);
	if (!afterSolid) return null;
	return afterSolid[1].trim();
};
const isPureBlackColor = (value) => {
	const trimmed = value.trim().toLowerCase();
	if (trimmed === "#000" || trimmed === "#000000") return true;
	if (/^rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(trimmed)) return true;
	return false;
};
const splitShadowLayers = (shadowValue) => shadowValue.split(/,(?![^(]*\))/);
const extractColorFromShadowLayer = (layer) => {
	const rgbMatch = layer.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (rgbMatch) return {
		red: parseInt(rgbMatch[1], 10),
		green: parseInt(rgbMatch[2], 10),
		blue: parseInt(rgbMatch[3], 10)
	};
	const hexMatch = layer.match(/#([0-9a-f]{3,6})\b/i);
	if (hexMatch) return parseColorToRgb(`#${hexMatch[1]}`);
	return null;
};
const parseShadowLayerBlur = (layer) => {
	const numericTokens = [...layer.replace(/rgba?\([^)]*\)/g, "").replace(/#[0-9a-f]{3,8}\b/gi, "").matchAll(/(\d+(?:\.\d+)?)(px)?/g)].map((match) => parseFloat(match[1]));
	return numericTokens.length >= 3 ? numericTokens[2] : 0;
};
const hasColoredGlowShadow = (shadowValue) => {
	for (const layer of splitShadowLayers(shadowValue)) {
		const color = extractColorFromShadowLayer(layer);
		if (color && hasColorChroma(color) && parseShadowLayerBlur(layer) > 4) return true;
	}
	return false;
};
const isBackgroundDark = (bgValue) => {
	const trimmed = bgValue.trim().toLowerCase();
	if (isPureBlackColor(trimmed)) return true;
	const parsed = parseColorToRgb(trimmed);
	if (!parsed) return false;
	return parsed.red <= 35 && parsed.green <= 35 && parsed.blue <= 35;
};
const BORDER_SIDE_KEYS = {
	borderLeft: "left",
	borderRight: "right",
	borderInlineStart: "left",
	borderInlineEnd: "right"
};
const BORDER_SIDE_WIDTH_KEYS = new Set([
	"borderLeftWidth",
	"borderRightWidth",
	"borderInlineStartWidth",
	"borderInlineEndWidth"
]);
const noInlineBounceEasing = { create: (context) => ({
	JSXAttribute(node) {
		const expression = getInlineStyleExpression(node);
		if (!expression) return;
		for (const property of expression.properties ?? []) {
			const key = getStylePropertyKey(property);
			if (!key) continue;
			const value = getStylePropertyStringValue(property);
			if (!value) continue;
			if ((key === "transition" || key === "transitionTimingFunction" || key === "animation" || key === "animationTimingFunction") && isOvershootCubicBezier(value)) context.report({
				node: property,
				message: "Bounce/elastic easing feels dated — real objects decelerate smoothly. Use ease-out or cubic-bezier(0.16, 1, 0.3, 1) instead"
			});
			if ((key === "animation" || key === "animationName") && hasBounceAnimationName(value)) context.report({
				node: property,
				message: "Bounce/elastic animation name detected — these feel tacky. Use exponential easing (ease-out-quart/expo) for natural deceleration"
			});
		}
	},
	JSXOpeningElement(node) {
		const classStr = getStringFromClassNameAttr(node);
		if (!classStr) return;
		if (/\banimate-bounce\b/.test(classStr)) context.report({
			node,
			message: "animate-bounce feels dated and tacky — use a subtle ease-out transform for natural deceleration"
		});
	}
}) };
const noZIndex9999 = { create: (context) => ({
	JSXAttribute(node) {
		const expression = getInlineStyleExpression(node);
		if (!expression) return;
		for (const property of expression.properties ?? []) {
			if (getStylePropertyKey(property) !== "zIndex") continue;
			const zValue = getStylePropertyNumberValue(property);
			if (zValue !== null && Math.abs(zValue) >= 100) context.report({
				node: property,
				message: `z-index: ${zValue} is arbitrarily high — use a deliberate z-index scale (1–50). Extreme values signal a stacking context problem, not a fix`
			});
		}
	},
	CallExpression(node) {
		if (node.callee?.type !== "MemberExpression") return;
		if (node.callee.property?.type !== "Identifier" || node.callee.property.name !== "create") return;
		if (node.callee.object?.type !== "Identifier" || node.callee.object.name !== "StyleSheet") return;
		const argument = node.arguments?.[0];
		if (!argument || argument.type !== "ObjectExpression") return;
		walkAst(argument, (child) => {
			if (child.type !== "Property") return;
			if (getStylePropertyKey(child) !== "zIndex") return;
			if (child.value?.type === "Literal" && typeof child.value.value === "number") {
				const zValue = child.value.value;
				if (Math.abs(zValue) >= 100) context.report({
					node: child,
					message: `z-index: ${zValue} is arbitrarily high — use a deliberate z-index scale (1–50). Extreme values signal a stacking context problem, not a fix`
				});
			}
		});
	}
}) };
const noInlineExhaustiveStyle = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	const propertyCount = expression.properties?.filter((property) => property.type === "Property").length ?? 0;
	if (propertyCount >= 8) context.report({
		node: expression,
		message: `${propertyCount} inline style properties — extract to a CSS class, CSS module, or styled component for maintainability and reuse`
	});
} }) };
const noSideTabBorder = { create: (context) => ({
	JSXAttribute(node) {
		const expression = getInlineStyleExpression(node);
		if (!expression) return;
		let hasBorderRadius = false;
		for (const property of expression.properties ?? []) if (getStylePropertyKey(property) === "borderRadius") {
			const numValue = getStylePropertyNumberValue(property);
			const strValue = getStylePropertyStringValue(property);
			if (numValue !== null && numValue > 0 || strValue !== null && parseFloat(strValue) > 0) hasBorderRadius = true;
		}
		const threshold = hasBorderRadius ? 1 : 3;
		for (const property of expression.properties ?? []) {
			const key = getStylePropertyKey(property);
			if (!key) continue;
			if (key in BORDER_SIDE_KEYS) {
				const value = getStylePropertyStringValue(property);
				if (!value) continue;
				const widthMatch = value.match(/^(\d+)px\s+solid/);
				if (!widthMatch) continue;
				const borderColor = extractBorderColorFromShorthand(value);
				if (borderColor && isNeutralBorderColor(borderColor)) continue;
				const width = parseInt(widthMatch[1], 10);
				if (width >= threshold) context.report({
					node: property,
					message: `Thick one-sided border (${BORDER_SIDE_KEYS[key]}: ${width}px) — the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it`
				});
			}
			if (BORDER_SIDE_WIDTH_KEYS.has(key)) {
				const numValue = getStylePropertyNumberValue(property);
				const strValue = getStylePropertyStringValue(property);
				const width = numValue ?? (strValue !== null ? parseFloat(strValue) : NaN);
				if (isNaN(width)) continue;
				const colorKey = key.replace("Width", "Color");
				if (!expression.properties?.some((colorProperty) => {
					if (getStylePropertyKey(colorProperty) !== colorKey) return false;
					const colorValue = getStylePropertyStringValue(colorProperty);
					return colorValue !== null && !isNeutralBorderColor(colorValue);
				})) continue;
				if (width >= threshold) context.report({
					node: property,
					message: `Thick one-sided border (${width}px) — the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it`
				});
			}
		}
	},
	JSXOpeningElement(node) {
		const classStr = getStringFromClassNameAttr(node);
		if (!classStr) return;
		const sideMatch = classStr.match(/\bborder-[lrse]-(\d+)\b/);
		if (!sideMatch) return;
		if (/\bborder-(?:(?:gray|slate|zinc|neutral|stone)-\d+|white|black|transparent)\b/.test(classStr)) return;
		if (parseInt(sideMatch[1], 10) >= (/\brounded(?:-(?!none\b)\w+)?\b/.test(classStr) && !/\brounded-none\b/.test(classStr) ? 1 : 4)) context.report({
			node,
			message: `Thick one-sided border (${sideMatch[0]}) — the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it`
		});
	}
}) };
const noPureBlackBackground = { create: (context) => ({
	JSXAttribute(node) {
		const expression = getInlineStyleExpression(node);
		if (!expression) return;
		for (const property of expression.properties ?? []) {
			const key = getStylePropertyKey(property);
			if (key !== "backgroundColor" && key !== "background") continue;
			const value = getStylePropertyStringValue(property);
			if (value && isPureBlackColor(value)) context.report({
				node: property,
				message: "Pure #000 background looks harsh — tint slightly toward your brand hue for a more refined feel (e.g. #0a0a0f)"
			});
		}
	},
	JSXOpeningElement(node) {
		const classStr = getStringFromClassNameAttr(node);
		if (!classStr) return;
		if (/\bbg-black\b(?!\/)/.test(classStr)) context.report({
			node,
			message: "Pure black background (bg-black) looks harsh — use a near-black tinted toward your brand hue (e.g. bg-gray-950)"
		});
	}
}) };
const noGradientText = { create: (context) => ({
	JSXAttribute(node) {
		const expression = getInlineStyleExpression(node);
		if (!expression) return;
		let hasBackgroundClipText = false;
		let hasGradientBackground = false;
		for (const property of expression.properties ?? []) {
			const key = getStylePropertyKey(property);
			const value = getStylePropertyStringValue(property);
			if (!key || !value) continue;
			if ((key === "backgroundClip" || key === "WebkitBackgroundClip") && value === "text") hasBackgroundClipText = true;
			if ((key === "backgroundImage" || key === "background") && value.includes("gradient")) hasGradientBackground = true;
		}
		if (hasBackgroundClipText && hasGradientBackground) context.report({
			node,
			message: "Gradient text (background-clip: text) is decorative rather than meaningful — a common AI tell. Use solid colors for text"
		});
	},
	JSXOpeningElement(node) {
		const classStr = getStringFromClassNameAttr(node);
		if (!classStr) return;
		if (/\bbg-clip-text\b/.test(classStr) && /\bbg-gradient-to-/.test(classStr)) context.report({
			node,
			message: "Gradient text (bg-clip-text + bg-gradient) is decorative rather than meaningful — a common AI tell. Use solid colors for text"
		});
	}
}) };
const noDarkModeGlow = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	let hasDarkBackground = false;
	let shadowProperty = null;
	let shadowValue = null;
	for (const property of expression.properties ?? []) {
		const key = getStylePropertyKey(property);
		if (!key) continue;
		if (key === "backgroundColor" || key === "background") {
			const value = getStylePropertyStringValue(property);
			if (value && isBackgroundDark(value)) hasDarkBackground = true;
		}
		if (key === "boxShadow") {
			shadowProperty = property;
			shadowValue = getStylePropertyStringValue(property);
		}
	}
	if (!hasDarkBackground || !shadowValue || !shadowProperty) return;
	if (hasColoredGlowShadow(shadowValue)) context.report({
		node: shadowProperty,
		message: "Colored glow on dark background — the default AI-generated 'cool' look. Use subtle, purposeful lighting instead"
	});
} }) };
const noJustifiedText = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	let isJustified = false;
	let hasHyphens = false;
	for (const property of expression.properties ?? []) {
		const key = getStylePropertyKey(property);
		const value = getStylePropertyStringValue(property);
		if (!key || !value) continue;
		if (key === "textAlign" && value === "justify") isJustified = true;
		if ((key === "hyphens" || key === "WebkitHyphens") && value === "auto") hasHyphens = true;
	}
	if (isJustified && !hasHyphens) context.report({
		node,
		message: "Justified text without hyphens creates uneven word spacing (\"rivers of white\"). Use text-align: left, or add hyphens: auto"
	});
} }) };
const noTinyText = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	for (const property of expression.properties ?? []) {
		if (getStylePropertyKey(property) !== "fontSize") continue;
		let pxValue = null;
		const numValue = getStylePropertyNumberValue(property);
		const strValue = getStylePropertyStringValue(property);
		if (numValue !== null) pxValue = numValue;
		else if (strValue !== null) {
			const pxMatch = strValue.match(/^([\d.]+)px$/);
			if (pxMatch) pxValue = parseFloat(pxMatch[1]);
			const remMatch = strValue.match(/^([\d.]+)rem$/);
			if (remMatch) pxValue = parseFloat(remMatch[1]) * 16;
		}
		if (pxValue !== null && pxValue > 0 && pxValue < 12) context.report({
			node: property,
			message: `Font size ${pxValue}px is too small — body text should be at least 12px for readability, 16px is ideal`
		});
	}
} }) };
const noWideLetterSpacing = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	let isUppercase = false;
	let letterSpacingProperty = null;
	let letterSpacingEm = null;
	for (const property of expression.properties ?? []) {
		const key = getStylePropertyKey(property);
		if (!key) continue;
		if (key === "textTransform") {
			if (getStylePropertyStringValue(property) === "uppercase") isUppercase = true;
		}
		if (key === "letterSpacing") {
			letterSpacingProperty = property;
			const strValue = getStylePropertyStringValue(property);
			const numValue = getStylePropertyNumberValue(property);
			if (strValue) {
				const emMatch = strValue.match(/^([\d.]+)em$/);
				if (emMatch) letterSpacingEm = parseFloat(emMatch[1]);
				const pxMatch = strValue.match(/^([\d.]+)px$/);
				if (pxMatch) letterSpacingEm = parseFloat(pxMatch[1]) / 16;
			}
			if (numValue !== null && numValue > 0) letterSpacingEm = numValue / 16;
		}
	}
	if (!isUppercase && letterSpacingProperty && letterSpacingEm !== null && letterSpacingEm > .05) context.report({
		node: letterSpacingProperty,
		message: `Letter spacing ${letterSpacingEm.toFixed(2)}em on body text disrupts natural character groupings. Reserve wide tracking for short uppercase labels only`
	});
} }) };
const noGrayOnColoredBackground = { create: (context) => ({ JSXOpeningElement(node) {
	const classStr = getStringFromClassNameAttr(node);
	if (!classStr) return;
	const grayTextMatch = classStr.match(/\btext-(?:gray|slate|zinc|neutral|stone)-\d+\b/);
	const coloredBgMatch = classStr.match(/\bbg-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/);
	if (grayTextMatch && coloredBgMatch) context.report({
		node,
		message: `Gray text (${grayTextMatch[0]}) on colored background (${coloredBgMatch[0]}) looks washed out — use a darker shade of the background color or white`
	});
} }) };
const noLayoutTransitionInline = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	for (const property of expression.properties ?? []) {
		const key = getStylePropertyKey(property);
		if (key !== "transition" && key !== "transitionProperty") continue;
		const value = getStylePropertyStringValue(property);
		if (!value) continue;
		const lower = value.toLowerCase();
		if (/\ball\b/.test(lower)) continue;
		const layoutMatch = lower.match(/\b(?:(?:max|min)-)?(?:width|height)\b|\bpadding(?:-(?:top|right|bottom|left))?\b|\bmargin(?:-(?:top|right|bottom|left))?\b/);
		if (layoutMatch) context.report({
			node: property,
			message: `Transitioning layout property "${layoutMatch[0]}" causes layout thrash every frame — use transform and opacity instead`
		});
	}
} }) };
const noDisabledZoom = { create: (context) => ({ JSXOpeningElement(node) {
	if (node.name?.type !== "JSXIdentifier" || node.name.name !== "meta") return;
	const nameAttr = findJsxAttribute(node.attributes ?? [], "name");
	if (!nameAttr?.value) return;
	if ((nameAttr.value.type === "Literal" ? nameAttr.value.value : null) !== "viewport") return;
	const contentAttr = findJsxAttribute(node.attributes ?? [], "content");
	if (!contentAttr?.value) return;
	const contentValue = contentAttr.value.type === "Literal" && typeof contentAttr.value.value === "string" ? contentAttr.value.value : null;
	if (!contentValue) return;
	const hasUserScalableNo = /user-scalable\s*=\s*no/i.test(contentValue);
	const maxScaleMatch = contentValue.match(/maximum-scale\s*=\s*([\d.]+)/i);
	const hasRestrictiveMaxScale = maxScaleMatch !== null && parseFloat(maxScaleMatch[1]) < 2;
	if (hasUserScalableNo && hasRestrictiveMaxScale) context.report({
		node,
		message: `user-scalable=no and maximum-scale=${maxScaleMatch[1]} disable pinch-to-zoom — this is an accessibility violation (WCAG 1.4.4). Remove both and fix layout if it breaks at 200% zoom`
	});
	else if (hasUserScalableNo) context.report({
		node,
		message: "user-scalable=no disables pinch-to-zoom — this is an accessibility violation (WCAG 1.4.4). Remove it and fix layout if it breaks at 200% zoom"
	});
	else if (hasRestrictiveMaxScale) context.report({
		node,
		message: `maximum-scale=${maxScaleMatch[1]} restricts zoom below 200% — this is an accessibility violation (WCAG 1.4.4). Use maximum-scale=5 or remove it`
	});
} }) };
const noOutlineNone = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	let hasOutlineNone = false;
	let outlineProperty = null;
	for (const property of expression.properties ?? []) {
		if (getStylePropertyKey(property) !== "outline") continue;
		const strValue = getStylePropertyStringValue(property);
		const numValue = getStylePropertyNumberValue(property);
		if (strValue === "none" || strValue === "0" || numValue === 0) {
			hasOutlineNone = true;
			outlineProperty = property;
		}
	}
	if (!hasOutlineNone || !outlineProperty) return;
	if (!expression.properties?.some((property) => {
		return getStylePropertyKey(property) === "boxShadow";
	})) context.report({
		node: outlineProperty,
		message: "outline: none removes keyboard focus visibility — use :focus-visible styling instead, or provide a box-shadow focus ring"
	});
} }) };
const noLongTransitionDuration = { create: (context) => ({ JSXAttribute(node) {
	const expression = getInlineStyleExpression(node);
	if (!expression) return;
	for (const property of expression.properties ?? []) {
		const key = getStylePropertyKey(property);
		if (!key) continue;
		const value = getStylePropertyStringValue(property);
		if (!value) continue;
		let durationMs = null;
		if (key === "transitionDuration" || key === "animationDuration") {
			let longestDurationPropertyMs = 0;
			for (const segment of value.split(",")) {
				const trimmedSegment = segment.trim();
				const msMatch = trimmedSegment.match(/^([\d.]+)ms$/);
				const secondsMatch = trimmedSegment.match(/^([\d.]+)s$/);
				if (msMatch) longestDurationPropertyMs = Math.max(longestDurationPropertyMs, parseFloat(msMatch[1]));
				else if (secondsMatch) longestDurationPropertyMs = Math.max(longestDurationPropertyMs, parseFloat(secondsMatch[1]) * 1e3);
			}
			if (longestDurationPropertyMs > 0) durationMs = longestDurationPropertyMs;
		}
		if (key === "transition" || key === "animation") {
			let longestDurationMs = 0;
			const segments = value.split(",");
			for (const segment of segments) {
				const firstTimeMatch = segment.match(/(?<![a-zA-Z\d])([\d.]+)(m?s)(?![a-zA-Z\d-])/);
				if (!firstTimeMatch) continue;
				const segmentDurationMs = firstTimeMatch[2] === "ms" ? parseFloat(firstTimeMatch[1]) : parseFloat(firstTimeMatch[1]) * 1e3;
				longestDurationMs = Math.max(longestDurationMs, segmentDurationMs);
			}
			if (longestDurationMs > 0) durationMs = longestDurationMs;
		}
		if (durationMs !== null && durationMs > 1e3) context.report({
			node: property,
			message: `${durationMs}ms transition is too slow for UI feedback — keep transitions under ${LONG_TRANSITION_DURATION_THRESHOLD_MS}ms. Use longer durations only for page-load hero animations`
		});
	}
} }) };
//#endregion
//#region src/plugin/rules/js-performance.ts
const jsCombineIterations = { create: (context) => ({ CallExpression(node) {
	if (node.callee?.type !== "MemberExpression" || node.callee.property?.type !== "Identifier") return;
	const outerMethod = node.callee.property.name;
	if (!CHAINABLE_ITERATION_METHODS.has(outerMethod)) return;
	const innerCall = node.callee.object;
	if (innerCall?.type !== "CallExpression" || innerCall.callee?.type !== "MemberExpression" || innerCall.callee.property?.type !== "Identifier") return;
	const innerMethod = innerCall.callee.property.name;
	if (!CHAINABLE_ITERATION_METHODS.has(innerMethod)) return;
	if (innerMethod === "map" && outerMethod === "filter") {
		const filterArgument = node.arguments?.[0];
		if (filterArgument?.type === "Identifier" && filterArgument.name === "Boolean" || filterArgument?.type === "ArrowFunctionExpression" && filterArgument.params?.length === 1 && filterArgument.body?.type === "Identifier" && filterArgument.params[0]?.type === "Identifier" && filterArgument.body.name === filterArgument.params[0].name) return;
	}
	context.report({
		node,
		message: `.${innerMethod}().${outerMethod}() iterates the array twice — combine into a single loop with .reduce() or for...of`
	});
} }) };
const jsTosortedImmutable = { create: (context) => ({ CallExpression(node) {
	if (!isMemberProperty(node.callee, "sort")) return;
	const receiver = node.callee.object;
	if (receiver?.type === "ArrayExpression" && receiver.elements?.length === 1 && receiver.elements[0]?.type === "SpreadElement") context.report({
		node,
		message: "[...array].sort() — use array.toSorted() for immutable sorting (ES2023)"
	});
} }) };
const jsHoistRegexp = { create: (context) => createLoopAwareVisitors({ NewExpression(node) {
	if (node.callee?.type === "Identifier" && node.callee.name === "RegExp") context.report({
		node,
		message: "new RegExp() inside a loop — hoist to a module-level constant"
	});
} }) };
const jsMinMaxLoop = { create: (context) => ({ MemberExpression(node) {
	if (!node.computed) return;
	const object = node.object;
	if (object?.type !== "CallExpression" || !isMemberProperty(object.callee, "sort")) return;
	const isFirstElement = node.property?.type === "Literal" && node.property.value === 0;
	const isLastElement = node.property?.type === "BinaryExpression" && node.property.operator === "-" && node.property.right?.type === "Literal" && node.property.right.value === 1;
	if (isFirstElement || isLastElement) {
		const targetFunction = isFirstElement ? "min" : "max";
		context.report({
			node,
			message: `array.sort()[${isFirstElement ? "0" : "length-1"}] for min/max — use Math.${targetFunction}(...array) instead (O(n) vs O(n log n))`
		});
	}
} }) };
const jsSetMapLookups = { create: (context) => createLoopAwareVisitors({ CallExpression(node) {
	if (node.callee?.type !== "MemberExpression" || node.callee.property?.type !== "Identifier") return;
	const methodName = node.callee.property.name;
	if (methodName === "includes" || methodName === "indexOf") context.report({
		node,
		message: `array.${methodName}() in a loop is O(n) per call — convert to a Set for O(1) lookups`
	});
} }) };
const jsBatchDomCss = { create: (context) => {
	const isStyleAssignment = (node) => node.type === "ExpressionStatement" && node.expression?.type === "AssignmentExpression" && node.expression.left?.type === "MemberExpression" && node.expression.left.object?.type === "MemberExpression" && node.expression.left.object.property?.type === "Identifier" && node.expression.left.object.property.name === "style";
	return { BlockStatement(node) {
		const statements = node.body ?? [];
		for (let statementIndex = 1; statementIndex < statements.length; statementIndex++) if (isStyleAssignment(statements[statementIndex]) && isStyleAssignment(statements[statementIndex - 1])) context.report({
			node: statements[statementIndex],
			message: "Multiple sequential element.style assignments — batch with cssText or classList for fewer reflows"
		});
	} };
} };
const jsIndexMaps = { create: (context) => createLoopAwareVisitors({ CallExpression(node) {
	if (node.callee?.type !== "MemberExpression" || node.callee.property?.type !== "Identifier") return;
	const methodName = node.callee.property.name;
	if (methodName === "find" || methodName === "findIndex") context.report({
		node,
		message: `array.${methodName}() in a loop is O(n*m) — build a Map for O(1) lookups`
	});
} }) };
const jsCacheStorage = { create: (context) => {
	const storageReadCounts = /* @__PURE__ */ new Map();
	return { CallExpression(node) {
		if (!isMemberProperty(node.callee, "getItem")) return;
		if (node.callee.object?.type !== "Identifier" || !STORAGE_OBJECTS.has(node.callee.object.name)) return;
		if (node.arguments?.[0]?.type !== "Literal") return;
		const storageKey = String(node.arguments[0].value);
		const readCount = (storageReadCounts.get(storageKey) ?? 0) + 1;
		storageReadCounts.set(storageKey, readCount);
		if (readCount === 2) {
			const storageName = node.callee.object.name;
			context.report({
				node,
				message: `${storageName}.getItem("${storageKey}") called multiple times — cache the result in a variable`
			});
		}
	} };
} };
const jsEarlyExit = { create: (context) => ({ IfStatement(node) {
	if (node.consequent?.type !== "BlockStatement" || !node.consequent.body) return;
	let nestingDepth = 0;
	let currentBlock = node.consequent;
	while (currentBlock?.type === "BlockStatement" && currentBlock.body?.length === 1) {
		const innerStatement = currentBlock.body[0];
		if (innerStatement.type !== "IfStatement") break;
		nestingDepth++;
		currentBlock = innerStatement.consequent;
	}
	if (nestingDepth >= 3) context.report({
		node,
		message: `${nestingDepth + 1} levels of nested if statements — use early returns to flatten`
	});
} }) };
const asyncParallel = { create: (context) => {
	const filename = context.getFilename?.() ?? "";
	const isTestFile = TEST_FILE_PATTERN.test(filename);
	return { BlockStatement(node) {
		if (isTestFile) return;
		const consecutiveAwaitStatements = [];
		const flushConsecutiveAwaits = () => {
			if (consecutiveAwaitStatements.length >= 3) reportIfIndependent(consecutiveAwaitStatements, context);
			consecutiveAwaitStatements.length = 0;
		};
		for (const statement of node.body ?? []) if (statement.type === "VariableDeclaration" && statement.declarations?.length === 1 && statement.declarations[0].init?.type === "AwaitExpression" || statement.type === "ExpressionStatement" && statement.expression?.type === "AwaitExpression") consecutiveAwaitStatements.push(statement);
		else flushConsecutiveAwaits();
		flushConsecutiveAwaits();
	} };
} };
const reportIfIndependent = (statements, context) => {
	const declaredNames = /* @__PURE__ */ new Set();
	for (const statement of statements) {
		if (statement.type !== "VariableDeclaration") continue;
		const declarator = statement.declarations[0];
		const awaitArgument = declarator.init?.argument;
		let referencesEarlierResult = false;
		walkAst(awaitArgument, (child) => {
			if (child.type === "Identifier" && declaredNames.has(child.name)) referencesEarlierResult = true;
		});
		if (referencesEarlierResult) return;
		if (declarator.id?.type === "Identifier") declaredNames.add(declarator.id.name);
	}
	context.report({
		node: statements[0],
		message: `${statements.length} sequential await statements that appear independent — use Promise.all() for parallel execution`
	});
};
const jsFlatmapFilter = { create: (context) => ({ CallExpression(node) {
	if (node.callee?.type !== "MemberExpression" || node.callee.property?.type !== "Identifier") return;
	if (node.callee.property.name !== "filter") return;
	const filterArgument = node.arguments?.[0];
	if (!filterArgument) return;
	const isIdentityArrow = filterArgument.type === "ArrowFunctionExpression" && filterArgument.params?.length === 1 && filterArgument.body?.type === "Identifier" && filterArgument.params[0]?.type === "Identifier" && filterArgument.body.name === filterArgument.params[0].name;
	if (!(filterArgument.type === "Identifier" && filterArgument.name === "Boolean" || isIdentityArrow)) return;
	const innerCall = node.callee.object;
	if (innerCall?.type !== "CallExpression" || innerCall.callee?.type !== "MemberExpression" || innerCall.callee.property?.type !== "Identifier") return;
	if (innerCall.callee.property.name !== "map") return;
	context.report({
		node,
		message: ".map().filter(Boolean) iterates twice — use .flatMap() to transform and filter in a single pass"
	});
} }) };
//#endregion
//#region src/plugin/rules/nuxt.ts
const nuxtNoImgElement = { create: (context) => ({ JSXOpeningElement(node) {
	if (node.name?.type !== "JSXIdentifier" || node.name.name !== "img") return;
	context.report({
		node,
		message: `Use <${NUXT_IMG_COMPONENT}> instead of <img> — provides automatic optimization, lazy loading, and responsive images`
	});
} }) };
const nuxtNoAElement = { create: (context) => ({ JSXOpeningElement(node) {
	if (node.name?.type !== "JSXIdentifier" || node.name.name !== "a") return;
	const hrefAttribute = findJsxAttribute(node.attributes ?? [], "href");
	if (!hrefAttribute?.value) return;
	let hrefValue = null;
	if (hrefAttribute.value.type === "Literal") hrefValue = hrefAttribute.value.value;
	else if (hrefAttribute.value.type === "JSXExpressionContainer" && hrefAttribute.value.expression?.type === "Literal") hrefValue = hrefAttribute.value.expression.value;
	if (typeof hrefValue === "string" && hrefValue.startsWith("/")) context.report({
		node,
		message: `Use <${NUXT_LINK_COMPONENT}> instead of <a> for internal links — enables client-side navigation and prefetching`
	});
} }) };
const nuxtMissingDefinePageMeta = { create: (context) => ({ Program(programNode) {
	const filename = context.getFilename?.() ?? "";
	if (!PAGE_FILE_PATTERN.test(filename)) return;
	let hasDefinePageMeta = false;
	walkAst(programNode, (child) => {
		if (hasDefinePageMeta) return;
		if (child.type === "CallExpression" && child.callee?.type === "Identifier" && child.callee.name === "definePageMeta") hasDefinePageMeta = true;
	});
	if (!hasDefinePageMeta) context.report({
		node: programNode,
		message: "Page without definePageMeta — add definePageMeta for route metadata, layout selection, and middleware configuration"
	});
} }) };
const nuxtUseAsyncData = { create: (context) => ({ CallExpression(node) {
	const filename = context.getFilename?.() ?? "";
	if (!PAGE_FILE_PATTERN.test(filename)) return;
	if (node.callee?.type !== "Identifier") return;
	if (node.callee.name !== "fetch" && node.callee.name !== "$fetch") return;
	context.report({
		node,
		message: "Use useAsyncData or useFetch instead of raw fetch/$fetch — integrates with SSR, deduplication, and auto-refresh"
	});
} }) };
const nuxtUseHead = { create: (context) => ({ Program(programNode) {
	const filename = context.getFilename?.() ?? "";
	if (!PAGE_FILE_PATTERN.test(filename)) return;
	let hasUseHead = false;
	walkAst(programNode, (child) => {
		if (hasUseHead) return;
		if (child.type === "CallExpression" && child.callee?.type === "Identifier" && child.callee.name === "useHead") hasUseHead = true;
	});
	if (!hasUseHead) context.report({
		node: programNode,
		message: "Page without useHead — add useHead for SEO metadata like title, description, and Open Graph tags"
	});
} }) };
const describeClientSideRedirect = (node) => {
	if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
		const objectName = node.callee.object?.type === "Identifier" ? node.callee.object.name : null;
		const methodName = node.callee.property?.type === "Identifier" ? node.callee.property.name : null;
		if (objectName === "router" && (methodName === "push" || methodName === "replace")) return `router.${methodName}() in onMounted — use navigateTo() for declarative navigation in Nuxt`;
	}
	if (node.type === "AssignmentExpression" && node.left?.type === "MemberExpression") {
		const objectName = node.left.object?.type === "Identifier" ? node.left.object.name : null;
		const propertyName = node.left.property?.type === "Identifier" ? node.left.property.name : null;
		if (objectName === "window" && propertyName === "location") return "window.location assignment in onMounted — use navigateTo() for declarative navigation in Nuxt";
		if (objectName === "location" && propertyName === "href") return "location.href assignment in onMounted — use navigateTo() for declarative navigation in Nuxt";
	}
	return null;
};
//#endregion
//#region src/plugin/index.ts
const plugin = {
	meta: { name: "nuxt-doctor" },
	rules: {
		"no-generic-handler-names": noGenericHandlerNames,
		"no-giant-component": noGiantComponent,
		"no-render-in-render": noRenderInRender,
		"no-nested-component-definition": noNestedComponentDefinition,
		"no-barrel-import": noBarrelImport,
		"no-full-lodash-import": noFullLodashImport,
		"no-moment": noMoment,
		"prefer-dynamic-import": preferDynamicImport,
		"use-lazy-motion": useLazyMotion,
		"no-undeferred-third-party": noUndeferredThirdParty,
		"no-array-index-as-key": noArrayIndexAsKey,
		"no-prevent-default": noPreventDefault,
		"no-inline-bounce-easing": noInlineBounceEasing,
		"no-z-index-9999": noZIndex9999,
		"no-inline-exhaustive-style": noInlineExhaustiveStyle,
		"no-side-tab-border": noSideTabBorder,
		"no-pure-black-background": noPureBlackBackground,
		"no-gradient-text": noGradientText,
		"no-dark-mode-glow": noDarkModeGlow,
		"no-justified-text": noJustifiedText,
		"no-tiny-text": noTinyText,
		"no-wide-letter-spacing": noWideLetterSpacing,
		"no-gray-on-colored-background": noGrayOnColoredBackground,
		"no-layout-transition-inline": noLayoutTransitionInline,
		"no-disabled-zoom": noDisabledZoom,
		"no-outline-none": noOutlineNone,
		"no-long-transition-duration": noLongTransitionDuration,
		"js-combine-iterations": jsCombineIterations,
		"js-tosorted-immutable": jsTosortedImmutable,
		"js-hoist-regexp": jsHoistRegexp,
		"js-min-max-loop": jsMinMaxLoop,
		"js-set-map-lookups": jsSetMapLookups,
		"js-batch-dom-css": jsBatchDomCss,
		"js-index-maps": jsIndexMaps,
		"js-cache-storage": jsCacheStorage,
		"js-early-exit": jsEarlyExit,
		"js-flatmap-filter": jsFlatmapFilter,
		"async-parallel": asyncParallel,
		"nuxt-no-img-element": nuxtNoImgElement,
		"nuxt-no-a-element": nuxtNoAElement,
		"nuxt-missing-define-page-meta": nuxtMissingDefinePageMeta,
		"nuxt-use-async-data": nuxtUseAsyncData,
		"nuxt-use-head": nuxtUseHead,
		"nuxt-no-client-side-redirect": { create: (context) => ({ CallExpression(node) {
			if (!isHookCall(node, "onMounted")) return;
			const callback = getEffectCallback(node);
			if (!callback) return;
			walkAst(callback, (child) => {
				const description = describeClientSideRedirect(child);
				if (description) context.report({
					node: child,
					message: description
				});
			});
		} }) },
		"no-eval": { create: (context) => ({
			CallExpression(node) {
				if (node.callee?.type === "Identifier" && node.callee.name === "eval") {
					context.report({
						node,
						message: "eval() is a code injection risk — avoid dynamic code execution"
					});
					return;
				}
				if (node.callee?.type === "Identifier" && (node.callee.name === "setTimeout" || node.callee.name === "setInterval") && node.arguments?.[0]?.type === "Literal" && typeof node.arguments[0].value === "string") context.report({
					node,
					message: `${node.callee.name}() with string argument executes code dynamically — use a function instead`
				});
			},
			NewExpression(node) {
				if (node.callee?.type === "Identifier" && node.callee.name === "Function") context.report({
					node,
					message: "new Function() is a code injection risk — avoid dynamic code execution"
				});
			}
		}) },
		"no-secrets-in-client-code": { create: (context) => ({ VariableDeclarator(node) {
			if (node.id?.type !== "Identifier") return;
			if (node.init?.type !== "Literal" || typeof node.init.value !== "string") return;
			const variableName = node.id.name;
			const literalValue = node.init.value;
			const trailingSuffix = variableName.split("_").pop()?.toLowerCase() ?? "";
			const isUiConstant = SECRET_FALSE_POSITIVE_SUFFIXES.has(trailingSuffix);
			if (SECRET_VARIABLE_PATTERN.test(variableName) && !isUiConstant && literalValue.length > 8) {
				context.report({
					node,
					message: `Possible hardcoded secret in "${variableName}" — use environment variables instead`
				});
				return;
			}
			if (SECRET_PATTERNS.some((pattern) => pattern.test(literalValue))) context.report({
				node,
				message: "Hardcoded secret detected — use environment variables instead"
			});
		} }) },
		"vue-prefer-script-setup": { create: (context) => ({
			ExportDefaultDeclaration(node) {
				if (node.declaration?.type !== "ObjectExpression") return;
				if (!(node.declaration.properties ?? []).some((prop) => prop.type === "Property" && prop.key?.type === "Identifier" && [
					"data",
					"computed",
					"methods",
					"props",
					"watch"
				].includes(prop.key.name))) return;
				context.report({
					node,
					message: "Use <script setup> instead of Options API / setup() function for better ergonomics"
				});
			},
			CallExpression(node) {
				if (getCalleeName(node) !== "defineComponent") return;
				const arg = node.arguments?.[0];
				if (!arg || arg.type !== "ObjectExpression") return;
				if (!(arg.properties ?? []).some((prop) => prop.type === "Property" && prop.key?.type === "Identifier" && prop.key.name === "setup")) return;
				context.report({
					node,
					message: "Use <script setup> instead of Options API / setup() function for better ergonomics"
				});
			}
		}) },
		"vue-no-side-effect-watch": { create: (context) => ({ CallExpression(node) {
			if (!isHookCall(node, VUE_WATCH_HOOKS)) return;
			const callbackIndex = getCalleeName(node) === "watchEffect" ? 0 : 1;
			const callback = node.arguments?.[callbackIndex];
			if (!callback) return;
			if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") return;
			const hasSideEffect = findSideEffect(callback) !== null;
			let hasRefMutation = false;
			walkAst(callback, (child) => {
				if (hasRefMutation) return;
				if (child.type === "AssignmentExpression" && child.left?.type === "MemberExpression" && child.left.property?.type === "Identifier" && child.left.property.name === "value") hasRefMutation = true;
			});
			if (hasSideEffect || hasRefMutation) context.report({
				node,
				message: "watch callback contains side effect — use watch for side effects only when necessary"
			});
		} }) },
		"vue-prefer-computed": { create: (context) => {
			const isReportableCall = (expression) => {
				if (expression.type !== "CallExpression") return false;
				if (expression.callee?.type !== "Identifier") return false;
				const name = expression.callee.name;
				if (UPPERCASE_PATTERN.test(name)) return false;
				if (VUE_COMPOSABLES.has(name)) return false;
				if (VUE_LIFECYCLE_HOOKS.has(name)) return false;
				if (VUE_WATCH_HOOKS.has(name)) return false;
				if (SETTER_PATTERN.test(name)) return true;
				return true;
			};
			return {
				JSXExpressionContainer(node) {
					if (!isReportableCall(node.expression)) return;
					context.report({
						node,
						message: "Method call in template — consider using computed() for reactive derived values"
					});
				},
				VExpressionContainer(node) {
					if (!isReportableCall(node.expression)) return;
					context.report({
						node,
						message: "Method call in template — consider using computed() for reactive derived values"
					});
				}
			};
		} },
		"vue-use-v-once": { create: (context) => {
			const isStaticContent = (node) => {
				const openingElement = node.openingElement ?? node.startTag;
				if (!openingElement) return false;
				if ((openingElement.attributes ?? openingElement.attrs ?? []).some((attr) => attr.type === "JSXExpressionContainer" || attr.type === "VExpressionContainer" || attr.type === "JSXSpreadAttribute" || attr.type === "VAttributeDirective")) return false;
				const children = node.children ?? [];
				if (children.some((child) => child.type === "JSXExpressionContainer" || child.type === "VExpressionContainer")) return false;
				return children.some((child) => {
					if (child.type === "JSXText" || child.type === "VText") return child.value?.trim().length > 0;
					if (child.type === "JSXElement" || child.type === "VElement") return true;
					return false;
				});
			};
			return {
				JSXElement(node) {
					if (!isStaticContent(node)) return;
					context.report({
						node,
						message: "Static content without v-once — use v-once for one-time rendered content"
					});
				},
				VElement(node) {
					if (!isStaticContent(node)) return;
					context.report({
						node,
						message: "Static content without v-once — use v-once for one-time rendered content"
					});
				}
			};
		} },
		"vue-prefer-shallow-ref": { create: (context) => ({ CallExpression(node) {
			if (getCalleeName(node) !== "ref") return;
			const arg = node.arguments?.[0];
			if (!arg) return;
			const isPrimitive = arg.type === "Literal" || arg.type === "TemplateLiteral";
			const isSimpleArray = arg.type === "ArrayExpression" && (arg.elements ?? []).every((el) => el == null || el.type === "Literal" || el.type === "TemplateLiteral");
			if (!isPrimitive && !isSimpleArray) return;
			context.report({
				node,
				message: "Use shallowRef() instead of ref() for primitive/simple values — better performance"
			});
		} }) },
		"vue-no-mutating-props": { create: (context) => {
			const firstParamNames = /* @__PURE__ */ new Set();
			const captureFirstParam = (params) => {
				if (params.length === 0) return;
				const first = params[0];
				if (first.type === "Identifier") firstParamNames.add(first.name);
				else if (first.type === "ObjectPattern") {
					for (const prop of first.properties ?? []) if (prop.type === "Property" && prop.key?.type === "Identifier") firstParamNames.add(prop.key.name);
				}
			};
			const isFirstParamName = (name) => name === "props" || firstParamNames.has(name);
			return {
				FunctionDeclaration(node) {
					captureFirstParam(node.params ?? []);
				},
				ArrowFunctionExpression(node) {
					captureFirstParam(node.params ?? []);
				},
				FunctionExpression(node) {
					captureFirstParam(node.params ?? []);
				},
				AssignmentExpression(node) {
					const left = node.left;
					if (!left) return;
					if (left.type === "MemberExpression" && left.object?.type === "Identifier" && isFirstParamName(left.object.name)) {
						context.report({
							node,
							message: "Props are read-only — do not mutate prop values directly"
						});
						return;
					}
					if (left.type === "Identifier" && isFirstParamName(left.name)) context.report({
						node,
						message: "Props are read-only — do not mutate prop values directly"
					});
				}
			};
		} }
	}
};
//#endregion
export { plugin as default };

//# sourceMappingURL=nuxt-doctor-plugin.js.map