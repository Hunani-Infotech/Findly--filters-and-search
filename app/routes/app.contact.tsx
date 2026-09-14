import { useEffect, useState } from "react";
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
} from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { deliverContactMessage } from "../services/contact.server";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
} from "../services/admin-extras.server";

export { ContactPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const DEFAULT_SUBJECT = "[Findly Smart Filters & Search] I need support";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function visibleSubject(value?: string) {
  const subject = (value ?? "").trim();
  if (!subject || subject === DEFAULT_SUBJECT) return "";
  return subject;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return {
      email: "",
      subject: "",
      message: "",
    };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const draft = extras.contactDraft;
  return {
    email: draft?.email ?? "",
    subject: visibleSubject(draft?.subject),
    message: draft?.message ?? "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const subjectInput = String(form.get("subject") ?? "").trim();
  const subject = subjectInput || DEFAULT_SUBJECT;
  const message = String(form.get("message") ?? "").trim();

  const errors: { email?: string; message?: string } = {};
  if (!email || !isValidEmail(email)) {
    errors.email = "Enter a valid email address";
  }
  if (!message) {
    errors.message = "Enter a message";
  }
  if (errors.email || errors.message) {
    return { ok: false as const, errors };
  }

  const extras = await getAdminNavExtras(shop.id);
  const draftExtras = {
    langs: extras.langs,
    i18n: extras.i18n,
    translationCustom: extras.translationCustom,
    contactDraft: { email, subject: subjectInput, message },
  };

  const delivered = await deliverContactMessage({
    shopDomain: session.shop,
    email,
    subject,
    message,
  });
  if (!delivered.ok) {
    await saveAdminNavExtras(shop.id, draftExtras);
    return { ok: false as const, errors: {}, sendError: delivered.error };
  }

  await saveAdminNavExtras(shop.id, {
    ...draftExtras,
    contactDraft: { email, subject: subjectInput, message: "" },
  });

  return {
    ok: true as const,
    ticketNumber: delivered.ticketNumber,
    ackSent: delivered.ackSent,
  };
};

export default function ContactNavPage() {
  const draft = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const submitting = isMutationBusy(navigation);

  const [email, setEmail] = useState(draft.email);
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [seenAction, setSeenAction] = useState(actionData);

  if (actionData !== seenAction) {
    setSeenAction(actionData);
    if (actionData && "ok" in actionData && actionData.ok) {
      setMessage("");
    }
  }

  useEffect(() => {
    if (!actionData || !("ok" in actionData)) return;
    if (actionData.ok) {
      shopify.toast.show(
        actionData.ticketNumber
          ? `Message sent · ${actionData.ticketNumber}`
          : "Message sent to Findly support",
      );
      return;
    }
    if (actionData.sendError) {
      shopify.toast.show(actionData.sendError, { isError: true });
    }
  }, [actionData, shopify]);

  const fieldErrors: {
    email?: string;
    message?: string;
  } =
    actionData && "ok" in actionData && !actionData.ok ? actionData.errors : {};
  const sendError =
    actionData && "ok" in actionData && !actionData.ok
      ? actionData.sendError
      : undefined;
  const successTicket =
    actionData && "ok" in actionData && actionData.ok
      ? actionData.ticketNumber
      : undefined;
  const successAckSent =
    actionData && "ok" in actionData && actionData.ok
      ? actionData.ackSent
      : undefined;

  return (
    <Page
      title="Contact"
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p">
                Don&apos;t hesitate to reach out if you have questions or need
                help. Most issues can be solved from your message.
              </Text>
              {sendError ? (
                <Banner tone="critical" title="Message was not sent">
                  <p>{sendError}</p>
                </Banner>
              ) : null}
              {successTicket ? (
                <Banner tone="success" title="Message sent to Findly support">
                  <p>
                    Reference: <strong>{successTicket}</strong>
                    {successAckSent
                      ? " A confirmation email with this reference was sent to your email."
                      : " Save this reference for follow-ups. A confirmation email could not be sent just now."}
                  </p>
                </Banner>
              ) : null}
              <Form method="post">
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="subject" value={subject} />
                <input type="hidden" name="message" value={message} />
                <FormLayout>
                  <TextField
                    label="Your email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={setEmail}
                    error={fieldErrors.email}
                  />
                  <TextField
                    label="Subject"
                    autoComplete="off"
                    value={subject}
                    placeholder={DEFAULT_SUBJECT}
                    onChange={setSubject}
                  />
                  <TextField
                    label="Message"
                    autoComplete="off"
                    value={message}
                    onChange={setMessage}
                    multiline={6}
                    error={fieldErrors.message}
                  />
                  <Button
                    submit
                    variant="primary"
                    loading={submitting}
                    disabled={submitting}
                  >
                    Submit
                  </Button>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
