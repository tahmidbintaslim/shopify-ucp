// What `shopify app dev` generates: types for the global `shopify` and Polaris tags.
import '@shopify/ui-extensions/checkout/preact';

declare module './src/ThankYou.tsx' {
  const shopify: import('@shopify/ui-extensions/purchase.thank-you.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
