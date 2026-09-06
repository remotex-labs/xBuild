# ifdef

`$$ifdef` keeps its value while a `define` flag is set, and removes it, along with every reference to the name it
bound, while the flag is not.

::: info 🧠 Add the types
`$$ifdef` is declared globally by the package. Add it to `types` in `tsconfig.json` so TypeScript knows about it.

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
$$ifdef('FLAG', valueOrCallback)
```

| Argument          | Type           | Notes                                              |
|-------------------|----------------|----------------------------------------------------|
| `FLAG`            | string literal | Required, and a literal rather than a variable.    |
| `valueOrCallback` | `unknown`      | Required. A function, an expression, or a literal. |

A call that does not match this shape is left as it stands rather than reported. A macro bound to a name that
does not start with `$$` still expands, and draws a `macro-prefix` warning.

## When a flag counts as set

`define` holds source text rather than values, so the text is what decides.

| `define` entry      | Flag  | Why                              |
|---------------------|-------|----------------------------------|
| `DEBUG: true`       | set   | `'true'`                         |
| `DEBUG: 'anything'` | set   | any other text                   |
| `DEBUG: 0`          | set   | `'0'` is text, not a falsy value |
| `DEBUG: ''`         | set   | the empty string is text too     |
| `DEBUG: false`      | unset | `'false'`                        |
| `DEBUG: null`       | unset | `'null'`                         |
| `DEBUG: undefined`  | unset | `'undefined'`                    |
| not named at all    | unset | the table does not carry it      |

The text is trimmed before the lookup, so padding around it does not change the answer.

::: warning 🔢 `0` and `''` set the flag in 3.0.0
v2 decided on truthiness, so `RETRIES: 0` disabled a macro. 3.0.0 decides on the substituted text, and only
`false`, `null`, `undefined`, and an absent key leave a flag unset. Write `false` where `0` used to mean off.
:::

## Forms

How the second argument is written decides the shape of the replacement.

### A function that is not invoked

Rewritten as a function declaration under the same name, carrying its parameters, its return type, and its
`async` keyword.

```ts
export const $$log = $$ifdef('DEBUG', (message: string) => console.log(message));
```

```ts
// set
export function $$log(message: string) { return console.log(message); }

// unset - the declaration is removed, and every read of $$log becomes undefined
```

### A function the source invokes

Parenthesized and left invoked, so the binding holds the result.

```ts
const $$now = $$ifdef('DEBUG', () => Date.now())();
```

```ts
// set
const $$now = (() => Date.now())();
```

### A macro standing as a statement

The body is inlined where the call stood, with no wrapper around it.

```ts
$$ifdef('DEBUG', () => {
    console.log('init');
    trace();
});
```

```ts
// set
console.log('init');
trace();

// unset - nothing is left behind
```

### A literal or an expression

Substituted as written.

```ts
export const $$feature = $$ifdef('FEATURE_X', true);
export const $$retries = $$ifdef('FEATURE_X', 40);
```

```ts
// set
export const $$feature = true;
export const $$retries = 40;
```

## Dropping reaches across files

3.0.0 collects the conditional macros whose flag does not hold before it rewrites anything, scanning every input
the build reaches rather than one file at a time. A name dropped where it was declared is therefore also dropped
where it is imported:

```ts
// src/debug.ts
export const $$trace = $$ifdef('DEBUG', (message: string) => console.log(message));

// src/index.ts
import { $$trace } from './debug';

$$trace('hello');
```

With `DEBUG` unset, the declaration goes, the import specifier is pruned, an import left with no specifiers is
removed outright, and the call becomes `undefined`. In an expression, a dropped name reads as `undefined`; as a
statement of its own, it leaves nothing behind. Where the name only names something - the `id` of a declaration,
a label, a parameter, a non-computed key - it is left alone.

The set of dropped names is on the shared context as `context.stage.dropped`, so a
[lifecycle hook](/configuration/lifecycle) can read it.

## Scope

The cross-file scan looks at exported top-level bindings alone: `export const NAME = $$ifdef('FLAG', ...)`. A
macro nested in a block, or bound without an export, is still expanded in the file that writes it, but its name is
not dropped elsewhere.

Files under `node_modules` are never rewritten, and a file that carries no `$$` is skipped unless an earlier file
dropped a name it may still use.

::: tip 🔍 Seeing the replacements
Run with `logLevel: 'verbose'`, or press `v` in a watching run, to see what each macro was replaced with.
:::

## See also

- [ifndef](/macros/ifndef) - the same, on the opposite answer.
- [inline](/macros/inline) - evaluate at build time and substitute the result.
- [`define`](/configuration/file#define) - where the flags come from.
