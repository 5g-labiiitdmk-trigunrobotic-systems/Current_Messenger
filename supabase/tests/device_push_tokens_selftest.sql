do $$
declare
  a uuid; b uuid; n int; owner uuid; failed boolean;
  t1 text := 'ExponentPushToken[sqltest-phone-one-xxxx]';
  t2 text := 'ExponentPushToken[sqltest-phone-two-xxxx]';
begin
  select id into a from public.users order by created_at limit 1;
  select id into b from public.users where id <> a order by created_at limit 1;
  if a is null or b is null then raise exception 'Need at least two rows in public.users to run this test'; end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform public.register_push_token(t1, 'android');
  perform public.register_push_token(t2, 'ios');
  perform public.register_push_token(t2, 'ios');
  select count(*) into n from public.device_push_tokens where user_id = a and token in (t1, t2);
  if n <> 2 then raise exception 'FAIL 1: expected 2 device tokens for A, got %', n; end if;

  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true);
  perform public.register_push_token(t1, 'android');
  select user_id into owner from public.device_push_tokens where token = t1;
  if owner is distinct from b then raise exception 'FAIL 2: token did not move to the new account'; end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  perform public.unregister_push_token(t1);
  select count(*) into n from public.device_push_tokens where token = t1;
  if n <> 1 then raise exception 'FAIL 3: A was able to remove B''s token'; end if;

  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true);
  perform public.unregister_push_token(t1);
  select count(*) into n from public.device_push_tokens where token = t1;
  if n <> 0 then raise exception 'FAIL 4: owner could not remove own token'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  failed := false;
  begin
    perform public.register_push_token(t2, 'ios');
  exception when others then
    failed := true;
  end;
  if not failed then raise exception 'FAIL 5: call without a signed-in user was allowed'; end if;

  raise exception 'ALL 5 CHECKS PASSED - nothing was saved (this message is expected)';
end $$;
