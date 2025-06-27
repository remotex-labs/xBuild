/**
 * Import will remove at compile time
 */

import type Typescript from 'typescript';

/**
 * Represents the core context objects needed for TypeScript language service plugin operations.
 *
 * @remarks
 * This interface encapsulates all the essential TypeScript service components that plugin
 * functions typically need to access. It provides a convenient way to pass these dependencies
 * to various plugin components without having to list them individually as parameters.
 *
 * The context includes references to both the original language service and the proxy
 * service that will be modified by the plugin, as well as the TypeScript namespace and
 * the language service host.
 *
 * @example
 * ```ts
 * // Creating a context object in the plugin factory
 * const context: ModuleContextInterface = {
 *   ts,
 *   proxy,
 *   languageService,
 *   languageServiceHost
 * };
 *
 * // Passing the context to a plugin component
 * registerCustomDiagnostics(context);
 * ```
 *
 * @see Typescript.LanguageServiceHost for host interaction capabilities
 * @see Typescript.LanguageService for details on the TypeScript language service API
 *
 * @since 2.0.0
 */

export interface ModuleContextInterface {
    ts: typeof Typescript;
    proxy: Typescript.LanguageService;
    languageService: Typescript.LanguageService;
    languageServiceHost: Typescript.LanguageServiceHost;
}
