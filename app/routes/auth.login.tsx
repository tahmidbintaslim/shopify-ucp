/**
 * Login/Install Route
 * Entry point for app installation
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { useState } from "react";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const errors = login(request);
  return json({ errors, polarisTranslations: {} });
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = login(request);
  return json({ errors });
}

export default function Auth() {
  const { errors } = useLoaderData<typeof loader>() as { errors: any };
  const [shop, setShop] = useState("");

  return (
    <Page narrowWidth>
      <Card>
        <BlockStack gap="500">
          <Text as="h1" variant="headingLg">
            Universal Agent Gateway
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Connect your Shopify store to AI agents
          </Text>
          <Form method="post">
            <FormLayout>
              <TextField
                label="Shop domain"
                name="shop"
                value={shop}
                onChange={setShop}
                placeholder="your-store.myshopify.com"
                autoComplete="off"
                error={errors?.shop}
              />
              <Button submit variant="primary">
                Install App
              </Button>
            </FormLayout>
          </Form>
        </BlockStack>
      </Card>
    </Page>
  );
}
