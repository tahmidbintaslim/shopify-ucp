/**
 * Public Landing Page - Marketing site for Universal Agent Gateway
 * Anyone can visit and install the app to their Shopify store
 */

import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // If shop parameter exists, redirect to OAuth flow
  if (url.searchParams.get("shop")) {
    return redirect(`/auth?${url.searchParams.toString()}`);
  }

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const shopInput = formData.get("shop") as string;

  if (!shopInput) {
    return json({ error: "Please enter your store URL" }, { status: 400 });
  }

  // Normalize the shop domain
  let shop = shopInput.trim().toLowerCase();
  
  // Remove protocol if present
  shop = shop.replace(/^https?:\/\//, "");
  
  // Remove trailing slashes
  shop = shop.replace(/\/+$/, "");
  
  // Add .myshopify.com if not present
  if (!shop.includes(".myshopify.com")) {
    shop = `${shop}.myshopify.com`;
  }

  // Validate format
  const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!shopifyDomainRegex.test(shop)) {
    return json({ error: "Please enter a valid Shopify store URL (e.g., your-store.myshopify.com)" }, { status: 400 });
  }

  // Redirect to OAuth
  return redirect(`/auth?shop=${encodeURIComponent(shop)}`);
}

export default function LandingPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Universal Agent Gateway - Connect AI Agents to Your Shopify Store</title>
        <meta name="description" content="The Stripe for AI Agents. Enable AI assistants like ChatGPT, Claude, and Gemini to help your customers discover and purchase products." />
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #1a1a2e;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          .hero {
            text-align: center;
            padding: 80px 20px;
            color: white;
          }
          .hero h1 {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 20px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
          .hero .subtitle {
            font-size: 1.5rem;
            opacity: 0.95;
            margin-bottom: 40px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          }
          .card {
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            max-width: 500px;
            margin: 0 auto;
          }
          .card h2 {
            font-size: 1.5rem;
            margin-bottom: 8px;
            color: #1a1a2e;
          }
          .card p {
            color: #666;
            margin-bottom: 24px;
          }
          .input-group {
            margin-bottom: 20px;
          }
          .input-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
          }
          .input-group input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .input-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
          }
          .input-group input::placeholder {
            color: #999;
          }
          .error {
            color: #dc3545;
            font-size: 14px;
            margin-top: 8px;
          }
          .btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          }
          .btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }
          .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 30px;
            padding: 60px 20px;
            max-width: 1000px;
            margin: 0 auto;
          }
          .feature {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 12px;
            color: white;
          }
          .feature h3 {
            font-size: 1.25rem;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .feature p {
            opacity: 0.9;
            line-height: 1.6;
          }
          .emoji {
            font-size: 1.5rem;
          }
          .footer {
            text-align: center;
            padding: 40px 20px;
            color: rgba(255,255,255,0.8);
          }
          .footer a {
            color: white;
            text-decoration: underline;
          }
          @media (max-width: 600px) {
            .hero h1 { font-size: 2rem; }
            .hero .subtitle { font-size: 1.1rem; }
            .card { padding: 24px; margin: 0 10px; }
          }
        `}} />
      </head>
      <body>
        <div className="container">
          <section className="hero">
            <h1>🤖 Universal Agent Gateway</h1>
            <p className="subtitle">
              The "Stripe for AI Agents" — Connect ChatGPT, Claude, Gemini, and other AI assistants directly to your Shopify store.
            </p>

            <div className="card">
              <h2>Get Started in 60 Seconds</h2>
              <p>Enter your Shopify store URL to install the app</p>
              
              <Form method="post">
                <div className="input-group">
                  <label htmlFor="shop">Your Shopify Store URL</label>
                  <input
                    type="text"
                    id="shop"
                    name="shop"
                    placeholder="your-store.myshopify.com"
                    required
                    autoComplete="off"
                    autoFocus
                  />
                  {actionData?.error && (
                    <div className="error">{actionData.error}</div>
                  )}
                </div>
                <button type="submit" className="btn" disabled={isSubmitting}>
                  {isSubmitting ? "Connecting..." : "Install Free → "}
                </button>
              </Form>
            </div>
          </section>

          <section className="features">
            <div className="feature">
              <h3><span className="emoji">🛒</span> AI-Powered Sales</h3>
              <p>Let AI agents search products, answer questions, and create checkout links for your customers — automatically.</p>
            </div>
            <div className="feature">
              <h3><span className="emoji">📊</span> Revenue Attribution</h3>
              <p>Track every dollar earned through AI agents. See which conversations convert and optimize your AI strategy.</p>
            </div>
            <div className="feature">
              <h3><span className="emoji">🔧</span> Zero Code Setup</h3>
              <p>Install in one click. Configure your brand voice, policies, and let AI agents represent your store professionally.</p>
            </div>
          </section>

          <footer className="footer">
            <p>Built for the AI commerce revolution 🚀</p>
            <p style={{ marginTop: "10px", fontSize: "14px" }}>
              Powered by <a href="https://shopify.dev" target="_blank" rel="noopener noreferrer">Shopify</a> • 
              Uses <a href="https://spec.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">MCP</a> Protocol
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
