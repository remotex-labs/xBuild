/**
 * Import will remove at compile time
 */

import type { Argv } from 'yargs';
import type { ArgvInterface } from '@services/interfaces/cli.interface';
import type { ConfigurationInterface, PartialDeepConfigurationsType } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import { existsSync } from 'fs';
import { xBuildError } from '@errors/xbuild.error';
import { defaultConfiguration } from '@configuration/default.configuration';
import { parseConfigurationFile } from '@configuration/parse.configuration';

/**
 * Parses CLI arguments and sets the configuration for the application.
 *
 * @param cli - An instance of `Argv<ArgvInterface>` that contains CLI arguments and options.
 * @returns The final configuration object as a `ConfigurationInterface`.
 * @throws Error - Throws an error if critical configuration properties are missing or invalid.
 */

function parseCliArgs(cli: Argv<ArgvInterface>): PartialDeepConfigurationsType {
    const args = <ArgvInterface> cli.argv;

    // Helper function to filter out undefined values
    const pickDefined = <T extends object>(obj: T): PartialDeepConfigurationsType => Object.fromEntries(
        Object.entries(obj).filter(([ , value ]) => value !== undefined)
    );

    const esbuildConfig = pickDefined({
        bundle: args.bundle,
        minify: args.minify,
        outdir: args.outdir,
        tsconfig: args.tsconfig,
        entryPoints: args.file ? [ args.file ] : undefined,
        target: args.node ? [ `node${ process.version.slice(1) }` ] : undefined,
        platform: args.node ? 'node' : undefined,
        format: args.format
    });

    return <PartialDeepConfigurationsType> {
        ...pickDefined({
            dev: args.dev,
            watch: args.watch,
            declaration: args.declaration,
            serve: args.serve ? { active: args.serve } : { undefined }
        }),
        ...{ esbuild: esbuildConfig }
    };
}

/**
 * Merges user configurations with CLI configurations and default settings
 * to produce a final configuration object for the build process.
 * This function handles both single and multiple user configurations,
 * allowing for flexible configuration merging.
 *
 * @param userConfig - An array or a single object of type `PartialDeepConfigurationsType`
 *                     representing the user's configurations to merge. If a single object
 *                     is provided, it is wrapped in an array for processing.
 * @param cliConfig - An optional object of type `PartialDeepConfigurationsType` representing
 *                    the CLI configurations to merge with the user configurations. Defaults to an empty object.
 * @returns An array of `ConfigurationInterface` objects, each representing a merged configuration.
 *
 * @throws xBuildError Throws an error if the `entryPoints` property in the merged configuration is undefined.
 *                       This ensures that the configuration is valid and complete for further processing.
 *
 * @example
 * ```ts
 * import { configuration } from './configuration';
 *
 * const userConfigs = [
 *     { esbuild: { entryPoints: ['src/index.ts'] } },
 *     { serve: { port: 3000 } }
 * ];
 * const cliConfigs = { esbuild: { minify: true } };
 *
 * const finalConfigs = await configuration(userConfigs, cliConfigs);
 * console.log('Merged Configuration:', finalConfigs);
 * ```
 */

export async function configuration(
    userConfig: Array<PartialDeepConfigurationsType> | PartialDeepConfigurationsType, cliConfig: PartialDeepConfigurationsType = {}
): Promise<Array<ConfigurationInterface>> {
    // Check if userConfig is an array and handle accordingly
    const userConfigs: Array<PartialDeepConfigurationsType> = Array.isArray(userConfig) ? userConfig : [ userConfig ];
    const defaultUserConfig = userConfigs[0];

    return userConfigs.flatMap<ConfigurationInterface>((userConfigEntry) => {
        const mergedConfig: ConfigurationInterface = {
            ...defaultConfiguration,
            ...defaultUserConfig,
            ...userConfigEntry,
            ...cliConfig,
            esbuild: {
                ...defaultConfiguration.esbuild,
                ...defaultUserConfig?.esbuild,
                ...userConfigEntry?.esbuild,
                ...cliConfig.esbuild
            },
            serve: {
                ...defaultConfiguration.serve,
                ...defaultUserConfig.serve,
                ...userConfigEntry.serve,
                ...cliConfig.serve
            }
        };

        if (!mergedConfig.esbuild.entryPoints) {
            throw new xBuildError('entryPoints cannot be undefined.');
        }

        return mergedConfig;
    });
}

/**
 * Merges CLI arguments with a configuration file to produce a final configuration object.
 * This function reads the specified configuration file and merges its contents with
 * the CLI arguments provided. The resulting configuration will be validated to ensure
 * that required properties, such as `entryPoints`, are defined.
 *
 * @param configFile - The path to the configuration file to read and merge with CLI arguments.
 * @param cli - An instance of `Argv<ArgvInterface>` containing CLI arguments and options.
 * @returns A promise that resolves to an array of `ConfigurationInterface` objects, representing
 *          the final merged configuration.
 * @throws Error Throws an error if the `entryPoints` property in the final configuration is undefined.
 *                 This ensures that the configuration is valid for further processing.
 *
 * @example
 * ```ts
 * import { cliConfiguration } from './cli-configuration';
 *
 * const configFilePath = './config.json';
 * const cliArgs = argv(); // Assuming `argv` is a function that retrieves CLI arguments
 *
 * cliConfiguration(configFilePath, cliArgs).then((finalConfig) => {
 *     console.log('Final configuration: ', finalConfig);
 * }).catch((error) => {
 *     console.error('Error loading configuration:', error);
 * });
 * ```
 */

export async function cliConfiguration(configFile: string, cli: Argv<ArgvInterface>): Promise<Array<ConfigurationInterface>> {
    const cliConfig = parseCliArgs(cli);
    const userConfig = existsSync(configFile) ? await parseConfigurationFile(configFile) : {};

    return configuration(userConfig, cliConfig);
}
