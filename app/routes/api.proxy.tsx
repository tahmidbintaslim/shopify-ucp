/**
 * App Proxy Handler
 * Routes app proxy requests to the correct handler
 */

import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // The App Proxy will route to this handler
  // Check the path and delegate to the right handler
  const url = new URL(request.url);
  const path = url.pathname;

  // Route to UCP endpoint
  if (path.includes(".well-known/ucp") || path.endsWith("/ucp")) {
    // Import and call the UCP loader
    const { loader: ucpLoader } = await import("./api.proxy.ucp");
    return ucpLoader({ request, params: {}, context: {} });
  }

  // Default: return 404
  return new Response("Not found", { status: 404 });
}
