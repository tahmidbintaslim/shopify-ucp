/**
 * Merchant Dashboard - "The Command Center"
 * Shows revenue stats, agent status, and quick actions
 *
 * Route: /app
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineGrid,
  Badge,
  Banner,
  Box,
  Divider,
  DataTable,
  EmptyState,
  SkeletonBodyText,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  XCircleIcon,
  CashDollarIcon,
  ChatIcon,
  CartIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// --- BACKEND: Load Data & Handle Actions ---

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch Merchant Profile & Stats
  const profile = await prisma.merchantProfile.findUnique({
    where: { shop },
    include: {
      interactions: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
    },
  });

  // Calculate analytics
  const stats = await prisma.agentInteraction.groupBy({
    by: ["converted"],
    where: { merchant: { shop } },
    _count: true,
    _sum: { orderValue: true, potentialValue: true },
  });

  const convertedStats = stats.find((s) => s.converted === true);
  const allStats = stats.reduce(
    (acc, s) => ({
      totalInteractions: acc.totalInteractions + s._count,
      totalRevenue: acc.totalRevenue + (s._sum.orderValue || 0),
      potentialRevenue: acc.potentialRevenue + (s._sum.potentialValue || 0),
    }),
    { totalInteractions: 0, totalRevenue: 0, potentialRevenue: 0 },
  );

  const conversions = convertedStats?._count || 0;
  const conversionRate =
    allStats.totalInteractions > 0
      ? ((conversions / allStats.totalInteractions) * 100).toFixed(1)
      : "0";

  // Get missed opportunities
  const missedOpportunities = await prisma.missedOpportunity.findMany({
    where: { shop },
    orderBy: { count: "desc" },
    take: 5,
  });

  // Check setup status
  const isSetupComplete = !!profile?.returnPolicy && !!profile?.brandVoice;

  return json({
    profile,
    stats: {
      totalRevenue: allStats.totalRevenue,
      potentialRevenue: allStats.potentialRevenue,
      totalInteractions: allStats.totalInteractions,
      conversions,
      conversionRate,
    },
    recentInteractions: profile?.interactions || [],
    missedOpportunities,
    isSetupComplete,
    shop,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle_agent") {
    const isEnabled = formData.get("isEnabled") === "true";

    await prisma.merchantProfile.upsert({
      where: { shop: session.shop },
      update: { isEnabled },
      create: {
        shop: session.shop,
        isEnabled,
        brandVoice: "friendly and professional",
        minFreeShipping: 50,
      },
    });

    return json({ status: "success", isEnabled });
  }

  return json({ status: "error", message: "Unknown action" });
}

// --- FRONTEND: The Dashboard UI ---

export default function Dashboard() {
  const {
    profile,
    stats,
    recentInteractions,
    missedOpportunities,
    isSetupComplete,
    shop,
  } = useLoaderData<typeof loader>();

  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const isAgentActive = profile?.isEnabled ?? false;

  const handleToggle = () => {
    submit(
      { intent: "toggle_agent", isEnabled: String(!isAgentActive) },
      { method: "POST" },
    );
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  // Format recent interactions for data table
  const recentRows = recentInteractions.map((i: any) => [
    new Date(i.timestamp).toLocaleDateString(),
    i.userIntent,
    i.inputQuery || "-",
    i.converted ? (
      <Badge tone="success">Converted</Badge>
    ) : i.checkoutUrl ? (
      <Badge tone="attention">Pending</Badge>
    ) : (
      <Badge>Browsing</Badge>
    ),
    i.orderValue ? formatCurrency(i.orderValue) : "-",
  ]);

  return (
    <Page title="Universal Agent Gateway">
      <BlockStack gap="500">
        {/* Onboarding Banner */}
        {!isSetupComplete && (
          <Banner
            title="Complete your Agent Profile"
            tone="warning"
            action={{ content: "Configure Settings", url: "/app/settings" }}
          >
            <p>
              Add your return policy and brand voice so the AI can represent
              your store correctly.
            </p>
          </Banner>
        )}

        {/* Key Metrics Row */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          {/* Total Revenue */}
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingSm" tone="subdued">
                  AI Revenue
                </Text>
                <Icon source={CashDollarIcon} tone="success" />
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {formatCurrency(stats.totalRevenue)}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {formatCurrency(stats.potentialRevenue)} potential
              </Text>
            </BlockStack>
          </Card>

          {/* Conversations */}
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingSm" tone="subdued">
                  Conversations
                </Text>
                <Icon source={ChatIcon} tone="info" />
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {stats.totalInteractions.toLocaleString()}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {stats.conversions} converted
              </Text>
            </BlockStack>
          </Card>

          {/* Conversion Rate */}
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingSm" tone="subdued">
                  Conversion Rate
                </Text>
                <Icon source={CartIcon} tone="magic" />
              </InlineStack>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {stats.conversionRate}%
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                AI-assisted purchases
              </Text>
            </BlockStack>
          </Card>

          {/* Agent Status */}
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingSm" tone="subdued">
                  Agent Status
                </Text>
                <Icon
                  source={isAgentActive ? CheckCircleIcon : XCircleIcon}
                  tone={isAgentActive ? "success" : "critical"}
                />
              </InlineStack>
              <Badge tone={isAgentActive ? "success" : "critical"} size="large">
                {isAgentActive ? "Active & Selling" : "Offline"}
              </Badge>
              <Box paddingBlockStart="200">
                <Button
                  onClick={handleToggle}
                  variant={isAgentActive ? "secondary" : "primary"}
                  loading={isLoading}
                  fullWidth
                >
                  {isAgentActive ? "Pause Agent" : "Activate Agent"}
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            {/* Recent Activity */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent AI Interactions
                </Text>
                <Divider />
                {recentRows.length === 0 ? (
                  <EmptyState
                    heading="No activity yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      Activate your agent to start receiving AI-powered customer
                      interactions.
                    </p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "text",
                      "numeric",
                    ]}
                    headings={["Date", "Intent", "Query", "Status", "Value"]}
                    rows={recentRows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {/* Missed Opportunities */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Missed Opportunities
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Searches that returned no results
                </Text>
                <Divider />
                {missedOpportunities.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No missed searches yet.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    {missedOpportunities.map((opp: any) => (
                      <InlineStack key={opp.id} align="space-between">
                        <Text as="span">"{opp.searchTerm}"</Text>
                        <Badge tone="attention">{`${opp.count}x`}</Badge>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Quick Actions */}
            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Quick Actions
                  </Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Button url="/app/settings" fullWidth>
                      Configure Agent
                    </Button>
                    <Button url="/app/playground" fullWidth variant="secondary">
                      Test Your Agent
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Box>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
