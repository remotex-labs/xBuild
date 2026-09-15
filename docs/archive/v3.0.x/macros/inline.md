# inline

`$$inline` runs its argument while the build runs and replaces the call with what came back, rendered as source.

::: info 🧠 Add the types
`$$inline` is declared globally by the package. Add it to `types` in `tsconfig.json` so TypeScript knows about it.

```json
{
    "compilerOptions": {
        "types": [ "node", "@remotex-labs/xbuild" ]
    }
}
```

:::

## Syntax

```ts
$$inline(expressionOrCallback)
```

Exactly one argument, a function or a reference to one. A call with any other number of arguments is not a macro
call and is left as it stands.

```ts
export const $$stamp = $$inline(() => 2 + 2);
// export const $$stamp = 4;
```

## What comes back

The value is rendered as the source text that stands in for the call:

| Value                 | Rendered as                          |
|-----------------------|--------------------------------------|
| `number`, `boolean`   | `String(value)`                      |
| `string`              | a JSON string                        |
| an object or an array | JSON                                 |
| a function            | its own source                       |
| `undefined`, `null`   | `undefined`                          |
| a `bigint`            | a quoted string of its digits, exact |
| a `Map` or a `Set`    | `{}`, as `JSON.stringify` produces   |
| a `Date`              | the string its own `toJSON` produced |

::: warning 📦 Objects survive in 3.0.0
v2 rendered anything that was not a string, a number, or a boolean as `undefined`. 3.0.0 serializes objects and
arrays as JSON, so a callback returning a record now reaches the output intact.
:::

```ts
const $$region = $$inline(() => ({ region: 'eu', replicas: 3 }));
// const $$region = {"region":"eu","replicas":3};
```

## Where the callback runs

The callback is taken from the source as written, wrapped in a CommonJS module that calls it, built, and run in a
VM context that shares the host's intrinsics. That has three consequences worth knowing:

- **`require` is bound to the file the call sits in**, so a package the project depends on resolves the way it
  would from that file. Packages stay external and are not bundled into the callback.
- **A relative specifier resolves against the working directory**, not against the file the call sits in.
- **The value crosses back out intact**, so a `RegExp` built inside satisfies `instanceof RegExp` outside.

The context isolates the global scope, not the process: `process` and the timers are reachable. It is a scoping
tool for code the project wrote, not a boundary against code it did not.

```ts
const $$version = $$inline(() => {
    const { readFileSync } = require('fs');

    return JSON.parse(readFileSync('package.json', 'utf8')).version;
});
// const $$version = "3.0.0";
```

::: warning 🗑️ The `context` global is gone
v2.2.0 exposed a `context` global inside the sandbox carrying `variantName`, `argv`, and `options`, along with a
`MacroContextInterface` to declare it. 3.0.0 removed both. Reach the same values through
[`define`](/configuration/file#define) with a function value, which is handed the name and the parsed arguments,
or through a [lifecycle hook](/configuration/lifecycle), which is handed the whole context.

```ts
define: {
    __VARIANT: (name, argv) => String(argv.build ?? 'all')
}
```

:::

## As a statement

An `$$inline` call standing as a statement of its own leaves nothing behind, since its value has nowhere to go.
Reach for it where the point is the side effect at build time:

```ts
$$inline(() => {
    console.log('building', new Date().toISOString());
});
// nothing in the output
```

## Failure

A callback that throws, or code that does not build, is reported as a `macro-inline` error and leaves `undefined`
in its place, so the file stays parsable and the build reports the cause rather than a syntax error downstream.

```text
✗  macro-inline  $$inline failed: ENOENT: no such file or directory, open 'missing.json'
```

## The callback stands alone

Only the argument's own source is taken and built, so the callback carries nothing from the file around it. An
identifier it closes over is not in scope when it runs, and reading one fails as a `macro-inline` error:

```ts
const port = 3000;

const $$port = $$inline(() => port);      // macro-inline: port is not defined
const $$port = $$inline(() => 3000);      // const $$port = 3000;
```

Bring in whatever it needs through `require`, or write the value into the callback.

::: warning 🔗 Function references no longer resolve
v2 accepted a reference to a function declared elsewhere in the file, `$$inline(getPort)`, and warned when it
could not find one. 3.0.0 builds the argument on its own, so a reference reaches nothing. Write the function
inline instead.
:::

::: tip 🔍 Seeing the replacements
Run with `logLevel: 'verbose'`, or press `v` in a watching run, to see what each macro was replaced with.
:::

## See also

- [ifdef](/macros/ifdef) - keep code while a flag is set.
- [ifndef](/macros/ifndef) - keep code while a flag is not.
- [`define`](/configuration/file#define) - values substituted into the source.
