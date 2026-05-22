# @applymate/shared

Workspace package for code reused by **`packages/web`** and **`packages/extension`**.

| Folder        | Purpose                                      |
| ------------- | -------------------------------------------- |
| `components/` | Shared UI primitives (no Next.js-only APIs). |
| `hooks/`      | Shared React hooks.                          |
| `types/`      | Shared TypeScript types.                     |
| `lib/`        | Pure utilities (`cn`, formatters, etc.).     |

Consumed via the `package.json` `exports` field and TypeScript path aliases in each app.
