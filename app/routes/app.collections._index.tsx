import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  Icon,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import {
  ChevronRightIcon,
  CollectionIcon,
  FilterIcon,
  LayoutSidebarLeftIcon,
  SearchIcon,
} from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import prisma from "../db.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { AdminListPagination } from "../components/admin-list-pagination";
import { slicePage } from "../utils/admin-list-page";

export { CollectionsListSkeleton as HydrateFallback } from "../components/admin-skeletons";

const PREFERENCES = [
  {
    id: "defaults",
    title: "Shop defaults",
    description: "Filter settings used when a collection has no custom setup.",
    url: "/app/collections/default",
    icon: CollectionIcon,
  },
  {
    id: "filters",
    title: "Filter trees",
    description: "Create and assign filter sets across collections and search.",
    url: "/app/filters",
    icon: FilterIcon,
  },
  {
    id: "panel",
    title: "Filter panel display",
    description: "Choose how filters are displayed — as a sidebar or a drawer.",
    url: "/app/settings?tab=panel",
    icon: LayoutSidebarLeftIcon,
  },
] as const;

type CollectionFilterStatus = {
  setup: "custom" | "default";
  treeName: string | null;
  enabled: boolean;
};

function collectionNumericId(collectionGid: string) {
  const match = /Collection\/(\d+)/.exec(collectionGid);
  return match?.[1] || collectionGid;
}

function newestTree<T extends { createdAt: Date }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) =>
    row.createdAt > best.createdAt ? row : best,
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const [collections, joins, legacyAssigned, defaultTrees] = await Promise.all([
    prisma.collection.findMany({
      where: { shopId: shop.id },
      orderBy: { title: "asc" },
      select: {
        collectionGid: true,
        title: true,
        handle: true,
      },
    }),
    prisma.filterTreeCollection.findMany({
      where: { shopId: shop.id },
      select: {
        collectionGid: true,
        tree: {
          select: {
            id: true,
            name: true,
            enabled: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.filterConfig.findMany({
      where: { shopId: shop.id, collectionGid: { not: "" } },
      select: {
        collectionGid: true,
        name: true,
        enabled: true,
        createdAt: true,
      },
    }),
    prisma.filterConfig.findMany({
      where: {
        shopId: shop.id,
        collectionGid: "",
        treeCollections: { none: {} },
      },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        name: true,
        enabled: true,
        createdAt: true,
      },
    }),
  ]);

  const assignedByGid = new Map<
    string,
    Array<{ name: string; enabled: boolean; createdAt: Date }>
  >();

  for (const row of joins) {
    const list = assignedByGid.get(row.collectionGid) || [];
    list.push({
      name: row.tree.name,
      enabled: row.tree.enabled,
      createdAt: row.tree.createdAt,
    });
    assignedByGid.set(row.collectionGid, list);
  }

  for (const row of legacyAssigned) {
    const list = assignedByGid.get(row.collectionGid) || [];
    list.push({
      name: row.name,
      enabled: row.enabled,
      createdAt: row.createdAt,
    });
    assignedByGid.set(row.collectionGid, list);
  }

  const fallback = defaultTrees[0] || null;

  return {
    totalCollections: collections.length,
    collections: collections.map((collection) => {
      const assigned = newestTree(assignedByGid.get(collection.collectionGid) || []);
      const status: CollectionFilterStatus = assigned
        ? {
            setup: "custom",
            treeName: assigned.name.trim() || "Untitled",
            enabled: assigned.enabled,
          }
        : {
            setup: "default",
            treeName: fallback?.name.trim() || null,
            enabled: fallback?.enabled ?? true,
          };

      return {
        collectionGid: collection.collectionGid,
        id: collectionNumericId(collection.collectionGid),
        title: collection.title,
        handle: collection.handle,
        status,
      };
    }),
  };
};

export default function CollectionsIndex() {
  const data = useLoaderData<typeof loader>();
  const navigate = useEmbeddedNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data.collections;
    return data.collections.filter((collection) => {
      const title = collection.title.toLowerCase();
      const handle = collection.handle.toLowerCase();
      return title.includes(needle) || handle.includes(needle);
    });
  }, [data.collections, query]);

  const listSlice = slicePage(filtered, page);
  if (page !== listSlice.safePage) setPage(listSlice.safePage);

  const catalogEmpty = data.totalCollections === 0;

  return (
    <Page
      title="Collections"
      subtitle="Browse synced collections and open filter settings for each one."
      primaryAction={{
        content: "Shop defaults",
        onAction: () => navigate("/app/collections/default"),
      }}
      secondaryActions={[
        {
          content: "Manage filters",
          onAction: () => navigate("/app/filters"),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {catalogEmpty ? (
              <Banner
                tone="warning"
                title="Collections aren’t synced yet"
                action={{
                  content: "Go to Home",
                  onAction: () => navigate("/app"),
                }}
              >
                <p>
                  Run a catalog sync from Home, then return here to configure
                  filters per collection.
                </p>
              </Banner>
            ) : null}

            <Card padding="0">
              <div className="findly-list-search">
                <TextField
                  label="Search collections"
                  labelHidden
                  placeholder="Search collections"
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
                  disabled={catalogEmpty}
                />
              </div>
              <table className="findly-list-table">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th>Handle</th>
                    <th>Filter setup</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="findly-list-empty">
                          <Text as="p" tone="subdued">
                            {catalogEmpty
                              ? "No collections yet. Run a catalog sync from Home, then return here."
                              : "No collections match your search."}
                          </Text>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    listSlice.paged.map((collection) => {
                      const href = `/app/collections/${collection.id}`;
                      const { status } = collection;
                      const openCollection = () => navigate(href);
                      return (
                        <tr
                          key={collection.collectionGid}
                          className="findly-list-row is-clickable"
                          onClick={openCollection}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openCollection();
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`Configure filters for ${collection.title.trim() || "Untitled"}`}
                        >
                          <td>
                            <div className="findly-list-name">
                              <button
                                type="button"
                                className="findly-list-name-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openCollection();
                                }}
                              >
                                <Text as="span" variant="bodyMd" fontWeight="semibold">
                                  {collection.title.trim() || "Untitled"}
                                </Text>
                              </button>
                            </div>
                          </td>
                          <td>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              {collection.handle || "—"}
                            </Text>
                          </td>
                          <td>
                            <InlineStack gap="200" wrap>
                              <Badge
                                tone={status.setup === "custom" ? "info" : undefined}
                              >
                                {status.setup === "custom" ? "Custom" : "Default"}
                              </Badge>
                              {status.setup === "custom" && status.treeName ? (
                                <Badge>{status.treeName}</Badge>
                              ) : null}
                            </InlineStack>
                          </td>
                          <td>
                            <Badge tone={status.enabled ? "success" : undefined}>
                              {status.enabled ? "Active" : "Disabled"}
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
                noun="collection"
              />
            </Card>

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
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
