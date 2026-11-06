-- Synthetic seed data only. Never put real people or production data here.
insert into public.services (name, sort_order) values
  ('Example Service A', 10),
  ('Example Service B', 20)
on conflict do nothing;