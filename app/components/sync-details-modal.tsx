import {
  Banner,
  BlockStack,
  Button,
  InlineStack,
  List,
  Modal,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";

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

export function formatSyncTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function syncStatusLabel(status: string) {
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
  const navigate = useEmbeddedNavigate();
  const syncing = data.status === "SYNCING" || busy;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catalog sync"
      primaryAction={{
        content: submitting ? "Queueing…" : syncing ? "Syncing…" : "Sync now",
        loading: submitting,
        disabled: submitting || syncing,
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
                <Button variant="plain" onClick={() => go(billingHref)}>
                  Upgrade your plan
                </Button>{" "}
                for a higher cap.
              </p>
            </Banner>
          ) : null}

          {data.status === "READY" && !data.overProductLimit ? (
            <Banner tone="success">
              <p>
                Product and inventory changes update automatically in a few
                seconds. Filters become ready first; collection order and prices
                finish in the background.
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
            <Text as="p">Status: {syncStatusLabel(data.status)}</Text>
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
              Store changes update in a few seconds. Filters go live first;
              collection order and prices catch up in the background.
            </Text>
            <List>
              <List.Item>Products or variants added, edited, or removed</List.Item>
              <List.Item>Stock or availability changes</List.Item>
              <List.Item>Products added to or removed from collections</List.Item>
              <List.Item>Product or variant metafield changes</List.Item>
              <List.Item>A full sync still runs when you install the app</List.Item>
            </List>
          </BlockStack>

          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              What to do next
            </Text>
            <List type="number">
              <List.Item>
                <Button variant="plain" onClick={() => go(metafieldsHref)}>
                  Map metafields
                </Button>{" "}
                if you use custom attributes
              </List.Item>
              <List.Item>
                <Button
                  variant="plain"
                  onClick={() => go(defaultFiltersHref)}
                >
                  Set shop-wide default filters
                </Button>
                , then open{" "}
                <Button variant="plain" onClick={() => go(settingsHref)}>
                  Settings
                </Button>{" "}
                for layout, search, and sort
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
