import { redirect } from "next/navigation";

export default function SearchProjectsRedirectPage() {
  redirect("/app/jobs?view=searches");
}
