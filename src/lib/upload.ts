import { supabase } from '@/src/lib/supabase';

export async function uploadApartmentPhoto(userId: string, uri: string) {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('apartment-photos').upload(path, buffer, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('apartment-photos').getPublicUrl(path);
  return data.publicUrl;
}
