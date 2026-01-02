/**
 * Import will remove at compile time
 */

import type { Options } from 'yargs';
import type { BuildOptions } from 'esbuild';

// todo tsdocs

export interface DeclarationConfigInterface {
    bundle?: boolean;
    outDir?: string;
}

export interface TypeCheckerConfigInterface {
    failOnError?: boolean;
}

export interface BuildDefinitionInterface {
    types?: boolean | TypeCheckerConfigInterface;
    define?: Record<string, unknown>;
    esbuild: Omit<BuildOptions, 'plugins' | 'define'>;
    declaration?: boolean | DeclarationConfigInterface;
}

export type CommonConfigType = Partial<BuildDefinitionInterface>;

export interface ConfigurationInterface {
    verbose?: boolean;
    common?: CommonConfigType;
    userArgv?: Record<string, Options>;
    variants: {
        [variant: string]: BuildDefinitionInterface
    };
}
