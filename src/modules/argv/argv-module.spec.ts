/**
 * Imports
 */

import { ArgvModule } from './argv.module';
import { ArgsConfigPath } from '@argv/constants/argv.constant';

/**
 * Tests
 */

describe('ArgvModule', () => {
    let argv: ArgvModule;

    beforeEach(() => {
        xJet.restoreAllMocks();
        argv = new ArgvModule();
    });

    describe('parseConfigFile', () => {
        test('should read the default path when the line names no configuration', () => {
            expect(argv.parseConfigFile([]).config).toBe(ArgsConfigPath);
        });

        test('should read the path the line names', () => {
            expect(argv.parseConfigFile([ 'node', 'xbuild', '--config', 'build/prod.xbuild.ts' ]).config)
                .toBe('build/prod.xbuild.ts');
        });

        test('should read the path an alias names', () => {
            expect(argv.parseConfigFile([ 'node', 'xbuild', '-c', 'build/prod.xbuild.ts' ]).config)
                .toBe('build/prod.xbuild.ts');
        });

        test('should pass over every other argument the line carries', () => {
            const parsed: any = argv.parseConfigFile([ 'node', 'xbuild', 'src/index.ts', '--bundle', '--nope', 'x' ]);

            expect(parsed.config).toBe(ArgsConfigPath);
            expect(parsed.bundle).toBe(true);
            expect(parsed.nope).toBe('x');
        });

        test('should keep the executable and the script among the positions', () => {
            const parsed: any = argv.parseConfigFile([ 'node', 'xbuild', 'src/index.ts' ]);

            expect(parsed._).toEqual([ 'node', 'xbuild', 'src/index.ts' ]);
        });

        test('should leave help and version switched off', () => {
            const help: any = argv.parseConfigFile([ 'node', 'xbuild', '--help' ]);
            const version: any = argv.parseConfigFile([ 'node', 'xbuild', '--version' ]);

            expect(help.help).toBe(true);
            expect(help.config).toBe(ArgsConfigPath);
            expect(version.version).toBe(true);
        });
    });

    describe('enhancedParse', () => {
        test('should take the files the line names as entry points', () => {
            const parsed = argv.enhancedParse([ 'node', 'xbuild', 'src/app.ts', 'src/cli.ts' ]);

            expect(parsed.entryPoints).toEqual([ 'src/app.ts', 'src/cli.ts' ]);
        });

        test('should read its own options', () => {
            const parsed = argv.enhancedParse([ 'node', 'xbuild', '--bundle', '--minify', '--outdir', 'dist' ]);

            expect(parsed).toEqual(expect.objectContaining({ bundle: true, minify: true, outdir: 'dist' }));
        });

        test('should read an option by its alias', () => {
            const parsed = argv.enhancedParse([ 'node', 'xbuild', '-b', '-o', 'dist', '-f', 'esm', '--tc' ]);

            expect(parsed).toEqual(expect.objectContaining({
                bundle: true, outdir: 'dist', format: 'esm', typeCheck: true
            }));
        });

        test('should read the options the configuration adds', () => {
            const parsed: any = argv.enhancedParse([ 'node', 'xbuild', '--env', 'prod' ], {
                env: { type: 'string' }
            });

            expect(parsed.env).toBe('prod');
        });

        test('should carry the default of an option the configuration adds', () => {
            const parsed: any = argv.enhancedParse([ 'node', 'xbuild' ], {
                env: { type: 'string', default: 'dev' }
            });

            expect(parsed.env).toBe('dev');
        });

        test('should drop the executable and the script', () => {
            const parsed = argv.enhancedParse([ 'node', 'xbuild', '--bundle' ]);

            expect(parsed._).toEqual([]);
            expect(parsed.entryPoints).toBeUndefined();
        });

    });
});
