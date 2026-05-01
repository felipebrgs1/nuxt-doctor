import {
  noGenericHandlerNames,
  noGiantComponent,
  noNestedComponentDefinition,
  noRenderInRender,
} from "./rules/architecture.js";
import {
  noBarrelImport,
  noFullLodashImport,
  noMoment,
  noUndeferredThirdParty,
  preferDynamicImport,
  useLazyMotion,
} from "./rules/bundle-size.js";
import {
  noArrayIndexAsKey,
  noPreventDefault,
} from "./rules/correctness.js";
import {
  noDarkModeGlow,
  noDisabledZoom,
  noGradientText,
  noGrayOnColoredBackground,
  noInlineBounceEasing,
  noInlineExhaustiveStyle,
  noJustifiedText,
  noLayoutTransitionInline,
  noLongTransitionDuration,
  noOutlineNone,
  noPureBlackBackground,
  noSideTabBorder,
  noTinyText,
  noWideLetterSpacing,
  noZIndex9999,
} from "./rules/design.js";
import {
  asyncParallel,
  jsBatchDomCss,
  jsCacheStorage,
  jsCombineIterations,
  jsEarlyExit,
  jsFlatmapFilter,
  jsHoistRegexp,
  jsIndexMaps,
  jsMinMaxLoop,
  jsSetMapLookups,
  jsTosortedImmutable,
} from "./rules/js-performance.js";
import {
  nuxtMissingDefinePageMeta,
  nuxtNoAElement,
  nuxtNoClientSideRedirect,
  nuxtNoImgElement,
  nuxtUseAsyncData,
  nuxtUseHead,
} from "./rules/nuxt.js";
import { noEval, noSecretsInClientCode } from "./rules/security.js";
import {
  vueNoMutatingProps,
  vueNoSideEffectWatch,
  vuePreferComputed,
  vuePreferScriptSetup,
  vuePreferShallowRef,
  vueUseVOnce,
} from "./rules/vue.js";
import type { RulePlugin } from "./types.js";

const plugin: RulePlugin = {
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
    "nuxt-no-client-side-redirect": nuxtNoClientSideRedirect,

    "no-eval": noEval,
    "no-secrets-in-client-code": noSecretsInClientCode,

    "vue-prefer-script-setup": vuePreferScriptSetup,
    "vue-no-side-effect-watch": vueNoSideEffectWatch,
    "vue-prefer-computed": vuePreferComputed,
    "vue-use-v-once": vueUseVOnce,
    "vue-prefer-shallow-ref": vuePreferShallowRef,
    "vue-no-mutating-props": vueNoMutatingProps,
  },
};

export default plugin;
