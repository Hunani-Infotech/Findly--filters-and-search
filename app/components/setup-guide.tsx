import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Collapsible,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useFetcher, useNavigation } from "react-router";
import {
  isSetupMarkId,
  isThemeStepId,
  type SetupMarkId,
  type SetupProgress,
  type SetupStep,
} from "../utils/setup-progress";
import { isNavigatingTo } from "./admin-loading";
import { useEmbeddedHref, useEmbeddedNavigate } from "../hooks/use-embedded-navigate";

function markerClass(step: SetupStep, isNext: boolean) {
  if (step.status === "complete") return "findly-setup-marker findly-setup-marker--done";
  if (isNext) return "findly-setup-marker findly-setup-marker--current";
  return "findly-setup-marker findly-setup-marker--todo";
}

export function SetupGuide({ progress }: { progress: SetupProgress }) {
  const navigate = useEmbeddedNavigate();
  const hrefFor = useEmbeddedHref();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const fetcher = useFetcher<{
    ok?: boolean;
    intent?: string;
    done?: boolean;
  }>();
  const lastResult = useRef<unknown>(null);
  const nextId = progress.nextStep?.id ?? "";
  const [expandedId, setExpandedId] = useState(
    () => nextId || progress.steps[0]?.id || "",
  );
  const [trackedNextId, setTrackedNextId] = useState(nextId);
  if (nextId !== trackedNextId) {
    setTrackedNextId(nextId);
    if (nextId) setExpandedId(nextId);
  }

  useEffect(() => {
    const result = fetcher.data;
    if (!result || fetcher.state !== "idle") return;
    if (lastResult.current === result) return;
    lastResult.current = result;
    if (!result.ok || result.intent !== "setup-theme") return;
    shopify.toast.show(
      result.done ? "Step marked as done" : "Step unmarked",
    );
  }, [fetcher.data, fetcher.state, shopify]);

  const pendingStep =
    fetcher.state !== "idle"
      ? String(fetcher.formData?.get("step") || "")
      : "";

  const markStep = (stepId: SetupMarkId, done: boolean) => {
    const formData = new FormData();
    formData.set("intent", "setup-theme");
    formData.set("step", stepId);
    formData.set("done", done ? "true" : "false");
    fetcher.submit(formData, { method: "POST" });
  };

  const openStep = (step: SetupStep) => {
    if (step.external) {
      window.open(step.href, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(step.href);
  };

  return (
    <Card padding="0">
      <div className="findly-setup">
        <div className="findly-setup-header">
          <Text as="h2" variant="headingMd">
            Get started
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {`${progress.completeCount} of ${progress.steps.length} completed`}
            {progress.nextStep
              ? ` · Next: ${progress.nextStep.title}`
              : " · All steps are done"}
          </Text>
        </div>

        <ol className="findly-setup-list">
          {progress.steps.map((step) => {
            const complete = step.status === "complete";
            const isNext = progress.nextStep?.id === step.id;
            const expanded = expandedId === step.id;
            const loading =
              !step.external && isNavigatingTo(navigation, step.href.split("?")[0]);
            const canMark = isSetupMarkId(step.id);
            const themeStep = isThemeStepId(step.id);
            const marking = pendingStep === step.id;
            const viewHref = step.external ? step.href : hrefFor(step.href);

            return (
              <li
                key={step.id}
                className={
                  expanded
                    ? "findly-setup-item is-open"
                    : "findly-setup-item"
                }
              >
                <div className="findly-setup-row">
                  <button
                    type="button"
                    className="findly-setup-toggle"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? "" : step.id)}
                  >
                    <span className={markerClass(step, isNext)} aria-hidden="true">
                      {complete ? (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M3.5 8.5 6.5 11.5 12.5 4.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </span>
                    <span className="findly-setup-title">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {step.title}
                      </Text>
                      {complete ? (
                        <span className="findly-setup-done">Done</span>
                      ) : isNext ? (
                        <span className="findly-setup-next">Current step</span>
                      ) : null}
                    </span>
                  </button>
                  {complete ? (
                    <Button
                      size="slim"
                      url={step.external ? step.href : undefined}
                      target={step.external ? "_blank" : undefined}
                      onClick={
                        step.external
                          ? undefined
                          : () => navigate(step.href)
                      }
                      loading={!step.external && loading}
                    >
                      View
                    </Button>
                  ) : null}
                </div>

                <Collapsible
                  open={expanded}
                  id={`findly-setup-${step.id}`}
                  transition={{ duration: "120ms", timingFunction: "ease-out" }}
                >
                  <div className="findly-setup-body">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {step.description}
                    </Text>
                    {themeStep && !complete ? (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Open the theme editor, save your change, then mark this
                        step as done.
                      </Text>
                    ) : null}
                    <InlineStack gap="200" wrap>
                      {complete ? (
                        <Button
                          url={step.external ? viewHref : undefined}
                          target={step.external ? "_blank" : undefined}
                          onClick={
                            step.external ? undefined : () => openStep(step)
                          }
                          loading={!step.external && loading}
                        >
                          View
                        </Button>
                      ) : step.external ? (
                        <Button
                          variant={isNext ? "primary" : "secondary"}
                          url={step.href}
                          target="_blank"
                        >
                          {step.actionLabel}
                        </Button>
                      ) : (
                        <Button
                          variant={isNext ? "primary" : "secondary"}
                          onClick={() => {
                            if (step.id === "performance") {
                              markStep("performance", true);
                            }
                            navigate(step.href);
                          }}
                          loading={loading}
                          disabled={loading}
                        >
                          {step.actionLabel}
                        </Button>
                      )}
                      {canMark ? (
                        <Button
                          variant={complete ? "plain" : "secondary"}
                          loading={marking}
                          disabled={marking}
                          onClick={() => markStep(step.id as SetupMarkId, !complete)}
                        >
                          {complete ? "Mark as not done" : "I've done this"}
                        </Button>
                      ) : null}
                    </InlineStack>
                  </div>
                </Collapsible>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
