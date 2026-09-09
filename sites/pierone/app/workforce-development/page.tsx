import { redirect } from "next/navigation";

/** Bookmarks to the old sixth-nav URL land on the launch service, not a sixth product. */
export default function WorkforceDevelopmentRedirectPage() {
  redirect("/services/workforce-pipeline-assessment");
}
