/**
 * Import will remove at compile time
 */

import type Typescript from 'typescript/lib/tsserverlibrary.js';
import type { ModuleContextInterface } from '@ts-plugin/interfaces/module.interface';

/**
 * Imports
 */

/**
 *
 */


module.exports = function (modules: { typescript: typeof Typescript }): Typescript.server.PluginModule {
    const ts = modules.typescript;

    return {
        create: (info: Typescript.server.PluginCreateInfo): Typescript.LanguageService => {
            const proxy = { ...info.languageService };
            const languageService = info.languageService;
            const languageServiceHost = info.languageServiceHost;
            const context: ModuleContextInterface = {
                ts,
                proxy,
                languageService,
                languageServiceHost
            };

            return proxy;
        }
    };
};
