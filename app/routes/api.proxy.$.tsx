/**
 * App Proxy catch-all.
 *
 * Shopify forwards https://<shop>/apps/agent/<path> to /api/proxy/<path>.
 * /api/proxy/ucp is served by api.proxy.ucp.tsx. This splat route also
 * serves the profile at /api/proxy/.well-known/ucp, the URL the theme embed
 * links to, and answers 404 for any other path.
 */

import { type LoaderFunctionArgs } from "@remix-run/node";
import { loader as ucpLoader } from "./api.proxy.ucp";

export async function loader(args: LoaderFunctionArgs) {
  if (args.params["*"] === ".well-known/ucp") {
    return ucpLoader(args);
  }

  return new Response("Not found", { status: 404 });
}
