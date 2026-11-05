create table if not exists private.assistant_analysis_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null default 0 check (requests between 0 and 10),
  primary key (organization_id, actor_id, window_start)
);

revoke all on table private.assistant_analysis_usage from public, anon, authenticated;

create or replace function public.consume_assistant_analysis_quota()
returns table (allowed boolean, used integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_window_start timestamptz := date_trunc('hour', now());
  v_used integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select private.current_user_organization_id()
    into v_organization_id;

  if v_organization_id is null or not exists (
    select 1
    from public.organization_members m
    where m.organization_id = v_organization_id
      and m.user_id = v_user_id
  ) then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_organization_id::text || ':' || v_user_id::text || ':' || v_window_start::text,
      0
    )
  );

  insert into private.assistant_analysis_usage (
    organization_id, actor_id, window_start, requests
  ) values (
    v_organization_id, v_user_id, v_window_start, 1
  )
  on conflict (organization_id, actor_id, window_start)
  do update set requests = private.assistant_analysis_usage.requests + 1
  where private.assistant_analysis_usage.requests < 10
  returning requests into v_used;

  if v_used is null then
    select u.requests
      into v_used
    from private.assistant_analysis_usage u
    where u.organization_id = v_organization_id
      and u.actor_id = v_user_id
      and u.window_start = v_window_start;

    return query select false, coalesce(v_used, 10), v_window_start + interval '1 hour';
  else
    return query select true, v_used, v_window_start + interval '1 hour';
  end if;
end;
$function$;

revoke all on function public.consume_assistant_analysis_quota() from public, anon;
grant execute on function public.consume_assistant_analysis_quota() to authenticated;

comment on function public.consume_assistant_analysis_quota() is
  'Atomically reserves one generative assistant analysis per authenticated organization member, capped at 10 per UTC hour.';
