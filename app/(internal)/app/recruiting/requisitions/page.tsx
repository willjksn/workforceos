import { redirect } from "next/navigation";

export default async function RequisitionsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  redirect(created ? `/app/jobs?view=headcount&created=${created}` : "/app/jobs?view=headcount");
}
