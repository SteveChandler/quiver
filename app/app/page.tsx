import { permanentRedirect } from "next/navigation";

export default function AppLegacyRedirectPage() {
  permanentRedirect("/features");
}
