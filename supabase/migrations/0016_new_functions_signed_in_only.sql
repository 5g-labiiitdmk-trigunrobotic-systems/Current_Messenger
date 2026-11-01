-- Follow-up to 0013 (issue 2): Supabase grants EXECUTE on new functions to the
-- signed-out role automatically, and "revoke from public" does not remove that
-- grant. search_users and get_profiles are meant for signed-in users only
-- (they already return nothing without one), so remove the extra grant.
-- login_email_for_username and username_taken stay open to signed-out callers
-- on purpose: login-by-username and the signup username check run before
-- sign-in.
revoke execute on function public.search_users(text) from anon;
revoke execute on function public.get_profiles(uuid[]) from anon;
