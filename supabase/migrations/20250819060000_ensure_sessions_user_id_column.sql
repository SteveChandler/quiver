-- Ensure sessions table has user_id column for API compatibility

begin;

-- Add user_id column to sessions table if it doesn't exist
do $$ 
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_name = 'sessions' 
        and column_name = 'user_id' 
        and table_schema = 'public'
    ) then
        -- Add user_id column
        alter table public.sessions add column user_id uuid not null default gen_random_uuid();
        
        -- Set user_id to profile_id for existing records (they should be the same)
        update public.sessions set user_id = profile_id;
        
        -- Add index for performance
        create index if not exists sessions_user_idx on public.sessions (user_id, arrival_time desc);
        
        -- Add foreign key constraint if profiles table exists
        if exists (select 1 from information_schema.tables where table_name = 'profiles' and table_schema = 'public') then
            alter table public.sessions 
                add constraint sessions_user_id_fkey 
                foreign key (user_id) references public.profiles(id) on delete cascade;
        end if;
        
        raise notice 'Added user_id column to sessions table';
    else
        raise notice 'user_id column already exists in sessions table';
    end if;
end $$;

commit;
