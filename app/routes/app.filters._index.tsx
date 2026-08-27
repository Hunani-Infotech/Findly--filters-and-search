import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
  type ActionFunctionArgs,
  type HeadersFunction,
  type LoaderFunctionArgs,
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
  SearchIcon,
  XSmallIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import { isMutationBusy } from "../components/admin-loading";
import prisma from "../db.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import { AdminListPagination } from "../components/admin-list-pagination";
import { DragHandle } from "../components/drag-handle";
import { slicePage, reorderWithinSubset } from "../utils/admin-list-page";
import { downloadJson } from "../utils/download-json";
import {
  deleteFilterTrees,
  duplicateFilterTrees,
  exportFilterTreesPayload,
  listFilterTrees,
  reorderFilterTrees,
  setFilterTreesEnabled,
} from "../services/filter-trees.server";

export { FiltersListSkeleton as HydrateFallback } from "../components/admin-skeletons";

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

function parseIdList(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

type FilterListTree = {
  id: string;
  name: string;
  enabled: boolean;
  appliesToSearch: boolean;
  collections: Array<{ gid: string; title: string }>;
};

function appliesToMarkup(tree: FilterListTree) {
  const collectionBadges =
    tree.collections.length === 0 ? (
      <Badge>All Collections</Badge>
    ) : (
      <>
        <Badge>{tree.collections[0]?.title || "Collection"}</Badge>
        {tree.collections.length > 1 ? (
          <Badge>{`+${tree.collections.length - 1} collections`}</Badge>
        ) : null}
      </>
    );
  return (
    <InlineStack gap="200" wrap>
      {tree.appliesToSearch ? <Badge>Search Page</Badge> : null}
      {collectionBadges}
    </InlineStack>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const trees = await listFilterTrees(shop.id);
  const assignedGids = [
    ...new Set(
      trees.flatMap((tree) =>
        tree.treeCollections.map((row) => row.collectionGid),
      ),
    ),
  ];
  const collections = assignedGids.length
    ? await prisma.collection.findMany({
        where: { shopId: shop.id, collectionGid: { in: assignedGids } },
        select: { collectionGid: true, title: true },
      })
    : [];
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
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const ids = parseIdList(form.get("ids"));

  if (intent === "create") {
    return redirect(
      withEmbeddedParamsFromRequest(request, "/app/filters/new"),
    );
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

export default function FiltersIndex() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useEmbeddedNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const exportFetcher = useFetcher<typeof action>();
  const bulkFetcher = useFetcher<typeof action>();
  const reorderFetcher = useFetcher<typeof action>();
  const { ask, dialog } = useConfirmDelete();
  const { trees } = data;
  const creating = isMutationBusy(navigation);
  const exporting = exportFetcher.state !== "idle";
  const bulkBusy = bulkFetcher.state !== "idle";
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
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
  const storedPromoOpen = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => window.localStorage.getItem(PROMO_STORAGE_KEY) !== "1",
    () => false,
  );
  const [promoHidden, setPromoHidden] = useState(false);
  const promoOpen = !promoHidden && storedPromoOpen;
  const lastExportKey = useRef<string | null>(null);
  const lastBulkKey = useRef<unknown>(null);
  const [clearedBulkResult, setClearedBulkResult] = useState<unknown>(null);

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

  const bulkResult =
    bulkFetcher.state === "idle" ? bulkFetcher.data : undefined;
  if (
    bulkResult &&
    clearedBulkResult !== bulkResult &&
    "ok" in bulkResult &&
    bulkResult.ok &&
    "intent" in bulkResult
  ) {
    setClearedBulkResult(bulkResult);
    setSelectedIds([]);
  }

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

  const listSlice = slicePage(filteredTrees, page);
  if (page !== listSlice.safePage) setPage(listSlice.safePage);
  const pagedTrees = listSlice.paged;

  const visibleIds = pagedTrees.map((tree) => tree.id);
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
    const next = reorderWithinSubset(order, visibleIds, from, to);
    if (next.join() === order.join()) return;
    persistOrder(next);
  };

  const handleDragStart = (index: number, event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", visibleIds[index] || String(index));
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

  const submitBulk = async (intent: "enable" | "disable" | "duplicate" | "delete") => {
    if (!selectedIds.length || bulkBusy) return;
    if (intent === "delete") {
      const ok = await ask({
        title: selectedIds.length === 1
          ? "Delete this filter?"
          : `Delete ${selectedIds.length} filters?`,
        message: "This cannot be undone.",
        confirmLabel: "Delete",
      });
      if (!ok) return;
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
              <div className="findly-list-search">
                <TextField
                  label="Searching filters"
                  labelHidden
                  placeholder="Searching filters"
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setPage(0);
                  }}
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} />}
                  clearButton
                  onClearButtonClick={() => {
                    setQuery("");
                    setPage(0);
                  }}
                />
              </div>
              {selectedVisible.length > 0 ? (
                <div className="findly-list-bulk">
                  <div className="findly-list-bulk-start">
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
              <table className="findly-list-table">
                {selectedVisible.length === 0 ? (
                  <thead>
                    <tr>
                      <th className="findly-list-check">
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
                        <div className="findly-list-empty">
                          <Text as="p" tone="subdued">
                            {trees.length === 0
                              ? "Add a filter to configure collection and search filters."
                              : "No filters match your search."}
                          </Text>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedTrees.map((tree, index) => {
                      const href = `/app/filters/${tree.id}`;
                      const dragging = dragIndex === index;
                      const selected = selectedIds.includes(tree.id);
                      return (
                        <tr
                          key={tree.id}
                          className={
                            dragging ? "findly-list-row is-dragging" : undefined
                          }
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleRowDrop(index, event)}
                        >
                          <td className="findly-list-check">
                            <Checkbox
                              label={`Select ${tree.name.trim() || "Untitled"}`}
                              labelHidden
                              checked={selected}
                              onChange={(checked) => toggleSelected(tree.id, checked)}
                            />
                          </td>
                          <td>
                            <div className="findly-list-name">
                              <button
                                type="button"
                                className="findly-list-handle"
                                draggable
                                aria-label={`Reorder ${tree.name}. Position ${listSlice.start + index + 1} of ${filteredTrees.length}`}
                                onDragStart={(event) => handleDragStart(index, event)}
                                onDragEnd={() => setDragIndex(null)}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DragHandle />
                              </button>
                              <button
                                type="button"
                                className="findly-list-name-btn"
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
              <AdminListPagination
                slice={listSlice}
                onPageChange={setPage}
                noun="filter"
              />
            </Card>
            {promoOpen ? (
              <div className="findly-swatch-promo">
                <span className="findly-swatch-promo-icon" aria-hidden />
                <p className="findly-swatch-promo-body">
                  Make separate products feel like real variants. Connect colors,
                  styles, and related products in one product experience.
                </p>
                <div className="findly-swatch-promo-actions">
                  <button type="button" onClick={() => navigate("/app/swatches")}>
                    Start for free
                  </button>
                </div>
                <button
                  type="button"
                  className="findly-swatch-promo-close"
                  aria-label="Dismiss"
                  onClick={() => {
                    setPromoHidden(true);
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
                    <span className="findly-pref-row-icon">
                      <Icon source={item.icon} />
                    </span>
                    <span className="findly-pref-row-body">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {item.title}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.description}
                      </Text>
                    </span>
                    <span className="findly-pref-row-chevron">
                      <Icon source={ChevronRightIcon} />
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
      {dialog}
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
