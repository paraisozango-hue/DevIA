-- Ensure every workspace-admin RLS policy uses the private SECURITY DEFINER helper.
-- This prevents authenticated requests from depending on the revoked public helper.

alter policy "workspace admins can create integrations"
  on public.integrations
  with check (private.is_workspace_admin(workspace_id));

alter policy "workspace admins can delete integrations"
  on public.integrations
  using (private.is_workspace_admin(workspace_id));

alter policy "workspace admins can update integrations"
  on public.integrations
  using (private.is_workspace_admin(workspace_id))
  with check (private.is_workspace_admin(workspace_id));

alter policy "workspace admins can delete conversations"
  on public.conversations
  using (
    exists (
      select 1
      from public.projects p
      where p.id = conversations.project_id
        and private.is_workspace_admin(p.workspace_id)
    )
  );

alter policy "workspace admins can delete messages"
  on public.messages
  using (
    exists (
      select 1
      from public.conversations c
      join public.projects p on p.id = c.project_id
      where c.id = messages.conversation_id
        and private.is_workspace_admin(p.workspace_id)
    )
  );

alter policy "workspace admins can delete projects"
  on public.projects
  using (private.is_workspace_admin(workspace_id));
