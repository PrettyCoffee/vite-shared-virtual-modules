import { Plugin, UserConfig, ConfigEnv } from 'vite';

type SharedModuleRole = 'provider' | 'consumer';
interface SharedModulesOptions {
  /** Disable the plugin */
  disabled?: (env: ConfigEnv) => boolean;
  /** The role of the app using this plugin.
   *  There must be exactly one provider app.
   **/
  role: SharedModuleRole;
  /** A map of modules to be shared between multiple builds.
   *  The key is the module path and the value is the global variable name.
   *
   *  e.g. { "react": "React", "react-dom/client": "ReactDOM" }
   **/
  modules: Record<string, string>;
}

const getPluginConfig = (
  role: SharedModuleRole,
  moduleMap: Record<string, string>
): UserConfig =>
  role === 'provider'
    ? {}
    : {
        build: {
          rollupOptions: {
            external: Object.keys(moduleMap),
          },
        },
      };

const createProviderScript = (module: string, global: string) => `
  const ${global} = require("${module}");
  if (!window.${global} && !globalThis["${global}"]) {
    window["${global}"] = globalThis["${global}"] = ${global};
  }
  console.log("window.${global}", window["${global}"])
  module.exports = ${global};
`;

const createConsumerScript = (global: string) => `
  console.log("window.${global}", window["${global}"])
  module.exports = window["${global}"];
`;

const VIRTUAL_PREFIX = '/@virtual:shared-modules/';
const virtualId = (id: string) => `${VIRTUAL_PREFIX}${id}.cjs`;

/** Externalize modules in vite to share them between multiple builds.
 *
 *  @returns The plugin to be used in your vite config
 **/
export const sharedModules = ({
  disabled: disabledFn = () => false,
  role,
  modules: moduleMap,
}: SharedModulesOptions): Plugin => {
  let disabled = false;

  const modules = Object.entries(moduleMap).map(([module, global]) => ({
    module,
    global,
    script:
      role === 'provider'
        ? createProviderScript(module, global)
        : createConsumerScript(global),
  }));

  return {
    name: 'shared-modules',
    enforce: 'pre',

    config(_, env) {
      const missingProvider = role === 'consumer' && env.command === 'serve';
      disabled = missingProvider || disabledFn(env);

      return disabled ? {} : getPluginConfig(role, moduleMap);
    },

    resolveId(id, importer) {
      const isVirtualImporter = importer?.startsWith(VIRTUAL_PREFIX);
      if (disabled || isVirtualImporter || !(id in moduleMap)) {
        return null;
      }
      return virtualId(id);
    },

    load(id) {
      const isVirtualModule = id.startsWith(VIRTUAL_PREFIX);
      if (disabled || !isVirtualModule) return null;
      const match = modules.find(({ module }) => virtualId(module) === id);
      return !match ? null : match.script;
    },
  };
};
