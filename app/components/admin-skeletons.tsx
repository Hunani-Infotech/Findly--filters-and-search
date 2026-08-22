import {
  BlockStack,
  Box,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  SkeletonTabs,
  SkeletonThumbnail,
} from "@shopify/polaris";

function SkeletonTableRows({ rows = 6 }: { rows?: number }) {
  return (
    <BlockStack gap="0">
      {Array.from({ length: rows }, (_, index) => (
        <Box
          key={index}
          padding="400"
          borderBlockStartWidth={index === 0 ? undefined : "025"}
          borderColor="border"
        >
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <SkeletonThumbnail size="small" />
            <Box minWidth="0" width="100%">
              <SkeletonBodyText lines={1} />
            </Box>
            <SkeletonDisplayText size="small" />
          </InlineStack>
        </Box>
      ))}
    </BlockStack>
  );
}

function SkeletonCards({ count = 2, lines = 4 }: { count?: number; lines?: number }) {
  return (
    <BlockStack gap="400">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <BlockStack gap="300">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={lines} />
          </BlockStack>
        </Card>
      ))}
    </BlockStack>
  );
}

export function FiltersListSkeleton() {
  return (
    <SkeletonPage title="Filters" primaryAction>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>
            <Card padding="0">
              <Box padding="400">
                <SkeletonDisplayText size="small" maxWidth="40%" />
              </Box>
              <SkeletonTableRows rows={7} />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SearchPageSkeleton() {
  return (
    <SkeletonPage title="Search" primaryAction>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SkeletonTabs count={4} />
            <SkeletonCards count={3} lines={5} />
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SearchSubpageSkeleton() {
  return (
    <SkeletonPage title="Search" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <SkeletonCards count={2} lines={6} />
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="findly-settings-page findly-settings-page--preview">
      <SkeletonPage title="Settings" primaryAction backAction>
        <BlockStack gap="400">
          <SkeletonTabs count={4} />
          <Layout>
            <Layout.Section>
              <SkeletonCards count={2} lines={6} />
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={10} />
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>
      </SkeletonPage>
    </div>
  );
}

export function TranslationListSkeleton() {
  return (
    <SkeletonPage title="Translation" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <SkeletonBodyText lines={2} />
            </Card>
            <Card padding="0">
              <SkeletonTableRows rows={6} />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function TranslationLocaleSkeleton() {
  return (
    <SkeletonPage title="Translation" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <SkeletonTabs count={3} />
            </Box>
            <SkeletonTableRows rows={8} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <SkeletonPage title="Analytics" backAction>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SkeletonTabs count={2} />
            <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="400">
              {Array.from({ length: 5 }, (_, index) => (
                <Card key={index}>
                  <BlockStack gap="200">
                    <SkeletonBodyText lines={1} />
                    <SkeletonDisplayText size="medium" />
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
            <SkeletonCards count={2} lines={5} />
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function BillingPageSkeleton() {
  return (
    <SkeletonPage title="Pricing">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <SkeletonBodyText lines={2} />
            </Card>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              {Array.from({ length: 3 }, (_, index) => (
                <Card key={index}>
                  <BlockStack gap="300">
                    <SkeletonDisplayText size="small" />
                    <SkeletonDisplayText size="large" />
                    <SkeletonBodyText lines={6} />
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function ContactPageSkeleton() {
  return (
    <SkeletonPage title="Contact" backAction>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={8} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SyncPageSkeleton() {
  return (
    <SkeletonPage title="Sync" primaryAction>
      <Layout>
        <Layout.Section>
          <SkeletonCards count={2} lines={4} />
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function IntegrationsPageSkeleton() {
  return (
    <SkeletonPage title="Integrations" backAction>
      <Layout>
        <Layout.Section>
          <SkeletonCards count={2} lines={5} />
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function FilterEditorSkeleton() {
  return (
    <SkeletonPage title="Edit filter" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <SkeletonCards count={2} lines={7} />
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={8} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function FilterOptionSkeleton() {
  return (
    <SkeletonPage title="Filter option" primaryAction backAction fullWidth>
      <Layout>
        <Layout.Section>
          <SkeletonCards count={2} lines={6} />
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={8} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function GroupsListSkeleton() {
  return (
    <SkeletonPage title="Group values" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <SkeletonTableRows rows={6} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function GroupFormSkeleton() {
  return (
    <SkeletonPage title="Group" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <SkeletonCards count={2} lines={6} />
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SwatchesPageSkeleton() {
  return (
    <SkeletonPage title="Swatch" backAction fullWidth>
      <Layout>
        <Layout.Section>
          <div className="findly-swatch-workspace">
            <Card>
              <BlockStack gap="200">
                {Array.from({ length: 6 }, (_, index) => (
                  <SkeletonBodyText key={index} lines={1} />
                ))}
              </BlockStack>
            </Card>
            <Card padding="0">
              <Box padding="400">
                <SkeletonDisplayText size="small" maxWidth="50%" />
              </Box>
              <SkeletonTableRows rows={7} />
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SimplePageSkeleton({ title = "Loading" }: { title?: string }) {
  return (
    <SkeletonPage title={title} backAction>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

/** Destination-aware skeleton for admin page switches and HydrateFallback. */
export function AdminRouteSkeleton({ pathname }: { pathname?: string }) {
  const path = (pathname || "/app").replace(/\/+$/, "") || "/app";

  if (path === "/app") return <FiltersListSkeleton />;
  if (path === "/app/search") return <SearchPageSkeleton />;
  if (path.startsWith("/app/search/")) return <SearchSubpageSkeleton />;
  if (path === "/app/settings") return <SettingsPageSkeleton />;
  if (path === "/app/translation") return <TranslationListSkeleton />;
  if (path.startsWith("/app/translation/")) return <TranslationLocaleSkeleton />;
  if (path === "/app/analytics") return <AnalyticsPageSkeleton />;
  if (path === "/app/billing") return <BillingPageSkeleton />;
  if (path === "/app/contact") return <ContactPageSkeleton />;
  if (path === "/app/sync") return <SyncPageSkeleton />;
  if (path === "/app/integrations") return <IntegrationsPageSkeleton />;
  if (path === "/app/swatches" || path.startsWith("/app/swatches/")) {
    return <SwatchesPageSkeleton />;
  }
  if (path === "/app/groups") return <GroupsListSkeleton />;
  if (path.startsWith("/app/groups/")) return <GroupFormSkeleton />;
  if (/\/options(\/|$)/.test(path)) return <FilterOptionSkeleton />;
  if (path.startsWith("/app/filters/") || path.startsWith("/app/collections/")) {
    return <FilterEditorSkeleton />;
  }
  if (path === "/app/recommendations") {
    return <SimplePageSkeleton title="Recommendations" />;
  }
  if (path === "/app/vehicle-finder") {
    return <SimplePageSkeleton title="Vehicle Finder" />;
  }

  return <SimplePageSkeleton />;
}
