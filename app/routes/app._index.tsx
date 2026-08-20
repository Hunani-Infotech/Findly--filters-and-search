import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  ResourceItem,
  ResourceList,
  Text,
  TextField,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { ensureShop } from "../shop.server";
import { isMutationBusy, isNavigatingTo } from "../components/admin-loading";
import {
  createFilterTree,
  exportFilterTreesPayload,
  listFilterTrees,
  reorderFilterTrees,
} from "../filter-trees.server";

const PREFERENCES = [
  {
    id: "panel",
    title: "Filter panel display",
    description: "Choose how filters are displayed — as a sidebar or a drawer.",
    url: "/app/settings?tab=panel",
  },
  {
    id: "product",
    title: "Product card & grid settings",
    description:
      "Control the appearance and behavior of product cards in the collection and search results.",
    url: "/app/settings?tab=product",
  },
  {
    id: "swatches",
    title: "Color swatches",
    description: "Set up color values and their display names.",
    url: "/app/swatches",
  },
  {
    id: "groups",
    title: "Group values",
    description: "Merge Light Blue, Dark Blue, Midnight Blue to Blue.",
    url: "/app/groups",
  },
] as const;

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseIdList(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function applyVisibleReorder(full: string[], visible: string[], from: number, to: number) {
  const nextVisible = moveItem(visible, from, to);
  if (nextVisible === visible) return full;
  const visSet = new Set(visible);
  let i = 0;
  return full.map((id) => (visSet.has(id) ? nextVisible[i++] : id));
}

function DragHandle() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      aria-hidden="true"
      focusable="false"
    >
      {[0, 1, 2, 3, 4, 5].map((dot) => (
        <circle
          key={dot}
          cx={dot % 2 === 0 ? 3 : 9}
          cy={2 + Math.floor(dot / 2) * 6}
          r="1.4"
          fill="#8c9196"
        />
      ))}
    </svg>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);

  const trees = await listFilterTrees(shop.id);

  return {
    trees: trees.map((tree) => ({
      id: tree.id,
      name: tree.name,
      enabled: tree.enabled,
      appliesToSearch: tree.appliesToSearch,
      collectionCount: tree.treeCollections.length,
      sortOrder: tree.sortOrder,
      createdAt: tree.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "create") {
    const tree = await createFilterTree(shop.id, { name: "Untitled tree" });
    return redirect(`/app/filters/${tree.id}`);
  }

  if (intent === "export") {
    const payload = await exportFilterTreesPayload(shop.id);
    return { ok: true, intent: "export" as const, payload };
  }

  if (intent === "reorder") {
    const ids = parseIdList(form.get("ids"));
    await reorderFilterTrees(shop.id, ids);
    return { ok: true, intent: "reorder" as const };
  }

  return { ok: false };
};

function appliesToMarkup(tree: {
  collectionCount: number;
  appliesToSearch: boolean;
}) {
  const collectionLabel =
    tree.collectionCount === 0
      ? "All collections"
      : `${tree.collectionCount} collection${tree.collectionCount === 1 ? "" : "s"}`;

  return (
    <InlineStack gap="200" wrap>
      <Badge>{collectionLabel}</Badge>
      {tree.appliesToSearch ? <Badge>Search</Badge> : null}
    </InlineStack>
  );
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const exportFetcher = useFetcher<typeof action>();
  const reorderFetcher = useFetcher<typeof action>();
  const { trees } = data;
  const creating = isMutationBusy(navigation);
  const exporting = exportFetcher.state !== "idle";
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState(() => trees.map((tree) => tree.id));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const lastExportKey = useRef<string | null>(null);

  useEffect(() => {
    setOrder(trees.map((tree) => tree.id));
  }, [trees]);

  useEffect(() => {
    const result = exportFetcher.data;
    if (!result || !("ok" in result) || !result.ok) return;
    if (!("intent" in result) || result.intent !== "export") return;
    if (!("payload" in result) || !result.payload) return;
    const key =
      typeof result.payload === "object" &&
      result.payload &&
      "exportedAt" in result.payload
        ? String(result.payload.exportedAt)
        : JSON.stringify(result.payload);
    if (lastExportKey.current === key) return;
    lastExportKey.current = key;
    downloadJson("findly-filters.json", result.payload);
  }, [exportFetcher.data]);

  const treesById = useMemo(
    () => new Map(trees.map((tree) => [tree.id, tree])),
    [trees],
  );

  const orderedTrees = useMemo(() => {
    const known = order
      .map((id) => treesById.get(id))
      .filter((tree): tree is (typeof trees)[number] => Boolean(tree));
    const seen = new Set(known.map((tree) => tree.id));
    for (const tree of trees) {
      if (!seen.has(tree.id)) known.push(tree);
    }
    return known;
  }, [order, trees, treesById]);

  const filteredTrees = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orderedTrees;
    return orderedTrees.filter((tree) => tree.name.toLowerCase().includes(needle));
  }, [orderedTrees, query]);

  const persistOrder = (nextIds: string[]) => {
    setOrder(nextIds);
    const formData = new FormData();
    formData.set("intent", "reorder");
    formData.set("ids", JSON.stringify(nextIds));
    reorderFetcher.submit(formData, { method: "POST" });
  };

  const handleDrop = (from: number, to: number) => {
    const visibleIds = filteredTrees.map((tree) => tree.id);
    const next = applyVisibleReorder(order, visibleIds, from, to);
    if (next.join() === order.join()) return;
    persistOrder(next);
  };

  const handleDragStart = (index: number, event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", filteredTrees[index]?.id || String(index));
    setDragIndex(index);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleRowDrop = (index: number, event: DragEvent) => {
    event.preventDefault();
    if (dragIndex == null) return;
    handleDrop(dragIndex, index);
    setDragIndex(null);
  };

  return (
    <Page
      title="Filters"
      primaryAction={{
        content: creating ? "Creating…" : "+ Add filter",
        loading: creating,
        onAction: () => {
          const formData = new FormData();
          formData.set("intent", "create");
          submit(formData, { method: "POST" });
        },
      }}
      secondaryActions={[
        {
          content: "Export",
          loading: exporting,
          onAction: () => {
            const formData = new FormData();
            formData.set("intent", "export");
            exportFetcher.submit(formData, { method: "POST" });
          },
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {trees.length === 0 ? (
              <Banner title="No filters yet" tone="warning">
                <p>Add a filter to configure collection and search filters.</p>
              </Banner>
            ) : null}
            <Card padding="0">
              <Box padding="400">
                <TextField
                  label="Searching filters"
                  labelHidden
                  placeholder="Searching filters"
                  value={query}
                  onChange={setQuery}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setQuery("")}
                />
              </Box>
              <Box paddingInline="400" paddingBlockEnd="200">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px minmax(120px, 1.4fr) minmax(140px, 1fr) 100px 72px",
                    gap: 12,
                    padding: "8px 4px",
                    color: "#616161",
                  }}
                >
                  <span />
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Name
                  </Text>
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Applies to
                  </Text>
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Status
                  </Text>
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Actions
                  </Text>
                </div>
              </Box>
              {filteredTrees.length === 0 ? (
                <Box padding="400" paddingBlockStart="0">
                  <Text as="p" tone="subdued">
                    No filters match your search.
                  </Text>
                </Box>
              ) : (
                <Box paddingInline="400" paddingBlockEnd="400">
                  <BlockStack gap="200">
                    {filteredTrees.map((tree, index) => {
                      const href = `/app/filters/${tree.id}`;
                      const dragging = dragIndex === index;
                      return (
                        <div
                          key={tree.id}
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleRowDrop(index, event)}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "28px minmax(120px, 1.4fr) minmax(140px, 1fr) 100px 72px",
                            gap: 12,
                            alignItems: "center",
                            padding: "10px 8px",
                            border: dragging
                              ? "1px dashed #c9cccf"
                              : "1px solid #e3e3e3",
                            borderRadius: 10,
                            background: dragging ? "#f6f6f7" : "#fff",
                          }}
                        >
                          <button
                            type="button"
                            draggable
                            aria-label={`Reorder ${tree.name}. Position ${index + 1} of ${filteredTrees.length}`}
                            onDragStart={(event) => handleDragStart(index, event)}
                            onDragEnd={() => setDragIndex(null)}
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 28,
                              height: 28,
                              padding: 0,
                              border: "none",
                              background: "transparent",
                              cursor: "grab",
                            }}
                          >
                            <DragHandle />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(href)}
                            style={{
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {tree.name.trim() || "Untitled"}
                            </Text>
                          </button>
                          {appliesToMarkup(tree)}
                          <Badge tone={tree.enabled ? "success" : "attention"}>
                            {tree.enabled ? "Active" : "Disabled"}
                          </Badge>
                          <Button
                            variant="plain"
                            onClick={() => navigate(href)}
                            loading={isNavigatingTo(navigation, href)}
                          >
                            Edit
                          </Button>
                        </div>
                      );
                    })}
                  </BlockStack>
                </Box>
              )}
            </Card>

            <Text as="h2" variant="headingMd">
              Preferences
            </Text>
            <Card padding="0">
              <ResourceList
                resourceName={{ singular: "preference", plural: "preferences" }}
                items={[...PREFERENCES]}
                renderItem={(item) => (
                  <ResourceItem
                    id={item.id}
                    accessibilityLabel={`Open ${item.title}`}
                    onClick={() => navigate(item.url)}
                  >
                    <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {item.title}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {item.description}
                        </Text>
                      </BlockStack>
                      <Button variant="plain" onClick={() => navigate(item.url)}>
                        Open
                      </Button>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
