/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Export interfaces
 */

export type { Options } from 'yargs';
export type * from '@interfaces/types.interface';
export type * from '@interfaces/lifecycle.interface';
export type * from '@interfaces/configuration.interface';
export type * from '@providers/interfaces/log-provider.interface';
export type * from '@providers/interfaces/stack-provider.interface';
export type { ServerConfigurationInterface } from '@server/interfaces/server.interface';
export type { WatchOptionsInterface } from '@services/interfaces/watch-service.interface';

/**
 * Export configuration
 */

export type xBuildConfig = xBuildConfigInterface;

/**
 * Export
 */

export * from '@server/server.module';
export * from '@services/watch.service';
export * from '@providers/stack.provider';
export * from '@typescript/typescript.module';

declare global {
    type DefineType = 'DEBUG' | 'PRODUCTION' | 'TEST' | 'DEV' | 'CI' | 'LOCAL' | string;

    function $$inline<T>(callback: () => T): T | undefined;

    function $$ifdef<T>(define: DefineType, callback: T):
        T extends (...args: infer A) => infer R ? (...args: A) => R | undefined  : T | undefined;

    function $$ifndef<T>(define: DefineType, callback: T):
        T extends (...args: infer A) => infer R ? (...args: A) => R | undefined  : T | undefined;

    var $argv: Record<string, unknown>;
}
