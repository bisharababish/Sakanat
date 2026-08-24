import { supabase } from '@/src/lib/supabase';
import type { Apartment } from '@/src/types/database';

export async function loadSavedApartmentIds(studentId: string) {
  const { data, error } = await supabase
    .from('saved_apartments')
    .select('apartment_id')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data ?? []).map((row) => row.apartment_id as string);
}

export async function loadSavedApartments(studentId: string) {
  const { data, error } = await supabase
    .from('saved_apartments')
    .select('apartment_id, apartments(*, cities(*), universities(*))')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? [])
    .map((row) => row.apartments)
    .flatMap((item) => (Array.isArray(item) ? item : item ? [item] : [])) as Apartment[])
    .filter((item) => item.status === 'approved');
}

export async function toggleSavedApartment(studentId: string, apartmentId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    const { error } = await supabase
      .from('saved_apartments')
      .delete()
      .eq('student_id', studentId)
      .eq('apartment_id', apartmentId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('saved_apartments').insert({
    student_id: studentId,
    apartment_id: apartmentId,
  });
  if (error) throw error;
  return true;
}
