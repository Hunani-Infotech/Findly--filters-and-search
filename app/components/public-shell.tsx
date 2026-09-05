import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { FINDLY_SUPPORT_EMAIL } from "../utils/public-origin";

import styles from "./public-shell.module.css";

function Mark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      F
    </span>
  );
}

function NavLinks({
  pathname,
  onFaq,
  onPrivacy,
  onTerms,
}: {
  pathname: string;
  onFaq: boolean;
  onPrivacy: boolean;
  onTerms: boolean;
}) {
  const linkClass = (active: boolean) =>
    active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

  return (
    <>
      <Link className={linkClass(false)} to={{ pathname: "/", hash: "features" }}>
        Features
      </Link>
      <Link
        className={linkClass(onFaq)}
        to="/faq"
        aria-current={onFaq ? "page" : undefined}
      >
        FAQ
      </Link>
      <Link
        className={linkClass(onPrivacy)}
        to="/privacy"
        aria-current={onPrivacy ? "page" : undefined}
      >
        Privacy
      </Link>
      <Link
        className={linkClass(onTerms)}
        to="/terms"
        aria-current={onTerms ? "page" : undefined}
      >
        Terms
      </Link>
      <Link
        className={styles.navCta}
        to={pathname === "/" ? { pathname: "/", hash: "open-admin" } : "/auth/login"}
      >
        Log in
      </Link>
    </>
  );
}

export function PublicMessage({
  title,
  children,
  actionLabel = "Back to Findly",
  actionTo = "/",
  minimal = false,
}: {
  title: string;
  children?: ReactNode;
  actionLabel?: string;
  actionTo?: string;
  /** Title + action only — no marketing header/footer. */
  minimal?: boolean;
}) {
  const body = (
    <div className={styles.narrow}>
      <div className={styles.card}>
        <h1 className={styles.cardTitle}>{title}</h1>
        {children ? <p className={styles.cardCopy}>{children}</p> : null}
        <Link className={styles.button} to={actionTo}>
          {actionLabel}
        </Link>
      </div>
    </div>
  );

  if (minimal) {
    return <div className={`${styles.page} ${styles.messageOnly}`}>{body}</div>;
  }

  return <PublicShell>{body}</PublicShell>;
}

export function PublicPending() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>
            <Mark />
            Findly
          </span>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.narrow}>
          <div className={styles.card} aria-busy="true" aria-live="polite">
            <p className={styles.cardCopy}>Loading…</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const onFaq = pathname === "/faq";
  const onPrivacy = pathname === "/privacy";
  const onTerms = pathname === "/terms";
  const navProps = { pathname, onFaq, onPrivacy, onTerms };

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.logo} to="/" aria-current={pathname === "/" ? "page" : undefined}>
            <Mark />
            Findly
          </Link>
          <nav className={styles.nav} aria-label="Site">
            <NavLinks {...navProps} />
          </nav>
          <details className={styles.menu}>
            <summary>Menu</summary>
            <div className={styles.menuPanel}>
              <NavLinks {...navProps} />
            </div>
          </details>
        </div>
      </header>
      <main className={styles.main} id="main">
        {children}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <strong>
              <Mark />
              Findly
            </strong>
            <p>
              Collection filters and storefront search for Shopify. Built by
              SRH Web Agency.
            </p>
          </div>
          <nav className={styles.footerCol} aria-label="Product">
            <p>Product</p>
            <Link to={{ pathname: "/", hash: "features" }}>Features</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/auth/login">Log in</Link>
          </nav>
          <nav className={styles.footerCol} aria-label="Legal">
            <p>Legal</p>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
          <nav className={styles.footerCol} aria-label="Contact">
            <p>Contact</p>
            <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>{FINDLY_SUPPORT_EMAIL}</a>
          </nav>
        </div>
        <p className={styles.footerMeta}>
          © {new Date().getFullYear()} SRH Web Agency. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
