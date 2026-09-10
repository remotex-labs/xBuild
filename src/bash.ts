/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ArgumentsInterface } from '@argv/interfaces/argv-module.interface';
import type { ConfigurationInterface } from '@interfaces/configuration.interface';
import type { ServerConfigurationInterface } from '@server/interfaces/server.interface';
import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { rmSync } from 'fs';
import '@errors/uncaught.error';
import { Screen } from '@ui/screen.ui';
import { bannerUi } from '@ui/banner.ui';
import { ArgvModule } from '@argv/argv.module';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { ServerModule } from '@server/server.module';
import { startInteractive } from '@ui/interactive.ui';
import { BuildService } from '@services/build.service';
import { WatchService } from '@services/watch.service';
import { configFileProvider } from '@providers/config-file.provider';

/**
 * Replaces the declared variants with one built from the entry points the command line named.
 *
 * @param config - Configuration read from the file, modified in place
 * @param args - Parsed command line the run was started with
 *
 * @remarks
 * Files named on the command line are a run of their own rather than an addition to what the file declares,
 * so the variants it declares are put aside, and a single variant named `argv` takes their place.
 * A command line naming no entry point leaves the configuration as the file wrote it.
 *
 * @example
 * ```ts
 * // xBuild src/index.ts
 * configureEntryPoints(config, args);
 * config.variants; // { argv: { esbuild: { entryPoints: [ 'src/index.ts' ] } } }
 * ```
 *
 * @since 3.0.0
 */

export function configureEntryPoints(config: xBuildConfigInterface, args: ArgumentsInterface): void {
    if (!args.entryPoints) return;

    config.variants = {
        argv: {
            esbuild: {
                entryPoints: args.entryPoints
            }
        }
    };
}

/**
 * Writes the flags the command line typed onto every variant.
 *
 * @param config - Configuration the overrides are written onto, modified in place
 * @param args - Parsed command line the run was started with
 *
 * @remarks
 * A flag left untyped is left alone rather than written as its default,
 * so what a configuration file states survives everything the command line did not say.
 * The overrides reach every variant, since a flag names what the run is for rather than which variant it is about.
 * Each output directory is also excluded from the watch as it is settled,
 * without which a build would write into the tree it is watching and set off the next one.
 *
 * @example
 * ```ts
 * // xBuild --outdir build --minify
 * applyCommandLineOverrides(config, args);
 * config.watch.filter; // [ '!build/**' ]
 * ```
 *
 * @since 3.0.0
 */

export function applyCommandLineOverrides(config: xBuildConfigInterface, args: ArgumentsInterface): void {
    const commonOutDir = config.common?.esbuild?.outdir ?? 'dist';
    const variants = Object.values(config.variants ?? {});
    if(commonOutDir) {
        config.watch?.filter?.push(`!${ commonOutDir }/**`);
    }

    for (const variant of variants) {
        if (args.types !== undefined) variant.types = args.types;
        if (args.outdir !== undefined) variant.esbuild.outdir = args.outdir;
        if (args.bundle !== undefined) variant.esbuild.minify = args.bundle;
        if (args.minify !== undefined) variant.esbuild.minify = args.minify;
        if (args.tsconfig !== undefined) variant.esbuild.tsconfig = args.tsconfig;
        if (args.platform !== undefined) variant.esbuild.platform = args.platform;
        if (args.declaration !== undefined) variant.declaration = args.declaration;
        if (args.failOnError !== undefined) {
            variant.types = { failOnError: args.failOnError };
        }

        if(variant.esbuild.outdir && variant.esbuild.outdir !== commonOutDir) {
            config.watch?.filter?.push(`!${ variant.esbuild.outdir }/**`);
        }
    }
}

/**
 * Clears the output of an earlier run where the command line asked for it, then builds.
 *
 * @param build - Service the variants are built through
 * @param args - Parsed command line the run was started with
 * @returns A promise settling once every variant asked for has finished
 *
 * @remarks
 * Bound to its two arguments and handed to the screen,
 * so a key or a watch starts the same build the command line asked for.
 * The directory cleared is `dist` rather than whatever the configuration writes to.
 * The `--build` flag decides which variants run, and naming none runs every variant the configuration declares.
 *
 * @since 3.0.0
 */

async function executeBuild(build: BuildService, args: ArgumentsInterface): Promise<void> {
    if (args.clean) rmSync('dist', { recursive: true, force: true });

    await build.build(args.build);
}

/**
 * Starts the development server where either the command line or the configuration asks for one.
 *
 * @param config - Configuration read for its `serve` block
 * @param args - Parsed command line the run was started with
 * @param screen - Screen the server reports through
 * @returns A promise settling once the server is listening, at once when none was asked for
 *
 * @remarks
 * `--serve` carries the directory to serve, so asking for a server and choosing what it serves are the one flag,
 * and a configuration that starts one of its own is honored even where the flag is absent.
 * The directory falls back to the configured one and then to `dist`, which is where a build writes by default.
 * The server reports through the screen rather than to the console,
 * so its address reaches the status line and its requests are held to the level the run reports at.
 *
 * @example
 * ```ts
 * // xBuild --serve dist
 * await startServer(config, args, screen);
 * // [xBuild] → serve http://localhost:3000
 * ```
 *
 * @see ServerModule
 * @since 3.0.0
 */

export async function startServer(config: xBuildConfigInterface, args: ArgumentsInterface, screen: Screen): Promise<void> {
    const shouldStartServer = (args.serve ?? false) !== false || config.serve?.start;
    if (!shouldStartServer) return;

    const serveDir = config.serve?.dir || args.serve || 'dist';
    const server = new ServerModule(<ServerConfigurationInterface> { ...config.serve }, serveDir);
    server.subscribe(screen.serverEvent.bind(screen));

    await server.start();
}

/**
 * Watches the project, rebuilds on a change, and takes the terminal for the shortcuts.
 *
 * @param buildService - Service the rebuilds run through
 * @param config - Configuration read for its `watch` block, and replaced when its file changes
 * @param args - Parsed command line the run was started with
 * @param screen - Screen the rebuilds are announced on
 * @returns A promise settling once the keys are listened for, at once when no watch was asked for
 *
 * @remarks
 * A run is watched where `--watch` asked for it, and also where a server is serving,
 * since output nobody rebuilds is not worth serving.
 * A change refreshes the file model before anything is rebuilt,
 * so the rebuild reads the files as they now are rather than as they were read the first time.
 * Reloading the TypeScript configuration belongs to the screen rather than to the watch,
 * which puts a rebuild started by a key on the same footing as one started by a change.
 * The configuration file is watched by its own version rather than by its path,
 * so an edit to it is reparsed and reapplied while every other change goes straight to a rebuild.
 * The shortcuts are listened for last, since they take the last row of the terminal,
 * and a run that never reaches here leaves the terminal as it found it.
 *
 * @example
 * ```ts
 * // xBuild --watch
 * await startWatchMode(build, config, args, screen);
 * // [xBuild] ↻ rebuild 2 files changed
 * ```
 *
 * @see WatchService
 * @see startInteractive
 *
 * @since 3.0.0
 */

export async function startWatchMode(
    buildService: BuildService, config: xBuildConfigInterface, args: ArgumentsInterface, screen: Screen
): Promise<void> {
    const shouldWatch = args.watch || args.serve !== undefined || config.serve?.start;
    if (!shouldWatch) return;

    const files = inject(FilesModel);
    let configVersion = files.touch(args.config!).version;

    const watchService = new WatchService(process.cwd(), config.watch);
    watchService.subscribe(async (changedFiles) => {
        if(configVersion !== files.touch(args.config!).version) {
            configVersion = files.touch(args.config!).version;
            const config = await configFileProvider(args.config!);
            applyCommandLineOverrides(config, args);
            buildService.configuration = config;
        }

        const count = Object.keys(changedFiles).length;
        await screen.rebuild(`${ count } ${ count === 1 ? 'file' : 'files' } changed`);
    });

    await startInteractive(screen);
}

/**
 * Runs the command line from the banner to the last build.
 *
 * @returns A promise settling once the build has run, or never returning where a check ended the process
 *
 * @remarks
 * The configuration file is found before anything else is parsed, since it is what declares the rest of the flags,
 * and the full parse is written back onto the arguments the provider was handed.
 * The screen is built around the build itself, so a key pressed later starts the same run the command line asked for.
 * A run asking for a type check reports it and leaves from there, since nothing is built for one.
 * The server and the watch are started before the first build,
 * so a rebuild reaches a screen, and the output is served as soon as it is written.
 *
 * @since 3.0.0
 */

async function main(): Promise<void> {
    console.log(bannerUi());

    // Parse configuration
    const argvService = inject(ArgvModule);
    const preConfig = argvService.parseConfigFile(process.argv);

    const args = {} as ArgumentsInterface;
    const config = await configFileProvider(preConfig.config, args);

    // Configure build
    configureEntryPoints(config, args);
    applyCommandLineOverrides(config, args);

    const buildService = new BuildService(config as ConfigurationInterface, args);
    const screen = inject(Screen, executeBuild.bind({}, buildService, args));
    buildService.subscribe(screen.buildEvent.bind(screen));

    if (args.typeCheck) {
        screen.diagnostics(await buildService.typeChack(args.build));
    }

    // Execute build pipeline
    await startServer(config, args, screen);
    await startWatchMode(buildService, config, args, screen);
    await executeBuild(buildService, args);
}

await main();
