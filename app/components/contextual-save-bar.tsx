import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SaveBar } from "@shopify/app-bridge-react";

type ContextualSaveBarProps = {
  id: string;
  open: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** When true, App Bridge prompts before Discard. */
  discardConfirmation?: boolean;
};

type SaveBarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary";
  loading?: boolean | "";
  children?: ReactNode;
};

function SaveBarButton(props: SaveBarButtonProps) {
  return <button {...props} />;
}

/**
 * Sticky Shopify admin save bar for dirty forms.
 * Prefer this over Page primaryAction Save so merchants can save while scrolled.
 */
export function ContextualSaveBar({
  id,
  open,
  saving = false,
  onSave,
  onDiscard,
  discardConfirmation = false,
}: ContextualSaveBarProps) {
  return (
    <SaveBar id={id} open={open} discardConfirmation={discardConfirmation}>
      <SaveBarButton
        type="button"
        variant="primary"
        disabled={saving}
        loading={saving ? "" : undefined}
        onClick={onSave}
      >
        Save
      </SaveBarButton>
      <SaveBarButton type="button" disabled={saving} onClick={onDiscard}>
        Discard
      </SaveBarButton>
    </SaveBar>
  );
}

/** True when two persistable snapshots differ (JSON stringify compare). */
export function isDirtySnapshot(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Submit a form by id (typed for App Bridge SaveBar onSave handlers). */
export function requestFormSubmit(formId: string) {
  const form = document.getElementById(formId);
  if (form instanceof HTMLFormElement) form.requestSubmit();
}
