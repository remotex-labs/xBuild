---
name: 🐞 Bug Report
title: 🐞 Bug Report
about: Something is broken
labels: [ "bug", "needs triage" ]
---

**Describe the bug**

A clear and concise description of what is wrong.

**Reproduction**

A minimal config and the command that triggers the problem.

```ts
// config.xbuild.ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

export const config: xBuildConfig = { /* ... */ };
```

```bash
xBuild src/index.ts --bundle
```

**Expected behavior**

What you expected to happen.

**Actual behavior**

What actually happened. Include the full error message and stack trace if there is one.

```text
Error: ...
    at ...
```

**Environment**

|                                | |
|--------------------------------|-|
| `@remotex-labs/xbuild` version | |
| Node.js version                | |
| TypeScript version             | |
| OS                             | |

**Checklist**

- [ ] I have searched for existing issues, and this is not a duplicate.
- [ ] I am using the latest published version.
- [ ] I have included a minimal reproduction above.
