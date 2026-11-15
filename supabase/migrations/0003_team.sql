-- Lets new teammates be added from Home. Safe to run more than once. Nothing is deleted.
-- Until now a client's coach had to be exactly 'Harsh' or 'Shrutika'.
alter table clients drop constraint if exists clients_coach_check;
