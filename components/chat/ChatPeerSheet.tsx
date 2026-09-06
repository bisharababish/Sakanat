import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { Button } from '@/components/ui/Button';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useToday } from '@/src/hooks/useToday';
import { majorLabel } from '@/src/data/majors';
import { ageLabel, localizedName } from '@/src/lib/format';
import { displayName } from '@/src/lib/name';
import { canShowOwnerContact, canShowSeekerContact, shouldShareEmergency } from '@/src/lib/privacy';
import { seekerRoleLabel } from '@/src/lib/seeker';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { BookingStatus, Profile, UserRole } from '@/src/types/database';

type PeerProfile = Partial<
  Pick<
    Profile,
    | 'id'
    | 'full_name'
    | 'full_name_en'
    | 'avatar_url'
    | 'role'
    | 'gender'
    | 'date_of_birth'
    | 'city_id'
    | 'university_id'
    | 'major'
    | 'study_year'
    | 'degree_level'
    | 'bio'
    | 'phone'
    | 'whatsapp'
    | 'phone_visibility'
    | 'whatsapp_visibility'
    | 'id_verify_status'
    | 'home_address'
    | 'emergency_name'
    | 'emergency_phone'
    | 'share_emergency'
    | 'spoken_languages'
    | 'student_id_number'
  >
> & { id: string };

export type ChatPeerSeed = {
  id: string;
  full_name?: string | null;
  full_name_en?: string | null;
  avatar_url?: string | null;
  role?: UserRole | null;
};

const PEER_SELECTS = [
  'id, full_name, avatar_url, role, gender, date_of_birth, city_id, university_id, major, study_year, degree_level, bio, phone, whatsapp, phone_visibility, whatsapp_visibility, id_verify_status, home_address, emergency_name, emergency_phone, share_emergency, spoken_languages, student_id_number',
  'id, full_name, avatar_url, role, gender, date_of_birth, city_id, university_id, major, study_year, degree_level, phone, whatsapp, id_verify_status, home_address, emergency_name, emergency_phone, student_id_number',
  'id, full_name, avatar_url, role, gender, date_of_birth, city_id, university_id, phone, whatsapp, id_verify_status',
  'id, full_name, avatar_url, role, phone',
];

async function loadPeerProfile(userId: string): Promise<PeerProfile | null> {
  for (const columns of PEER_SELECTS) {
    const { data, error } = await supabase.from('profiles').select(columns).eq('id', userId).maybeSingle();
    if (!error && data) return data as PeerProfile;
  }
  return null;
}

function seedAsPeer(seed: ChatPeerSeed): PeerProfile {
  return {
    id: seed.id,
    full_name: seed.full_name,
    full_name_en: seed.full_name_en,
    avatar_url: seed.avatar_url,
    role: seed.role ?? undefined,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function Row({ icon, text }: { icon: ComponentProps<typeof Ionicons>['name']; text: string }) {
  const colors = useColors();
  const { rtlText, row } = useLayout();
  return (
    <View style={[styles.row, row]}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={[styles.rowText, rtlText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

export function ChatPeerSheet({
  visible,
  userId,
  viewerId,
  seed,
  onClose,
}: {
  visible: boolean;
  userId?: string | null;
  viewerId?: string | null;
  seed?: ChatPeerSeed | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { cities, universities } = useCatalog();
  const today = useToday();
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !userId) {
      setPeer(null);
      setBookingStatus(null);
      return;
    }
    let alive = true;
    setLoading(true);
    if (seed?.id === userId) setPeer(seedAsPeer(seed));

    void (async () => {
      try {
        const [profile, a, b] = await Promise.all([
          loadPeerProfile(userId),
          viewerId
            ? supabase
                .from('bookings')
                .select('status')
                .eq('student_id', viewerId)
                .eq('owner_id', userId)
                .in('status', ['pending', 'confirmed', 'completed'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          viewerId
            ? supabase
                .from('bookings')
                .select('status')
                .eq('student_id', userId)
                .eq('owner_id', viewerId)
                .in('status', ['pending', 'confirmed', 'completed'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (!alive) return;
        if (profile) setPeer(profile);
        else if (seed?.id === userId) setPeer(seedAsPeer(seed));
        else setPeer(null);
        setBookingStatus(((a.data?.status ?? b.data?.status) as BookingStatus | undefined) ?? null);
      } catch {
        if (!alive) return;
        if (seed?.id === userId) setPeer(seedAsPeer(seed));
        else setPeer(null);
        setBookingStatus(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, userId, viewerId, seed?.id, seed?.full_name, seed?.avatar_url, seed?.role]);

  const name = peer ? displayName(peer, i18n.language) || peer.full_name || '' : '';
  const city = peer?.city_id
    ? localizedName(cities.find((item) => item.id === peer.city_id), i18n.language)
    : '';
  const university = peer?.university_id
    ? localizedName(universities.find((item) => item.id === peer.university_id), i18n.language)
    : '';
  const isOwnerPeer = peer?.role === 'owner';
  const contactFn = isOwnerPeer ? canShowOwnerContact : canShowSeekerContact;
  const showPhone = peer ? contactFn(peer, 'phone', { bookingStatus }) : false;
  const showWhatsapp = peer ? contactFn(peer, 'whatsapp', { bookingStatus }) : false;
  const showEmergency =
    peer && shouldShareEmergency(peer)
      ? isOwnerPeer
        ? bookingStatus === 'confirmed' || bookingStatus === 'completed'
        : Boolean(bookingStatus)
      : false;

  const yearKey = peer?.study_year;
  const yearLabel =
    yearKey && /^[1-6]$/.test(yearKey) ? t(`profile.year${yearKey}` as 'profile.year1') : '';
  const degree =
    peer?.degree_level === 'bachelor'
      ? t('profile.bachelor')
      : peer?.degree_level === 'master'
        ? t('profile.master')
        : peer?.degree_level === 'doctorate'
          ? t('profile.doctorate')
          : peer?.degree_level === 'diploma'
            ? t('profile.diploma')
            : peer?.degree_level
              ? t('profile.otherDegree')
              : '';

  const langs = (peer?.spoken_languages ?? [])
    .map((code) =>
      code === 'ar' ? t('profile.langAr') : code === 'en' ? t('profile.langEn') : code === 'he' ? t('profile.langHe') : code,
    )
    .filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.head, row]}>
            <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{t('chat.peerProfile')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading && !peer ? (
            <ActivityIndicator color={colors.primary} />
          ) : !peer ? (
            <Text style={[styles.empty, rtlText, { color: colors.textMuted }]}>{t('chat.peerMissing')}</Text>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
              <View style={[styles.person, row]}>
                {peer.avatar_url ? (
                  <Image source={{ uri: peer.avatar_url }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
                  </View>
                )}
                <View style={styles.personCopy}>
                  <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={2}>
                    {name || t('chat.unknownPerson')}
                  </Text>
                  {peer.role ? (
                    <Text style={[styles.role, rtlText, { color: colors.primary }]}>
                      {peer.role === 'owner' ? t('roles.owner') : seekerRoleLabel(peer.role, t)}
                    </Text>
                  ) : null}
                  <IdVerifyBadge status={peer.id_verify_status} role={peer.role} compact />
                </View>
              </View>

              {peer.bio?.trim() ? (
                <Text style={[styles.bio, rtlText, { color: colors.textMuted }]}>{peer.bio.trim()}</Text>
              ) : null}

              {peer.gender ? <Row icon="person-outline" text={t(`profile.${peer.gender}`)} /> : null}
              {ageLabel(peer.date_of_birth, t, today) ? (
                <Row icon="hourglass-outline" text={ageLabel(peer.date_of_birth, t, today)!} />
              ) : null}
              {city ? <Row icon="location-outline" text={city} /> : null}
              {university ? <Row icon="school-outline" text={university} /> : null}
              {peer.major ? <Row icon="book-outline" text={majorLabel(peer.major, i18n.language)} /> : null}
              {degree ? <Row icon="ribbon-outline" text={degree} /> : null}
              {yearLabel ? <Row icon="calendar-outline" text={yearLabel} /> : null}
              {peer.student_id_number ? (
                <Row icon="card-outline" text={`${t('profile.studentId')} ${peer.student_id_number}`} />
              ) : null}
              {langs.length ? <Row icon="chatbubbles-outline" text={langs.join(' · ')} /> : null}
              {peer.home_address && !isOwnerPeer ? (
                <Row icon="home-outline" text={peer.home_address} />
              ) : null}
              {showPhone && peer.phone ? <Row icon="call-outline" text={peer.phone} /> : null}
              {showWhatsapp && (peer.whatsapp || peer.phone) ? (
                <Row icon="logo-whatsapp" text={peer.whatsapp || peer.phone || ''} />
              ) : null}
              {showEmergency && peer.emergency_name ? (
                <Row icon="heart-outline" text={`${t('profile.emergencyName')}: ${peer.emergency_name}`} />
              ) : null}
              {showEmergency && peer.emergency_phone ? (
                <Row icon="call-outline" text={`${t('profile.emergencyPhone')} ${peer.emergency_phone}`} />
              ) : null}
            </ScrollView>
          )}

          <Button title={t('common.close')} variant="ghost" pill onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    zIndex: 1,
    maxHeight: '80%',
  },
  head: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 18, fontFamily: 'Cairo_800ExtraBold' },
  scroll: { flexGrow: 0 },
  scrollInner: { gap: 8, paddingBottom: 4 },
  empty: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  person: { alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 18 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontFamily: 'Cairo_800ExtraBold' },
  personCopy: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 17, fontFamily: 'Cairo_800ExtraBold' },
  role: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  bio: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  row: { alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_600SemiBold' },
});
