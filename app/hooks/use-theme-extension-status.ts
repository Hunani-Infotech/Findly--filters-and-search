import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import {
  themeFlagsEqual,
  themeFlagsFromSteps,
  type SetupProgress,
  type ThemeSetupFlags,
} from "../utils/setup-progress";
import { detectThemeExtensionFlags } from "../utils/theme-extension-status";

type SyncResult = {
  ok?: boolean;
  intent?: string;
};

export function useThemeExtensionStatus(
  shopify: unknown,
  setup: SetupProgress,
): ThemeSetupFlags | null {
  const persisted = themeFlagsFromSteps(setup);
  const [live, setLive] = useState<ThemeSetupFlags | null>(null);
  const fetcher = useFetcher<SyncResult>();
  const persistedRef = useRef(persisted);
  const submitRef = useRef(fetcher.submit);
  const syncingRef = useRef(false);

  useEffect(() => {
    persistedRef.current = persisted;
    submitRef.current = fetcher.submit;
  });

  useEffect(() => {
    let cancelled = false;

    const persistIfChanged = (flags: ThemeSetupFlags) => {
      if (themeFlagsEqual(flags, persistedRef.current)) return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      const formData = new FormData();
      formData.set("intent", "sync-theme-status");
      formData.set("collection-filters", String(flags["collection-filters"]));
      formData.set("product-search", String(flags["product-search"]));
      formData.set("instant-search", String(flags["instant-search"]));
      submitRef.current(formData, { method: "POST" });
    };

    const readTheme = async () => {
      const flags = await detectThemeExtensionFlags(shopify);
      if (cancelled || !flags) return;
      setLive(flags);
      persistIfChanged(flags);
    };

    void readTheme();
    const onFocus = () => {
      void readTheme();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void readTheme();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [shopify]);

  useEffect(() => {
    if (fetcher.state === "idle") syncingRef.current = false;
  }, [fetcher.state]);

  return live;
}
