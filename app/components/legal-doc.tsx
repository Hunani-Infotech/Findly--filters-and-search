import type { ReactNode } from "react";

import styles from "../privacy.module.css";

export function LegalDoc({
  eyebrow,
  title,
  updated,
  toc,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  toc: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className={styles.legal}>
      <nav className={styles.toc} aria-label="On this page">
        <p className={styles.tocLabel}>On this page</p>
        <ol>
          {toc.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.label}</a>
            </li>
          ))}
        </ol>
      </nav>
      <article className={styles.doc}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.updated}>{updated}</p>
        {children}
      </article>
    </div>
  );
}
