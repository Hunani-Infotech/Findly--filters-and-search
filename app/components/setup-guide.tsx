import { Badge, BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { useNavigation } from "react-router";
import type { SetupProgress, SetupStep } from "../setup-progress.server";
import { isNavigatingTo } from "./admin-loading";
import { useEmbeddedNavigate } from "../admin-path";

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
            Sync the catalog, turn on a filter, then add the Collection
            filters and Product search theme blocks. You can do this from the
            theme editor without a developer.
          </Text>
        </BlockStack>

        {next ? (
          <InlineStack gap="300" blockAlign="center" wrap>
            {next.external ? (
              <Button variant="primary" url={next.href} target="_blank">
                {`${next.number}. ${next.actionLabel}`}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => navigate(next.href)}
                loading={isNavigatingTo(navigation, next.href)}
              >
                {`${next.number}. ${next.actionLabel}`}
              </Button>
            )}
            <Text as="p" variant="bodySm" tone="subdued">
              {progress.completeCount} of {progress.steps.length} steps ready
              · {progress.productCount} products · {progress.collectionCount}{" "}
              collections
              {progress.mappedFilterCount
                ? ` · ${progress.mappedFilterCount} metafield filters`
                : ""}
            </Text>
          </InlineStack>
        ) : (
          <Text as="p" variant="bodySm" tone="success">
            Setup is complete. Filters and search are ready on the storefront
            once you save the theme.
          </Text>
        )}

        <BlockStack gap="300">
          {progress.steps.map((step) => {
            const loading =
              !step.external && isNavigatingTo(navigation, step.href);
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
                {step.external ? (
                  <Button url={step.href} target="_blank">
                    {step.actionLabel}
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate(step.href)}
                    loading={loading}
                    disabled={loading}
                  >
                    {step.actionLabel}
                  </Button>
                )}
              </InlineStack>
            );
          })}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
