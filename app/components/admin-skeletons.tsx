import type { CSSProperties } from "react";
import {
  BlockStack,
  Box,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  SkeletonPage,
  SkeletonTabs,
  Text,
} from "@shopify/polaris";

type SkelKind =
  | "line"
  | "text"
  | "title"
  | "field"
  | "btn"
  | "chip"
  | "check"
  | "circle"
  | "icon"
  | "swatch"
  | "thumb"
  | "block";

function Skel({
  kind = "line",
  width,
  className,
}: {
  kind?: SkelKind;
  width?: string | number;
  className?: string;
}) {
  const style: CSSProperties | undefined =
    width == null ? undefined : { width };
  return (
    <span
      className={`findly-skel findly-skel--${kind}${className ? ` ${className}` : ""}`}
      style={style}
      aria-hidden
    />
  );
}

function SkelBanner() {
  return (
    <div className="findly-skel-banner">
      <div className="findly-skel-banner__head">
        <Skel kind="circle" />
        <Skel kind="title" width="38%" />
      </div>
      <div className="findly-skel-banner__body">
        <div className="findly-skel-stack">
          <Skel kind="text" width="92%" />
          <Skel kind="text" width="64%" />
        </div>
      </div>
    </div>
  );
}

function FieldBlock({ lines = 1 }: { lines?: number }) {
  return (
    <div className="findly-skel-stack">
      <Skel kind="line" width="22%" />
      {Array.from({ length: lines }, (_, index) => (
        <Skel key={index} kind="field" />
      ))}
    </div>
  );
}

function CheckboxRow({ width = "48%" }: { width?: string }) {
  return (
    <div className="findly-skel-row">
      <Skel kind="check" />
      <Skel kind="text" width={width} />
    </div>
  );
}

function DragHandleDots() {
  return (
    <span className="findly-list__handle" aria-hidden>
      <svg width="12" height="16" viewBox="0 0 12 16" fill="#c9cccf">
        <circle cx="3" cy="3" r="1.25" />
        <circle cx="9" cy="3" r="1.25" />
        <circle cx="3" cy="8" r="1.25" />
        <circle cx="9" cy="8" r="1.25" />
        <circle cx="3" cy="13" r="1.25" />
        <circle cx="9" cy="13" r="1.25" />
      </svg>
    </span>
  );
}

export function FiltersListSkeleton() {
  return (
    <SkeletonPage title="Filters" primaryAction>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card padding="0">
              <div className="findly-list__search">
                <Skel kind="field" />
              </div>
              <table className="findly-list__table">
                <thead>
                  <tr>
                    <th className="findly-list__check">
                      <Skel kind="check" />
                    </th>
                    <th>Name</th>
                    <th>Applies To</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, index) => (
                    <tr key={index}>
                      <td className="findly-list__check">
                        <Skel kind="check" />
                      </td>
                      <td>
                        <div className="findly-list__name">
                          <DragHandleDots />
                          <Skel kind="text" width={index % 2 ? "58%" : "72%"} />
                        </div>
                      </td>
                      <td>
                        <div className="findly-skel-row">
                          <Skel kind="chip" />
                          {index % 3 === 0 ? <Skel kind="chip" /> : null}
                        </div>
                      </td>
                      <td>
                        <Skel kind="chip" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="findly-admin-pager">
                <Skel kind="line" width="28%" />
              </div>
            </Card>
            <Card padding="0">
              <div className="findly-pref-heading">
                <Text as="h2" variant="headingMd">
                  Preferences
                </Text>
              </div>
              <div className="findly-pref-list">
                {["36%", "42%", "28%"].map((width) => (
                  <div className="findly-pref-row" key={width}>
                    <span className="findly-pref-row__icon">
                      <Skel kind="icon" />
                    </span>
                    <span className="findly-pref-row__body">
                      <Skel kind="text" width={width} />
                      <Skel kind="line" width="70%" />
                    </span>
                    <span className="findly-pref-row__chevron">
                      <Skel kind="line" width={8} />
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function HomePageSkeleton() {
  const steps = [
    "Sync your catalog",
    "Turn on a filter",
    "Enable Collection filters",
    "Add Product search",
    "Check performance",
  ];
  return (
    <SkeletonPage title="Welcome to Findly">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card padding="0">
              <div className="findly-setup">
                <div className="findly-setup__header">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingMd">
                      Get started
                    </Text>
                    <Skel kind="line" width="46%" />
                  </BlockStack>
                </div>
                <ol className="findly-setup__list">
                  {steps.map((title, index) => (
                    <li
                      key={title}
                      className={
                        index === 0
                          ? "findly-setup__item findly-setup__item--open"
                          : "findly-setup__item"
                      }
                    >
                      <div className="findly-setup__row">
                        <span
                          className={
                            index === 0
                              ? "findly-setup-marker findly-setup-marker--current"
                              : "findly-setup-marker findly-setup-marker--todo"
                          }
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <span className="findly-setup__title">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {title}
                          </Text>
                        </span>
                      </div>
                      {index === 0 ? (
                        <div className="findly-setup__body">
                          <Skel kind="text" width="88%" />
                          <Skel kind="text" width="62%" />
                          <Skel kind="btn" />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap gap="300">
                <div className="findly-skel-stack" style={{ maxWidth: "70%" }}>
                  <Skel kind="title" width="36%" />
                  <Skel kind="text" width="80%" />
                </div>
                <Skel kind="btn" />
              </InlineStack>
            </Card>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center" wrap gap="300">
                  <Skel kind="title" width="28%" />
                  <div className="findly-skel-row">
                    <Skel kind="btn" />
                    <Skel kind="btn" />
                  </div>
                </InlineStack>
                <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div className="findly-skel-stack" key={index}>
                      <Skel kind="line" width="48%" />
                      <Skel kind="title" width="64%" />
                    </div>
                  ))}
                </InlineGrid>
              </BlockStack>
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
            <SkeletonTabs count={2} />
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Tools
                </Text>
                <CheckboxRow width="42%" />
                <CheckboxRow width="54%" />
                <CheckboxRow width="38%" />
                <CheckboxRow width="48%" />
                <FieldBlock lines={2} />
              </BlockStack>
            </Card>
            <Text as="h2" variant="headingMd">
              Preferences
            </Text>
            <Card padding="0">
              {["Pinnings", "Synonyms", "Redirects"].map((label) => (
                <Box
                  key={label}
                  padding="400"
                  borderBlockStartWidth={label === "Pinnings" ? undefined : "025"}
                  borderColor="border"
                >
                  <InlineStack align="space-between" blockAlign="center" wrap gap="300">
                    <div className="findly-skel-stack">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {label}
                      </Text>
                      <Skel kind="line" width="70%" />
                    </div>
                    <Skel kind="btn" />
                  </InlineStack>
                </Box>
              ))}
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Search relevance
                </Text>
                <div className="findly-search-fields">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div className="findly-search-fields__row" key={index}>
                      <DragHandleDots />
                      <Skel kind="check" />
                      <Skel kind="text" width={index % 2 ? "44%" : "36%"} />
                    </div>
                  ))}
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function SearchSubpageSkeleton({
  title = "Search",
  variant = "pinnings",
}: {
  title?: string;
  variant?: "pinnings" | "redirects" | "synonyms";
}) {
  return (
    <SkeletonPage title={title} primaryAction backAction>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Skel kind="text" width="72%" />
              {[0, 1].map((index) => (
                <BlockStack gap="200" key={index}>
                  <InlineStack align="space-between" blockAlign="center">
                    <Skel kind="title" width="28%" />
                    <Skel kind="btn" />
                  </InlineStack>
                  <FieldBlock />
                  {variant === "synonyms" ? (
                    <>
                      <Skel kind="field" />
                      <Skel kind="field" width="40%" />
                    </>
                  ) : variant === "redirects" ? (
                    <FieldBlock />
                  ) : (
                    <FieldBlock lines={2} />
                  )}
                </BlockStack>
              ))}
              <Skel kind="btn" />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function PinningsPageSkeleton() {
  return <SearchSubpageSkeleton title="Pinnings" variant="pinnings" />;
}

export function RedirectsPageSkeleton() {
  return <SearchSubpageSkeleton title="Redirects" variant="redirects" />;
}

export function SynonymsPageSkeleton() {
  return <SearchSubpageSkeleton title="Synonyms" variant="synonyms" />;
}

export function SettingsPageSkeleton() {
  return (
    <div className="findly-settings-page findly-settings-page--preview">
      <SkeletonPage title="Settings" primaryAction backAction>
        <BlockStack gap="400">
          <SkeletonTabs count={3} />
          <Layout>
            <Layout.Section>
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      General
                    </Text>
                    <CheckboxRow width="58%" />
                    <CheckboxRow width="46%" />
                    <CheckboxRow width="62%" />
                    <CheckboxRow width="40%" />
                    <CheckboxRow width="52%" />
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Product visibility
                    </Text>
                    <FieldBlock />
                    <FieldBlock />
                    <CheckboxRow width="44%" />
                    <CheckboxRow width="50%" />
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Sorting
                    </Text>
                    <CheckboxRow width="36%" />
                    {Array.from({ length: 6 }, (_, index) => (
                      <CheckboxRow
                        key={index}
                        width={index % 2 ? "42%" : "34%"}
                      />
                    ))}
                    <FieldBlock />
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <div className="findly-settings-preview">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Preview
                    </Text>
                    <div className="findly-skel-widget">
                      <div className="findly-skel-stack findly-skel-widget__side">
                        <Skel kind="title" width="70%" />
                        <Skel kind="field" />
                        <CheckboxRow width="80%" />
                        <CheckboxRow width="64%" />
                        <CheckboxRow width="72%" />
                        <Skel kind="block" />
                      </div>
                      <div className="findly-skel-widget__grid">
                        {Array.from({ length: 4 }, (_, index) => (
                          <div className="findly-skel-widget__tile" key={index} />
                        ))}
                      </div>
                    </div>
                  </BlockStack>
                </Card>
              </div>
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
            <SkelBanner />
            <Card padding="0">
              <table className="findly-list__table">
                <thead>
                  <tr>
                    <th>Language</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }, (_, index) => (
                    <tr key={index}>
                      <td>
                        <div className="findly-skel-row">
                          <Skel kind="text" width="42%" />
                          {index === 0 ? <Skel kind="chip" /> : null}
                        </div>
                      </td>
                      <td>
                        <Skel kind="chip" />
                      </td>
                      <td>
                        <div className="findly-skel-row">
                          <Skel kind="btn" />
                          <Skel kind="btn" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

const I18N_TABS = [
  "Product",
  "Search",
  "Filter",
  "Sort",
  "Filter option labels",
  "Vehicle Finder form",
  "Custom",
];

export function TranslationLocaleSkeleton() {
  return (
    <SkeletonPage title="Translation" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <Card>
            <div className="findly-i18n-tabs">
              {I18N_TABS.map((tab, index) => (
                <span
                  key={tab}
                  className={
                    index === 0
                      ? "findly-i18n-tab findly-i18n-tab--active"
                      : "findly-i18n-tab"
                  }
                >
                  {tab}
                </span>
              ))}
            </div>
            <div className="findly-i18n-table">
              <div className="findly-i18n-table__head">
                <span>Reference</span>
                <span />
                <span>
                  <Skel kind="text" width="48%" />
                </span>
              </div>
              {Array.from({ length: 8 }, (_, index) => (
                <div className="findly-i18n-table__row" key={index}>
                  <Skel kind="text" width={index % 2 ? "62%" : "48%"} />
                  <span className="findly-i18n-arrow">›</span>
                  <Skel kind="field" />
                </div>
              ))}
            </div>
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
            <SkelBanner />
            <SkeletonTabs count={2} />
            <Box maxWidth="14rem">
              <Skel kind="field" />
            </Box>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="400">
              {Array.from({ length: 5 }, (_, index) => (
                <Card key={index}>
                  <BlockStack gap="200">
                    <Skel kind="line" width="56%" />
                    <Skel kind="title" width="42%" />
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
            <Card>
              <BlockStack gap="300">
                <Skel kind="title" width="28%" />
                {Array.from({ length: 4 }, (_, index) => (
                  <InlineStack
                    key={index}
                    align="space-between"
                    blockAlign="center"
                  >
                    <Skel kind="text" width="24%" />
                    <Skel kind="text" width="12%" />
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              {Array.from({ length: 3 }, (_, index) => (
                <Card key={index}>
                  <BlockStack gap="300">
                    <Skel kind="title" width="64%" />
                    <Skel kind="text" width="90%" />
                    <Skel kind="text" width="70%" />
                    <Skel kind="text" width="82%" />
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

export function BillingPageSkeleton() {
  return (
    <SkeletonPage title="Pricing">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Skel kind="title" width="40%" />
                  <Skel kind="text" width="70%" />
                  <Skel kind="text" width="52%" />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Skel kind="title" width="56%" />
                  <Skel kind="text" width="44%" />
                  <Skel kind="field" />
                </BlockStack>
              </Card>
            </InlineGrid>
            <Skel kind="field" width="12rem" />
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              {Array.from({ length: 3 }, (_, index) => (
                <Card key={index}>
                  <BlockStack gap="300">
                    <Skel kind="title" width="42%" />
                    <Skel kind="title" width="34%" />
                    <Skel kind="text" width="80%" />
                    <CheckboxRow width="72%" />
                    <CheckboxRow width="64%" />
                    <CheckboxRow width="58%" />
                    <Skel kind="btn" />
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
              <Skel kind="text" width="76%" />
              <FieldBlock />
              <FieldBlock />
              <FieldBlock />
              <FieldBlock lines={3} />
              <Skel kind="btn" />
            </BlockStack>
          </Card>
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
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Filter render events
                </Text>
                <Skel kind="text" width="58%" />
                <Skel kind="text" width="46%" />
                <Skel kind="text" width="64%" />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Theme.liquid listener snippet
                  </Text>
                  <Skel kind="btn" />
                </InlineStack>
                <Skel kind="block" />
                <Skel kind="block" />
              </BlockStack>
            </Card>
            {["Reviews", "Wishlist", "Translation"].map((title) => (
              <Card key={title}>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    {title}
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Skel kind="text" width="32%" />
                    <Skel kind="chip" />
                  </InlineStack>
                  <Skel kind="text" width="78%" />
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
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
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <FieldBlock />
                <div className="findly-skel-stack">
                  <Skel kind="line" width="18%" />
                  <div className="findly-skel-row">
                    <Skel kind="chip" />
                    <Skel kind="chip" />
                    <Skel kind="chip" />
                  </div>
                </div>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Variants as separate products
                </Text>
                <CheckboxRow width="56%" />
                <FieldBlock />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Filter options
                  </Text>
                  <Skel kind="btn" />
                </InlineStack>
                <div className="findly-option-table">
                  <div className="findly-option-table__head">
                    <span />
                    <span>Label</span>
                    <span>Source</span>
                    <span>Display type</span>
                    <span>Actions</span>
                  </div>
                  {Array.from({ length: 6 }, (_, index) => (
                    <div className="findly-option-table__row" key={index}>
                      <DragHandleDots />
                      <Skel kind="text" width="70%" />
                      <Skel kind="chip" />
                      <Skel kind="field" />
                      <div className="findly-skel-row">
                        <Skel kind="btn" />
                      </div>
                    </div>
                  ))}
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function CollectionFilterSkeleton() {
  return (
    <SkeletonPage title="Shop-wide default filters" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SkelBanner />
            {["1. Filter options", "2. Matching (AND vs OR)", "3. Display type and order", "4. Filter value order"].map(
              (title, cardIndex) => (
                <Card key={title}>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      {title}
                    </Text>
                    {cardIndex === 0 ? (
                      <>
                        <CheckboxRow width="48%" />
                        {Array.from({ length: 7 }, (_, index) => (
                          <CheckboxRow
                            key={index}
                            width={index % 2 ? "36%" : "28%"}
                          />
                        ))}
                      </>
                    ) : cardIndex === 2 ? (
                      Array.from({ length: 5 }, (_, index) => (
                        <InlineStack
                          key={index}
                          align="space-between"
                          blockAlign="center"
                          wrap
                          gap="300"
                        >
                          <div className="findly-skel-row">
                            <DragHandleDots />
                            <Skel kind="text" width="8rem" />
                          </div>
                          <Box minWidth="10rem">
                            <Skel kind="field" />
                          </Box>
                        </InlineStack>
                      ))
                    ) : (
                      Array.from({ length: 4 }, (_, index) => (
                        <CheckboxRow
                          key={index}
                          width={index % 2 ? "44%" : "38%"}
                        />
                      ))
                    )}
                  </BlockStack>
                </Card>
              ),
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function FilterOptionSkeleton() {
  return (
    <div className="findly-option-editor-page">
      <SkeletonPage title="Edit filter option" primaryAction backAction fullWidth>
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <FieldBlock />
                  <FieldBlock />
                  <FieldBlock />
                  <FieldBlock />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                    <FieldBlock />
                    <FieldBlock />
                  </InlineGrid>
                  <Skel kind="field" />
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                    {Array.from({ length: 8 }, (_, index) => (
                      <CheckboxRow
                        key={index}
                        width={index % 2 ? "62%" : "48%"}
                      />
                    ))}
                  </InlineGrid>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Display options
                  </Text>
                  <CheckboxRow width="42%" />
                  <CheckboxRow width="50%" />
                  <FieldBlock />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Advanced settings
                  </Text>
                  <FieldBlock />
                  <FieldBlock />
                  <FieldBlock lines={2} />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <div className="findly-option-preview-wrap">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Preview
                  </Text>
                  <div className="findly-option-preview">
                    <div className="findly-option-preview__header">
                      <span className="findly-option-preview__caret" />
                      <span className="findly-option-preview__title">
                        <Skel kind="text" width="5rem" />
                      </span>
                      <span className="findly-option-preview__tip">i</span>
                    </div>
                    <div className="findly-option-preview__body">
                      <div className="findly-option-preview__search">
                        <Skel kind="line" width="42%" />
                      </div>
                      <div className="findly-option-preview__values">
                        {Array.from({ length: 5 }, (_, index) => (
                          <div className="findly-option-preview__value" key={index}>
                            <Skel kind="check" />
                            <span className="findly-option-preview__text">
                              <Skel kind="text" width={index % 2 ? "70%" : "54%"} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </BlockStack>
              </Card>
            </div>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    </div>
  );
}

export function GroupsListSkeleton() {
  return (
    <SkeletonPage title="Group values" primaryAction backAction>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <table className="findly-list__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Values</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }, (_, index) => (
                  <tr key={index}>
                    <td>
                      <Skel kind="text" width="56%" />
                    </td>
                    <td>
                      <Skel kind="chip" />
                    </td>
                    <td>
                      <Skel kind="text" width="18%" />
                    </td>
                    <td>
                      <Skel kind="btn" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <Card>
            <BlockStack gap="400">
              <FieldBlock />
              <FieldBlock />
              <FieldBlock />
              <CheckboxRow width="32%" />
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                {Array.from({ length: 8 }, (_, index) => (
                  <CheckboxRow key={index} width={index % 2 ? "58%" : "46%"} />
                ))}
              </InlineGrid>
              <InlineStack align="space-between" blockAlign="center">
                <Skel kind="line" width="36%" />
                <Skel kind="btn" />
              </InlineStack>
            </BlockStack>
          </Card>
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
            <div className="findly-swatch-options">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className={
                    index === 0
                      ? "findly-swatch-option findly-swatch-option--selected"
                      : "findly-swatch-option"
                  }
                >
                  <span className="findly-swatch-option__label">
                    <Skel kind="text" width={index % 2 ? "58%" : "72%"} />
                  </span>
                  {index === 1 || index === 3 ? (
                    <Skel kind="chip" />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="findly-swatch-main">
              <div className="findly-swatch-toolbar">
                <div className="findly-swatch-search">
                  <Skel kind="field" />
                </div>
                <Skel kind="field" width={120} />
              </div>
              <div className="findly-swatch-table">
                <div className="findly-swatch-table__head">
                  <span />
                  <span>Value</span>
                  <span>Type</span>
                  <span>Color</span>
                </div>
                {Array.from({ length: 7 }, (_, index) => (
                  <div className="findly-swatch-table__row" key={index}>
                    <Skel kind="check" />
                    <span className="findly-swatch-table__value">
                      <Skel kind="swatch" />
                      <Skel kind="text" width={index % 2 ? "52%" : "68%"} />
                    </span>
                    <div className="findly-skel-type">
                      <Skel kind="btn" />
                      <Skel kind="btn" />
                    </div>
                    <div className="findly-skel-hex">
                      <Skel kind="swatch" />
                      <Skel kind="field" />
                      <Skel kind="btn" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="findly-swatch-pager">
                <span className="findly-swatch-pager__label">
                  <Skel kind="line" width="10rem" />
                </span>
                <div className="findly-skel-row">
                  <Skel kind="icon" />
                  <Skel kind="icon" />
                </div>
              </div>
            </div>
          </div>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export function UnderConstructionSkeleton({ title }: { title: string }) {
  return (
    <SkeletonPage title={title} backAction>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300" inlineAlign="center">
              <span className="findly-under-construction__icon">
                <Skel kind="circle" />
              </span>
              <Skel kind="title" width="11rem" />
              <Skel kind="text" width="70%" />
              <Skel kind="text" width="54%" />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

function SimplePageSkeleton({ title = "Loading" }: { title?: string }) {
  return (
    <SkeletonPage title={title} backAction>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Skel kind="title" width="32%" />
              <Skel kind="text" width="88%" />
              <Skel kind="text" width="64%" />
              <Skel kind="field" />
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

  if (path === "/app") return <HomePageSkeleton />;
  if (path === "/app/filters") return <FiltersListSkeleton />;
  if (path === "/app/search") return <SearchPageSkeleton />;
  if (path === "/app/search/pinnings") return <PinningsPageSkeleton />;
  if (path === "/app/search/redirects") return <RedirectsPageSkeleton />;
  if (path === "/app/search/synonyms") return <SynonymsPageSkeleton />;
  if (path.startsWith("/app/search/")) return <SearchSubpageSkeleton />;
  if (path === "/app/settings") return <SettingsPageSkeleton />;
  if (path === "/app/translation") return <TranslationListSkeleton />;
  if (path.startsWith("/app/translation/")) return <TranslationLocaleSkeleton />;
  if (path === "/app/analytics") return <AnalyticsPageSkeleton />;
  if (path === "/app/billing") return <BillingPageSkeleton />;
  if (path === "/app/contact") return <ContactPageSkeleton />;
  if (path === "/app/sync") return <HomePageSkeleton />;
  if (path === "/app/integrations") return <IntegrationsPageSkeleton />;
  if (path === "/app/swatches" || path.startsWith("/app/swatches/")) {
    return <SwatchesPageSkeleton />;
  }
  if (path === "/app/groups") return <GroupsListSkeleton />;
  if (path.startsWith("/app/groups/")) return <GroupFormSkeleton />;
  if (/\/options(\/|$)/.test(path)) return <FilterOptionSkeleton />;
  if (path.startsWith("/app/collections/")) return <CollectionFilterSkeleton />;
  if (path.startsWith("/app/filters/")) return <FilterEditorSkeleton />;
  if (path === "/app/recommendations") {
    return <UnderConstructionSkeleton title="Recommendations" />;
  }
  if (path === "/app/vehicle-finder") {
    return <UnderConstructionSkeleton title="Vehicle Finder" />;
  }

  return <SimplePageSkeleton />;
}
