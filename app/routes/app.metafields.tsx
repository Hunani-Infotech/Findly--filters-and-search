import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import type { MetafieldFilterType } from "@prisma/client";
import {
  Banner,
  BlockStack,
  Card,
  Checkbox,
  IndexTable,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { enforcePlanLimits, ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import {
  getMetafieldMappings,
  saveMetafieldMappings,
} from "../shop.server";

type MappingDraft = {
  namespace: string;
  key: string;
  displayLabel: string;
  filterType: MetafieldFilterType;
  enabled: boolean;
  sortOrder: number;
};

const FILTER_TYPE_OPTIONS = [
  { label: "List", value: "LIST" },
  { label: "Range", value: "RANGE" },
  { label: "Boolean", value: "BOOLEAN" },
];

const VALID_FILTER_TYPES = new Set<string>(["LIST", "RANGE", "BOOLEAN"]);

function parseMappingsPayload(
  raw: string,
):
  | { ok: true; mappings: MappingDraft[] }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error:
          "Invalid mappings data. Refresh the page and try saving again.",
      };
    }
    return { ok: true, mappings: parsed as MappingDraft[] };
  } catch {
    return {
      ok: false,
      error: "Invalid mappings data. Refresh the page and try saving again.",
    };
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const [discovered, mappings, limits] = await Promise.all([
    prisma.discoveredMetafield.findMany({
      where: { shopId: shop.id },
      orderBy: [{ namespace: "asc" }, { key: "asc" }],
      take: 200,
    }),
    getMetafieldMappings(shop.id),
    enforcePlanLimits(shop.id),
  ]);

  return {
    discovered,
    mappings,
    filterCount: limits.filterCount,
    filterLimit: limits.filterLimit,
    plan: limits.plan,
    overFilterLimit: limits.overFilterLimit,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const form = await request.formData();
  const parsed = parseMappingsPayload(String(form.get("mappings") || "[]"));
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { mappings } = parsed;

  for (const mapping of mappings) {
    if (!VALID_FILTER_TYPES.has(mapping.filterType)) {
      return {
        error: `Invalid filter type for ${mapping.namespace}.${mapping.key}. Choose List, Range, or Boolean.`,
      };
    }
  }

  const enabledInTableOrder = mappings
    .filter((mapping) => mapping.enabled)
    .map((mapping, index) => ({
      namespace: mapping.namespace,
      key: mapping.key,
      displayLabel: mapping.displayLabel || mapping.key,
      filterType: mapping.filterType,
      enabled: true as const,
      sortOrder: index,
    }));

  const limits = await enforcePlanLimits(shop.id);

  if (enabledInTableOrder.length > limits.filterLimit) {
    return {
      error: `Your ${limits.plan} plan allows up to ${limits.filterLimit} metafield filters (selected ${enabledInTableOrder.length}). Remove some or upgrade on Billing.`,
    };
  }

  await saveMetafieldMappings(shop.id, enabledInTableOrder);

  return { ok: true };
};

export default function MetafieldsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const initialRows = useMemo(() => {
    const mappingKey = (namespace: string, key: string) =>
      `${namespace}.${key}`;
    const byKey = new Map(
      data.mappings.map((m) => [mappingKey(m.namespace, m.key), m]),
    );
    const seen = new Set<string>();

    const fromDiscovered = data.discovered.map((d, index) => {
      const id = mappingKey(d.namespace, d.key);
      seen.add(id);
      const existing = byKey.get(id);
      return {
        namespace: d.namespace,
        key: d.key,
        sampleValue: d.sampleValue,
        displayLabel: existing?.displayLabel ?? d.key,
        filterType: (existing?.filterType ?? "LIST") as MetafieldFilterType,
        enabled: Boolean(existing),
        sortOrder: existing?.sortOrder ?? index,
      };
    });

    const orphans = data.mappings
      .filter((m) => !seen.has(mappingKey(m.namespace, m.key)))
      .map((m) => ({
        namespace: m.namespace,
        key: m.key,
        sampleValue: null as string | null,
        displayLabel: m.displayLabel,
        filterType: m.filterType as MetafieldFilterType,
        enabled: true,
        sortOrder: m.sortOrder,
      }));

    return [...fromDiscovered, ...orphans];
  }, [data.discovered, data.mappings]);

  const [rows, setRows] = useState(initialRows);
  const [loaderRows, setLoaderRows] = useState(initialRows);
  if (initialRows !== loaderRows) {
    setLoaderRows(initialRows);
    setRows(initialRows);
  }

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Metafield mappings saved");
    }
    if (actionData && "error" in actionData && actionData.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const selectedCount = rows.filter((r) => r.enabled).length;
  const saving = isMutationBusy(navigation);

  const updateRow = (
    namespace: string,
    key: string,
    patch: Partial<(typeof rows)[number]>,
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.namespace === namespace && row.key === key
          ? { ...row, ...patch }
          : row,
      ),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCount > data.filterLimit) {
      shopify.toast.show(
        `Filter limit is ${data.filterLimit} on ${data.plan}. Deselect some filters.`,
        { isError: true },
      );
      return;
    }
    const formData = new FormData();
    formData.set("mappings", JSON.stringify(rows));
    submit(formData, { method: "POST" });
  };

  const rowMarkup = rows.map((row, index) => (
    <IndexTable.Row
      id={`${row.namespace}.${row.key}`}
      key={`${row.namespace}.${row.key}`}
      position={index}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {row.namespace}.{row.key}
        </Text>
        {row.sampleValue ? (
          <Text as="p" tone="subdued" variant="bodySm">
            Sample: {row.sampleValue}
          </Text>
        ) : null}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Checkbox
          label="Use as filter"
          labelHidden
          checked={row.enabled}
          disabled={saving}
          onChange={(checked) => {
            if (checked && !row.enabled && selectedCount >= data.filterLimit) {
              shopify.toast.show(
                `Filter limit reached (${data.filterLimit} on ${data.plan}).`,
                { isError: true },
              );
              return;
            }
            updateRow(row.namespace, row.key, { enabled: checked });
          }}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <TextField
          label="Label"
          labelHidden
          autoComplete="off"
          value={row.displayLabel}
          disabled={saving || !row.enabled}
          onChange={(value) =>
            updateRow(row.namespace, row.key, { displayLabel: value })
          }
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Select
          label="Filter type"
          labelHidden
          options={FILTER_TYPE_OPTIONS}
          value={row.filterType}
          disabled={saving || !row.enabled}
          onChange={(value) =>
            updateRow(row.namespace, row.key, {
              filterType: value as MetafieldFilterType,
            })
          }
        />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Metafield filters"
      primaryAction={{
        content: saving ? "Saving…" : "Save mappings",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "metafields-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="metafields-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              {actionData && "error" in actionData && actionData.error ? (
                <Banner tone="critical" title="Could not save mappings">
                  <p>{actionData.error}</p>
                </Banner>
              ) : null}

              <Banner tone="info">
                <p>
                  Boolean metafields can be mapped and saved. The storefront
                  currently shows them as a checkbox list (a dedicated
                  true/false control is not part of this step).
                </p>
              </Banner>

              <Banner
                tone={
                  selectedCount > data.filterLimit || data.overFilterLimit
                    ? "warning"
                    : "info"
                }
              >
                <p>
                  Metafield filters: {selectedCount}/{data.filterLimit} on{" "}
                  {data.plan} plan (Free: 5, Pro: 25).
                </p>
              </Banner>

              {rows.length > 0 ? (
                <Text as="p" tone="subdued" variant="bodySm">
                  Enabled filters appear on the storefront in this table order
                  (top to bottom).
                </Text>
              ) : null}

              {rows.length === 0 ? (
                <Banner
                  title="No metafields discovered"
                  tone="warning"
                  action={{ content: "Run sync", url: "/app/sync" }}
                >
                  <p>
                    Run a full sync to discover product metafields from your
                    catalog.
                  </p>
                </Banner>
              ) : (
                <Card padding="0">
                  <IndexTable
                    resourceName={{
                      singular: "metafield",
                      plural: "metafields",
                    }}
                    itemCount={rows.length}
                    headings={[
                      { title: "Metafield" },
                      { title: "Use as filter" },
                      { title: "Label" },
                      { title: "Filter type" },
                    ]}
                    selectable={false}
                  >
                    {rowMarkup}
                  </IndexTable>
                </Card>
              )}
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
