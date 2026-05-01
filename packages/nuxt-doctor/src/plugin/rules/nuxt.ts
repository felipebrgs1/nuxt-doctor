import {
  PAGE_FILE_PATTERN,
  NUXT_COMPOSABLES,
  NUXT_NAVIGATION_FUNCTIONS,
  VUE_LIFECYCLE_HOOKS,
  NUXT_IMG_COMPONENT,
  NUXT_LINK_COMPONENT,
} from "../constants.js";
import {
  findJsxAttribute,
  hasDirective,
  containsFetchCall,
  walkAst,
  isHookCall,
  getEffectCallback,
  hasJsxAttribute,
} from "../helpers.js";
import type { EsTreeNode, Rule, RuleContext } from "../types.js";

export const nuxtNoImgElement: Rule = {
  create: (context: RuleContext) => ({
    JSXOpeningElement(node: EsTreeNode) {
      if (node.name?.type !== "JSXIdentifier" || node.name.name !== "img") return;

      context.report({
        node,
        message: `Use <${NUXT_IMG_COMPONENT}> instead of <img> — provides automatic optimization, lazy loading, and responsive images`,
      });
    },
  }),
};

export const nuxtNoAElement: Rule = {
  create: (context: RuleContext) => ({
    JSXOpeningElement(node: EsTreeNode) {
      if (node.name?.type !== "JSXIdentifier" || node.name.name !== "a") return;

      const hrefAttribute = findJsxAttribute(node.attributes ?? [], "href");
      if (!hrefAttribute?.value) return;

      let hrefValue: string | null = null;
      if (hrefAttribute.value.type === "Literal") {
        hrefValue = hrefAttribute.value.value;
      } else if (
        hrefAttribute.value.type === "JSXExpressionContainer" &&
        hrefAttribute.value.expression?.type === "Literal"
      ) {
        hrefValue = hrefAttribute.value.expression.value;
      }

      if (typeof hrefValue === "string" && hrefValue.startsWith("/")) {
        context.report({
          node,
          message: `Use <${NUXT_LINK_COMPONENT}> instead of <a> for internal links — enables client-side navigation and prefetching`,
        });
      }
    },
  }),
};

export const nuxtMissingDefinePageMeta: Rule = {
  create: (context: RuleContext) => ({
    Program(programNode: EsTreeNode) {
      const filename = context.getFilename?.() ?? "";
      if (!PAGE_FILE_PATTERN.test(filename)) return;

      let hasDefinePageMeta = false;
      walkAst(programNode, (child: EsTreeNode) => {
        if (hasDefinePageMeta) return;
        if (
          child.type === "CallExpression" &&
          child.callee?.type === "Identifier" &&
          child.callee.name === "definePageMeta"
        ) {
          hasDefinePageMeta = true;
        }
      });

      if (!hasDefinePageMeta) {
        context.report({
          node: programNode,
          message:
            "Page without definePageMeta — add definePageMeta for route metadata, layout selection, and middleware configuration",
        });
      }
    },
  }),
};

export const nuxtUseAsyncData: Rule = {
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNode) {
      const filename = context.getFilename?.() ?? "";
      if (!PAGE_FILE_PATTERN.test(filename)) return;

      if (node.callee?.type !== "Identifier") return;
      if (node.callee.name !== "fetch" && node.callee.name !== "$fetch") return;

      context.report({
        node,
        message:
          "Use useAsyncData or useFetch instead of raw fetch/$fetch — integrates with SSR, deduplication, and auto-refresh",
      });
    },
  }),
};

export const nuxtUseHead: Rule = {
  create: (context: RuleContext) => ({
    Program(programNode: EsTreeNode) {
      const filename = context.getFilename?.() ?? "";
      if (!PAGE_FILE_PATTERN.test(filename)) return;

      let hasUseHead = false;
      walkAst(programNode, (child: EsTreeNode) => {
        if (hasUseHead) return;
        if (
          child.type === "CallExpression" &&
          child.callee?.type === "Identifier" &&
          child.callee.name === "useHead"
        ) {
          hasUseHead = true;
        }
      });

      if (!hasUseHead) {
        context.report({
          node: programNode,
          message:
            "Page without useHead — add useHead for SEO metadata like title, description, and Open Graph tags",
        });
      }
    },
  }),
};

const describeClientSideRedirect = (node: EsTreeNode): string | null => {
  if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
    const objectName = node.callee.object?.type === "Identifier" ? node.callee.object.name : null;
    const methodName = node.callee.property?.type === "Identifier" ? node.callee.property.name : null;
    if (objectName === "router" && (methodName === "push" || methodName === "replace")) {
      return `router.${methodName}() in onMounted — use navigateTo() for declarative navigation in Nuxt`;
    }
  }

  if (node.type === "AssignmentExpression" && node.left?.type === "MemberExpression") {
    const objectName = node.left.object?.type === "Identifier" ? node.left.object.name : null;
    const propertyName = node.left.property?.type === "Identifier" ? node.left.property.name : null;
    if (objectName === "window" && propertyName === "location") {
      return "window.location assignment in onMounted — use navigateTo() for declarative navigation in Nuxt";
    }
    if (objectName === "location" && propertyName === "href") {
      return "location.href assignment in onMounted — use navigateTo() for declarative navigation in Nuxt";
    }
  }

  return null;
};

export const nuxtNoClientSideRedirect: Rule = {
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNode) {
      if (!isHookCall(node, "onMounted")) return;

      const callback = getEffectCallback(node);
      if (!callback) return;

      walkAst(callback, (child: EsTreeNode) => {
        const description = describeClientSideRedirect(child);
        if (description) {
          context.report({
            node: child,
            message: description,
          });
        }
      });
    },
  }),
};
