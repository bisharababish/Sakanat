// Supabase Edge Function: send Expo push with service role (deploy with `supabase functions deploy push-send`).
// Secrets: none required beyond default SUPABASE_*; Expo Push is public HTTP API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Kind = 'booking' | 'chat' | 'listing' | 'review' | 'broadcast';

type Body = {
  mode?: 'user' | 'broadcast';
  userId?: string;
  title?: string;
  body?: string;
  kind?: Kind;
  roles?: Array<'student' | 'renter' | 'owner'>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return json({ error: 'unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(supabaseUrl, service);
    const payload = (await req.json()) as Body;
    const title = (payload.title ?? '').trim();
    const body = (payload.body ?? '').trim();
    if (!title || !body) return json({ error: 'missing_title_body' }, 400);

    const mode = payload.mode ?? (payload.userId ? 'user' : 'broadcast');

    if (mode === 'broadcast') {
      const { data: me } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
      if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);
      const roles = payload.roles?.length ? payload.roles : ['student', 'renter', 'owner'];
      const { data, error } = await admin
        .from('profiles')
        .select('expo_push_token, notify_booking')
        .in('role', roles)
        .not('expo_push_token', 'is', null)
        .neq('account_status', 'suspended');
      if (error) throw error;
      const tokens = [
        ...new Set(
          (data ?? [])
            .filter((row) => row.expo_push_token && row.notify_booking !== false)
            .map((row) => row.expo_push_token as string),
        ),
      ];
      const sent = await sendExpo(tokens, title, body);
      return json({ recipients: sent });
    }

    if (!payload.userId) return json({ error: 'missing_user' }, 400);
    const kind: Kind = payload.kind ?? 'booking';
    const { data, error } = await admin
      .from('profiles')
      .select('expo_push_token, notify_booking, notify_chat, notify_listing, notify_review')
      .eq('id', payload.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.expo_push_token) return json({ recipients: 0 });

    const allowed =
      kind === 'chat'
        ? data.notify_chat !== false
        : kind === 'listing'
          ? data.notify_listing !== false
          : kind === 'review'
            ? data.notify_review !== false
            : data.notify_booking !== false;
    if (!allowed) return json({ recipients: 0 });

    const sent = await sendExpo([data.expo_push_token], title, body);
    return json({ recipients: sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'push_failed';
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sendExpo(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 90) {
    const chunk = tokens.slice(i, i + 90);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        chunk.map((to) => ({
          to,
          title,
          body,
          sound: 'default',
          channelId: 'default',
        })),
      ),
    });
    sent += chunk.length;
  }
  return sent;
}
