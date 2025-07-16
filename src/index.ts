/**
 * Exports
 */

export type * from '@configuration/interfaces/configuration.interface';
export type { BuildResult, OnLoadArgs, OnLoadResult, OnResolveArgs, OnResolveResult, PluginBuild } from 'esbuild';

/**
 * Import will remove at compile time
 */

import type { BuildResult } from 'esbuild';
import type { ArgvInterface } from '@services/interfaces/cli.interface';
import type { PartialDeepConfigurationsType } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import '@errors/stack.error';
import '@errors/uncaught.error';
import { existsSync } from 'fs';
import { argvParser } from '@services/cli.service';
import { BuildService } from '@services/build.service';
import { parseConfigurationFile } from '@configuration/parse.configuration';
import { cliConfiguration, configuration } from '@providers/configuration.provider';

/**
 * Clean cli
 */

global.__ACTIVE_COLOR = true;

/**
 * Main run function that initiates the build process based on CLI arguments.
 *
 * This function parses the CLI arguments, configures the build settings, and executes
 * the appropriate build tasks, including type checking, serving, or running in debug mode.
 *
 * @param argv - An array of strings representing the CLI arguments.
 *
 * @returns A promise that resolves when all build tasks are completed.
 *
 * @example
 * ```ts
 * await buildWithArgv(process.argv);
 * ```
 */

export async function buildWithArgv(argv: Array<string>): Promise<void> {
    const cli = argvParser(argv);
    const args = <ArgvInterface> cli.argv;
    const configs = await cliConfiguration(args.config, cli);
    const buildPromises = configs.map(async (config): Promise<void> => {
        const build = new BuildService(config);

        if (args.serve || config.serve.active)
            return await build.serve();

        if (Array.isArray(args.debug)) {
            if (args.debug.length < 1) {
                args.debug = [ 'index' ];
            }

            return await build.runDebug(args.debug);
        }

        await build.run();
    });

    // Wait for all build promises to resolve
    await Promise.all(buildPromises);
}

/**
 * Builds the project using a configuration file specified by its path.
 *
 * This function reads the configuration from the provided file path, processes it,
 * and initiates the build tasks.
 *
 * @param configFilePath - The path to the configuration file to be used for the build.
 *
 * @returns A promise that resolves to an array of `BuildResult` objects once all build tasks are completed.
 *
 * @throws Error Throws an error if the configuration file does not exist or is invalid.
 *
 * @example
 * ```ts
 * const results = await buildWithPath('./config.ts');
 * console.log('Build results:', results);
 * ```
 */

export async function buildWithConfigPath(configFilePath: string): Promise<BuildResult[]> {
    const userConfig = existsSync(configFilePath) ? await parseConfigurationFile(configFilePath) : {};
    const configs = await configuration(userConfig);
    const buildPromises = configs.map(async (config): Promise<BuildResult> => {
        const build = new BuildService(config);

        return <BuildResult> await build.run();
    });

    return await Promise.all(buildPromises);
}

/**
 * Builds the project based on the provided configuration object.
 *
 * This function processes the given configuration and executes the build tasks accordingly.
 *
 * @param config - A partial configuration object used to define the build settings.
 *
 * @returns A promise that resolves to an array of `BuildResult` objects once all build tasks are completed.
 *
 * @example
 * ```ts
 * const results = await build({ entryPoints: ['./src/index.ts'] });
 * console.log('Build results:', results);
 * ```
 */

export async function build(config: PartialDeepConfigurationsType): Promise<BuildResult[]> {
    const configs = await configuration(config);
    const buildPromises = configs.map(async (config): Promise<BuildResult> => {
        const build = new BuildService(config);

        return <BuildResult> await build.run();
    });

    return await Promise.all(buildPromises);
}
