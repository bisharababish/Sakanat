// Supabase Edge Function: Expo push (client JWT or service-role / DB webhook).
// Deploy: npx supabase functions deploy push-send --project-ref <ref>
// Optional secret for DB/pg_net: supabase secrets set PUSH_HOOK_SECRET=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-push-secret',
};

type Kind = 'booking' | 'chat' | 'listing' | 'review' | 'broadcast';

type Body = {
  mode?: 'user' | 'broadcast';
  userId?: string;
  title?: string;
  body?: string;
  kind?: Kind;
  roles?: Array<'student' | 'renter' | 'owner'>;
  data?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const hookSecret = Deno.env.get('PUSH_HOOK_SECRET') ?? '';

    const auth = req.headers.get('Authorization') ?? '';
    const pushSecret = req.headers.get('x-push-secret') ?? '';
    const bearer = auth.replace(/^Bearer\s+/i, '').trim();
    const isService = Boolean(bearer && bearer === service);
    const isHook =
      Boolean(hookSecret && pushSecret && pushSecret === hookSecret) &&
      pushSecret !== 'CHANGE_ME_PUSH_HOOK_SECRET' &&
      pushSecret !== '2s8X4x1LSDZOMrVbRYJlUHyWCvGo9aFIdfgqE0Tn';

    let callerId: string | null = null;
    let callerIsAdmin = false;

    if (!isService && !isHook) {
      if (!auth) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(supabaseUrl, anon, {
        global: { headers: { Authorization: auth } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
      callerId = userData.user.id;
    }

    const admin = createClient(supabaseUrl, service);
    if (callerId) {
      const { data: me } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle();
      callerIsAdmin = me?.role === 'admin';
    }

    const payload = (await req.json()) as Body;
    const title = (payload.title ?? '').trim().slice(0, 120);
    const body = (payload.body ?? '').trim().slice(0, 400);
    if (!title || !body) return json({ error: 'missing_title_body' }, 400);
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};

    const mode = payload.mode ?? (payload.userId ? 'user' : 'broadcast');

    if (mode === 'broadcast') {
      if (!isService && !isHook && !callerIsAdmin) return json({ error: 'forbidden' }, 403);
      const roles = payload.roles?.length ? payload.roles : ['student', 'renter', 'owner'];
      const { data: rows, error } = await admin
        .from('profiles')
        .select('expo_push_token, notify_booking')
        .in('role', roles)
        .not('expo_push_token', 'is', null)
        .neq('account_status', 'suspended');
      if (error) throw error;
      const tokens = [
        ...new Set(
          (rows ?? [])
            .filter((row) => row.expo_push_token && row.notify_booking !== false)
            .map((row) => row.expo_push_token as string),
        ),
      ];
      return json({ recipients: await sendExpo(tokens, title, body, { kind: 'broadcast', ...data }) });
    }

    if (!payload.userId) return json({ error: 'missing_user' }, 400);
    const userId = payload.userId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: 'invalid_user' }, 400);
    }

    if (callerId && !callerIsAdmin) {
      const { count: bookingHits } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .or(
          `and(student_id.eq.${callerId},owner_id.eq.${userId}),and(owner_id.eq.${callerId},student_id.eq.${userId})`,
        )
        .limit(1);
      const { count: chatHits } = await admin
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .or(
          `and(student_id.eq.${callerId},owner_id.eq.${userId}),and(owner_id.eq.${callerId},student_id.eq.${userId})`,
        )
        .limit(1);
      if (!bookingHits && !chatHits) return json({ error: 'forbidden' }, 403);
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: recent } = await admin
        .from('push_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('caller_id', callerId)
        .gte('created_at', since);
      if ((recent ?? 0) >= 30) return json({ error: 'rate_limited' }, 429);
      await admin.from('push_send_log').insert({ caller_id: callerId });
    }

    const kind: Kind = payload.kind ?? 'booking';
    const { data: profile, error } = await admin
      .from('profiles')
      .select('expo_push_token, notify_booking, notify_chat, notify_listing, notify_review')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile?.expo_push_token) return json({ recipients: 0 });

    const allowed =
      kind === 'chat'
        ? profile.notify_chat !== false
        : kind === 'listing'
          ? profile.notify_listing !== false
          : kind === 'review'
            ? profile.notify_review !== false
            : profile.notify_booking !== false;
    if (!allowed) return json({ recipients: 0 });

    return json({
      recipients: await sendExpo([profile.expo_push_token], title, body, { kind, ...data }),
    });
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

async function sendExpo(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
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
          data,
        })),
      ),
    });
    sent += chunk.length;
  }
  return sent;
}
