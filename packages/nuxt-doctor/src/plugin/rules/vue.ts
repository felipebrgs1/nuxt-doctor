import {
  VUE_COMPOSABLES,
  VUE_LIFECYCLE_HOOKS,
  VUE_WATCH_HOOKS,
  SETTER_PATTERN,
  UPPERCASE_PATTERN,
} from "../constants.js";
import {
  walkAst,
  isHookCall,
  getCalleeName,
  findSideEffect,
} from "../helpers.js";
import type { EsTreeNode, Rule, RuleContext } from "../types.js";

/**
 * Detects Options API components and recommends <script setup>.
 *
 * Triggers on:
 *   - `export default { data/computed/methods }` (Options API pattern)
 *   - `defineComponent({ setup() { ... } })` (setup function pattern)
 */
export const vuePreferScriptSetup: Rule = {
  create: (context: RuleContext) => ({
    ExportDefaultDeclaration(node: EsTreeNode) {
      if (node.declaration?.type !== "ObjectExpression") return;

      const hasOptionApi = (node.declaration.properties ?? []).some(
        (prop: EsTreeNode) =>
          prop.type === "Property" &&
          prop.key?.type === "Identifier" &&
          ["data", "computed", "methods", "props", "watch"].includes(prop.key.name),
      );
      if (!hasOptionApi) return;

      context.report({
        node,
        message:
          "Use <script setup> instead of Options API / setup() function for better ergonomics",
      });
    },

    CallExpression(node: EsTreeNode) {
      if (getCalleeName(node) !== "defineComponent") return;

      const arg = node.arguments?.[0];
      if (!arg || arg.type !== "ObjectExpression") return;

      const hasSetup = (arg.properties ?? []).some(
        (prop: EsTreeNode) =>
          prop.type === "Property" &&
          prop.key?.type === "Identifier" &&
          prop.key.name === "setup",
      );
      if (!hasSetup) return;

      context.report({
        node,
        message:
          "Use <script setup> instead of Options API / setup() function for better ergonomics",
      });
    },
  }),
};

/**
 * Detects watch/wEffect callbacks that contain side effects (fetch calls or
 * external state mutations) and warns when they should be avoided.
 */
export const vueNoSideEffectWatch: Rule = {
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNode) {
      if (!isHookCall(node, VUE_WATCH_HOOKS)) return;

      const calleeName = getCalleeName(node);
      // watchEffect(fn) → callback is first arg
      // watch(source, fn) → callback is second arg
      const callbackIndex = calleeName === "watchEffect" ? 0 : 1;
      const callback = node.arguments?.[callbackIndex];
      if (!callback) return;

      if (
        callback.type !== "ArrowFunctionExpression" &&
        callback.type !== "FunctionExpression"
      )
        return;

      // Check for side effects (fetch calls, mutations, etc.)
      const hasSideEffect = findSideEffect(callback) !== null;

      // Also check for ref value mutations (someRef.value = x) which
      // findSideEffect does not cover
      let hasRefMutation = false;
      walkAst(callback, (child: EsTreeNode) => {
        if (hasRefMutation) return;
        if (
          child.type === "AssignmentExpression" &&
          child.left?.type === "MemberExpression" &&
          child.left.property?.type === "Identifier" &&
          child.left.property.name === "value"
        ) {
          hasRefMutation = true;
        }
      });

      if (hasSideEffect || hasRefMutation) {
        context.report({
          node,
          message:
            "watch callback contains side effect — use watch for side effects only when necessary",
        });
      }
    },
  }),
};

/**
 * Detects method calls inside template expressions (JSX / Vue mustache) that
 * would benefit from being wrapped in computed() for better performance.
 */
export const vuePreferComputed: Rule = {
  create: (context: RuleContext) => {
    const isReportableCall = (expression: EsTreeNode): boolean => {
      if (expression.type !== "CallExpression") return false;
      if (expression.callee?.type !== "Identifier") return false;

      const name = expression.callee.name;

      // Components (uppercase) render children, they are not arbitrary calls
      if (UPPERCASE_PATTERN.test(name)) return false;

      // Known reactivity / lifecycle APIs are not template-derived calls
      if (VUE_COMPOSABLES.has(name)) return false;
      if (VUE_LIFECYCLE_HOOKS.has(name)) return false;
      if (VUE_WATCH_HOOKS.has(name)) return false;

      // Setter-like method calls (e.g. setValue()) are especially
      // problematic in templates as they mutate state during render
      if (SETTER_PATTERN.test(name)) return true;

      return true;
    };

    return {
      JSXExpressionContainer(node: EsTreeNode) {
        if (!isReportableCall(node.expression)) return;

        context.report({
          node,
          message:
            "Method call in template — consider using computed() for reactive derived values",
        });
      },

      VExpressionContainer(node: EsTreeNode) {
        if (!isReportableCall(node.expression)) return;

        context.report({
          node,
          message:
            "Method call in template — consider using computed() for reactive derived values",
        });
      },
    };
  },
};

/**
 * Detects elements that have no dynamic bindings and could use v-once for
 * one-time rendering.
 */
export const vueUseVOnce: Rule = {
  create: (context: RuleContext) => {
    const isStaticContent = (node: EsTreeNode): boolean => {
      const openingElement = node.openingElement ?? node.startTag;
      if (!openingElement) return false;

      const attributes =
        openingElement.attributes ?? openingElement.attrs ?? [];
      const hasDynamicAttribute = attributes.some(
        (attr: EsTreeNode) =>
          attr.type === "JSXExpressionContainer" ||
          attr.type === "VExpressionContainer" ||
          attr.type === "JSXSpreadAttribute" ||
          attr.type === "VAttributeDirective",
      );
      if (hasDynamicAttribute) return false;

      const children = node.children ?? [];
      const hasExpressionChild = children.some(
        (child: EsTreeNode) =>
          child.type === "JSXExpressionContainer" ||
          child.type === "VExpressionContainer",
      );
      if (hasExpressionChild) return false;

      // Skip elements that only contain whitespace
      const hasMeaningfulContent = children.some((child: EsTreeNode) => {
        if (child.type === "JSXText" || child.type === "VText") {
          return child.value?.trim().length > 0;
        }
        if (child.type === "JSXElement" || child.type === "VElement") {
          return true;
        }
        return false;
      });

      return hasMeaningfulContent;
    };

    return {
      JSXElement(node: EsTreeNode) {
        if (!isStaticContent(node)) return;

        context.report({
          node,
          message:
            "Static content without v-once — use v-once for one-time rendered content",
        });
      },

      VElement(node: EsTreeNode) {
        if (!isStaticContent(node)) return;

        context.report({
          node,
          message:
            "Static content without v-once — use v-once for one-time rendered content",
        });
      },
    };
  },
};

/**
 * Detects ref() called with primitive or simple array literals that could
 * use shallowRef() for better performance.
 */
export const vuePreferShallowRef: Rule = {
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNode) {
      if (getCalleeName(node) !== "ref") return;

      const arg = node.arguments?.[0];
      if (!arg) return;

      const isPrimitive =
        arg.type === "Literal" || arg.type === "TemplateLiteral";

      const isSimpleArray =
        arg.type === "ArrayExpression" &&
        (arg.elements ?? []).every(
          (el: EsTreeNode | null) =>
            el == null ||
            el.type === "Literal" ||
            el.type === "TemplateLiteral",
        );

      if (!isPrimitive && !isSimpleArray) return;

      context.report({
        node,
        message:
          "Use shallowRef() instead of ref() for primitive/simple values — better performance",
      });
    },
  }),
};

/**
 * Detects direct mutations of component props inside functions.
 */
export const vueNoMutatingProps: Rule = {
  create: (context: RuleContext) => {
    // Collect identifiers that are likely prop parameters (first param of
    // component-like functions) to catch destructured-prop reassignment.
    const firstParamNames = new Set<string>();

    const captureFirstParam = (params: EsTreeNode[]): void => {
      if (params.length === 0) return;
      const first = params[0];
      if (first.type === "Identifier") {
        firstParamNames.add(first.name);
      } else if (first.type === "ObjectPattern") {
        for (const prop of first.properties ?? []) {
          if (
            prop.type === "Property" &&
            prop.key?.type === "Identifier"
          ) {
            firstParamNames.add(prop.key.name);
          }
        }
      }
    };

    const isFirstParamName = (name: string): boolean =>
      name === "props" || firstParamNames.has(name);

    return {
      FunctionDeclaration(node: EsTreeNode) {
        captureFirstParam(node.params ?? []);
      },
      ArrowFunctionExpression(node: EsTreeNode) {
        captureFirstParam(node.params ?? []);
      },
      FunctionExpression(node: EsTreeNode) {
        captureFirstParam(node.params ?? []);
      },

      AssignmentExpression(node: EsTreeNode) {
        const left = node.left;
        if (!left) return;

        // Case 1: props.foo = value
        if (
          left.type === "MemberExpression" &&
          left.object?.type === "Identifier" &&
          isFirstParamName(left.object.name)
        ) {
          context.report({
            node,
            message:
              "Props are read-only — do not mutate prop values directly",
          });
          return;
        }

        // Case 2: foo = value (destructured prop reassignment)
        if (
          left.type === "Identifier" &&
          isFirstParamName(left.name)
        ) {
          context.report({
            node,
            message:
              "Props are read-only — do not mutate prop values directly",
          });
        }
      },
    };
  },
};
