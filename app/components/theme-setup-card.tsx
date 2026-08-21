import { Badge, BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import type { SetupProgress, SetupStep, ThemeStepId } from "../setup-progress.server";

function statusBadge(step: SetupStep) {
  if (step.status === "complete") {
    return <Badge tone="success">Added</Badge>;
  }
  return <Badge tone="attention">Needs theme editor</Badge>;
}

export function ThemeSetupCard({ progress }: { progress: SetupProgress }) {
  const shopify = useAppBridge();
  const fetcher = useFetcher<{
    ok?: boolean;
    intent?: string;
    done?: boolean;
  }>();
  const lastResult = useRef<unknown>(null);
  const pendingStep =
    fetcher.state !== "idle"
      ? String(fetcher.formData?.get("step") || "")
      : "";

  useEffect(() => {
    const result = fetcher.data;
    if (!result || fetcher.state !== "idle") return;
    if (lastResult.current === result) return;
    lastResult.current = result;
    if (!result.ok || result.intent !== "setup-theme") return;
    shopify.toast.show(
      result.done ? "Theme step marked as added" : "Theme step unmarked",
    );
  }, [fetcher.data, fetcher.state, shopify]);

  const markStep = (stepId: ThemeStepId, done: boolean) => {
    const formData = new FormData();
    formData.set("intent", "setup-theme");
    formData.set("step", stepId);
    formData.set("done", done ? "true" : "false");
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="center" wrap gap="200">
            <Text as="h2" variant="headingMd">
              Show filters and search on your theme
            </Text>
            {progress.themeComplete ? (
              <Badge tone="success">Theme blocks added</Badge>
            ) : (
              <Badge tone="attention">Required</Badge>
            )}
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            Shoppers only see filters and search after you add three Online
            Store 2.0 blocks. No developer is required — open the theme
            editor, add the block, save, then mark the step done.
          </Text>
        </BlockStack>

        <BlockStack gap="400">
          {progress.themeSteps.map((step) => {
            const complete = step.status === "complete";
            const busy = pendingStep === step.id;
            return (
              <BlockStack key={step.id} gap="200">
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Text as="h3" variant="bodyMd" fontWeight="semibold">
                    {step.number}. {step.title}
                  </Text>
                  {statusBadge(step)}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  {step.description}
                </Text>
                <InlineStack gap="200" wrap>
                  <Button url={step.href} target="_blank">
                    {step.actionLabel}
                  </Button>
                  <Button
                    variant={complete ? "plain" : "secondary"}
                    loading={busy}
                    disabled={busy}
                    onClick={() =>
                      markStep(step.id as ThemeStepId, !complete)
                    }
                  >
                    {complete ? "Mark as not added" : "I've added this"}
                  </Button>
                </InlineStack>
              </BlockStack>
            );
          })}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
