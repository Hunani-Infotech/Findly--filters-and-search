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
  Checkbox,
  FormLayout,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { deliverContactMessage } from "../services/contact.server";
import { FINDLY_SUPPORT_EMAIL } from "../utils/public-origin";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
} from "../services/admin-extras.server";

export { ContactPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const DEFAULT_SUBJECT = "[Findly Smart Filters & Search] I need support";
const COLLABORATOR_CODE_PATTERN = /^\d{4}$/;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRequestAccess(form: FormData) {
  const raw = String(form.get("requestAccess") ?? "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const draft = extras.contactDraft;
  return {
    email: draft?.email ?? "",
    subject: draft?.subject || DEFAULT_SUBJECT,
    message: draft?.message ?? "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const requestAccess = isRequestAccess(form);
  const collaboratorCode = requestAccess
    ? String(form.get("collaboratorCode") ?? "").trim()
    : "";
  const subject = String(form.get("subject") ?? "").trim() || DEFAULT_SUBJECT;
  const message = String(form.get("message") ?? "").trim();

  const errors: { email?: string; message?: string; collaboratorCode?: string } =
    {};
  if (!email || !isValidEmail(email)) {
    errors.email = "Enter a valid email address";
  }
  if (!message) {
    errors.message = "Enter a message";
  }
  if (requestAccess && !COLLABORATOR_CODE_PATTERN.test(collaboratorCode)) {
    errors.collaboratorCode = "Enter the 4-digit collaborator request code";
  }
  if (errors.email || errors.message || errors.collaboratorCode) {
    return { ok: false as const, errors };
  }

  const extras = await getAdminNavExtras(shop.id);
  const draftExtras = {
    langs: extras.langs,
    i18n: extras.i18n,
    translationCustom: extras.translationCustom,
    contactDraft: { email, subject, message },
  };

  const delivered = await deliverContactMessage({
    shopDomain: session.shop,
    email,
    requestAccess,
    collaboratorCode,
    subject,
    message,
  });
  if (!delivered.ok) {
    await saveAdminNavExtras(shop.id, draftExtras);
    return { ok: false as const, errors: {}, sendError: delivered.error };
  }

  await saveAdminNavExtras(shop.id, {
    ...draftExtras,
    contactDraft: { email, subject, message: "" },
  });

  return { ok: true as const };
};

export default function ContactNavPage() {
  const draft = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const submitting = isMutationBusy(navigation);

  const [email, setEmail] = useState(draft.email);
  const [requestAccess, setRequestAccess] = useState(false);
  const [collaboratorCode, setCollaboratorCode] = useState("");
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [seenAction, setSeenAction] = useState(actionData);

  if (actionData !== seenAction) {
    setSeenAction(actionData);
    if (actionData && "ok" in actionData && actionData.ok) {
      setMessage("");
      setCollaboratorCode("");
      setRequestAccess(false);
    }
  }

  useEffect(() => {
    if (!actionData || !("ok" in actionData)) return;
    if (actionData.ok) {
      shopify.toast.show("Message sent to Findly support");
      return;
    }
    if (actionData.sendError) {
      shopify.toast.show(actionData.sendError, { isError: true });
    }
  }, [actionData, shopify]);

  const fieldErrors: {
    email?: string;
    message?: string;
    collaboratorCode?: string;
  } =
    actionData && "ok" in actionData && !actionData.ok ? actionData.errors : {};
  const sendError =
    actionData && "ok" in actionData && !actionData.ok
      ? actionData.sendError
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
                help. Most issues can be solved from your message. If you want
                Findly staff in your admin, tick Request store access below, or
                send a staff invitation to{" "}
                <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>
                  {FINDLY_SUPPORT_EMAIL}
                </a>{" "}
                with Apps and Online Store → Themes permissions.
              </Text>
              {sendError ? (
                <Banner tone="critical" title="Message was not sent">
                  <p>{sendError}</p>
                </Banner>
              ) : null}
              <Form method="post">
                <FormLayout>
                  <input type="hidden" name="email" value={email} />
                  <input
                    type="hidden"
                    name="requestAccess"
                    value={requestAccess ? "1" : ""}
                  />
                  <input
                    type="hidden"
                    name="collaboratorCode"
                    value={requestAccess ? collaboratorCode : ""}
                  />
                  <input type="hidden" name="subject" value={subject} />
                  <input type="hidden" name="message" value={message} />
                  <TextField
                    label="Your email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={setEmail}
                    error={fieldErrors.email}
                  />
                  <Checkbox
                    label="Request store access"
                    helpText="Only tick this if you want Findly staff to log into your Shopify admin. We email the 4-digit collaborator request code with this message and do not save it."
                    checked={requestAccess}
                    onChange={setRequestAccess}
                  />
                  {requestAccess ? (
                    <TextField
                      label="Collaborator request code"
                      autoComplete="off"
                      value={collaboratorCode}
                      onChange={setCollaboratorCode}
                      error={fieldErrors.collaboratorCode}
                      helpText="Shopify admin → Settings → Users and permissions → Collaborators. This code is sent with your message only; it is not stored."
                    />
                  ) : null}
                  <TextField
                    label="Subject"
                    autoComplete="off"
                    value={subject}
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
