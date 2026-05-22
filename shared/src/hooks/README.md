# `hooks/`

Cross-package React hooks (e.g. data fetching helpers, shared form logic).

Import from the web app or extension via:

```ts
import { useThing } from '@applymate/shared/hooks/useThing';
```

Add one file per hook; re-export from `src/index.ts` when the hook is part of the public shared API.
