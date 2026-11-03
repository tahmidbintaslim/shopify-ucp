# Contributing

Thanks for your interest in Universal Agent Gateway. The project is a prototype, so bug reports, fixes and work on the [roadmap](README.md#status-and-roadmap) are all useful.

## Before you start

- For anything larger than a small fix, open an issue first so the approach can be agreed before you write code.
- Security issues go by email, not through issues. See [SECURITY.md](SECURITY.md).

## Set up

Follow [Getting started](README.md#getting-started) in the README. You need Node.js 22.6 or later and PostgreSQL. You can work on the MCP endpoint without a Shopify Partner account by using the placeholder shop in `scripts/demo-shop.sql`.

The project uses npm. Install with `npm ci` so `package-lock.json` stays as it is, and commit lockfile changes only when you change dependencies.

## Checks

Run these before opening a pull request. CI runs the same commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If you change `prisma/schema.prisma`, add a migration with `npm run prisma:migrate` and check it matches the schema:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

Add or update tests in `test/` for changes to the JSON-RPC helpers or other logic that runs without a database.

## Pull requests

- Keep each pull request to one change, and keep commits small.
- Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages, for example `fix(api): ...`, `feat(admin): ...` or `docs: ...`.
- Update the README when you change what the app does, its API or its status. The README describes what the code does today, so do not document features before they work.
- Do not commit secrets. Configuration goes in `.env`, which is ignored; document new variables in `.env.example`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
