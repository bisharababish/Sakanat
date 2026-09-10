import AsyncStorage from '@react-native-async-storage/async-storage';

import { sendMessage } from '@/src/lib/chat';
import { uploadChatPhoto } from '@/src/lib/upload';

const KEY = 'sakanat.chatOutbox';

export type ChatOutboxItem = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  imageUri?: string | null;
  imageUrl?: string | null;
  createdAt: string;
};

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function emit(count: number) {
  listeners.forEach((fn) => fn(count));
}

export function subscribeOutboxCount(listener: Listener) {
  listeners.add(listener);
  void outboxCount().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function readQueue(): Promise<ChatOutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatOutboxItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: ChatOutboxItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, 40)));
  emit(items.length);
}

export async function enqueueChatOutbox(item: ChatOutboxItem) {
  const queue = await readQueue();
  queue.push(item);
  await writeQueue(queue);
}

export async function flushChatOutbox(conversationId?: string) {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, left: 0 };
  const remaining: ChatOutboxItem[] = [];
  let sent = 0;
  for (const item of queue) {
    if (conversationId && item.conversationId !== conversationId) {
      remaining.push(item);
      continue;
    }
    try {
      let imageUrl = item.imageUrl ?? null;
      if (!imageUrl && item.imageUri) {
        imageUrl = await uploadChatPhoto(item.senderId, item.conversationId, item.imageUri);
      }
      await sendMessage(item.conversationId, item.senderId, item.body, imageUrl);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return { sent, left: remaining.length };
}

export async function outboxCount(conversationId?: string) {
  const queue = await readQueue();
  if (!conversationId) return queue.length;
  return queue.filter((item) => item.conversationId === conversationId).length;
}
