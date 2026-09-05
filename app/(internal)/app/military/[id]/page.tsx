import { redirect } from "next/navigation";

export default async function LegacyMilitaryOccupationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/military/occupations/${id}`);
}
