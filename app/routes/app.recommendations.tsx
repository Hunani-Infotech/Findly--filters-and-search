import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  Modal,
  Page,
  Select,
  Tabs,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { UnderConstructionGate } from "../components/under-construction";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
  type RecPageTab,
} from "../admin-nav-extras.server";
import {
  isRecWidgetId,
  parseHandleList,
  parseRecsConfig,
  type RecsConfig,
  type RecWidgetId,
} from "../recs";

type RecWidget = {
  id: RecWidgetId;
  title: string;
  description: string;
  tabs: RecPageTab[];
};

const REC_TABS: { id: RecPageTab; content: string; panelID: string }[] = [
  { id: "product", content: "Product page", panelID: "rec-product" },
  { id: "home", content: "Home page", panelID: "rec-home" },
  { id: "collection", content: "Collection page", panelID: "rec-collection" },
  { id: "cart", content: "Cart page", panelID: "rec-cart" },
];

const REC_WIDGETS: RecWidget[] = [
  {
    id: "frequently-bought-together",
    title: "Frequently bought together",
    description: "Suggest products customers often add with the current item.",
    tabs: ["product", "cart"],
  },
  {
    id: "trending-products",
    title: "Trending products",
    description: "Highlight products that are gaining traction in the store.",
    tabs: ["product", "home", "collection"],
  },
  {
    id: "recently-purchased-products",
    title: "Recently purchased products",
    description: "Surface items other shoppers bought recently.",
    tabs: ["product"],
  },
  {
    id: "hand-picked-related-products",
    title: "Hand-picked related products",
    description: "Show merchant-picked related products for this item.",
    tabs: ["product"],
  },
  {
    id: "most-added-products",
    title: "Most added products",
    description: "Products added to cart most often.",
    tabs: ["product"],
  },
  {
    id: "best-sellers",
    title: "Best sellers",
    description: "Your top-selling products.",
    tabs: ["product", "home", "collection", "cart"],
  },
  {
    id: "recently-viewed-products",
    title: "Recently viewed products",
    description: "Products this shopper viewed recently.",
    tabs: ["product", "home", "cart"],
  },
  {
    id: "most-viewed-products",
    title: "Most viewed products",
    description: "Products viewed most across the store.",
    tabs: ["product", "collection"],
  },
  {
    id: "new-products",
    title: "New products",
    description: "Newest catalog arrivals.",
    tabs: ["product", "home", "collection"],
  },
];

const MERCHANDISE_WIDGET_IDS: RecWidgetId[] = [
  "best-sellers",
  "most-added-products",
  "most-viewed-products",
  "trending-products",
  "recently-purchased-products",
  "new-products",
  "frequently-bought-together",
];

type RecsActionOk = {
  ok: true;
  intent: string;
  recs: RecsConfig;
  recOn: Record<string, boolean>;
};

function cloneRecs(recs: RecsConfig): RecsConfig {
  return {
    on: { ...recs.on },
    counts: { ...recs.counts },
    picks: Object.fromEntries(
      Object.entries(recs.picks).map(([key, value]) => [key, [...value]]),
    ),
    related: Object.fromEntries(
      Object.entries(recs.related).map(([key, value]) => [key, [...value]]),
    ),
  };
}

async function persistRecs(shopId: string, recs: RecsConfig, extrasBase?: Awaited<ReturnType<typeof getAdminNavExtras>>) {
  const extras = extrasBase ?? (await getAdminNavExtras(shopId));
  extras.recs = recs;
  extras.recOn = recs.on;
  const saved = await saveAdminNavExtras(shopId, extras);
  return saved;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const recs = extras.recs;
  return { shopDomain: session.shop, recs, recOn: recs.on };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const extras = await getAdminNavExtras(shop.id);
  const recs = cloneRecs(extras.recs);

  if (intent === "recOn") {
    const id = String(form.get("id") || "").trim();
    if (!isRecWidgetId(id)) {
      return { error: "Unknown widget" };
    }
    recs.on[id] = form.get("on") === "true";
    const saved = await persistRecs(shop.id, recs, extras);
    return {
      ok: true as const,
      intent,
      recs: saved.recs,
      recOn: saved.recs.on,
    } satisfies RecsActionOk;
  }

  if (intent === "saveCounts") {
    recs.counts = parseRecsConfig({
      ...recs,
      counts: {
        mobile: form.get("mobile"),
        tablet: form.get("tablet"),
        desktop: form.get("desktop"),
      },
    }).counts;
    const saved = await persistRecs(shop.id, recs, extras);
    return {
      ok: true as const,
      intent,
      recs: saved.recs,
      recOn: saved.recs.on,
    } satisfies RecsActionOk;
  }

  if (intent === "saveRelated") {
    const source = parseHandleList(form.get("source"), 1)[0] ?? "";
    const related = parseHandleList(form.get("related"));
    if (!source) {
      return { error: "Enter a source product handle" };
    }
    if (related.length === 0) {
      delete recs.related[source];
    } else {
      recs.related[source] = related;
    }
    const saved = await persistRecs(shop.id, recs, extras);
    return {
      ok: true as const,
      intent,
      recs: saved.recs,
      recOn: saved.recs.on,
    } satisfies RecsActionOk;
  }

  if (intent === "deleteRelated") {
    const source = parseHandleList(form.get("source"), 1)[0] ?? "";
    if (!source) {
      return { error: "Unknown source handle" };
    }
    delete recs.related[source];
    const saved = await persistRecs(shop.id, recs, extras);
    return {
      ok: true as const,
      intent,
      recs: saved.recs,
      recOn: saved.recs.on,
    } satisfies RecsActionOk;
  }

  if (intent === "savePicks") {
    const id = String(form.get("id") || "").trim();
    if (!isRecWidgetId(id)) {
      return { error: "Unknown widget" };
    }
    const handles = parseHandleList(form.get("handles"));
    if (handles.length === 0) {
      delete recs.picks[id];
    } else {
      recs.picks[id] = handles;
    }
    const saved = await persistRecs(shop.id, recs, extras);
    return {
      ok: true as const,
      intent,
      recs: saved.recs,
      recOn: saved.recs.on,
    } satisfies RecsActionOk;
  }

  return { error: "Unknown action" };
};

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [tabIndex, setTabIndex] = useState(0);
  const [recs, setRecs] = useState<RecsConfig>(data.recs);
  const [recOn, setRecOn] = useState<Record<string, boolean>>(data.recOn);
  const [manualOpen, setManualOpen] = useState(false);
  const [relatedSource, setRelatedSource] = useState("");
  const [relatedHandlesText, setRelatedHandlesText] = useState("");
  const [pickWidgetId, setPickWidgetId] = useState<string>(MERCHANDISE_WIDGET_IDS[0]!);
  const [pickHandlesText, setPickHandlesText] = useState(
    (data.recs.picks[MERCHANDISE_WIDGET_IDS[0]!] ?? []).join("\n"),
  );
  const [mobileCount, setMobileCount] = useState(String(data.recs.counts.mobile));
  const [tabletCount, setTabletCount] = useState(String(data.recs.counts.tablet));
  const [desktopCount, setDesktopCount] = useState(String(data.recs.counts.desktop));
  const [loaderRecs, setLoaderRecs] = useState(data.recs);
  const [loaderRecOn, setLoaderRecOn] = useState(data.recOn);
  const [appliedFetcher, setAppliedFetcher] = useState<typeof fetcher.data>(undefined);
  const lastToastData = useRef<typeof fetcher.data>(undefined);

  if (data.recs !== loaderRecs || data.recOn !== loaderRecOn) {
    setLoaderRecs(data.recs);
    setLoaderRecOn(data.recOn);
    setRecs(data.recs);
    setRecOn(data.recOn);
    setMobileCount(String(data.recs.counts.mobile));
    setTabletCount(String(data.recs.counts.tablet));
    setDesktopCount(String(data.recs.counts.desktop));
  }

  if (fetcher.data && fetcher.data !== appliedFetcher && "ok" in fetcher.data && fetcher.data.ok) {
    setAppliedFetcher(fetcher.data);
    setRecs(fetcher.data.recs);
    setRecOn(fetcher.data.recOn);
    setMobileCount(String(fetcher.data.recs.counts.mobile));
    setTabletCount(String(fetcher.data.recs.counts.tablet));
    setDesktopCount(String(fetcher.data.recs.counts.desktop));
  }

  const saving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const savingIntent =
    saving && fetcher.formData
      ? String(fetcher.formData.get("intent") || "")
      : "";

  useEffect(() => {
    const result = fetcher.data;
    if (!result || lastToastData.current === result) return;
    lastToastData.current = result;
    if ("ok" in result && result.ok) {
      const messages: Record<string, string> = {
        recOn: "Recommendations saved",
        saveCounts: "Breakpoint counts saved",
        saveRelated: "Related mapping saved",
        savePicks: "Merchandised list saved",
        deleteRelated: "Related mapping deleted",
      };
      shopify.toast.show(messages[result.intent] ?? "Recommendations saved");
    }
    if ("error" in result && result.error) {
      shopify.toast.show(String(result.error), { isError: true });
    }
  }, [fetcher.data, shopify]);

  const activeTab = REC_TABS[tabIndex]?.id ?? "product";
  const widgets = useMemo(
    () => REC_WIDGETS.filter((w) => w.tabs.includes(activeTab)),
    [activeTab],
  );

  const relatedKeys = useMemo(
    () => Object.keys(recs.related).sort(),
    [recs.related],
  );

  const merchandiseOptions = useMemo(
    () =>
      MERCHANDISE_WIDGET_IDS.map((id) => ({
        label: REC_WIDGETS.find((widget) => widget.id === id)?.title ?? id,
        value: id,
      })),
    [],
  );

  const themeEditorUrl = `https://${data.shopDomain}/admin/themes/current/editor?context=apps`;

  const toggleWidget = (id: string, nextOn: boolean) => {
    setRecOn((prev) => ({ ...prev, [id]: nextOn }));
    const formData = new FormData();
    formData.set("intent", "recOn");
    formData.set("id", id);
    formData.set("on", String(nextOn));
    fetcher.submit(formData, { method: "POST" });
  };

  const saveCounts = () => {
    fetcher.submit(
      {
        intent: "saveCounts",
        mobile: mobileCount,
        tablet: tabletCount,
        desktop: desktopCount,
      },
      { method: "POST" },
    );
  };

  const saveRelated = () => {
    fetcher.submit(
      {
        intent: "saveRelated",
        source: relatedSource,
        related: relatedHandlesText,
      },
      { method: "POST" },
    );
  };

  const deleteRelated = (source: string) => {
    fetcher.submit({ intent: "deleteRelated", source }, { method: "POST" });
  };

  const savePicks = () => {
    fetcher.submit(
      {
        intent: "savePicks",
        id: pickWidgetId,
        handles: pickHandlesText,
      },
      { method: "POST" },
    );
  };

  const selectRelatedSource = (source: string) => {
    setRelatedSource(source);
    setRelatedHandlesText((recs.related[source] ?? []).join("\n"));
  };

  const changePickWidget = (id: string) => {
    setPickWidgetId(id);
    setPickHandlesText((recs.picks[id] ?? []).join("\n"));
  };

  return (
    <UnderConstructionGate feature="Recommendations">
    <Page
      title="Recommendations"
      subtitle="Enable widget to increment your customer cart sizes."
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
      secondaryActions={[
        {
          content: "Settings",
          onAction: () => navigate("/app/settings"),
        },
        {
          content: "Manual recommendations",
          onAction: () => setManualOpen(true),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner title="Grant access" tone="info">
              <p>
                Order-based widgets (recently purchased, frequently bought
                together, most added) use hand-picked lists until orders exist.
                Newest, hand-picked related, and recently viewed (browser) work
                without orders.
              </p>
            </Banner>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Get started with recommendations
                  </Text>
                  <Badge>0/2 completed</Badge>
                </InlineStack>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Text as="p">Step 1: Activate the Findly app embed</Text>
                    <Button url={themeEditorUrl} target="_blank">
                      Activate now
                    </Button>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Text as="p">Step 2: Add the app widget to the page</Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Breakpoint counts
                </Text>
                <Text as="p" tone="subdued">
                  How many recommended products to show at each screen size.
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <TextField
                    label="Mobile"
                    type="number"
                    min={1}
                    max={12}
                    autoComplete="off"
                    value={mobileCount}
                    onChange={setMobileCount}
                  />
                  <TextField
                    label="Tablet"
                    type="number"
                    min={1}
                    max={12}
                    autoComplete="off"
                    value={tabletCount}
                    onChange={setTabletCount}
                  />
                  <TextField
                    label="Desktop"
                    type="number"
                    min={1}
                    max={12}
                    autoComplete="off"
                    value={desktopCount}
                    onChange={setDesktopCount}
                  />
                </InlineGrid>
                <InlineStack align="end">
                  <Button
                    variant="primary"
                    loading={savingIntent === "saveCounts"}
                    onClick={saveCounts}
                  >
                    Save counts
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Tabs tabs={REC_TABS} selected={tabIndex} onSelect={setTabIndex} />

            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              {widgets.map((widget) => {
                const on = recOn[widget.id] === true;
                return (
                  <Card key={`${activeTab}-${widget.id}`}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        {widget.title}
                      </Text>
                      <Text as="p" tone="subdued">
                        {widget.description}
                      </Text>
                      <InlineStack gap="200" wrap>
                        <Button
                          variant={on ? "secondary" : "primary"}
                          loading={savingIntent === "recOn"}
                          onClick={() => toggleWidget(widget.id, !on)}
                        >
                          {on ? "Turn off" : "Turn on"}
                        </Button>
                        <Button url={themeEditorUrl} target="_blank">
                          Add to theme
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                );
              })}
            </InlineGrid>

            <Text as="p" tone="subdued">
              Learn more about Recommendations
            </Text>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Manual recommendations"
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">
                Hand-picked related
              </Text>
              <TextField
                label="Source product handle"
                autoComplete="off"
                value={relatedSource}
                onChange={setRelatedSource}
                helpText="The product that should show related items."
              />
              <TextField
                label="Related handles"
                autoComplete="off"
                multiline={4}
                value={relatedHandlesText}
                onChange={setRelatedHandlesText}
                helpText="One product handle per line. Leave empty to delete this mapping."
              />
              <InlineStack align="end">
                <Button
                  variant="primary"
                  loading={savingIntent === "saveRelated"}
                  onClick={saveRelated}
                >
                  Save mapping
                </Button>
              </InlineStack>
            </BlockStack>

            {relatedKeys.length > 0 ? (
              <BlockStack gap="200">
                <Text as="p" variant="headingSm">
                  Existing mappings
                </Text>
                {relatedKeys.map((source) => (
                  <InlineStack
                    key={source}
                    align="space-between"
                    blockAlign="center"
                    wrap
                    gap="200"
                  >
                    <Button
                      variant="plain"
                      onClick={() => selectRelatedSource(source)}
                    >
                      {`${source} (${recs.related[source]?.length ?? 0})`}
                    </Button>
                    <Button
                      tone="critical"
                      loading={savingIntent === "deleteRelated"}
                      onClick={() => deleteRelated(source)}
                    >
                      Delete
                    </Button>
                  </InlineStack>
                ))}
              </BlockStack>
            ) : (
              <Text as="p" tone="subdued">
                No related mappings yet.
              </Text>
            )}

            <Divider />

            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">
                Merchandised lists
              </Text>
              <Select
                label="Widget"
                options={merchandiseOptions}
                value={pickWidgetId}
                onChange={changePickWidget}
              />
              <TextField
                label="Product handles"
                autoComplete="off"
                multiline={4}
                value={pickHandlesText}
                onChange={setPickHandlesText}
                helpText="One handle per line. Used until live order or view data exists."
              />
              <InlineStack align="end">
                <Button
                  variant="primary"
                  loading={savingIntent === "savePicks"}
                  onClick={savePicks}
                >
                  Save list
                </Button>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
    </UnderConstructionGate>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
