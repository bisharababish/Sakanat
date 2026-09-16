import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { contactVisibilityLabel } from '@/src/lib/privacy';
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

  const [phoneVisibility, setPhoneVisibility] = useState<ContactVisibility>(
    profile.phone_visibility ?? 'booking',
  );
  const [shareEmergency, setShareEmergency] = useState(profile.share_emergency !== false);
  const [notifyBooking, setNotifyBooking] = useState(profile.notify_booking !== false);
  const [notifyChat, setNotifyChat] = useState(profile.notify_chat !== false);
  const [notifyListing, setNotifyListing] = useState(profile.notify_listing !== false);
  const [notifyReview, setNotifyReview] = useState(profile.notify_review !== false);

  const visibilityItems: { value: ContactVisibility; label: string }[] = [
    { value: 'booking', label: t('profile.privacyOnBooking') },
    { value: 'confirmed', label: t('profile.privacyWhenConfirmed') },
    { value: 'none', label: t('profile.privacyHidden') },
  ];

  useEffect(() => {
    setPhoneVisibility(profile.phone_visibility ?? 'booking');
    setShareEmergency(profile.share_emergency !== false);
    setNotifyBooking(profile.notify_booking !== false);
    setNotifyChat(profile.notify_chat !== false);
    setNotifyListing(profile.notify_listing !== false);
    setNotifyReview(profile.notify_review !== false);
  }, [
    profile.id,
    profile.phone_visibility,
    profile.share_emergency,
    profile.notify_booking,
    profile.notify_chat,
    profile.notify_listing,
    profile.notify_review,
  ]);

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

  return (
    <>
      <Card compact>
        <View style={styles.dense}>
          <SectionHead compact icon="eye-outline" title={t('profile.privacyTitle')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
            {t(isOwner ? 'profile.privacyIntroOwner' : 'profile.privacyIntro')}
          </Text>

          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('common.phone')}</Text>
          <FilterPills
            compact
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

          <ToggleRow
            label={t('profile.shareEmergency')}
            hint={isOwner ? t('profile.shareEmergencyOwnerHint') : t('profile.shareEmergencyHint')}
            value={shareEmergency}
            onChange={(next) => {
              setShareEmergency(next);
              void persist({ share_emergency: next }, () => setShareEmergency(!next));
            }}
          />
        </View>
      </Card>

      <Card compact>
        <View style={styles.dense}>
          <SectionHead compact icon="notifications-outline" title={t('profile.notifyTitle')} />
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
          {isOwner ? (
            <ToggleRow
              label={t('profile.notifyListing')}
              hint={t('profile.notifyListingHint')}
              value={notifyListing}
              onChange={(next) => {
                setNotifyListing(next);
                void persist({ notify_listing: next }, () => setNotifyListing(!next));
              }}
            />
          ) : null}
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
    </>
  );
}

const styles = StyleSheet.create({
  dense: { gap: spacing.xs, maxWidth: '100%' },
  denseLabel: { fontWeight: '700', fontSize: 12, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
  mini: { fontSize: 11, lineHeight: 15, fontFamily: 'Cairo_400Regular' },
  toggleBlock: { gap: 2, maxWidth: '100%' },
  toggleRow: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleLabel: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_700Bold' },
});
