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
  return <PublicMessage title="Page not found" actionLabel="Go back" minimal />;
}
