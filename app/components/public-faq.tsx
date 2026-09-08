import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  filterFaqItems,
  type FaqItem,
} from "../data/public-faq";
import { FINDLY_SUPPORT_EMAIL } from "../utils/public-origin";
import { scrollToId } from "../utils/public-scroll";

import styles from "./public-faq.module.css";

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  const needle = q.toLowerCase();
  return parts.map((part, index) =>
    part.toLowerCase() === needle ? (
      <mark className={styles.markHit} key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function Answer({ text, query }: { text: string; query: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      nodes.push(...linkEmail(text.slice(last, match.index), query, last));
    }
    const href = match[2];
    const label = match[1];
    nodes.push(
      href.startsWith("/") ? (
        <Link key={`l-${match.index}`} to={href}>
          {label}
        </Link>
      ) : (
        <a key={`a-${match.index}`} href={href}>
          {label}
        </a>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(...linkEmail(text.slice(last), query, last));
  return <>{nodes}</>;
}

function linkEmail(chunk: string, query: string, keyBase: number): ReactNode[] {
  const parts = chunk.split(new RegExp(`(${FINDLY_SUPPORT_EMAIL})`, "g"));
  return parts.map((part, index) => {
    if (part === FINDLY_SUPPORT_EMAIL) {
      return (
        <a key={`m-${keyBase}-${index}`} href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>
          {FINDLY_SUPPORT_EMAIL}
        </a>
      );
    }
    return <span key={`t-${keyBase}-${index}`}>{highlight(part, query)}</span>;
  });
}

function FaqCard({
  item,
  query,
  open,
  onToggle,
}: {
  item: FaqItem;
  query: string;
  open: boolean;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <details
      className={styles.item}
      id={item.id}
      open={open}
      onToggle={(event) => {
        const el = event.currentTarget;
        onToggle(item.id, el.open);
      }}
    >
      <summary className={styles.summary}>
        <span className={styles.question}>{highlight(item.question, query)}</span>
        <span className={styles.toggle} aria-hidden="true" />
      </summary>
      <div className={styles.answer}>
        <p>
          <Answer text={item.answer} query={query} />
        </p>
      </div>
    </details>
  );
}

export function PublicFaq() {
  const searchId = useId();
  const [params, setParams] = useSearchParams();
  const topic = params.get("topic") ?? "all";
  const [draft, setDraft] = useState(() => params.get("q") ?? "");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [showTop, setShowTop] = useState(false);
  const query = draft;

  const visible = useMemo(
    () => filterFaqItems(FAQ_ITEMS, query, topic),
    [query, topic],
  );

  const autoOpenKey =
    query.trim().length < 2 ? "" : visible.map((item) => item.id).join("\0");
  const [appliedAutoOpenKey, setAppliedAutoOpenKey] = useState("");
  if (autoOpenKey !== appliedAutoOpenKey) {
    setAppliedAutoOpenKey(autoOpenKey);
    if (autoOpenKey) {
      setOpenIds(new Set(visible.map((item) => item.id)));
    }
  }

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      setOpenIds((prev) => new Set(prev).add(id));
      scrollToId(id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          if (draft.trim()) nextParams.set("q", draft);
          else nextParams.delete("q");
          if (nextParams.toString() === prev.toString()) return prev;
          return nextParams;
        },
        { replace: true, preventScrollReset: true },
      );
    }, 200);
    return () => window.clearTimeout(timer);
  }, [draft, setParams]);

  function setTopic(next: string) {
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (!next || next === "all") nextParams.delete("topic");
        else nextParams.set("topic", next);
        return nextParams;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function onToggle(id: string, next: boolean) {
    setOpenIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of FAQ_CATEGORIES) {
      map[cat.id] = filterFaqItems(FAQ_ITEMS, query, cat.id).length;
    }
    return map;
  }, [query]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Answers</p>
        <h1>Frequently asked questions</h1>
        <p className={styles.lede}>
          Search by topic or keyword — install, filters, search, billing, and
          data handling for Findly.
        </p>
        <form className={styles.search} role="search" onSubmit={onSearchSubmit}>
          <label className={styles.searchLabel} htmlFor={searchId}>
            Search questions
          </label>
          <div className={styles.searchRow}>
            <input
              id={searchId}
              className={styles.searchInput}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Try “metafield”, “refund”, or “theme block”"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query ? (
              <button
                className={styles.clear}
                type="button"
                onClick={() => setDraft("")}
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>
        <div className={styles.topics} role="group" aria-label="FAQ topics">
          {FAQ_CATEGORIES.map((cat) => {
            const selected = topic === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={selected}
                className={selected ? `${styles.topic} ${styles.topicOn}` : styles.topic}
                onClick={() => setTopic(cat.id)}
              >
                {cat.label}
                <span className={styles.count}>{counts[cat.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </header>

      <p className={styles.status} aria-live="polite">
        {visible.length === 0
          ? "No matching questions"
          : `${visible.length} ${visible.length === 1 ? "question" : "questions"}`}
      </p>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>
            Nothing matched “{query}”. Try another word, pick a topic, or email{" "}
            <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>{FINDLY_SUPPORT_EMAIL}</a>.
          </p>
          <button type="button" className={styles.reset} onClick={() => setDraft("")}>
            Clear search
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((item) => (
            <FaqCard
              key={item.id}
              item={item}
              query={query}
              open={openIds.has(item.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}

      <aside className={styles.help} aria-labelledby="faq-still-stuck">
        <h2 id="faq-still-stuck">Still stuck?</h2>
        <p>
          Write to{" "}
          <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>{FINDLY_SUPPORT_EMAIL}</a>.
          Legal detail lives in the{" "}
          <Link to="/privacy">Privacy Policy</Link> and{" "}
          <Link to="/terms">Terms of Service</Link>.
        </p>
      </aside>

      {showTop ? (
        <button
          type="button"
          className={styles.toTop}
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Back to top
        </button>
      ) : null}
    </div>
  );
}
