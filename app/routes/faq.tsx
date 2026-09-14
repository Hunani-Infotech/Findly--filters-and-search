import type { HeadersFunction, MetaFunction } from "react-router";

import { PublicFaq } from "../components/public-faq";
import { PublicShell } from "../components/public-shell";
import { FAQ_ITEMS } from "../data/public-faq";
import { FINDLY_PUBLIC_ORIGIN } from "../utils/public-origin";

export const meta: MetaFunction = () => [
  { title: "FAQ — Findly: Smart Filters & Search" },
  {
    name: "description",
    content:
      "Answers for installing Findly, collection filters, storefront search, billing plans, and how shop-scoped data is handled.",
  },
];

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
      },
    })),
    url: `${FINDLY_PUBLIC_ORIGIN}/faq`,
  };
}

export default function FaqPage() {
  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <PublicFaq />
    </PublicShell>
  );
}
