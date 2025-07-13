# Using the ifdef and macros

To enable conditional code inclusion, add a `define` object to your xBuild configuration file:
```ts
export default {
    esbuild: {
        entryPoints: ['./src/main.ts'],
        outdir: 'dist',
        minify: false,
        format: 'esm',
        bundle: true,
    },
    define: {
        DEBUG: true,        // Enables the DEBUG section
        FEATURE_X: false,    // Excludes the FEATURE_X section
    }
};
```

The following example demonstrates how to use the ifdef preprocessor with conditional function definitions:
> Note that `$$logger` will be deleted from all places in your code if the flag is not set in your configuration, 
> keeping your production builds clean and optimized.

```ts
// main.ts

console.log("This code always runs");

// If the `DEBUG` flag is set in your build config, this block will be included
// ifdef DEBUG
export function $$logger(...args: Array<unknown>): void {
    console.log(...args);
}
// endif

// ifdef FEATURE_X
console.log("Feature X is active");
// endif


$$logger('data'); // will be deleted if $$logger does not exist
```
