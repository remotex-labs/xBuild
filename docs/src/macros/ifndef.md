# ifndef

`$$ifndef` is the counterpart of [`$$ifdef`](/macros/ifdef): it keeps its value while a `define` flag is **not**
set, and removes it, along with every reference to the name it bound, while the flag is.

::: info 🧠 Add the types
`$$ifndef` is declared globally by the package. Add it to `types` in `tsconfig.json` so TypeScript knows about it.

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
$$ifndef('FLAG', valueOrCallback)
```

| Argument          | Type           | Notes                                              |
|-------------------|----------------|----------------------------------------------------|
| `FLAG`            | string literal | Required, and a literal rather than a variable.    |
| `valueOrCallback` | `unknown`      | Required. A function, an expression, or a literal. |

## When a flag counts as unset

The same table `$$ifdef` reads, answered the other way round.

| `define` entry     | `$$ifndef` keeps its value  |
|--------------------|-----------------------------|
| `PROD: false`      | yes                         |
| `PROD: null`       | yes                         |
| `PROD: undefined`  | yes                         |
| not named at all   | yes                         |
| `PROD: true`       | no                          |
| `PROD: 0`          | no - `'0'` is text          |
| `PROD: ''`         | no - so is the empty string |
| `PROD: 'anything'` | no                          |

::: warning 🔢 `0` and `''` set the flag in 3.0.0
v2 decided on truthiness, so `PROD: 0` kept an `$$ifndef` value. 3.0.0 decides on the substituted text, and only
`false`, `null`, `undefined`, and an absent key leave a flag unset. Write `false` where `0` used to mean off.
:::

## Forms

Identical to [`$$ifdef`](/macros/ifdef#forms). How the second argument is written decides the shape:

```ts
export const $$devOnly = $$ifndef('PROD', () => console.log('dev mode'));
```

```ts
// PROD unset
export function $$devOnly() { return console.log('dev mode'); }

// PROD set - the declaration is removed, and every read of $$devOnly becomes undefined
```

A function the source invokes stays invoked:

```ts
const $$label = $$ifndef('PROD', (name: string) => `${ name } dev`)('build');
// PROD unset: const $$label = ((name: string) => `${ name } dev`)('build');
```

A macro standing as a statement has its body inlined:

```ts
$$ifndef('PROD', () => {
    installDevTools();
});
// PROD unset: installDevTools();
// PROD set:   nothing
```

A literal or an expression is substituted as written:

```ts
export const $$assertions = $$ifndef('PROD', true);
// PROD unset: export const $$assertions = true;
```

## The two together

Write both to get a value either way, and only one of them survives any given build:

```ts
export const $$log = $$ifndef('PROD', (message: string) => console.log(message));
export const $$noop = $$ifdef('PROD', () => undefined);
```

## Dropping reaches across files

Exactly as with `$$ifdef`: a name dropped where it was declared is pruned from the imports that name it, and its
reads become `undefined`. See [Dropping reaches across files](/macros/ifdef#dropping-reaches-across-files).

::: tip 🔍 Seeing the replacements
Run with `logLevel: 'verbose'`, or press `v` in a watching run, to see what each macro was replaced with.
:::

## See also

- [ifdef](/macros/ifdef) - the same, on the opposite answer.
- [inline](/macros/inline) - evaluate at build time and substitute the result.
- [`define`](/configuration/file#define) - where the flags come from.
