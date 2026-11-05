create or replace function private.get_assistant_analysis_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_hour_start timestamptz := date_trunc('hour', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select private.current_user_organization_id()
    into v_organization_id;

  if v_organization_id is null
     or not private.has_org_role(v_organization_id, array['owner','admin','manager']) then
    raise exception 'organization_manager_required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'limit_per_user_hour', 10,
    'window_start', v_hour_start,
    'resets_at', v_hour_start + interval '1 hour',
    'organization', jsonb_build_object(
      'generative_requests_this_hour',
        coalesce((select sum(u.requests) from private.assistant_analysis_usage u
          where u.organization_id = v_organization_id and u.window_start = v_hour_start), 0),
      'generative_limit_this_hour',
        (select count(*) * 10 from public.organization_members m where m.organization_id = v_organization_id),
      'ai_analyses_this_month',
        (select count(*) from public.assistant_analysis_audit a
          where a.organization_id = v_organization_id and a.engine = 'ai' and a.occurred_at >= v_month_start),
      'rules_analyses_this_month',
        (select count(*) from public.assistant_analysis_audit a
          where a.organization_id = v_organization_id and a.engine = 'rules' and a.occurred_at >= v_month_start)
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'email', coalesce(u.email, 'Usuário'),
        'role', m.role,
        'generative_requests_this_hour', coalesce(usage.requests, 0),
        'hourly_limit', 10,
        'ai_analyses_this_month', coalesce(monthly.ai_count, 0),
        'rules_analyses_this_month', coalesce(monthly.rules_count, 0),
        'last_analysis_at', monthly.last_analysis_at
      ) order by coalesce(usage.requests, 0) desc, coalesce(monthly.ai_count, 0) desc)
      from public.organization_members m
      left join auth.users u on u.id = m.user_id
      left join private.assistant_analysis_usage usage
        on usage.organization_id = m.organization_id
        and usage.actor_id = m.user_id
        and usage.window_start = v_hour_start
      left join lateral (
        select
          count(*) filter (where a.engine = 'ai') as ai_count,
          count(*) filter (where a.engine = 'rules') as rules_count,
          max(a.occurred_at) as last_analysis_at
        from public.assistant_analysis_audit a
        where a.organization_id = m.organization_id
          and a.actor_id = m.user_id
          and a.occurred_at >= v_month_start
      ) monthly on true
      where m.organization_id = v_organization_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function private.get_assistant_analysis_usage() from public, anon;
grant execute on function private.get_assistant_analysis_usage() to authenticated;

create or replace function public.get_assistant_analysis_usage()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_assistant_analysis_usage();
$function$;

revoke all on function public.get_assistant_analysis_usage() from public, anon;
grant execute on function public.get_assistant_analysis_usage() to authenticated;

comment on function public.get_assistant_analysis_usage() is
  'Returns aggregate assistant AI usage for the caller organization; restricted to owner, admin and manager.';
