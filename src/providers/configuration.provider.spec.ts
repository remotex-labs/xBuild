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
import { defaultConfiguration } from '@configuration/default.configuration';
import { parseConfigurationFile } from '@configuration/parse.configuration';

/**
 * Mocks
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

xJet.mock(xBuildLazy).mockReturnValue(<any>{
    get service() {
        return {
            file: 'x'
        };
    }
});

xJet.mock(defaultConfiguration).mockReturnValue(defaultConfig);

beforeEach(() => {
    xJet.resetAllMocks();
});

/**
 * Tests
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
        xJet.resetAllMocks();
    });

    test('should return configuration with default values and merged file values', async () => {
        xJet.mock(existsSync).mockReturnValueOnce(true);
        xJet.mock(parseConfigurationFile).mockReturnValueOnce({
            esbuild: {
                entryPoints: [ './src/index.ts' ]
            }
        } as any);

        const config = await cliConfiguration(mockConfigFilePath, mockArgv);
        expect(config).toEqual([
            {
                ...defaultConfig,
                esbuild: {
                    ...defaultConfig.esbuild,
                    entryPoints: [ './src/index.ts' ],
                    target: [ `node${ process.version.slice(1) }` ],
                    platform: 'node'
                },
                serve: {
                    ...defaultConfig.serve,
                    undefined: undefined // Todo fix mock bug
                }
            }
        ]);
    });

    test('should throw an error if entryPoints is undefined', async () => {
        xJet.mock(existsSync).mockReturnValueOnce(true);
        xJet.mock(parseConfigurationFile).mockReturnValueOnce({ esbuild: {} } as any);

        await expect(cliConfiguration(mockConfigFilePath, <any> { argv: {} }))
            .rejects
            .toThrow('entryPoints cannot be undefined.');
    });
});
