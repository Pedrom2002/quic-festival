import { NextResponse, type NextRequest } from "next/server";
import { getTeamMemberBySlug } from "@/lib/team-members";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const member = await getTeamMemberBySlug(slug);

  if (!member || !member.active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nameParts = member.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  const url = `https://app.quic.pt/card/${member.slug}`;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastName};${firstName};;;`,
    `FN:${member.name}`,
    "ORG:QUIC",
    `TITLE:${member.role}`,
    member.phone ? `TEL;TYPE=CELL:${member.phone}` : null,
    `EMAIL:${member.email}`,
    `URL:${url}`,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n") + "\r\n";

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${member.slug}.vcf"`,
    },
  });
}
