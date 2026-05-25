import { permanentRedirect } from "next/navigation";

export default function PricingRedirectPage() {
  permanentRedirect("/plans");
}
