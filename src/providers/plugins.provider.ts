/**
 * Import will remove at compile time
 */

import type { OnLoadResult, OnResolveArgs, OnResolveResult, Plugin } from 'esbuild';
import type { Message, OnLoadArgs, BuildResult, OnEndResult, PluginBuild } from 'esbuild';
import type { OnEndType, OnStartType, OnResolveType } from '@providers/interfaces/plugins.interface';
import type { OnLoadType, PluginsBuildStateInterface } from '@providers/interfaces/plugins.interface';

/**
 * Imports
 */

import { promises } from 'fs';
import { resolve } from 'path';

/**
 * Plugin provider for esbuild that registers hooks for lifecycle events such as onStart, onEnd, onResolve, and onLoad.
 * This class allows dynamic behavior by registering multiple hooks for different stages of the build process.
 */

export class PluginsProvider {
    /**
     * Holds the build state that hooks can modify.
     */

    private buildState: PluginsBuildStateInterface = {};

    /**
     * Holds the registered hooks for the `onEnd` lifecycle event.
     * This array contains functions that are called after the build process completes.
     */

    private onEndHooks: Array<OnEndType> = [];

    /**
     * Holds the registered hooks for the `onSuccess` lifecycle event.
     * This array contains functions that are called after the build success finish.
     */

    private onSuccess: Array<OnEndType> = [];

    /**
     * Holds the registered hooks for the `onLoad` lifecycle event.
     * This array contains functions that are called when esbuild attempts to load a module.
     */

    private onLoadHooks: Array<OnLoadType> = [];

    /**
     * Holds the registered hooks for the `onStart` lifecycle event.
     * This array contains functions that are called before the build process starts.
     */

    private onStartHooks: Array<OnStartType> = [];

    /**
     * Holds the registered hooks for the `onResolve` lifecycle event.
     * This array contains functions that are called when esbuild attempts to resolve a module path.
     */

    private onResolveHooks: Array<OnResolveType> = [];

    /**
     * Registers a hook function for the `onStart` lifecycle event.
     * The hook will be called before the build process starts.
     *
     * @param fn - A function of type `OnStartType` that will be executed when the build process starts.
     *
     * @example
     * ```ts
     * pluginProvider.registerOnStart(async (build) => {
     *   console.log('Build started:', build);
     * });
     * ```
     */

    registerOnStart(fn: OnStartType | undefined): void {
        if (fn)
            this.onStartHooks.push(fn);
    }

    /**
     * Registers a hook function for the `onEnd` lifecycle event.
     * The hook will be called after the build process completes.
     *
     * @param fn - A function of type `OnEndType` that will be executed after the build completes.
     *
     * @example
     * ```ts
     * pluginProvider.registerOnEnd(async (result) => {
     *   console.log('Build finished:', result);
     * });
     * ```
     */

    registerOnEnd(fn: OnEndType | undefined): void {
        if (fn)
            this.onEndHooks.push(fn);
    }

    /**
     * Registers a hook function for the `onSuccess` lifecycle event.
     * The hook will be called after the build success completes.
     *
     * @param fn - A function of type `OnEndType` that will be executed after the build completes.
     *
     * @example
     * ```ts
     * pluginProvider.registerOnSuccess(async (result) => {
     *   console.log('Build Success finished:', result);
     * });
     * ```
     */

    registerOnSuccess(fn: OnEndType | undefined): void {
        if (fn)
            this.onSuccess.push(fn);
    }

    /**
     * Registers a hook function for the `onResolve` lifecycle event.
     * The hook will be called when esbuild attempts to resolve a module path.
     *
     * @param fn - A function of type `OnResolveType` that will be executed during module resolution.
     *
     * @example
     * ```ts
     * pluginProvider.registerOnResolve(async (args) => {
     *   if (args.path === 'my-module') {
     *     return { path: './src/my-module.ts' };
     *   }
     *   return null;
     * });
     * ```
     */

    registerOnResolve(fn: OnResolveType | undefined): void {
        if (fn)
            this.onResolveHooks.push(fn);
    }

    /**
     * Registers a hook function for the `onLoad` lifecycle event.
     * The hook will be called when esbuild attempts to load a module.
     *
     * @param fn - A function of type `OnLoadType` that will be executed during module loading.
     *
     * @example
     * ```ts
     * pluginProvider.registerOnLoad(async (contents, loader, args) => {
     *   if (args.path.endsWith('.json')) {
     *     return { contents: JSON.stringify({ key: 'value' }), loader: 'json' };
     *   }
     *   return null;
     * });
     * ```
     */

    registerOnLoad(fn: OnLoadType | undefined): void {
        if (fn)
            this.onLoadHooks.push(fn);
    }

    /**
     * Registers esbuild plugin hooks and sets up the middleware plugin.
     *
     * This function defines the setup for an esbuild plugin, enabling hooks for various lifecycle events:
     * onStart, onEnd, onResolve, and onLoad. It ensures that hooks registered by the user are called at
     * the appropriate stages of the build process.
     *
     * @returns An object with the plugin configuration that can be passed to esbuild's `plugins` array.
     * The configuration includes the plugin name and setup function.
     *
     * @example
     * ```ts
     * // Example usage with esbuild:
     * const esbuild = require('esbuild');
     * const pluginProvider = new PluginsProvider();
     *
     * esbuild.build({
     *   entryPoints: ['./src/index.ts'],
     *   bundle: true,
     *   plugins: [pluginProvider.setup()],
     * }).catch(() => process.exit(1));
     * ```
     */

    setup(): Plugin {
        return {
            name: 'middleware-plugin',
            setup: (build: PluginBuild): void => {
                build.initialOptions.metafile = true;
                build.onEnd(this.handleOnEnd.bind(this));
                build.onStart(this.handleOnStart.bind(this, build));
                build.onLoad({ filter: /.*/ }, this.handleOnLoad.bind(this));
                build.onResolve({ filter: /.*/ }, this.handleOnResolve.bind(this));
            }
        };
    }

    /**
     * Executes all registered onStart hooks.
     *
     * This function is called when the build process starts and invokes each hook registered via
     * `registerOnStart`. Hooks can perform actions such as initializing tasks, logging, or setting
     * up build conditions.
     *
     * @param build - The esbuild `PluginBuild` object that represents the current build process.
     *
     * @returns A promise that resolves when all hooks have been executed.
     *
     * @example
     * ```ts
     * // Registering an onStart hook
     * pluginProvider.registerOnStart(async (build) => {
     *   console.log('Build started:', build);
     * });
     * ```
     */

    private async handleOnStart(build: PluginBuild): Promise<OnEndResult> {
        this.buildState = {};
        const result: Required<OnEndResult> = {
            errors: [],
            warnings: []
        };

        for (const hook of this.onStartHooks) {
            const status = await hook(build, this.buildState);
            if (status) {
                if (status.errors?.length)
                    result.errors.push(...status.errors);

                if (status.warnings?.length)
                    result.warnings.push(...status.warnings);
            }
        }

        return result;
    }

    /**
     * Executes all registered onEnd hooks after the build finishes.
     *
     * This function is called after the build process completes and invokes each hook registered via
     * `registerOnEnd`. Hooks can be used to process the build results, such as performing analysis or cleanup.
     *
     * @param buildResult - The build buildResult object provided by esbuild, containing details about the build process.
     *
     * @returns A promise that resolves when all hooks have been executed.
     *
     * @example
     * ```ts
     * // Registering an onEnd hook
     * pluginProvider.registerOnEnd(async (buildResult) => {
     *   console.log('Build completed:', buildResult);
     * });
     * ```
     */

    private async handleOnEnd(buildResult: BuildResult): Promise<OnEndResult> {
        const result: Required<OnEndResult> = {
            errors: buildResult.errors ?? [],
            warnings: buildResult.warnings ?? []
        };

        for (const hook of this.onEndHooks) {
            // Update buildResult with the current errors and warnings from result
            buildResult.errors = <Message[]> result.errors;
            buildResult.warnings = <Message[]> result.warnings;
            const status = await hook(buildResult, this.buildState);

            // Merge errors and warnings from the hook status
            if (status) {
                if (status.errors?.length)
                    result.errors.push(...status.errors);

                if (status.warnings?.length)
                    result.warnings.push(...status.warnings);
            }
        }

        if(result.errors.length < 1) {
            for (const hook of this.onSuccess) {
                await hook(buildResult, this.buildState);
            }
        }

        return result;
    }

    /**
     * Resolves module imports using registered onResolve hooks.
     *
     * This function is called whenever esbuild attempts to resolve a module path. It iterates over all registered
     * onResolve hooks and merges their results. If no hook resolves a path, `null` is returned.
     *
     * @param args - The esbuild `OnResolveArgs` object containing information about the module being resolved.
     *
     * @returns A promise that resolves to an `OnResolveResult` containing the resolved path, or `null` if no path is found.
     *
     * @example
     * ```ts
     * // Registering an onResolve hook
     * pluginProvider.registerOnResolve(async (args) => {
     *   if (args.path === 'my-module') {
     *     return { path: './src/my-module.ts' };
     *   }
     *   return null;
     * });
     * ```
     */

    private async handleOnResolve(args: OnResolveArgs): Promise<OnResolveResult | null> {
        let result: OnResolveResult = {};
        for (const hook of this.onResolveHooks) {
            const hookResult = await hook(args, this.buildState);
            if (hookResult) {
                result = {
                    ...result,
                    ...hookResult,
                    path: hookResult.path || result.path
                };
            }
        }

        return result.path ? result : null;
    }

    /**
     * Loads module contents using registered onLoad hooks.
     *
     * This function is called when esbuild attempts to load a module. It reads the module contents and then
     * processes it through all registered onLoad hooks. The hooks can modify the contents and loader type.
     *
     * @param args - The esbuild `OnLoadArgs` object containing information about the module being loaded.
     *
     * @returns A promise that resolves to an `OnLoadResult` containing the module contents and loader, or `null` if no contents are loaded.
     *
     * @example
     * ```ts
     * // Registering an onLoad hook
     * pluginProvider.registerOnLoad(async (contents, loader, args) => {
     *   if (args.path.endsWith('.json')) {
     *     return { contents: JSON.stringify({ key: 'value' }), loader: 'json' };
     *   }
     *   return null;
     * });
     * ```
     */

    private async handleOnLoad(args: OnLoadArgs): Promise<OnLoadResult | null> {
        let result: OnLoadResult = { contents: undefined, loader: 'default' };
        const filePath = resolve(args.path);

        if (!result.contents) {
            result.contents = await promises.readFile(filePath, 'utf8');
        }

        for (const hook of this.onLoadHooks) {
            const hookResult = await hook(result.contents ?? '', result.loader, args, this.buildState);
            if (hookResult) {
                result = {
                    ...result,
                    ...hookResult,
                    contents: hookResult.contents || result.contents,
                    loader: hookResult.loader || result.loader
                };
            }
        }

        return result.contents ? result : null;
    }
}
