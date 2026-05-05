begin;

-- Keep the existing auth.users FK intact, but also expose the direct
-- profiles relationship PostgREST needs for profiles(... user_surf_preferences (...)).
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_class table_class
      on table_class.oid = i.indrelid
    join pg_namespace table_namespace
      on table_namespace.oid = table_class.relnamespace
    join pg_attribute first_index_column
      on first_index_column.attrelid = table_class.oid
     and first_index_column.attnum = i.indkey[0]
    where table_namespace.nspname = 'public'
      and table_class.relname = 'user_surf_preferences'
      and i.indisvalid
      and first_index_column.attname = 'user_id'
  ) then
    create index idx_user_surf_preferences_user_id_profiles_fkey
      on public.user_surf_preferences (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_surf_preferences'::regclass
      and conname = 'user_surf_preferences_user_id_profiles_fkey'
  ) then
    alter table public.user_surf_preferences
      add constraint user_surf_preferences_user_id_profiles_fkey
      foreign key (user_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table public.user_surf_preferences
  validate constraint user_surf_preferences_user_id_profiles_fkey;

notify pgrst, 'reload schema';

commit;
