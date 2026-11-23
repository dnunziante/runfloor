alter table public.sales_solo_signup_intents
  alter column owner_user_id drop not null;

alter table public.sales_solo_signup_intents
  add column signup_email text;

update public.sales_solo_signup_intents intent
set signup_email = lower(trim(auth_user.email))
from auth.users auth_user
where auth_user.id = intent.owner_user_id
  and intent.signup_email is null;

alter table public.sales_solo_signup_intents
  alter column signup_email set not null;

alter table public.sales_solo_signup_intents
  add constraint sales_solo_signup_email_normalized
  check (signup_email = lower(trim(signup_email)));

create unique index sales_solo_signup_one_pending_per_email
  on public.sales_solo_signup_intents (signup_email)
  where status = 'pending';
