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
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Icon,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import {
  ChevronRightIcon,
  ColorIcon,
  LayoutSidebarLeftIcon,
  MergeIcon,
  ProductIcon,
  SearchIcon,
  XSmallIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { ensureShop } from "../shop.server";
import { isMutationBusy } from "../components/admin-loading";
import prisma from "../db.server";
import {
  createFilterTree,
  deleteFilterTrees,
  duplicateFilterTrees,
  exportFilterTreesPayload,
  listFilterTrees,
  reorderFilterTrees,
  setFilterTreesEnabled,
} from "../filter-trees.server";

const PROMO_STORAGE_KEY = "findly-filters-promo-dismissed";

const PREFERENCES = [
  {
    id: "panel",
    title: "Filter panel display",
    description:
      "Choose how filters are displayed — as a sidebar or a drawer.",
    url: "/app/settings?tab=panel",
    icon: LayoutSidebarLeftIcon,
  },
  {
    id: "product",
    title: "Product card & grid settings",
    description:
      "Control the appearance and behavior of product cards in the collection and search results.",
    url: "/app/settings?tab=product",
    icon: ProductIcon,
  },
  {
    id: "swatches",
    title: "Color swatches",
    description: "Set up color values and their display names.",
    url: "/app/swatches",
    icon: ColorIcon,
  },
  {
    id: "groups",
    title: "Group values",
    description:
      "Merge Light Blue, Dark Blue, Midnight Blue to Blue Color.",
    url: "/app/groups",
    icon: MergeIcon,
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

type FilterListTree = {
  id: string;
  name: string;
  enabled: boolean;
  collections: Array<{ gid: string; title: string }>;
};

function appliesToMarkup(tree: FilterListTree) {
  if (tree.collections.length === 0) {
    return <Badge>All Collections</Badge>;
  }
  const first = tree.collections[0]?.title || "Collection";
  const extra = tree.collections.length - 1;
  return (
    <InlineStack gap="200" wrap>
      <Badge>{first}</Badge>
      {extra > 0 ? <Badge>{`+${extra} collections`}</Badge> : null}
    </InlineStack>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);

  const [trees, collections] = await Promise.all([
    listFilterTrees(shop.id),
    prisma.collection.findMany({
      where: { shopId: shop.id },
      select: { collectionGid: true, title: true },
    }),
  ]);
  const titles = new Map(
    collections.map((collection) => [collection.collectionGid, collection.title]),
  );

  return {
    trees: trees.map((tree) => ({
      id: tree.id,
      name: tree.name,
      enabled: tree.enabled,
      appliesToSearch: tree.appliesToSearch,
      collectionCount: tree.treeCollections.length,
      collections: tree.treeCollections.map((row) => ({
        gid: row.collectionGid,
        title: titles.get(row.collectionGid) || row.collectionGid,
      })),
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
  const ids = parseIdList(form.get("ids"));

  if (intent === "create") {
    const tree = await createFilterTree(shop.id);
    return redirect(`/app/filters/${tree.id}?new=1`);
  }

  if (intent === "export") {
    const payload = await exportFilterTreesPayload(shop.id);
    return { ok: true, intent: "export" as const, payload };
  }

  if (intent === "reorder") {
    await reorderFilterTrees(shop.id, ids);
    return { ok: true, intent: "reorder" as const };
  }

  if (intent === "enable" || intent === "disable") {
    const result = await setFilterTreesEnabled(shop.id, ids, intent === "enable");
    return { ok: true, intent, updated: result.updated };
  }

  if (intent === "duplicate") {
    const result = await duplicateFilterTrees(shop.id, ids);
    return { ok: true, intent: "duplicate" as const, duplicated: result.duplicated };
  }

  if (intent === "delete") {
    const result = await deleteFilterTrees(shop.id, ids);
    if ("error" in result) {
      return { error: result.error, deleted: result.deleted };
    }
    return { ok: true, intent: "delete" as const, deleted: result.deleted };
  }

  return { ok: false };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const exportFetcher = useFetcher<typeof action>();
  const bulkFetcher = useFetcher<typeof action>();
  const reorderFetcher = useFetcher<typeof action>();
  const { trees } = data;
  const creating = isMutationBusy(navigation);
  const exporting = exportFetcher.state !== "idle";
  const bulkBusy = bulkFetcher.state !== "idle";
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const treeIds = trees.map((tree) => tree.id);
  const treeIdKey = treeIds.join("\0");
  const [order, setOrder] = useState(treeIds);
  const [orderSource, setOrderSource] = useState(treeIdKey);
  if (treeIdKey !== orderSource) {
    setOrderSource(treeIdKey);
    setOrder(treeIds);
    setSelectedIds((current) => current.filter((id) => treeIds.includes(id)));
  }
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const lastExportKey = useRef<string | null>(null);
  const lastBulkKey = useRef<unknown>(null);

  useEffect(() => {
    setPromoOpen(window.localStorage.getItem(PROMO_STORAGE_KEY) !== "1");
  }, []);

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

  useEffect(() => {
    const result = bulkFetcher.data;
    if (!result || bulkFetcher.state !== "idle") return;
    if (lastBulkKey.current === result) return;
    lastBulkKey.current = result;
    if ("error" in result && result.error) {
      shopify.toast.show(result.error, { isError: true });
      return;
    }
    if (!("ok" in result) || !result.ok || !("intent" in result)) return;
    if (result.intent === "enable") {
      shopify.toast.show("Filters enabled");
    } else if (result.intent === "disable") {
      shopify.toast.show("Filters disabled");
    } else if (result.intent === "duplicate") {
      shopify.toast.show("Filters duplicated");
    } else if (result.intent === "delete") {
      shopify.toast.show("Filters deleted");
    }
    setSelectedIds([]);
  }, [bulkFetcher.data, bulkFetcher.state, shopify]);

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

  const visibleIds = filteredTrees.map((tree) => tree.id);
  const selectedVisible = selectedIds.filter((id) => visibleIds.includes(id));
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;

  const persistOrder = (nextIds: string[]) => {
    setOrder(nextIds);
    const formData = new FormData();
    formData.set("intent", "reorder");
    formData.set("ids", JSON.stringify(nextIds));
    reorderFetcher.submit(formData, { method: "POST" });
  };

  const handleDrop = (from: number, to: number) => {
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

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, ...visibleIds])];
      const hide = new Set(visibleIds);
      return current.filter((id) => !hide.has(id));
    });
  };

  const submitBulk = (intent: "enable" | "disable" | "duplicate" | "delete") => {
    if (!selectedIds.length || bulkBusy) return;
    if (
      intent === "delete" &&
      !window.confirm(
        selectedIds.length === 1
          ? "Delete this filter?"
          : `Delete ${selectedIds.length} filters?`,
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("ids", JSON.stringify(selectedIds));
    bulkFetcher.submit(formData, { method: "POST" });
  };

  return (
    <Page
      title="Filters"
      primaryAction={{
        content: creating ? "Creating…" : "+ Add Filter",
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
            <Card padding="0">
              <div className="findly-filters-list__search">
                <TextField
                  label="Searching filters"
                  labelHidden
                  placeholder="Searching filters"
                  value={query}
                  onChange={setQuery}
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} />}
                  clearButton
                  onClearButtonClick={() => setQuery("")}
                />
              </div>
              {selectedVisible.length > 0 ? (
                <div className="findly-filters-list__bulk">
                  <div className="findly-filters-list__bulk-start">
                    <Checkbox
                      label="Select all filters"
                      labelHidden
                      checked={someVisibleSelected ? "indeterminate" : true}
                      onChange={toggleAllVisible}
                    />
                    <Text as="span" variant="bodySm" fontWeight="medium">
                      {`${selectedVisible.length} selected`}
                    </Text>
                  </div>
                  <ButtonGroup>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => submitBulk("delete")}
                    >
                      Delete filters
                    </Button>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => submitBulk("duplicate")}
                    >
                      Duplicate filters
                    </Button>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => submitBulk("disable")}
                    >
                      Disable filters
                    </Button>
                    <Button
                      disabled={bulkBusy}
                      onClick={() => submitBulk("enable")}
                    >
                      Enable filters
                    </Button>
                  </ButtonGroup>
                </div>
              ) : null}
              <table className="findly-filters-list__table">
                {selectedVisible.length === 0 ? (
                  <thead>
                    <tr>
                      <th className="findly-filters-list__check">
                        <Checkbox
                          label="Select all filters"
                          labelHidden
                          checked={
                            allVisibleSelected
                              ? true
                              : someVisibleSelected
                                ? "indeterminate"
                                : false
                          }
                          disabled={visibleIds.length === 0}
                          onChange={toggleAllVisible}
                        />
                      </th>
                      <th>Name</th>
                      <th>Applies To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {filteredTrees.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="findly-filters-list__empty">
                          <Text as="p" tone="subdued">
                            {trees.length === 0
                              ? "Add a filter to configure collection and search filters."
                              : "No filters match your search."}
                          </Text>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTrees.map((tree, index) => {
                      const href = `/app/filters/${tree.id}`;
                      const dragging = dragIndex === index;
                      const selected = selectedIds.includes(tree.id);
                      return (
                        <tr
                          key={tree.id}
                          className={
                            dragging ? "findly-filters-list__row--dragging" : undefined
                          }
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleRowDrop(index, event)}
                        >
                          <td className="findly-filters-list__check">
                            <Checkbox
                              label={`Select ${tree.name.trim() || "Untitled"}`}
                              labelHidden
                              checked={selected}
                              onChange={(checked) => toggleSelected(tree.id, checked)}
                            />
                          </td>
                          <td>
                            <div className="findly-filters-list__name">
                              <button
                                type="button"
                                className="findly-filters-list__handle"
                                draggable
                                aria-label={`Reorder ${tree.name}. Position ${index + 1} of ${filteredTrees.length}`}
                                onDragStart={(event) => handleDragStart(index, event)}
                                onDragEnd={() => setDragIndex(null)}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DragHandle />
                              </button>
                              <button
                                type="button"
                                className="findly-filters-list__name-btn"
                                onClick={() => navigate(href)}
                              >
                                <Text as="span" variant="bodyMd" fontWeight="semibold">
                                  {tree.name.trim() || "Untitled"}
                                </Text>
                              </button>
                            </div>
                          </td>
                          <td>{appliesToMarkup(tree)}</td>
                          <td>
                            <Badge tone={tree.enabled ? "success" : undefined}>
                              {tree.enabled ? "Active" : "Disabled"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Card>
            {promoOpen ? (
              <div className="findly-swatch-promo">
                <span className="findly-swatch-promo__icon" aria-hidden />
                <p className="findly-swatch-promo__body">
                  Make separate products feel like real variants. Connect colors,
                  styles, and related products in one product experience.
                </p>
                <div className="findly-swatch-promo__actions">
                  <button type="button" onClick={() => navigate("/app/swatches")}>
                    Start for free
                  </button>
                </div>
                <button
                  type="button"
                  className="findly-swatch-promo__close"
                  aria-label="Dismiss"
                  onClick={() => {
                    setPromoOpen(false);
                    window.localStorage.setItem(PROMO_STORAGE_KEY, "1");
                  }}
                >
                  <XSmallIcon width={16} height={16} />
                </button>
              </div>
            ) : null}
            <Card padding="0">
              <div className="findly-pref-heading">
                <Text as="h2" variant="headingMd">
                  Preferences
                </Text>
              </div>
              <div className="findly-pref-list">
                {PREFERENCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="findly-pref-row"
                    onClick={() => navigate(item.url)}
                  >
                    <span className="findly-pref-row__icon">
                      <Icon source={item.icon} />
                    </span>
                    <span className="findly-pref-row__body">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {item.title}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.description}
                      </Text>
                    </span>
                    <span className="findly-pref-row__chevron">
                      <Icon source={ChevronRightIcon} />
                    </span>
                  </button>
                ))}
              </div>
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
