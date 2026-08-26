import {
  Banner,
  BlockStack,
  InlineStack,
  List,
  Modal,
  Spinner,
  Text,
} from "@shopify/polaris";
import { Link } from "react-router";

export type SyncModalData = {
  status: string;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  errorLog: string | null;
  productCount: number;
  collectionCount: number;
  productLimit: number;
  plan: string;
  planName: string;
  overProductLimit: boolean;
};

function formatSyncTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function statusLabel(status: string) {
  if (status === "READY") return "Ready";
  if (status === "SYNCING") return "Syncing";
  if (status === "ERROR") return "Needs attention";
  return "Waiting";
}

export function SyncDetailsModal({
  open,
  data,
  billingHref,
  settingsHref,
  metafieldsHref,
  defaultFiltersHref,
  busy,
  submitting,
  onClose,
  onSync,
}: {
  open: boolean;
  data: SyncModalData;
  billingHref: string;
  settingsHref: string;
  metafieldsHref: string;
  defaultFiltersHref: string;
  busy: boolean;
  submitting: boolean;
  onClose: () => void;
  onSync: () => void;
}) {
  const syncing = data.status === "SYNCING" || busy;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catalog sync"
      primaryAction={{
        content: submitting ? "Queueing…" : "Sync now",
        loading: submitting,
        disabled: submitting,
        onAction: onSync,
      }}
      secondaryActions={[{ content: "Close", onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {data.overProductLimit ? (
            <Banner tone="warning">
              <p>
                Product limit reached ({data.productCount}/{data.productLimit} on{" "}
                {data.planName}).{" "}
                <Link to={billingHref}>Upgrade your plan</Link> for a higher cap.
              </p>
            </Banner>
          ) : null}

          {data.status === "READY" && !data.overProductLimit ? (
            <Banner tone="success">
              <p>
                Everyday edits sync automatically in a few seconds (inventory,
                products, collections). Use Sync now only after a large import
                or if something looks stuck — a full re-sync usually finishes in
                1–3 minutes for small catalogs.
              </p>
            </Banner>
          ) : null}

          {data.status === "ERROR" && data.errorLog ? (
            <Banner tone="critical" title="Last sync failed">
              <p>{data.errorLog}</p>
            </Banner>
          ) : null}

          {syncing ? (
            <InlineStack gap="200" blockAlign="center">
              <Spinner accessibilityLabel="Syncing catalog" size="small" />
              <Text as="p">Catalog sync in progress…</Text>
            </InlineStack>
          ) : null}

          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Status
            </Text>
            <Text as="p">Plan: {data.planName}</Text>
            <Text as="p">Status: {statusLabel(data.status)}</Text>
            <Text as="p">
              Last full sync: {formatSyncTime(data.lastFullSyncAt)}
            </Text>
            <Text as="p">
              Last update: {formatSyncTime(data.lastIncrementalSyncAt)}
            </Text>
            <Text as="p">
              Indexed products: {data.productCount} / {data.productLimit}
            </Text>
            <Text as="p">Collections: {data.collectionCount}</Text>
          </BlockStack>

          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Automatic updates
            </Text>
            <Text as="p" tone="subdued">
              Automatic updates are incremental and fast. Sync now runs a full
              Shopify bulk export — that is slower, and you usually do not need
              it for a single stock change.
            </Text>
            <List>
              <List.Item>Product or variant created, edited, or deleted</List.Item>
              <List.Item>Inventory / availability changes</List.Item>
              <List.Item>Collection membership changes</List.Item>
              <List.Item>Product or variant metafield changes</List.Item>
              <List.Item>Full re-sync still runs on app install</List.Item>
            </List>
          </BlockStack>

          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              What to do next
            </Text>
            <List type="number">
              <List.Item>
                <Link to={metafieldsHref}>Map metafields</Link> if you use custom
                attributes
              </List.Item>
              <List.Item>
                <Link to={defaultFiltersHref}>Set shop-wide default filters</Link>
                , then open <Link to={settingsHref}>Settings</Link> for layout,
                search, and sort
              </List.Item>
              <List.Item>
                Enable Collection filters, then add Product search in the theme
                editor
              </List.Item>
            </List>
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
