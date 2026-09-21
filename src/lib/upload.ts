import { File } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';

import i18n from '@/src/i18n';
import { supabase } from '@/src/lib/supabase';
import { AUDIO_MAX_BYTES, PHOTO_MAX_BYTES, photoExt } from '@/src/lib/limits';

const ID_DOCS_BUCKET = 'id-docs';
const PUBLIC_BUCKET = 'apartment-photos';
const CHAT_BUCKET = 'chat-photos';
const SIGNED_TTL_SEC = 60 * 60;

function contentTypeFor(ext: string) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function audioContentType(uri: string) {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'webm') return 'audio/webm';
  if (ext === '3gp' || ext === '3gpp') return 'audio/3gpp';
  if (ext === 'aac') return 'audio/aac';
  return 'audio/mp4';
}

function audioExt(uri: string) {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  if (ext === 'wav' || ext === 'webm' || ext === '3gp' || ext === 'aac' || ext === 'm4a' || ext === 'mp4') {
    return ext === 'mp4' ? 'm4a' : ext;
  }
  return 'm4a';
}

function base64ToArrayBuffer(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Local files via File / FileSystem — fetch(file://) is slow and often fails on Android. */
async function readLocalBuffer(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(i18n.t('chat.mediaFailed'));
    return response.arrayBuffer();
  }
  try {
    return await new File(uri).arrayBuffer();
  } catch {
    try {
      const b64 = await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
      return base64ToArrayBuffer(b64);
    } catch {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(i18n.t('chat.mediaFailed'));
      return response.arrayBuffer();
    }
  }
}

async function uploadPublicImage(path: string, uri: string, upsert = false) {
  const buffer = await readLocalBuffer(uri);
  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    throw new Error(i18n.t('profile.photoTooLarge'));
  }
  const ext = photoExt(path);
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, buffer, {
    contentType: contentTypeFor(ext),
    upsert,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadApartmentPhoto(userId: string, uri: string) {
  const ext = photoExt(uri);
  return uploadPublicImage(`${userId}/${Date.now()}.${ext}`, uri);
}

export async function uploadProfilePhoto(userId: string, uri: string) {
  const ext = photoExt(uri);
  return uploadPublicImage(`avatars/${userId}/${Date.now()}.${ext}`, uri);
}

/** Private chat photo — returns storage path (not a public URL). */
export async function uploadChatPhoto(userId: string, conversationId: string, uri: string) {
  const buffer = await readLocalBuffer(uri);
  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    throw new Error(i18n.t('chat.photoTooLarge'));
  }
  const ext = photoExt(uri);
  const path = `${conversationId}/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, buffer, {
    contentType: contentTypeFor(ext),
    upsert: false,
  });
  if (error) throw new Error(i18n.t('chat.mediaFailed'));
  return path;
}

export async function uploadChatAudio(userId: string, conversationId: string, uri: string) {
  const buffer = await readLocalBuffer(uri);
  if (buffer.byteLength > AUDIO_MAX_BYTES) {
    throw new Error(i18n.t('chat.voiceTooLarge'));
  }
  const path = `${conversationId}/${userId}/${Date.now()}.${audioExt(uri)}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, buffer, {
    contentType: audioContentType(uri),
    upsert: false,
  });
  if (error) throw new Error(i18n.t('chat.mediaFailed'));
  return path;
}

/** Resolve chat image path or legacy public URL for display. */
export async function chatPhotoUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('file:')) {
    return pathOrUrl;
  }
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(pathOrUrl, SIGNED_TTL_SEC);
  if (!error && data?.signedUrl) return data.signedUrl;
  return null;
}

/** National / university cards — private bucket; returns storage path (not a public URL). */
export async function uploadIdDoc(userId: string, kind: 'national' | 'university', uri: string) {
  const buffer = await readLocalBuffer(uri);
  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    throw new Error(i18n.t('profile.photoTooLarge'));
  }
  const ext = photoExt(uri);
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(ID_DOCS_BUCKET).upload(path, buffer, {
    contentType: contentTypeFor(ext),
    upsert: false,
  });
  if (error) {
    if (/bucket|not found|row-level security/i.test(error.message)) {
      throw new Error(i18n.t('profile.idUploadFailed'));
    }
    throw error;
  }
  return path;
}

/** Resolves a signed (or legacy public) URL for an ID card path. */
export async function idDocUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file:')) return path;

  if (path.startsWith('docs/')) {
    const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(ID_DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SEC);
  if (!error && data?.signedUrl) return data.signedUrl;
  return null;
}
