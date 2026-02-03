/**
 * Agent Playground - "Test Your Agent"
 * Allows merchants to chat with their own store's AI
 *
 * Route: /app/playground
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  Avatar,
  Badge,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback, useRef, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  searchProducts,
  getProductByHandle,
  createCheckoutLink,
  formatProductsForAI,
} from "../utils/agent-logic";

// --- BACKEND ---

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const profile = await prisma.merchantProfile.findUnique({
    where: { shop },
  });

  return json({
    profile,
    shop,
    isEnabled: profile?.isEnabled ?? false,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const message = formData.get("message") as string;
  const shop = session.shop;

  if (!message) {
    return json({ error: "Message is required" }, { status: 400 });
  }

  try {
    // Simple keyword-based intent detection for playground
    const lowerMessage = message.toLowerCase();

    // Search intent
    if (
      lowerMessage.includes("find") ||
      lowerMessage.includes("search") ||
      lowerMessage.includes("looking for") ||
      lowerMessage.includes("show me") ||
      lowerMessage.includes("want") ||
      lowerMessage.includes("need")
    ) {
      // Extract search query - simple approach
      const searchTerms = message
        .replace(
          /find|search|looking for|show me|i want|i need|can you|please/gi,
          "",
        )
        .trim();

      const products = await searchProducts(
        shop,
        session.accessToken!,
        searchTerms || message,
        5,
      );

      if (products.length === 0) {
        return json({
          response: `I couldn't find any products matching "${searchTerms}". Would you like me to try a different search?`,
          type: "text",
        });
      }

      return json({
        response: `Here's what I found:\n\n${formatProductsForAI(products)}`,
        type: "products",
        data: products,
      });
    }

    // Default response
    return json({
      response: `I understand you're asking about "${message}". Try asking me to:
      
• **Find products**: "Show me red dresses under $50"
• **Get details**: "Tell me about the vintage jacket"
• **Create checkout**: "I want to buy the blue sweater"

How can I help you shop today?`,
      type: "help",
    });
  } catch (error) {
    console.error("Playground error:", error);
    return json({
      response: "Sorry, I encountered an error. Please try again.",
      type: "error",
    });
  }
}

// --- FRONTEND ---

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Playground() {
  const { profile, shop, isEnabled } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `👋 Hi! I'm your AI shopping assistant for ${shop.replace(
        ".myshopify.com",
        "",
      )}. 

I can help customers:
• Find products they're looking for
• Answer questions about your store
• Create instant checkout links

Try chatting with me as if you were a customer!`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const response = fetcher.data as { response: string; type: string };
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
        },
      ]);
    }
  }, [fetcher.data, fetcher.state]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: input,
        timestamp: new Date(),
      },
    ]);

    // Submit to backend
    fetcher.submit({ message: input }, { method: "POST" });
    setInput("");
  }, [input, fetcher]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = fetcher.state === "submitting";

  return (
    <Page
      title="Agent Playground"
      backAction={{ content: "Dashboard", url: "/app" }}
      subtitle="Test how your AI agent interacts with customers"
    >
      <BlockStack gap="500">
        {!isEnabled && (
          <Banner
            title="Agent is currently disabled"
            tone="warning"
            action={{ content: "Activate Agent", url: "/app" }}
          >
            <p>
              Enable your agent from the dashboard to make it live for
              customers.
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card padding="0">
              {/* Chat Header */}
              <Box padding="400" background="bg-surface-secondary">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Avatar initials="AI" size="sm" />
                    <BlockStack gap="050">
                      <Text as="span" variant="headingSm">
                        {shop.replace(".myshopify.com", "")} Assistant
                      </Text>
                      <Badge tone="success" size="small">
                        Online
                      </Badge>
                    </BlockStack>
                  </InlineStack>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Playground Mode
                  </Text>
                </InlineStack>
              </Box>

              <Divider />

              {/* Messages Area */}
              <div
                style={{
                  padding: "16px",
                  minHeight: "400px",
                  maxHeight: "500px",
                  overflowY: "auto",
                }}
              >
                <BlockStack gap="400">
                  {messages.map((msg) => (
                    <Box key={msg.id}>
                      <InlineStack
                        align={msg.role === "user" ? "end" : "start"}
                        gap="200"
                      >
                        {msg.role === "assistant" && (
                          <Avatar initials="AI" size="sm" />
                        )}
                        <Box
                          background={
                            msg.role === "user"
                              ? "bg-fill-info"
                              : "bg-surface-secondary"
                          }
                          padding="300"
                          borderRadius="200"
                          maxWidth="80%"
                        >
                          <Text
                            as="p"
                            variant="bodyMd"
                            tone={
                              msg.role === "user" ? "text-inverse" : undefined
                            }
                          >
                            {msg.content.split("\n").map((line, i) => (
                              <span key={i}>
                                {line}
                                <br />
                              </span>
                            ))}
                          </Text>
                        </Box>
                        {msg.role === "user" && (
                          <Avatar initials="ME" size="sm" />
                        )}
                      </InlineStack>
                    </Box>
                  ))}
                  {isLoading && (
                    <InlineStack align="start" gap="200">
                      <Avatar initials="AI" size="sm" />
                      <Box
                        background="bg-surface-secondary"
                        padding="300"
                        borderRadius="200"
                      >
                        <Text as="p" tone="subdued">
                          Thinking...
                        </Text>
                      </Box>
                    </InlineStack>
                  )}
                  <div ref={messagesEndRef} />
                </BlockStack>
              </div>

              <Divider />

              {/* Input Area */}
              <Box padding="400">
                <InlineStack gap="200" blockAlign="end">
                  <Box width="100%">
                    <TextField
                      label="Message"
                      labelHidden
                      value={input}
                      onChange={setInput}
                      placeholder="Try: 'Show me products under $50' or 'Find me a gift'"
                      autoComplete="off"
                      multiline={1}
                      disabled={isLoading}
                    />
                  </Box>
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    loading={isLoading}
                    disabled={!input.trim()}
                  >
                    Send
                  </Button>
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {/* Tips */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Test Scenarios
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Try these common customer interactions:
                </Text>
                <Divider />
                <BlockStack gap="200">
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setInput("I'm looking for a gift under $50")}
                  >
                    "I'm looking for a gift under $50"
                  </Button>
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setInput("Show me your best sellers")}
                  >
                    "Show me your best sellers"
                  </Button>
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setInput("What's your return policy?")}
                  >
                    "What's your return policy?"
                  </Button>
                  <Button
                    variant="plain"
                    textAlign="left"
                    onClick={() => setInput("Do you have free shipping?")}
                  >
                    "Do you have free shipping?"
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Current Config */}
            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Current Config
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">
                      <strong>Voice:</strong> {profile?.brandVoice || "Default"}
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Free Shipping:</strong>{" "}
                      {profile?.minFreeShipping
                        ? `$${profile.minFreeShipping}+`
                        : "Not set"}
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>Returns:</strong>{" "}
                      {profile?.returnPolicy ? "Configured" : "Not set"}
                    </Text>
                  </BlockStack>
                  <Button url="/app/settings" fullWidth variant="secondary">
                    Edit Configuration
                  </Button>
                </BlockStack>
              </Card>
            </Box>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
