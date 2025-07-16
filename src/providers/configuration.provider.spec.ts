/**
 * Import will remove at compile time
 */

import type { Argv } from 'yargs';
import type { ArgvInterface } from '@services/interfaces/cli.interface';
import type { ConfigurationInterface } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import { existsSync } from 'fs';
import { xBuildLazy } from '@errors/stack.error';
import { cliConfiguration } from '@providers/configuration.provider';
import { parseConfigurationFile } from '@configuration/parse.configuration';

/**
 * Mocks
 */

jest.mock('@configuration/parse.configuration');
jest.mock('@configuration/default.configuration', () => ({
    defaultConfiguration: {
        dev: true,
        watch: false,
        declaration: true,
        esbuild: {
            bundle: true,
            minify: false,
            outdir: './dist',
            tsconfig: './tsconfig.json'
        },
        serve: {
            port: 3000,
            host: 'localhost',
            active: false
        }
    }
}));

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue(JSON.stringify({
        version: 3,
        file: 'index.js',
        sources: [ 'source.js' ],
        names: [],
        mappings: 'AAAA',
        sourcesContent: [ 'asd' ]
    }))
}));

jest.mock('typescript', () => ({
    parseConfigFileTextToJson: jest.fn(),
    parseJsonConfigFileContent: jest.fn(),
    formatDiagnosticsWithColorAndContext: jest.fn(),
    sys: {
        getCurrentDirectory: jest.fn(),
        newLine: '\n'
    }
}));

/**
 * Base configuration
 */

const defaultConfig: ConfigurationInterface = <any> {
    dev: true,
    watch: false,
    declaration: true,
    esbuild: {
        bundle: true,
        minify: false,
        outdir: './dist',
        tsconfig: './tsconfig.json'
    },
    serve: {
        port: 3000,
        host: 'localhost',
        active: false
    }
};

beforeEach(() => {
    jest.spyOn(xBuildLazy, 'service', 'get').mockReturnValue(<any> {
        file: 'x'
    });
});

/**
 * Tests for the `configuration` function.
 *
 * The `configuration` function retrieves the configuration from a specified file and merges it
 * with default values and command-line arguments. These tests ensure that the configuration is
 * correctly parsed and merged, or that errors are thrown when necessary.
 */

describe('configuration', () => {
    const mockConfigFilePath = 'path/to/config/file.json';
    const mockArgv: Argv<ArgvInterface> = <any> {
        argv: {
            dev: true,
            watch: false,
            declaration: true,
            bundle: true,
            minify: false,
            outdir: './dist',
            tsconfig: './tsconfig.json',
            file: './src/index.ts',
            node: true
        }
    };

    beforeEach(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
    });

    /**
     * Test case to verify that the `configuration` function returns the correct configuration
     * by merging the default configuration with values from the configuration file and CLI arguments.
     *
     * Code:
     * ```ts
     * const config = await configuration(mockConfigFilePath, mockArgv);
     * ```
     * Expected result: The configuration is correctly merged and returned.
     */

    test('should return configuration with default values and merged file values', async () => {
        (existsSync as jest.Mock).mockReturnValueOnce(true);
        (parseConfigurationFile as jest.Mock).mockReturnValueOnce({
            esbuild: {
                entryPoints: [ './src/index.ts' ]
            }
        });

        const config = await cliConfiguration(mockConfigFilePath, mockArgv);
        expect(config).toEqual([
            {
                ...defaultConfig,
                esbuild: {
                    ...defaultConfig.esbuild,
                    entryPoints: [ './src/index.ts' ],
                    target: [ `node${ process.version.slice(1) }` ],
                    platform: 'node'
                }
            }
        ]);
    });

    /**
     * Test case to verify that `configuration` throws an error when the configuration file cannot be found.
     *
     * This test simulates a scenario where the specified configuration file does not exist,
     * and the function should throw an error.
     *
     * Code:
     * ```ts
     * const config = await configuration('nonexistent/file.json', mockArgv);
     * ```
     * Expected result: The function throws an error indicating the file could not be found.
     */

    test('should throw an error if entryPoints is undefined', async () => {
        jest.spyOn(xBuildLazy, 'service', 'get').mockReturnValue(<any> {
            file: 'x'
        });

        (existsSync as jest.Mock).mockReturnValueOnce(true);
        (parseConfigurationFile as jest.Mock).mockReturnValueOnce({ esbuild: {} });

        await expect(cliConfiguration(mockConfigFilePath, <any> { argv: {} }))
            .rejects
            .toThrow('entryPoints cannot be undefined.');
    });
});
