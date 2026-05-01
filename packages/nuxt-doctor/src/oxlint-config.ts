import type { Framework } from "./types.js";

const NUXT_RULES: Record<string, string> = {
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
  "nuxt-doctor/prefer-use-fetch-over-use-async-data": "warn",
};

const VUE_RULES: Record<string, string> = {
  "nuxt-doctor/vue-no-deprecated-v-bind-sync": "error",
  "nuxt-doctor/vue-prefer-composition-api": "warn",
  "nuxt-doctor/vue-no-deprecated-events-api": "warn",
  "nuxt-doctor/vue-no-deprecated-filter": "error",
};

const VITEPRESS_RULES: Record<string, string> = {
  "nuxt-doctor/vitepress-no-relative-img": "warn",
  "nuxt-doctor/vitepress-use-theme-config": "warn",
};

const QUASAR_RULES: Record<string, string> = {
  "nuxt-doctor/quasar-no-deprecated-props": "warn",
  "nuxt-doctor/quasar-prefer-vue3-patterns": "warn",
};

interface OxlintConfigOptions {
  pluginPath: string;
  framework: Framework;
  customRulesOnly?: boolean;
}

const BUILTIN_VUE_RULES: Record<string, string> = {
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
  "vue/require-component-is": "warn",
};

const A11Y_RULES: Record<string, string> = {
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
  "jsx-a11y/iframe-has-title": "warn",
};

export const createOxlintConfig = ({
  pluginPath,
  framework,
  customRulesOnly = false,
}: OxlintConfigOptions) => ({
  categories: {
    correctness: "off",
    suspicious: "off",
    pedantic: "off",
    perf: "off",
    restriction: "off",
    style: "off",
    nursery: "off",
  },
  plugins: ["vue", "jsx-a11y", "import"],
  jsPlugins: [pluginPath],
  rules: {
    ...(customRulesOnly ? {} : BUILTIN_VUE_RULES),
    ...(customRulesOnly ? {} : A11Y_RULES),

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

    ...(framework === "nuxt" ? NUXT_RULES : {}),
    ...(framework === "vue" ? VUE_RULES : {}),
    ...(framework === "vitepress" ? VITEPRESS_RULES : {}),
    ...(framework === "quasar" ? QUASAR_RULES : {}),
  },
});
