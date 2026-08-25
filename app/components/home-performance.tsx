import { Link } from "react-router";
import { BlockStack, Card, InlineGrid, InlineStack, Text } from "@shopify/polaris";

export type HomePerformanceMetrics = {
  searchCount: number;
  filterCount: number;
  noResultRate: number;
  ctr: number;
  uniqueVisitors: number;
  uniqueDesktop: number;
  uniqueMobile: number;
  from: string;
};

function rangeLabel(fromIso: string) {
  const from = new Date(fromIso);
  const to = new Date();
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(from)} – ${fmt(to)}`;
}

function deviceLabel(desktop: number, mobile: number) {
  if (!desktop && !mobile) return "—";
  if (desktop && !mobile) return "Desktop";
  if (!desktop && mobile) return "Mobile";
  return `${desktop} / ${mobile}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="findly-perf__metric">
      <Text as="p" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <Text as="p" variant="headingMd">
        {value}
      </Text>
    </div>
  );
}

export function HomePerformance({
  metrics,
  viewHref,
}: {
  metrics: HomePerformanceMetrics;
  viewHref: string;
}) {
  const range = rangeLabel(metrics.from);
  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap gap="200">
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">
                Search performance
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {range}
              </Text>
            </BlockStack>
            <Link to={viewHref} className="findly-plain-btn">
              View
            </Link>
          </InlineStack>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="300">
            <Metric label="Total searches" value={String(metrics.searchCount)} />
            <Metric label="No-result rate" value={`${metrics.noResultRate}%`} />
            <Metric label="Click-through rate" value={`${metrics.ctr}%`} />
            <Metric
              label="Device"
              value={deviceLabel(metrics.uniqueDesktop, metrics.uniqueMobile)}
            />
          </InlineGrid>
          <div className="findly-perf__insight">
            New insights appear here as shoppers search your store.
          </div>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap gap="200">
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">
                Filter performance
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {range}
              </Text>
            </BlockStack>
            <Link to={viewHref} className="findly-plain-btn">
              View
            </Link>
          </InlineStack>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="300">
            <Metric label="Filter sessions" value={String(metrics.filterCount)} />
            <Metric label="Unique visitors" value={String(metrics.uniqueVisitors)} />
            <Metric label="Click-through rate" value={`${metrics.ctr}%`} />
            <Metric
              label="Device"
              value={deviceLabel(metrics.uniqueDesktop, metrics.uniqueMobile)}
            />
          </InlineGrid>
          <div className="findly-perf__insight">
            New insights appear here as shoppers use collection filters.
          </div>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
