/**
 * Public landing page for the Universal Agent Gateway prototype.
 * The app has not been installed on a real store yet and is not listed in the
 * App Store, so the page links to the source instead of an install form.
 */

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // If shop parameter exists, redirect to OAuth flow
  if (url.searchParams.get("shop")) {
    return redirect(`/auth?${url.searchParams.toString()}`);
  }

  return json({});
}

export const meta: MetaFunction = () => [
  { title: "Universal Agent Gateway (prototype)" },
  {
    name: "description",
    content:
      "A prototype Shopify app with an MCP-style JSON-RPC endpoint that AI agents can call to search a store's catalog. Not production-ready.",
  },
];

// The root layout already renders <html>, <head> and <body>. Rendering them
// again here nested a second document in <body> and broke hydration.
export default function LandingPage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          /* Polaris (loaded by the root layout) fixes html and body at 100%
             height with a grey body; let the page grow with its content. */
          html, body {
            height: auto;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #1a1a2e;
            line-height: 1.5;
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
            line-height: 1.2;
            font-weight: 800;
            margin-bottom: 20px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
          .hero .subtitle {
            font-size: 1.5rem;
            line-height: 1.4;
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
          a.btn {
            display: block;
            text-align: center;
            text-decoration: none;
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
        `,
        }}
      />
      <div className="container">
        <section className="hero">
          <h1>🤖 Universal Agent Gateway</h1>
          <p className="subtitle">
            A prototype Shopify app that gives AI agents an MCP-style endpoint
            for searching a store's catalog.
          </p>

          <div className="card">
            <h2>Prototype: install is not available</h2>
            <p>
              This app is an unfinished prototype. It has not been installed on
              a real store yet, and it is not listed in the Shopify App Store.
            </p>
            <a
              className="btn"
              href="https://github.com/tahmidbintaslim/shopify-ucp"
            >
              View the source on GitHub
            </a>
          </div>
        </section>

        <section className="features">
          <div className="feature">
            <h3>
              <span className="emoji">🛒</span> Product search
            </h3>
            <p>
              Lets agents search products, look up a product by handle and read
              the store's notes. Not yet tested against a real store.
            </p>
          </div>
          <div className="feature">
            <h3>
              <span className="emoji">📊</span> Order attribution
            </h3>
            <p>
              Designed to mark orders that started in an agent conversation. It
              depends on checkout links, which are not built yet, so it records
              nothing.
            </p>
          </div>
          <div className="feature">
            <h3>
              <span className="emoji">🔧</span> Store settings
            </h3>
            <p>
              Lets a merchant set a brand voice, return policy and shipping notes
              for the MCP endpoint to return to agents.
            </p>
          </div>
        </section>

        <footer className="footer">
          <p>An unfinished prototype. Not affiliated with Shopify.</p>
          <p style={{ marginTop: "10px", fontSize: "14px" }}>
            Built on the{" "}
            <a
              href="https://shopify.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              Shopify
            </a>{" "}
            Admin API • Modeled on the{" "}
            <a
              href="https://modelcontextprotocol.io/specification/2024-11-05"
              target="_blank"
              rel="noopener noreferrer"
            >
              MCP
            </a>{" "}
            spec
          </p>
        </footer>
      </div>
    </>
  );
}
