-- Seed inicial de admins.
-- Só emails aqui listados têm acesso a /admin e podem fazer check-in / export / resend.
-- Correr no SQL editor do Supabase depois do 0001_init.sql, e sempre que
-- adicionares/removeres alguém da equipa.

insert into public.admins (email) values
  ('pedro.marques@quic.pt'),
  ('rafael.amado@quic.pt')
on conflict (email) do nothing;
