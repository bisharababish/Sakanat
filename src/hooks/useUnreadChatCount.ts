import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/lib/auth';
import { isConversationUnread, markInboxDelivered } from '@/src/lib/chat';
import { supabase, uniqueChannel } from '@/src/lib/supabase';
import type { Conversation } from '@/src/types/database';

export function useUnreadChatCount() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!profile?.id) {
      setCount(0);
      return;
    }
    const column = profile.role === 'owner' ? 'owner_id' : profile.role === 'admin' ? null : 'student_id';
    if (!column) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .gte('last_message_at', since);
      setCount(error ? 0 : data?.length ?? 0);
      return;
    }
    const { data, error } = await supabase
      .from('conversations')
      .select(
        'id, student_id, owner_id, last_message, last_message_at, student_last_read_at, owner_last_read_at, student_delivered_at, owner_delivered_at',
      )
      .eq(column, profile.id);
    if (error) {
      setCount(0);
      return;
    }
    const rows = (data as Conversation[]) ?? [];
    setCount(rows.filter((item) => isConversationUnread(item, profile.id)).length);
    void markInboxDelivered(rows, profile.role === 'owner');
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    void refresh();
    if (!profile?.id) return;
    const channel = uniqueChannel(`unread-chats:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, refresh]);

  return count;
}
