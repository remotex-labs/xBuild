#!/usr/bin/env node

/**
 * Imports
 */

import { bannerComponent } from '@components/banner.component';

/**
 * Banner
 */

console.log(bannerComponent());

function measureTime(fn: any): void {
    const start = performance.now(); // start time in milliseconds
    fn();
    const end = performance.now(); // end time in milliseconds

    const seconds = (end - start) / 1000;
    console.log(`Function took ${ (end - start).toFixed(3) } milliseconds to run.`);
    console.log(`Function took ${ seconds.toFixed(6) } seconds to run.\n\n`);
}

import { TypescriptModule } from '@typescript/typescript.module';

const x = new TypescriptModule('tsconfig.json');
// x.updateFile([ 'src/index.ts' ]);

measureTime(() => {
    const u = x.check();
    console.log(u.join('\n'));
});

measureTime(() => {
    const u = x.check();
    console.log(u.join('\n'));
});


measureTime(() => {
    x.emitBundleDeclarations([ 'src/index.ts' ]);
});
