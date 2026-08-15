import { useEffect, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRouteError,
  useSubmit,
} from "react-router";
import {
  Banner,
  BlockStack,
  Card,
  Checkbox,
  ChoiceList,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ensureShopAccess } from "../billing.server";
import { normalizeDisplayOrder } from "../filters.server";
import { getFilterConfig, saveFilterConfig, filterConfigPriceFields } from "../shop.server";
import { toCollectionGid } from "../settings.server";
import { isMutationBusy } from "../components/admin-loading";
import { DisplayOrderList } from "../components/display-order-list";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const id = params.id;
  if (!id) {
    throw new Response("Collection id required", { status: 400 });
  }

  const collectionGid = toCollectionGid(id);
  const collection = await prisma.collection.findUnique({
    where: {
      shopId_collectionGid: {
        shopId: shop.id,
        collectionGid,
      },
    },
  });

  if (!collection) {
    return {
      notFound: true as const,
      collectionGid,
      collection: null,
      usingDefault: true,
      config: {
        enabled: true,
        enablePrice: true,
        enableAvailability: true,
        enableVendor: true,
        enableProductType: true,
        enableTags: true,
        enableOptions: true,
        displayOrder: normalizeDisplayOrder(),
        ...filterConfigPriceFields(null),
      },
    };
  }

  const config = await getFilterConfig(shop.id, collectionGid);
  const hasSpecific = await prisma.filterConfig.findUnique({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid },
    },
  });

  return {
    notFound: false as const,
    collectionGid,
    collection: {
      title: collection.title,
      handle: collection.handle,
      collectionGid: collection.collectionGid,
    },
    usingDefault: !hasSpecific,
    config: {
      enabled: config?.enabled ?? true,
      enablePrice: config?.enablePrice ?? true,
      enableAvailability: config?.enableAvailability ?? true,
      enableVendor: config?.enableVendor ?? true,
      enableProductType: config?.enableProductType ?? true,
      enableTags: config?.enableTags ?? true,
      enableOptions: config?.enableOptions ?? true,
      displayOrder: normalizeDisplayOrder(config?.displayOrder),
      ...filterConfigPriceFields(config),
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const id = params.id;
  if (!id) {
    return { error: "Collection id required" };
  }

  const collectionGid = toCollectionGid(id);
  const form = await request.formData();

  const bool = (key: string) => form.get(key) === "true" || form.get(key) === "on";

  let displayOrder: string[] = normalizeDisplayOrder();
  const orderRaw = form.get("displayOrder");
  if (typeof orderRaw === "string" && orderRaw) {
    try {
      const parsed = JSON.parse(orderRaw) as string[];
      if (Array.isArray(parsed) && parsed.length) {
        displayOrder = normalizeDisplayOrder(parsed);
      }
    } catch {
      // keep default
    }
  }

  const parseMoney = (key: string) => {
    const raw = form.get(key);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  let customMin = parseMoney("customPriceMin");
  let customMax = parseMoney("customPriceMax");
  if (customMin != null && customMax != null && customMin > customMax) {
    const swap = customMin;
    customMin = customMax;
    customMax = swap;
  }

  const priceRangeMode =
    form.get("priceRangeMode") === "custom" ? "custom" : "auto";
  if (priceRangeMode === "custom" && (customMin == null || customMax == null)) {
    return { error: "Custom price range needs both a min and a max." };
  }

  await saveFilterConfig(shop.id, {
    collectionGid,
    enabled: bool("enabled"),
    enablePrice: bool("enablePrice"),
    enableAvailability: bool("enableAvailability"),
    enableVendor: bool("enableVendor"),
    enableProductType: bool("enableProductType"),
    enableTags: bool("enableTags"),
    enableOptions: bool("enableOptions"),
    priceRangeMode,
    customPriceMin: customMin,
    customPriceMax: customMax,
    displayOrder,
  });

  return { ok: true };
};

type ConfigState = {
  enabled: boolean;
  enablePrice: boolean;
  enableAvailability: boolean;
  enableVendor: boolean;
  enableProductType: boolean;
  enableTags: boolean;
  enableOptions: boolean;
  priceRangeMode: "auto" | "custom";
  customPriceMin: string;
  customPriceMax: string;
  displayOrder: string[];
};

export default function CollectionFilterConfigPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [config, setConfig] = useState<ConfigState>(data.config);
  const [loaderConfig, setLoaderConfig] = useState(data.config);
  if (data.config !== loaderConfig) {
    setLoaderConfig(data.config);
    setConfig(data.config);
  }

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Filter config saved");
    }
    if (actionData && "error" in actionData && actionData.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("enabled", String(config.enabled));
    formData.set("enablePrice", String(config.enablePrice));
    formData.set("enableAvailability", String(config.enableAvailability));
    formData.set("enableVendor", String(config.enableVendor));
    formData.set("enableProductType", String(config.enableProductType));
    formData.set("enableTags", String(config.enableTags));
    formData.set("enableOptions", String(config.enableOptions));
    formData.set("priceRangeMode", config.priceRangeMode);
    formData.set("customPriceMin", config.customPriceMin);
    formData.set("customPriceMax", config.customPriceMax);
    formData.set("displayOrder", JSON.stringify(config.displayOrder));
    submit(formData, { method: "POST" });
  };

  if (data.notFound || !data.collection) {
    return (
      <Page
        title="Collection not found"
        backAction={{
          content: "Collections",
          onAction: () => navigate("/app"),
        }}
      >
        <Layout>
          <Layout.Section>
            <Banner
              tone="warning"
              title="This collection is not in the local index"
              action={{
                content: "Go to Sync",
                onAction: () => navigate("/app/sync"),
              }}
            >
              <p>
                Run a full sync, then open Configure again. Looking for{" "}
                {data.collectionGid}.
              </p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title={data.collection.title}
      subtitle={
        data.collection.handle
          ? `Handle: ${data.collection.handle}`
          : data.collection.collectionGid
      }
      backAction={{
        content: "Collections",
        onAction: () => navigate("/app"),
      }}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "collection-filter-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="collection-filter-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              {data.usingDefault && (
                <Banner tone="info">
                  <p>
                    This collection is using the shop-wide default. Saving
                    creates a collection-specific config.
                  </p>
                </Banner>
              )}

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Filter toggles
                  </Text>
                  <FormLayout>
                    <Checkbox
                      label="Enable filters for this collection"
                      checked={config.enabled}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enabled: checked }))
                      }
                    />
                    <Checkbox
                      label="Price"
                      checked={config.enablePrice}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enablePrice: checked }))
                      }
                    />
                    {config.enablePrice ? (
                      <BlockStack gap="200">
                        <ChoiceList
                          title="Price range"
                          choices={[
                            {
                              label: "From products in this collection",
                              value: "auto",
                              helpText:
                                "Slider min and max come from synced variant prices.",
                            },
                            {
                              label: "Custom min / max",
                              value: "custom",
                              helpText:
                                "You set the slider bounds. Shoppers can still filter inside that range.",
                            },
                          ]}
                          selected={[config.priceRangeMode]}
                          disabled={saving}
                          onChange={(selected) =>
                            setConfig((c) => ({
                              ...c,
                              priceRangeMode:
                                selected[0] === "custom" ? "custom" : "auto",
                            }))
                          }
                        />
                        {config.priceRangeMode === "custom" ? (
                          <InlineStack gap="300" wrap>
                            <TextField
                              label="Custom min"
                              type="number"
                              autoComplete="off"
                              value={config.customPriceMin}
                              disabled={saving}
                              onChange={(value) =>
                                setConfig((c) => ({
                                  ...c,
                                  customPriceMin: value,
                                }))
                              }
                            />
                            <TextField
                              label="Custom max"
                              type="number"
                              autoComplete="off"
                              value={config.customPriceMax}
                              disabled={saving}
                              onChange={(value) =>
                                setConfig((c) => ({
                                  ...c,
                                  customPriceMax: value,
                                }))
                              }
                            />
                          </InlineStack>
                        ) : null}
                      </BlockStack>
                    ) : null}
                    <Checkbox
                      label="Availability"
                      checked={config.enableAvailability}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({
                          ...c,
                          enableAvailability: checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="Vendor"
                      checked={config.enableVendor}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableVendor: checked }))
                      }
                    />
                    <Checkbox
                      label="Product type"
                      checked={config.enableProductType}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({
                          ...c,
                          enableProductType: checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="Tags"
                      checked={config.enableTags}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableTags: checked }))
                      }
                    />
                    <Checkbox
                      label="Variant options (Size, Color, etc.)"
                      checked={config.enableOptions}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableOptions: checked }))
                      }
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Display order
                  </Text>
                  <DisplayOrderList
                    keys={config.displayOrder}
                    disabled={saving}
                    onChange={(displayOrder) =>
                      setConfig((c) => ({ ...c, displayOrder }))
                    }
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "status" in error
        ? `Could not load this collection (${String((error as { status: unknown }).status)})`
        : "Could not load this collection";

  return (
    <Page title="Collection filters">
      <Layout>
        <Layout.Section>
          <Banner tone="critical" title="This page did not load">
            <p>{message}</p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
