import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal, Text } from "@shopify/polaris";

export type ConfirmDeleteOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmDeleteModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading,
  onClose,
  onConfirm,
}: ConfirmDeleteOptions & {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: confirmLabel,
        destructive: true,
        loading,
        onAction: onConfirm,
      }}
      secondaryActions={[{ content: cancelLabel, onAction: onClose }]}
    >
      {message ? (
        <Modal.Section>
          {typeof message === "string" ? <Text as="p">{message}</Text> : message}
        </Modal.Section>
      ) : (
        <Modal.Section>
          <Text as="p">This cannot be undone.</Text>
        </Modal.Section>
      )}
    </Modal>
  );
}

/**
 * In-app confirmation for destructive actions.
 * Use this instead of window.confirm — native dialogs often do not appear
 * in the Shopify admin iframe.
 */
export function useConfirmDelete() {
  const [pending, setPending] = useState<ConfirmDeleteOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback((options: ConfirmDeleteOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setPending(options);
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setPending(null);
    resolve?.(ok);
  }, []);

  const dialog: ReactNode = (
    <ConfirmDeleteModal
      open={pending != null}
      title={pending?.title ?? ""}
      message={pending?.message}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      onClose={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { ask, dialog };
}
