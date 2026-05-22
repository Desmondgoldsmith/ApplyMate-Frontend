# @applymate/web

Next.js **App Router** app (landing + authenticated product surface).

- **Architecture**: feature folders under `src/features/*`, atomic layers under `src/components/{ui,atoms,molecules,organisms}`.
- **Shared code**: import from `@applymate/shared` for types, `cn()`, and cross-platform hooks/components.
- **shadcn/ui**: `components.json` is configured; run `npx shadcn@latest add <component>` from this package directory.
- **Sentry / PostHog**: see `src/lib/README.md` and root `sentry.*.config.ts` files (placeholders wired).

```bash
npm run dev --workspace=@applymate/web
```
