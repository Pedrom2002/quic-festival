import { supabaseAdmin } from "@/lib/supabase/admin";

export type TeamMember = {
  id: string;
  created_at: string;
  name: string;
  role: string;
  phone: string | null;
  email: string;
  slug: string;
  active: boolean;
};

export type CreateTeamMember = {
  name: string;
  role: string;
  phone?: string | null;
  email: string;
  slug: string;
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function getAllTeamMembers(): Promise<TeamMember[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("team_members")
    .select("id,created_at,name,role,phone,email,slug,active")
    .order("name", { ascending: true });
  if (error) throw new Error(`getAllTeamMembers: ${error.message}`);
  return (data ?? []) as TeamMember[];
}

export async function getTeamMemberBySlug(slug: string): Promise<TeamMember | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("team_members")
    .select("id,created_at,name,role,phone,email,slug,active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getTeamMemberBySlug: ${error.message}`);
  return data as TeamMember | null;
}

export async function createTeamMember(input: CreateTeamMember): Promise<TeamMember> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("team_members")
    .insert({
      name: input.name,
      role: input.role,
      phone: input.phone ?? null,
      email: input.email,
      slug: input.slug,
    })
    .select("id,created_at,name,role,phone,email,slug,active")
    .single();
  if (error) throw new Error(`createTeamMember: ${error.message}`);
  return data as TeamMember;
}

export async function updateTeamMember(
  id: string,
  input: Partial<CreateTeamMember>,
): Promise<TeamMember> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("team_members")
    .update(input)
    .eq("id", id)
    .select("id,created_at,name,role,phone,email,slug,active")
    .single();
  if (error) throw new Error(`updateTeamMember: ${error.message}`);
  return data as TeamMember;
}

export async function toggleTeamMemberActive(id: string, active: boolean): Promise<void> {
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("team_members")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(`toggleTeamMemberActive: ${error.message}`);
}
