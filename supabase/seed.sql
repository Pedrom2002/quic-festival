-- Correr uma vez depois de criar conta de auth para o email admin.
insert into public.admins(email) values ('matilde.carrola@gmail.com')
on conflict do nothing;
