import { notFound } from "next/navigation";
import { getTeamMemberBySlug } from "@/lib/team-members";
import CardView from "./card-view";

export const dynamic = "force-dynamic";

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = await getTeamMemberBySlug(slug);

  if (!member || !member.active) {
    notFound();
  }

  return <CardView member={member} />;
}
