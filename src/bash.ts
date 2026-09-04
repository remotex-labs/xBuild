/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecycleEventsType } from '@interfaces/lifecycle.interface';
import type { ArgumentsInterface } from '@argv/interfaces/argv-module.interface';
import type { ConfigurationInterface } from '@interfaces/configuration.interface';
import type { ServerConfigurationInterface } from '@server/interfaces/server.interface';
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
import { BuildService } from '@services/build.service';
import { WatchService } from '@services/watch.service';
import { createActionPrefix, clearScreen } from '@ui/print.ui';
import { keywordColor, pathColor, mutedColor } from '@ui/color.ui';
import { configFileProvider } from '@providers/config-file.provider';
import { TypescriptService } from '@typescript/services/typescript.service';

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

export function events(event: LifecycleEventsType): void {
    if(event.type === 'start') {
        console.log(`${ createActionPrefix('build') } ${ keywordColor(event.context.variantName) }`);

        return;
    }
}

async function executeBuild(buildService: BuildService, args: ArgumentsInterface): Promise<void> {
    if(args.typeCheck) {
        const result = await buildService.typeChack();
        console.log(result);

        return;
    }

    if(args.clean) {
        rmSync('dist', { recursive: true, force: true });
    }

    await buildService.build();
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
    buildService: BuildService, config: xBuildConfigInterface, args: ArgumentsInterface, url?: string
): Promise<void> {
    const shouldWatch = args.watch || args.serve !== undefined || config.serve?.start;
    if (!shouldWatch) return;

    const files = inject(FilesModel);
    let configVersion = files.touch(args.config!).version;

    const watchService = new WatchService(process.cwd(), config.watch);
    watchService.subscribe(async (changedFiles) => {
        clearScreen();
        files.refreshAll();
        TypescriptService.reload();

        if(configVersion !== files.touch(args.config!).version) {
            configVersion = files.touch(args.config!).version;
            const config = await configFileProvider(args.config!);
            applyCommandLineOverrides(config, args);
            buildService.configuration = config;
        }

        console.log(`${ prefix() } ${ mutedColor('Rebuilding') }: files (${ Object.keys(changedFiles).length })`);
        await executeBuild(buildService, args);
    });
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
    buildService.subscribe(events);

    // Execute build pipeline
    const url = await startServer(config, args);
    await startWatchMode(buildService, config, args, url);
    await executeBuild(buildService, args);
}

await main();
