import { Badge, BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { useNavigation } from "react-router";
import { useEmbeddedNavigate } from "../admin-path";
import type { SetupProgress, SetupStep } from "../setup-progress.server";
import { isNavigatingTo } from "./admin-loading";

function statusBadge(step: SetupStep) {
  if (step.status === "complete") {
    return <Badge tone="success">Done</Badge>;
  }
  if (step.status === "optional") {
    return <Badge>Optional</Badge>;
  }
  return <Badge tone="attention">Next</Badge>;
}

export function SetupGuide({ progress }: { progress: SetupProgress }) {
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const next = progress.nextStep;

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            Get started
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Same merchant path as a filter-and-search app: sync the catalog,
            choose filter options, set layout and search, then add the theme
            blocks. You do not need a separate filter app for these options.
          </Text>
        </BlockStack>

        {next ? (
          <InlineStack gap="300" blockAlign="center" wrap>
            <Button
              variant="primary"
              onClick={() => navigate(next.href)}
              loading={isNavigatingTo(navigation, next.href)}
            >
              {`${next.number}. ${next.actionLabel}`}
            </Button>
            <Text as="p" variant="bodySm" tone="subdued">
              {progress.completeCount} of {progress.steps.length} steps ready
              · {progress.productCount} products · {progress.collectionCount}{" "}
              collections
              {progress.mappedFilterCount
                ? ` · ${progress.mappedFilterCount} metafield filters`
                : ""}
            </Text>
          </InlineStack>
        ) : null}

        <BlockStack gap="300">
          {progress.steps.map((step) => {
            const loading = isNavigatingTo(navigation, step.href);
            return (
              <InlineStack
                key={step.id}
                align="space-between"
                blockAlign="start"
                gap="400"
                wrap
              >
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {step.number}. {step.title}
                    </Text>
                    {statusBadge(step)}
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {step.description}
                  </Text>
                </BlockStack>
                <Button
                  onClick={() => navigate(step.href)}
                  loading={loading}
                  disabled={loading}
                >
                  {step.actionLabel}
                </Button>
              </InlineStack>
            );
          })}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
