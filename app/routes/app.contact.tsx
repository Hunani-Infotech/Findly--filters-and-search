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
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useEmbeddedNavigate } from "../admin-path";
import { deliverContactMessage } from "../contact.server";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
} from "../admin-nav-extras.server";

const DEFAULT_SUBJECT = "[Findly Smart Filters & Search] I need support";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const draft = extras.contactDraft;
  return {
    email: draft?.email ?? "",
    collaboratorCode: draft?.collaboratorCode ?? "",
    subject: draft?.subject || DEFAULT_SUBJECT,
    message: draft?.message ?? "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const collaboratorCode = String(form.get("collaboratorCode") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim() || DEFAULT_SUBJECT;
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
    recOn: extras.recOn,
    recs: extras.recs,
    ymm: extras.ymm,
    langs: extras.langs,
    i18n: extras.i18n,
    translationCustom: extras.translationCustom,
    contactDraft: { email, collaboratorCode, subject, message },
  };

  const delivered = await deliverContactMessage({
    shopDomain: session.shop,
    email,
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
    contactDraft: { email, collaboratorCode, subject, message: "" },
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
  const [collaboratorCode, setCollaboratorCode] = useState(
    draft.collaboratorCode,
  );
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
      shopify.toast.show("Message sent to Findly support");
      return;
    }
    if (actionData.sendError) {
      shopify.toast.show(actionData.sendError, { isError: true });
    }
  }, [actionData, shopify]);

  const fieldErrors: { email?: string; message?: string } =
    actionData && "ok" in actionData && !actionData.ok ? actionData.errors : {};
  const sendError =
    actionData && "ok" in actionData && !actionData.ok
      ? actionData.sendError
      : undefined;

  return (
    <Page
      title="Contact"
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p">
                Don&apos;t hesitate to reach out if you have questions or need
                help. Please send a staff admin invitation to Findly support
                using the email you enter below, and include Apps and Online
                Store → Themes permissions in that invitation.
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
                    name="collaboratorCode"
                    value={collaboratorCode}
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
                  <TextField
                    label="Collaborator request code"
                    autoComplete="off"
                    value={collaboratorCode}
                    onChange={setCollaboratorCode}
                    helpText="To find the 4-digit access code: Shopify admin > Settings > Users and permissions > Collaborators"
                  />
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
