/**
 * Prefer `useConfirmDelete` from `app/components/confirm-delete-modal.tsx`
 * for destructive actions. Native `window.confirm` often does not appear
 * inside the Shopify admin iframe.
 */
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}

/** Browser-native notice. Use this instead of a custom dialog for blocking alerts. */
export function alertAction(message: string): void {
  window.alert(message);
}
