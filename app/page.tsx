import { permanentRedirect } from "next/navigation";
import { RELEASE_PATH } from "./lib/version";

export default function Page() {
  permanentRedirect(RELEASE_PATH);
}
