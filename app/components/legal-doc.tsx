import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import { scrollToId } from "../utils/public-scroll";
import styles from "./legal-doc.module.css";

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
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    function applyHash() {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      setActive(id);
      scrollToId(id);
    }

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  function onTocClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    setActive(id);
    scrollToId(id);
    window.history.pushState(null, "", `#${id}`);
  }

  return (
    <div className={styles.legal}>
      <nav className={styles.toc} aria-label="On this page">
        <p className={styles.tocLabel}>On this page</p>
        <ol>
          {toc.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={active === item.id ? styles.tocCurrent : undefined}
                aria-current={active === item.id ? "location" : undefined}
                onClick={(event) => onTocClick(event, item.id)}
              >
                {item.label}
              </a>
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
