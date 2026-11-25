-- VEYRION OS — index the Zoho sync workspace foreign key
-- Keeps organization/company lookups and parent-row deletes efficient.
create index if not exists zoho_sync_jobs_workspace_record_idx
  on public.zoho_sync_jobs(workspace_record_id);
