import { getAllTeamMembers } from "@/lib/team-members";
import CardsPanel from "@/components/admin/cards-panel";

export const dynamic = "force-dynamic";

export default async function AdminCardsPage() {
  const members = await getAllTeamMembers();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-sm tracking-[.22em] uppercase text-[#FFD27A] font-black">Cards</h1>
        <p className="text-xs opacity-50 mt-1">Cartões digitais da equipa QUIC</p>
      </div>
      <CardsPanel initial={members} isAdmin={true} />
    </div>
  );
}
