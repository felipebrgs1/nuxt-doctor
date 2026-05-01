// Component / layout thresholds
export const GIANT_COMPONENT_LINE_THRESHOLD = 300;
export const DEEP_NESTING_THRESHOLD = 3;

// Data threshold
export const DUPLICATE_STORAGE_READ_THRESHOLD = 2;
export const SEQUENTIAL_AWAIT_THRESHOLD = 3;

// Security
export const SECRET_MIN_LENGTH_CHARS = 8;
export const AUTH_CHECK_LOOKAHEAD_STATEMENTS = 3;

// Layout / CSS properties
export const LAYOUT_PROPERTIES = new Set([
  "width", "height", "top", "left", "right", "bottom", "padding",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "borderWidth", "fontSize", "lineHeight", "gap",
]);

// Heavy libraries (same concept — dynamic import them)
export const HEAVY_LIBRARIES = new Set([
  "@monaco-editor/react", "monaco-editor", "recharts", "@react-pdf/renderer",
  "vue-quill", "@codemirror/view", "@codemirror/state", "chart.js",
  "vue-chartjs", "@toast-ui/editor", "draft-js",
]);

// Fetch helpers
export const FETCH_CALLEE_NAMES = new Set(["fetch", "$fetch"]);
export const FETCH_MEMBER_OBJECTS = new Set(["axios", "ky", "got"]);

// Index parameter names (for v-for key)
export const INDEX_PARAMETER_NAMES = new Set(["index", "idx", "i"]);

// Barrel index suffixes
export const BARREL_INDEX_SUFFIXES = ["/index", "/index.js", "/index.ts", "/index.tsx", "/index.mjs"];

// Passive events
export const PASSIVE_EVENT_NAMES = new Set(["scroll", "wheel", "touchstart", "touchmove", "touchend"]);

// Loop types
export const LOOP_TYPES = ["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"];

// Auth functions (Nuxt server routes)
export const AUTH_FUNCTION_NAMES = new Set([
  "auth", "getSession", "getUser", "requireAuth",
  "checkAuth", "verifyAuth", "authenticate", "currentUser", "getAuth", "validateSession",
]);

// Secret patterns
export const SECRET_PATTERNS = [
  /^sk_live_/, /^sk_test_/, /^AKIA[0-9A-Z]{16}$/, /^ghp_[a-zA-Z0-9]{36}$/,
  /^gho_[a-zA-Z0-9]{36}$/, /^github_pat_/, /^glpat-/, /^xox[bporas]-/, /^sk-[a-zA-Z0-9]{32,}$/,
];

export const SECRET_VARIABLE_PATTERN = /(?:api_?key|secret|token|password|credential|auth)/i;

export const SECRET_FALSE_POSITIVE_SUFFIXES = new Set([
  "modal", "label", "text", "title", "name", "id", "key", "url", "path", "route",
  "page", "param", "field", "column", "header", "placeholder", "description", "type",
  "icon", "class", "style", "variant", "event", "action", "status", "state", "mode",
  "flag", "option", "config", "message", "error", "display", "view", "component",
  "element", "container", "wrapper", "button", "link", "input", "select", "dialog",
  "menu", "form", "step", "index", "count", "length", "role", "scope", "context",
  "provider", "ref", "handler", "query", "schema", "constant",
]);

// Loading state patterns
export const LOADING_STATE_PATTERN = /^(?:isLoading|isPending|isFetching)$/;

// Nuxt page patterns
export const PAGE_FILE_PATTERN = /\/pages\//;
export const PAGE_FILE_V2_PATTERN = /\/page\.(vue|tsx?|jsx?)$/;
export const APP_DIRECTORY_PATTERN = /\/app\//;

// Nuxt composables
export const VUE_LIFECYCLE_HOOKS = new Set([
  "onMounted", "onUnmounted", "onBeforeMount", "onBeforeUnmount",
  "onUpdated", "onBeforeUpdate", "onActivated", "onDeactivated",
  "onErrorCaptured", "onRenderTracked", "onRenderTriggered",
]);

export const VUE_WATCH_HOOKS = new Set(["watch", "watchEffect"]);

export const VUE_COMPOSABLES = new Set([
  "ref", "reactive", "computed", "shallowRef", "shallowReactive",
  "toRef", "toRefs", "readonly", "shallowReadonly",
  "provide", "inject", "useAttrs", "useSlots",
  "useCssModule", "useCssVars", "useTemplateRef",
]);

export const VUE_ROUTER_COMPOSABLES = new Set([
  "useRoute", "useRouter", "useLink",
]);

export const NUXT_COMPOSABLES = new Set([
  "useAsyncData", "useFetch", "useLazyAsyncData", "useLazyFetch",
  "useHead", "useSeoMeta", "useMeta", "definePageMeta",
  "useRuntimeConfig", "useAppConfig", "useState", "useCookie",
  "useRequestHeaders", "useRequestEvent", "useRequestURL",
  "useRoute", "useRouter", "navigateTo", "abortNavigation",
  "useError", "showError", "clearError", "createError",
  "refreshNuxtData", "reloadNuxtApp",
  "useNuxtApp", "useAppConfig", "useRuntimeConfig",
  "defineNuxtPlugin", "defineNuxtRouteMiddleware", "defineNuxtComponent",
  "useRequestFetch", "onPrehydrate",
]);

// Hooks that accept dependency arrays / watch sources
export const HOOKS_WITH_DEPS = new Set(["watch", "watchEffect"]);

// Iteration methods
export const CHAINABLE_ITERATION_METHODS = new Set(["map", "filter", "forEach", "flatMap"]);

// Storage objects
export const STORAGE_OBJECTS = new Set(["localStorage", "sessionStorage"]);

// Generic handler names
export const GENERIC_EVENT_SUFFIXES = new Set(["Click", "Change", "Input", "Blur", "Focus"]);

// Render function pattern
export const RENDER_FUNCTION_PATTERN = /^render[A-Z]/;

// Helper patterns
export const TRIVIAL_INITIALIZER_NAMES = new Set([
  "Boolean", "String", "Number", "Array", "Object", "parseInt", "parseFloat",
]);

export const SETTER_PATTERN = /^set[A-Z]/;
export const UPPERCASE_PATTERN = /^[A-Z]/;
export const INTERNAL_PAGE_PATH_PATTERN =
  /\/(?:(?:\((?:dashboard|admin|settings|account|internal|manage|console|portal|auth|onboarding|app|ee|protected)\))|(?:dashboard|admin|settings|account|internal|manage|console|portal))\//i;

export const TEST_FILE_PATTERN = /\.(?:test|spec|stories)\.[tj]sx?$/;

// Nuxt navigation
export const NUXT_NAVIGATION_FUNCTIONS = new Set(["navigateTo", "abortNavigation", "createError"]);

// Nuxt server routes
export const NUXT_SERVER_ROUTE_PATTERN = /\/server\//;

// Image / link component
export const NUXT_IMG_COMPONENT = "NuxtImg";
export const NUXT_LINK_COMPONENT = "NuxtLink";

// CSS performance
export const LARGE_BLUR_THRESHOLD_PX = 10;
export const BLUR_VALUE_PATTERN = /blur\((\d+(?:\.\d+)?)px\)/;
export const ANIMATION_CALLBACK_NAMES = new Set(["requestAnimationFrame", "setInterval"]);

// Design thresholds
export const Z_INDEX_ABSURD_THRESHOLD = 100;
export const INLINE_STYLE_PROPERTY_THRESHOLD = 8;
export const SIDE_TAB_BORDER_WIDTH_WITHOUT_RADIUS_PX = 3;
export const SIDE_TAB_BORDER_WIDTH_WITH_RADIUS_PX = 1;
export const SIDE_TAB_TAILWIDTH_WIDTH_WITHOUT_RADIUS = 4;
export const DARK_GLOW_BLUR_THRESHOLD_PX = 4;
export const DARK_BACKGROUND_CHANNEL_MAX = 35;
export const COLOR_CHROMA_THRESHOLD = 30;
export const TINY_TEXT_THRESHOLD_PX = 12;
export const WIDE_TRACKING_THRESHOLD_EM = 0.05;
export const LONG_TRANSITION_DURATION_THRESHOLD_MS = 1000;

// Layout transition
export const BOUNCE_ANIMATION_NAMES = new Set(["bounce", "elastic", "wobble", "jiggle", "spring"]);

// Motion library
export const MOTION_LIBRARY_PACKAGES = new Set(["@vueuse/motion", "vueuse-motion"]);
