import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import styles from "./public-shell.module.css";

export function PublicShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const onPrivacy = pathname === "/privacy";
  const onTerms = pathname === "/terms";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.logo} to="/" aria-current={pathname === "/" ? "page" : undefined}>
            Findly
          </Link>
          <nav className={styles.nav} aria-label="Legal">
            <Link
              className={onPrivacy ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              to="/privacy"
              aria-current={onPrivacy ? "page" : undefined}
            >
              Privacy
            </Link>
            <Link
              className={onTerms ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              to="/terms"
              aria-current={onTerms ? "page" : undefined}
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <small>Hunani Infotech</small>
          <nav className={styles.footerLinks} aria-label="Footer">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
