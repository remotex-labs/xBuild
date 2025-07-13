/**
 * Import will remove at compile time
 */

import type { Argv } from 'yargs';
import type { ArgvInterface } from '@services/interfaces/cli.interface';
import type { ConfigurationInterface } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { existsSync, readFileSync } from 'fs';
import { xBuildLazy } from '@errors/stack.error';
import { parseConfigurationFile } from '@configuration/parse.configuration';
import { cliConfiguration, tsConfiguration } from '@providers/configuration.provider';

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
 * Tests for the `tsConfiguration` function.
 *
 * The `tsConfiguration` function reads a TypeScript configuration file, parses it, and returns
 * the parsed configuration. These tests validate its behavior under various conditions, ensuring
 * that the function handles different scenarios correctly.
 */

describe('tsConfiguration', () => {
    const mockTsconfigPath = 'path/to/tsconfig.json';

    /**
     * Test case to verify that `tsConfiguration` correctly parses a valid TypeScript configuration file.
     *
     * This test simulates reading a valid tsconfig.json file and verifies that the function
     * parses the configuration correctly and returns the expected result.
     *
     * Code:
     * ```ts
     * const result = tsConfiguration('path/to/tsconfig.json');
     * ```
     * Expected result: The function returns the parsed configuration object as expected, and
     * all relevant functions are called with the correct arguments.
     */

    test('should parse a valid TypeScript configuration file', () => {
        const mockConfigFileContent = JSON.stringify({
            compilerOptions: {
                target: 'es6',
                module: 'commonjs'
            }
        });
        const mockParsedConfig = {
            options: {},
            fileNames: [],
            raw: {},
            errors: []
        };

        (existsSync as jest.Mock).mockImplementationOnce(() => true);
        (readFileSync as jest.Mock).mockReturnValueOnce(mockConfigFileContent);
        (ts.parseConfigFileTextToJson as jest.Mock).mockReturnValue({
            config: JSON.parse(mockConfigFileContent),
            error: null
        });
        (ts.parseJsonConfigFileContent as jest.Mock).mockReturnValue(mockParsedConfig);

        const result = tsConfiguration({
            tsconfig: mockTsconfigPath
        });

        expect(result).toEqual(mockParsedConfig);
        expect(readFileSync).toHaveBeenCalledWith(mockTsconfigPath, 'utf8');
        expect(ts.parseConfigFileTextToJson).toHaveBeenCalledWith(mockTsconfigPath, mockConfigFileContent);
        expect(ts.parseJsonConfigFileContent).toHaveBeenCalled();
    });

    /**
     * Test case to ensure that `tsConfiguration` throws an error when the JSON in the configuration file is invalid.
     *
     * This test simulates a scenario where the tsconfig.json file contains invalid JSON.
     * The function should throw an error indicating the JSON parsing issue.
     *
     * Code:
     * ```ts
     * const result = tsConfiguration('path/to/invalid-config.json');
     * ```
     * Expected result: The function throws an error with a message indicating the JSON parsing issue.
     */

    test('should throw an error for invalid JSON in the configuration file', () => {
        const invalidJson = '{ invalid json }';
        const mockError = {
            messageText: 'Invalid JSON'
        };

        (existsSync as jest.Mock).mockImplementationOnce(() => true);
        (readFileSync as jest.Mock).mockReturnValueOnce(invalidJson);
        (ts.parseConfigFileTextToJson as jest.Mock).mockReturnValue({
            config: null,
            error: mockError
        });
        (ts.formatDiagnosticsWithColorAndContext as jest.Mock).mockReturnValue('Invalid JSON');

        expect(() => tsConfiguration({
            tsconfig: mockTsconfigPath
        })).toThrow('Invalid JSON');
        expect(readFileSync).toHaveBeenCalledWith(mockTsconfigPath, 'utf8');
        expect(ts.parseConfigFileTextToJson).toHaveBeenCalledWith(mockTsconfigPath, invalidJson);
    });

    /**
     * Test case to verify that `tsConfiguration` throws an error when there are TypeScript parsing errors.
     *
     * This test simulates a scenario where the TypeScript configuration file is valid JSON,
     * but contains TypeScript-specific errors that should be handled by the function.
     *
     * Code:
     * ```ts
     * const result = tsConfiguration('path/to/config-with-errors.json');
     * ```
     * Expected result: The function throws an error with a message indicating the TypeScript parsing errors.
     */

    test('should throw an error for TypeScript parsing errors', () => {
        const mockConfigFileContent = JSON.stringify({
            compilerOptions: {
                target: 'es6',
                module: 'commonjs'
            }
        });
        const mockParsingError = {
            messageText: 'Parsing Error'
        };

        (existsSync as jest.Mock).mockImplementationOnce(() => true);
        (readFileSync as jest.Mock).mockReturnValueOnce(mockConfigFileContent);
        (ts.parseConfigFileTextToJson as jest.Mock).mockReturnValue({
            config: JSON.parse(mockConfigFileContent),
            error: null
        });
        (ts.parseJsonConfigFileContent as jest.Mock).mockReturnValue({
            options: {},
            fileNames: [],
            raw: {},
            errors: [ mockParsingError ]
        });
        (ts.formatDiagnosticsWithColorAndContext as jest.Mock).mockReturnValue('Parsing Error');

        expect(() => tsConfiguration({
            tsconfig: mockTsconfigPath
        })).toThrow('Parsing Error');
        expect(readFileSync).toHaveBeenCalledWith(mockTsconfigPath, 'utf8');
        expect(ts.parseConfigFileTextToJson).toHaveBeenCalledWith(mockTsconfigPath, mockConfigFileContent);
        expect(ts.parseJsonConfigFileContent).toHaveBeenCalledWith(
            JSON.parse(mockConfigFileContent),
            ts.sys,
            expect.any(String)
        );
    });

    /**
     * Test case to handle errors thrown when reading the configuration file.
     *
     * This test simulates an error occurring during the file read operation.
     * The function should throw an error with the same message.
     *
     * Code:
     * ```ts
     * const result = tsConfiguration('path/to/file-read-error.json');
     * ```
     * Expected result: The function throws an error with the same message as the file read error.
     */

    test('should handle file read errors', () => {
        const readError = new Error('File read error');

        (existsSync as jest.Mock).mockImplementationOnce(() => true);
        (readFileSync as jest.Mock).mockImplementationOnce(() => {
            throw readError;
        });

        expect(() => tsConfiguration({
            tsconfig: mockTsconfigPath
        })).toThrow('File read error');
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
