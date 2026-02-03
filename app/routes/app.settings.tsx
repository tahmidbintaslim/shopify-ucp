/**
 * Settings Page - "The Brain Configuration"
 * Allows merchants to customize AI behavior
 *
 * Route: /app/settings
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useSubmit,
  useNavigation,
  Form,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Text,
  BlockStack,
  Banner,
  Box,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// --- BACKEND ---

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const profile = await prisma.merchantProfile.findUnique({
    where: { shop },
  });

  return json({
    profile: profile || {
      brandVoice: "friendly and professional",
      returnPolicy: "",
      shippingInfo: "",
      minFreeShipping: 0,
      customPrompt: "",
    },
    shop,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const brandVoice = formData.get("brandVoice") as string;
  const returnPolicy = formData.get("returnPolicy") as string;
  const shippingInfo = formData.get("shippingInfo") as string;
  const minFreeShipping =
    parseFloat(formData.get("minFreeShipping") as string) || 0;
  const customPrompt = formData.get("customPrompt") as string;

  await prisma.merchantProfile.upsert({
    where: { shop: session.shop },
    update: {
      brandVoice,
      returnPolicy,
      shippingInfo,
      minFreeShipping,
      customPrompt,
      updatedAt: new Date(),
    },
    create: {
      shop: session.shop,
      brandVoice,
      returnPolicy,
      shippingInfo,
      minFreeShipping,
      customPrompt,
      isEnabled: true,
    },
  });

  return json({ status: "success", message: "Settings saved!" });
}

// --- FRONTEND ---

const BRAND_VOICE_OPTIONS = [
  { label: "Friendly and Professional", value: "friendly and professional" },
  { label: "Casual and Fun", value: "casual and fun" },
  { label: "Luxury and Sophisticated", value: "luxury and sophisticated" },
  { label: "Urgent and Action-Oriented", value: "urgent and action-oriented" },
  { label: "Warm and Caring", value: "warm and caring" },
  { label: "Technical and Detailed", value: "technical and detailed" },
];

export default function Settings() {
  const { profile, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isLoading = navigation.state === "submitting";
  const [saved, setSaved] = useState(false);

  // Form state
  const [brandVoice, setBrandVoice] = useState(profile.brandVoice);
  const [returnPolicy, setReturnPolicy] = useState(profile.returnPolicy || "");
  const [shippingInfo, setShippingInfo] = useState(profile.shippingInfo || "");
  const [minFreeShipping, setMinFreeShipping] = useState(
    String(profile.minFreeShipping || ""),
  );
  const [customPrompt, setCustomPrompt] = useState(profile.customPrompt || "");

  // Show saved banner temporarily
  useEffect(() => {
    if (navigation.state === "idle" && saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [navigation.state, saved]);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("brandVoice", brandVoice);
    formData.append("returnPolicy", returnPolicy);
    formData.append("shippingInfo", shippingInfo);
    formData.append("minFreeShipping", minFreeShipping);
    formData.append("customPrompt", customPrompt);

    submit(formData, { method: "POST" });
    setSaved(true);
  }, [
    brandVoice,
    returnPolicy,
    shippingInfo,
    minFreeShipping,
    customPrompt,
    submit,
  ]);

  return (
    <Page
      title="Agent Configuration"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        {saved && navigation.state === "idle" && (
          <Banner
            title="Settings saved!"
            tone="success"
            onDismiss={() => setSaved(false)}
          >
            <p>Your AI agent configuration has been updated.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            {/* Brand Voice */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Brand Voice
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  How should the AI represent your brand when talking to
                  customers?
                </Text>
                <FormLayout>
                  <Select
                    label="Voice Style"
                    options={BRAND_VOICE_OPTIONS}
                    value={brandVoice}
                    onChange={setBrandVoice}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Policies */}
            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Store Policies
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    The AI will use this information to answer customer
                    questions accurately.
                  </Text>
                  <FormLayout>
                    <TextField
                      label="Return Policy"
                      value={returnPolicy}
                      onChange={setReturnPolicy}
                      multiline={4}
                      placeholder="E.g., We offer 30-day returns on all unworn items with original tags..."
                      autoComplete="off"
                    />
                    <TextField
                      label="Shipping Information"
                      value={shippingInfo}
                      onChange={setShippingInfo}
                      multiline={3}
                      placeholder="E.g., Free shipping on orders over $50. Standard delivery takes 3-5 business days..."
                      autoComplete="off"
                    />
                    <TextField
                      label="Free Shipping Threshold"
                      value={minFreeShipping}
                      onChange={setMinFreeShipping}
                      type="number"
                      prefix="$"
                      placeholder="50"
                      helpText="Minimum order value for free shipping. Leave empty if no free shipping."
                      autoComplete="off"
                    />
                  </FormLayout>
                </BlockStack>
              </Card>
            </Box>

            {/* Advanced */}
            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Advanced Configuration
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Add custom instructions for the AI (optional).
                  </Text>
                  <FormLayout>
                    <TextField
                      label="Custom System Prompt"
                      value={customPrompt}
                      onChange={setCustomPrompt}
                      multiline={5}
                      placeholder="E.g., Always mention our current sale. Never recommend competitor products..."
                      helpText="These instructions will be added to the AI's base prompt."
                      autoComplete="off"
                    />
                  </FormLayout>
                </BlockStack>
              </Card>
            </Box>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {/* Preview */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Preview
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This is how your AI agent will describe itself:
                </Text>
                <Box
                  background="bg-surface-secondary"
                  padding="400"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodySm">
                    "I'm a {brandVoice} shopping assistant for{" "}
                    {shop.replace(".myshopify.com", "")}.
                    {minFreeShipping && parseFloat(minFreeShipping) > 0
                      ? ` Free shipping on orders over $${minFreeShipping}!`
                      : ""}
                    "
                  </Text>
                </Box>
              </BlockStack>
            </Card>

            {/* Connection Info */}
            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Connection Info
                  </Text>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm">
                      <strong>UCP Profile:</strong>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued" breakWord>
                      https://{shop}/apps/agent/.well-known/ucp
                    </Text>
                    <Text as="p" variant="bodySm">
                      <strong>MCP Endpoint:</strong>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued" breakWord>
                      {process.env.SHOPIFY_APP_URL || "[APP_URL]"}/api/mcp/
                      {shop}
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Box>

            {/* Save Button */}
            <Box paddingBlockStart="400">
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isLoading}
                fullWidth
                size="large"
              >
                Save Configuration
              </Button>
            </Box>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
