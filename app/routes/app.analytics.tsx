import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import {
  Banner,
  BlockStack,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Tabs,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  loadAnalyticsDashboard,
  type AnalyticsRange,
} from "../analytics.server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { useEmbeddedNavigate } from "../admin-path";

const DATE_RANGE_OPTIONS = [
  { label: "This month", value: "this_month" },
  { label: "Last 7 days", value: "last_7" },
  { label: "Last 30 days", value: "last_30" },
];

const RANGE_VALUES = new Set<string>(
  DATE_RANGE_OPTIONS.map((option) => option.value),
);

const TABS = [
  { id: "filter", content: "Filter analytics", panelID: "analytics-filter" },
  { id: "search", content: "Search analytics", panelID: "analytics-search" },
] as const;

type AnalyticsTabId = (typeof TABS)[number]["id"];
type CountRow = { label: string; count: number };

function parseRange(value: string | null): AnalyticsRange {
  if (value && RANGE_VALUES.has(value)) return value as AnalyticsRange;
  return "this_month";
}

function csvCell(value: string | number) {
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function countRowsToCsv(section: string, rows: CountRow[]) {
  return rows.map((row) =>
    [section, row.label, row.count].map(csvCell).join(","),
  );
}

type AnalyticsDashboard = Awaited<ReturnType<typeof loadAnalyticsDashboard>>;

function analyticsCsv(dashboard: AnalyticsDashboard) {
  const metricRows = [
    ["Unique visitors", dashboard.metrics.uniqueVisitors],
    ["Click-through rate", `${dashboard.metrics.ctr}%`],
    ["No-result rate", `${dashboard.metrics.noResultRate}%`],
    ["Unique desktop", dashboard.metrics.uniqueDesktop],
    ["Unique mobile", dashboard.metrics.uniqueMobile],
    ["Search events", dashboard.metrics.searchCount],
    ["Filter events", dashboard.metrics.filterCount],
  ].map((row) => row.map(csvCell).join(","));

  const listRows = [
    ...countRowsToCsv("Top queries", dashboard.topQueries),
    ...countRowsToCsv("No-result queries", dashboard.noResultQueries),
    ...countRowsToCsv("Top filter option value", dashboard.topFilterValues),
    ...countRowsToCsv("Usually filtered together", dashboard.filterCombos),
    ...countRowsToCsv("Most visited products", dashboard.mostVisited),
  ];

  return [
    ["Metric", "Value"].map(csvCell).join(","),
    ...metricRows,
    "",
    ["Section", "Label", "Count"].map(csvCell).join(","),
    ...listRows,
  ].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function InsightCard({ title, rows }: { title: string; rows: CountRow[] }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {title}
        </Text>
        {rows.length === 0 ? (
          <Text as="p" tone="subdued">
            There was no data found for this date range.
          </Text>
        ) : (
          <BlockStack gap="150">
            {rows.map((row) => (
              <InlineStack key={`${title}-${row.label}`} align="space-between" wrap={false}>
                <Text as="span" truncate>
                  {row.label}
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {row.count}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop, plan } = await ensureShopAccess(session.shop);
  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));
  const dashboard = await loadAnalyticsDashboard(shop.id, range, plan);
  return dashboard;
};

export default function AnalyticsPage() {
  const dashboard = useLoaderData<typeof loader>();
  const navigate = useEmbeddedNavigate();
  const [searchParams] = useSearchParams();
  const shopify = useAppBridge();
  const [tab, setTab] = useState<AnalyticsTabId>("filter");
  const selectedTabIndex = Math.max(
    0,
    TABS.findIndex((item) => item.id === tab),
  );
  const isFilter = tab === "filter";
  const metrics = [
    { label: "Unique visitors", value: String(dashboard.metrics.uniqueVisitors) },
    { label: "Click-through rate", value: `${dashboard.metrics.ctr}%` },
    { label: "No-result rate", value: `${dashboard.metrics.noResultRate}%` },
    { label: "Unique desktop", value: String(dashboard.metrics.uniqueDesktop) },
    { label: "Unique mobile", value: String(dashboard.metrics.uniqueMobile) },
  ];
  const sessionRows = dashboard.sessions.map((session) => ({
    date: session.date,
    count: isFilter ? session.filter : session.search,
  }));

  return (
    <Page
      title="Analytics"
      subtitle="Storefront beacons from search + filters"
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
      secondaryActions={[
        {
          content: "Export",
          onAction: () => {
            downloadCsv(
              `findly-analytics-${dashboard.range}.csv`,
              analyticsCsv(dashboard),
            );
            shopify.toast.show("Exported analytics CSV");
          },
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                Events are retained for {dashboard.retentionDays} days. Free
                keeps 90 days; Pro keeps 180 days.
              </p>
            </Banner>

            <Tabs
              tabs={[...TABS]}
              selected={selectedTabIndex}
              onSelect={(index) => {
                const next = TABS[index];
                if (next) setTab(next.id);
              }}
            />

            <Select
              label="Date range"
              options={DATE_RANGE_OPTIONS}
              value={dashboard.range}
              onChange={(value) => {
                const params = new URLSearchParams(searchParams);
                params.set("range", value);
                navigate(`/app/analytics?${params.toString()}`);
              }}
            />

            <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="400">
              {metrics.map((metric) => (
                <Card key={metric.label}>
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued">
                      {metric.label}
                    </Text>
                    <Text as="p" variant="headingLg">
                      {metric.value}
                    </Text>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  {isFilter ? "Filter sessions" : "Search sessions"}
                </Text>
                {sessionRows.length === 0 ? (
                  <Text as="p" tone="subdued">
                    There was no data found for this date range.
                  </Text>
                ) : (
                  <BlockStack gap="150">
                    {sessionRows.map((row) => (
                      <InlineStack
                        key={row.date}
                        align="space-between"
                        wrap={false}
                      >
                        <Text as="span">{row.date}</Text>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {row.count}
                        </Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {isFilter ? (
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                <InsightCard
                  title="Top filter option value"
                  rows={dashboard.topFilterValues}
                />
                <InsightCard
                  title="Usually filtered together"
                  rows={dashboard.filterCombos}
                />
                <InsightCard
                  title="Most visited products"
                  rows={dashboard.mostVisited}
                />
              </InlineGrid>
            ) : (
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                <InsightCard title="Top queries" rows={dashboard.topQueries} />
                <InsightCard
                  title="No-result queries"
                  rows={dashboard.noResultQueries}
                />
                <InsightCard
                  title="Most visited products"
                  rows={dashboard.mostVisited}
                />
              </InlineGrid>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
