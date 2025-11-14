#!/usr/bin/env node

/**
 * Import will remove at compile time
 */

import type { xBuildError } from '@errors/xbuild.error';
import type { VMRuntimeError } from '@errors/vm-runtime.error';

/**
 * Imports
 */

import { buildWithArgv } from './index.js';
import { bannerComponent } from '@components/banner.component';

/**
 * Banner
 */

console.log(bannerComponent());

/**
 * Run entrypoint of xBuild
 */

buildWithArgv(process.argv).catch((error: VMRuntimeError & xBuildError) => {
    console.error(error.stack);
    process.exit(1);
});
