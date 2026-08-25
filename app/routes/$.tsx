import type { MetaFunction } from "react-router";

import { PublicMessage } from "../components/public-shell";

export const meta: MetaFunction = () => [
  { title: "Page not found · Findly" },
  {
    name: "description",
    content: "That page is not part of Findly.",
  },
];

export default function NotFound() {
  return (
    <PublicMessage title="Page not found">
      That URL is not a Findly page. Open the homepage to log in with your
      Shopify shop, or read the privacy and terms links in the header.
    </PublicMessage>
  );
}
