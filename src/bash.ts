/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ArgumentsInterface } from '@argv/interfaces/argv-module.interface';
import type { ConfigurationInterface } from '@interfaces/configuration.interface';
import type { ServerConfigurationInterface } from '@server/interfaces/server.interface';
import type { InteractiveOptionsInterface } from '@ui/interfaces/interactive-ui.interface';
import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { rmSync } from 'fs';
import { ArgvModule } from '@argv/argv.module';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { bannerUi, prefix } from '@ui/banner.ui';
import { ServerModule } from '@server/server.module';
import { startInteractive } from '@ui/interactive.ui';
import { BuildService } from '@services/build.service';
import { WatchService } from '@services/watch.service';
import { configFileProvider } from '@providers/config-file.provider';
import { TypescriptService } from '@typescript/services/typescript.service';
import { keywordColor, pathColor, mutedColor, infoColor } from '@ui/color.ui';
import { clearScreen, createActionPrefix, printDiagnostics, printEvent, RELOAD_SYMBOL } from '@ui/print.ui';

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

async function executeBuild(build: BuildService, args: ArgumentsInterface): Promise<void> {
    if (args.typeCheck) return printDiagnostics(await build.typeChack(args.build));
    if (args.clean) rmSync('dist', { recursive: true, force: true });

    await build.build(args.build);
}

/**
 * Clears what the last build left, says what set this one off, and runs it.
 *
 * @param build - The build service the run drives
 * @param args - The command line the run was started with
 * @param reason - What asked for the build, such as the files that changed or the key that was pressed
 *
 * @remarks
 * Every rebuild of a watch goes through here - the ones a file change asks for and the ones a keystroke does -
 * so the screen is cleared and the run is announced the same way whichever set it off.
 *
 * @since 3.0.0
 */

async function rebuild(build: BuildService, args: ArgumentsInterface, reason: string): Promise<void> {
    clearScreen();
    console.log(`${ prefix() } ${ infoColor.dim(RELOAD_SYMBOL) } ${ mutedColor(reason) }`);

    await executeBuild(build, args);
}

export async function startServer(config: xBuildConfigInterface, args: ArgumentsInterface): Promise<string | undefined> {
    const shouldStartServer = (args.serve ?? false) !== false || config.serve?.start;
    if (!shouldStartServer) return;

    let urlString = undefined;
    const serveDir = config.serve?.dir || args.serve || 'dist';
    const serverConfig: ServerConfigurationInterface = {
        ...config.serve,
        onStart({ host, port, url }): void {
            urlString = url;
            console.log(`${ createActionPrefix('serve') } ${ keywordColor(serveDir) } ${ pathColor(url) }\n`);
            config.serve?.onStart?.({ host, port, url });
        }
    };

    const server = new ServerModule(serverConfig, serveDir);
    await server.start();

    return urlString;
}

export async function startWatchMode(
    buildService: BuildService, config: xBuildConfigInterface, args: ArgumentsInterface, interactive: InteractiveOptionsInterface
): Promise<void> {
    const shouldWatch = args.watch || args.serve !== undefined || config.serve?.start;
    if (!shouldWatch) return;

    const files = inject(FilesModel);
    let configVersion = files.touch(args.config!).version;

    const watchService = new WatchService(process.cwd(), config.watch);
    watchService.subscribe(async (changedFiles) => {
        files.refreshAll();
        TypescriptService.reload();

        if(configVersion !== files.touch(args.config!).version) {
            configVersion = files.touch(args.config!).version;
            const config = await configFileProvider(args.config!);
            applyCommandLineOverrides(config, args);
            buildService.configuration = config;
        }

        const count = Object.keys(changedFiles).length;
        await rebuild(buildService, args, `${ count } ${ count === 1 ? 'file' : 'files' } changed`);
    });

    startInteractive(interactive);
}

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
    const interactive: InteractiveOptionsInterface = {
        verbose: args.verbose ?? false,
        build: () => rebuild(buildService, args, 'rebuilding'),
        reload: async () => {
            await buildService.reload();
            await rebuild(buildService, args, 'reloading');
        }
    };

    buildService.subscribe(event => printEvent(event, interactive.verbose));

    // Execute build pipeline
    interactive.url = await startServer(config, args);
    await startWatchMode(buildService, config, args, interactive);
    await executeBuild(buildService, args);
}

await main();
