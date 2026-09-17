import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileSearchPrefs } from '@/components/profile/ProfileSearchPrefs';
import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { contactVisibilityLabel } from '@/src/lib/privacy';
import {
  getNotificationStatus,
  getPushEnabled,
  requestPushAndRegister,
  setPushEnabled,
} from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { ContactVisibility, Profile } from '@/src/types/database';

type Props = {
  profile: Profile;
  onSaved: () => void | Promise<void>;
  variant?: 'seeker' | 'owner';
};

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { rtlText, row } = useLayout();
  const colors = useColors();
  return (
    <View style={styles.toggleBlock}>
      <View style={[styles.toggleRow, row]}>
        <Text style={[styles.toggleLabel, rtlText, { color: colors.text }]} numberOfLines={2}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
      {hint ? <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function ProfileSettingsFields({ profile, onSaved, variant = 'seeker' }: Props) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const isOwner = variant === 'owner' || profile.role === 'owner';
  const isSeeker = profile.role === 'student' || profile.role === 'renter';

  const [phoneVisibility, setPhoneVisibility] = useState<ContactVisibility>(
    profile.phone_visibility ?? 'booking',
  );
  const [whatsappVisibility, setWhatsappVisibility] = useState<ContactVisibility>(
    profile.whatsapp_visibility ?? 'booking',
  );
  const [hideLastSeen, setHideLastSeen] = useState(Boolean(profile.hide_last_seen));
  const [hideSavedCount, setHideSavedCount] = useState(Boolean(profile.hide_saved_count));
  const [notifyBooking, setNotifyBooking] = useState(profile.notify_booking !== false);
  const [notifyChat, setNotifyChat] = useState(profile.notify_chat !== false);
  const [notifyListing, setNotifyListing] = useState(profile.notify_listing !== false);
  const [notifyReview, setNotifyReview] = useState(profile.notify_review !== false);
  const [pushMaster, setPushMaster] = useState(true);
  const [osStatus, setOsStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const visibilityItems: { value: ContactVisibility; label: string }[] = [
    { value: 'booking', label: t('profile.privacyOnBooking') },
    { value: 'confirmed', label: t('profile.privacyWhenConfirmed') },
    { value: 'none', label: t('profile.privacyHidden') },
  ];

  useEffect(() => {
    setPhoneVisibility(profile.phone_visibility ?? 'booking');
    setWhatsappVisibility(profile.whatsapp_visibility ?? 'booking');
    setHideLastSeen(Boolean(profile.hide_last_seen));
    setHideSavedCount(Boolean(profile.hide_saved_count));
    setNotifyBooking(profile.notify_booking !== false);
    setNotifyChat(profile.notify_chat !== false);
    setNotifyListing(profile.notify_listing !== false);
    setNotifyReview(profile.notify_review !== false);
  }, [
    profile.id,
    profile.phone_visibility,
    profile.whatsapp_visibility,
    profile.hide_last_seen,
    profile.hide_saved_count,
    profile.notify_booking,
    profile.notify_chat,
    profile.notify_listing,
    profile.notify_review,
  ]);

  useEffect(() => {
    void getPushEnabled().then(setPushMaster);
    void getNotificationStatus().then(setOsStatus);
  }, [profile.id]);

  const persist = async (patch: Record<string, unknown>, revert: () => void) => {
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
      if (error) throw error;
      await onSaved();
    } catch (err) {
      revert();
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.settingsSaveFailed'));
    }
  };

  const osHint =
    osStatus === 'granted'
      ? t('profile.notifyOsGranted')
      : osStatus === 'denied'
        ? t('profile.notifyOsDenied')
        : t('profile.notifyOsAsk');

  return (
    <>
      <Card>
        <View style={styles.stack}>
          <View style={styles.field}>
            <SectionHead icon="eye-outline" title={t('profile.privacyTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
              {t(isOwner ? 'profile.privacyIntroOwner' : 'profile.privacyIntro')}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('common.phone')}</Text>
            <FilterPills
              value={phoneVisibility}
              onChange={(next) => {
                const prev = phoneVisibility;
                setPhoneVisibility(next);
                void persist({ phone_visibility: next }, () => setPhoneVisibility(prev));
              }}
              items={visibilityItems}
            />
            <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>
              {contactVisibilityLabel(phoneVisibility, t)}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.whatsapp')}</Text>
            <FilterPills
              value={whatsappVisibility}
              onChange={(next) => {
                const prev = whatsappVisibility;
                setWhatsappVisibility(next);
                void persist({ whatsapp_visibility: next }, () => setWhatsappVisibility(prev));
              }}
              items={visibilityItems}
            />
            <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>
              {contactVisibilityLabel(whatsappVisibility, t)}
            </Text>
          </View>

          <ToggleRow
            label={t('profile.hideLastSeen')}
            hint={t('profile.hideLastSeenHint')}
            value={hideLastSeen}
            onChange={(next) => {
              setHideLastSeen(next);
              void persist({ hide_last_seen: next }, () => setHideLastSeen(!next));
            }}
          />
          {isSeeker ? (
            <ToggleRow
              label={t('profile.hideSavedCount')}
              hint={t('profile.hideSavedCountHint')}
              value={hideSavedCount}
              onChange={(next) => {
                setHideSavedCount(next);
                void persist({ hide_saved_count: next }, () => setHideSavedCount(!next));
              }}
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={styles.stack}>
          <View style={styles.field}>
            <SectionHead icon="notifications-outline" title={t('profile.notifyTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.notifyMasterHint')}</Text>
            <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>{osHint}</Text>
          </View>
          <ToggleRow
            label={t('menu.notifications')}
            hint={t('profile.notifyMasterSwitch')}
            value={pushMaster}
            onChange={(next) => {
              const prev = pushMaster;
              setPushMaster(next);
              void (async () => {
                try {
                  if (next) {
                    await requestPushAndRegister(profile.id);
                    setOsStatus(await getNotificationStatus());
                  } else {
                    await setPushEnabled(false, profile.id);
                  }
                } catch {
                  setPushMaster(prev);
                }
              })();
            }}
          />
          {osStatus === 'denied' ? (
            <Text
              onPress={() => void Linking.openSettings()}
              style={[styles.link, rtlText, { color: colors.primary }]}
            >
              {t('profile.notifyOpenSettings')}
            </Text>
          ) : null}
          <ToggleRow
            label={t('profile.notifyBooking')}
            hint={t('profile.notifyBookingHint')}
            value={notifyBooking}
            onChange={(next) => {
              setNotifyBooking(next);
              void persist({ notify_booking: next }, () => setNotifyBooking(!next));
            }}
          />
          <ToggleRow
            label={t('profile.notifyChat')}
            hint={t('profile.notifyChatHint')}
            value={notifyChat}
            onChange={(next) => {
              setNotifyChat(next);
              void persist({ notify_chat: next }, () => setNotifyChat(!next));
            }}
          />
          <ToggleRow
            label={isOwner ? t('profile.notifyListing') : t('profile.notifySearch')}
            hint={isOwner ? t('profile.notifyListingHint') : t('profile.notifySearchHint')}
            value={notifyListing}
            onChange={(next) => {
              setNotifyListing(next);
              void persist({ notify_listing: next }, () => setNotifyListing(!next));
            }}
          />
          <ToggleRow
            label={t('profile.notifyReview')}
            hint={t('profile.notifyReviewHint')}
            value={notifyReview}
            onChange={(next) => {
              setNotifyReview(next);
              void persist({ notify_review: next }, () => setNotifyReview(!next));
            }}
          />
        </View>
      </Card>

      {isSeeker ? <ProfileSearchPrefs profile={profile} onSaved={onSaved} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, maxWidth: '100%' },
  field: { gap: spacing.xs, maxWidth: '100%' },
  denseLabel: { fontWeight: '700', fontSize: 13, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 13, lineHeight: 19, fontFamily: 'Cairo_400Regular' },
  mini: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
  link: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  toggleBlock: { gap: 4, maxWidth: '100%' },
  toggleRow: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleLabel: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: 'Cairo_700Bold' },
});
