//#region src/plugin/types.d.ts
interface ReportDescriptor {
  node: EsTreeNode;
  message: string;
}
interface RuleContext {
  report: (descriptor: ReportDescriptor) => void;
  getFilename?: () => string;
}
interface RuleVisitors {
  [selector: string]: ((node: EsTreeNode) => void) | (() => void);
}
interface Rule {
  create: (context: RuleContext) => RuleVisitors;
}
interface RulePlugin {
  meta: {
    name: string;
  };
  rules: Record<string, Rule>;
}
interface EsTreeNode {
  type: string;
  [key: string]: any;
}
//#endregion
//#region src/plugin/index.d.ts
declare const plugin: RulePlugin;
//#endregion
export { plugin as default };
//# sourceMappingURL=nuxt-doctor-plugin.d.ts.map