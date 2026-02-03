/**
 * App Layout
 * Wraps all /app routes with Shopify app bridge and navigation
 */

import { Outlet } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export default function App() {
  return (
    <AppProvider isEmbeddedApp apiKey={process.env.SHOPIFY_API_KEY || ""}>
      <Outlet />
    </AppProvider>
  );
}
