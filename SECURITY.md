# Security policy

## Status

Universal Agent Gateway is a prototype and is not production-ready. Do not install it on a store with real customers or orders.

## Known limitations

These are documented and not yet fixed, so there is no need to report them:

- The MCP endpoint (`/api/mcp/:shop`) has no authentication and no rate limiting. Anyone who knows an installed shop's `myshopify.com` domain can call it, and it runs Admin API product queries with that shop's offline access token.
- Offline access tokens are stored in plain text in the `Session` table.
- `npm audit` reports advisories that need major upgrades (Prisma 7, and Remix 2 to React Router 7).

The [Security](README.md#security) and [Status and roadmap](README.md#status-and-roadmap) sections of the README track these.

## Supported versions

Only the latest commit on `main` gets fixes.

## Reporting a vulnerability

Email **tahmidbintaslimrafi@gmail.com** with a description of the issue, steps to reproduce and the commit you tested. Please do not open a public issue for a vulnerability.

You should get a reply within a few days. Once a fix is merged, the report can be credited in the commit message if you would like.
