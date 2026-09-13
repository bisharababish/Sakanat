import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { contactVisibilityLabel } from '@/src/lib/privacy';
import { getPushEnabled, setPushEnabled } from '@/src/lib/push';
import { loadMyReports, reportStatusLabel, submitAppReport } from '@/src/lib/reports';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type {
  AppReport,
  AppReportKind,
  ContactVisibility,
  GenderPolicy,
  Profile,
} from '@/src/types/database';

type Props = {
  profile: Profile;
  onSaved: () => void | Promise<void>;
  /** Owners skip seeker housing prefs and saved-count privacy. */
  variant?: 'seeker' | 'owner';
  highlightReportId?: string | null;
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
        <Text style={[styles.toggleLabel, rtlText, { color: colors.text }]}>{label}</Text>
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

export function ProfileSettingsFields({
  profile,
  onSaved,
  variant = 'seeker',
  highlightReportId,
}: Props) {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const isOwner = variant === 'owner' || profile.role === 'owner';

  const [phoneVisibility, setPhoneVisibility] = useState<ContactVisibility>(
    profile.phone_visibility ?? 'booking',
  );
  const [whatsappVisibility, setWhatsappVisibility] = useState<ContactVisibility>(
    profile.whatsapp_visibility ?? 'booking',
  );
  const [hideLastSeen, setHideLastSeen] = useState(Boolean(profile.hide_last_seen));
  const [hideSavedCount, setHideSavedCount] = useState(Boolean(profile.hide_saved_count));
  const [shareEmergency, setShareEmergency] = useState(profile.share_emergency !== false);

  const [budget, setBudget] = useState(
    profile.pref_budget_max != null ? String(Math.round(Number(profile.pref_budget_max))) : '',
  );
  const [genderPolicy, setGenderPolicy] = useState<GenderPolicy | ''>(profile.pref_gender_policy ?? '');
  const [moveIn, setMoveIn] = useState(profile.pref_move_in ?? '');
  const [occupants, setOccupants] = useState(String(profile.pref_occupants ?? ''));
  const [leaseMonths, setLeaseMonths] = useState(
    profile.pref_lease_months != null ? String(profile.pref_lease_months) : '',
  );

  const [pushMaster, setPushMaster] = useState(true);
  const [notifyBooking, setNotifyBooking] = useState(profile.notify_booking !== false);
  const [notifyChat, setNotifyChat] = useState(profile.notify_chat !== false);
  const [notifyListing, setNotifyListing] = useState(profile.notify_listing !== false);
  const [notifyReview, setNotifyReview] = useState(profile.notify_review !== false);

  const [reports, setReports] = useState<AppReport[]>([]);
  const [reportKind, setReportKind] = useState<AppReportKind>('safety');
  const [reportBody, setReportBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const visibilityItems: { value: ContactVisibility; label: string }[] = [
    { value: 'booking', label: t('profile.privacyOnBooking') },
    { value: 'confirmed', label: t('profile.privacyWhenConfirmed') },
    { value: 'none', label: t('profile.privacyHidden') },
  ];

  const reloadReports = useCallback(async () => {
    try {
      setReports(await loadMyReports(profile.id));
    } catch {
      setReports([]);
    }
  }, [profile.id]);

  useEffect(() => {
    void getPushEnabled().then(setPushMaster);
    void reloadReports();
  }, [reloadReports]);

  // Privacy can auto-save and refresh `profile` — only sync those fields from the server.
  useEffect(() => {
    setPhoneVisibility(profile.phone_visibility ?? 'booking');
    setWhatsappVisibility(profile.whatsapp_visibility ?? 'booking');
    setHideLastSeen(Boolean(profile.hide_last_seen));
    setHideSavedCount(Boolean(profile.hide_saved_count));
    setShareEmergency(profile.share_emergency !== false);
  }, [
    profile.phone_visibility,
    profile.whatsapp_visibility,
    profile.hide_last_seen,
    profile.hide_saved_count,
    profile.share_emergency,
  ]);

  // Housing + notify prefs: sync when the account changes, not on every privacy refresh
  // (that was snapping pills back to the first / saved option while editing).
  useEffect(() => {
    setBudget(profile.pref_budget_max != null ? String(Math.round(Number(profile.pref_budget_max))) : '');
    setGenderPolicy(profile.pref_gender_policy ?? '');
    setMoveIn(profile.pref_move_in ?? '');
    setOccupants(profile.pref_occupants != null ? String(profile.pref_occupants) : '');
    setLeaseMonths(profile.pref_lease_months != null ? String(profile.pref_lease_months) : '');
    setNotifyBooking(profile.notify_booking !== false);
    setNotifyChat(profile.notify_chat !== false);
    setNotifyListing(profile.notify_listing !== false);
    setNotifyReview(profile.notify_review !== false);
  }, [profile.id]);

  const persistPrivacy = async (
    patch: Partial<{
      phone_visibility: ContactVisibility;
      whatsapp_visibility: ContactVisibility;
      hide_last_seen: boolean;
      hide_saved_count: boolean;
      share_emergency: boolean;
    }>,
    revert: () => void,
  ) => {
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
      if (error) throw error;
      await onSaved();
    } catch (err) {
      revert();
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.settingsSaveFailed'));
    }
  };

  const setPhoneVisibilityLive = (next: ContactVisibility) => {
    const prev = phoneVisibility;
    setPhoneVisibility(next);
    void persistPrivacy({ phone_visibility: next }, () => setPhoneVisibility(prev));
  };

  const setWhatsappVisibilityLive = (next: ContactVisibility) => {
    const prev = whatsappVisibility;
    setWhatsappVisibility(next);
    void persistPrivacy({ whatsapp_visibility: next }, () => setWhatsappVisibility(prev));
  };

  const setShareEmergencyLive = (next: boolean) => {
    setShareEmergency(next);
    void persistPrivacy({ share_emergency: next }, () => setShareEmergency(!next));
  };

  const setHideLastSeenLive = (next: boolean) => {
    setHideLastSeen(next);
    void persistPrivacy({ hide_last_seen: next }, () => setHideLastSeen(!next));
  };

  const setHideSavedCountLive = (next: boolean) => {
    setHideSavedCount(next);
    void persistPrivacy({ hide_saved_count: next }, () => setHideSavedCount(!next));
  };

  const save = async () => {
    if (!isOwner) {
      const budgetNum = budget.trim() ? Number(budget.replace(/[^\d.]/g, '')) : null;
      if (budget.trim() && (!Number.isFinite(budgetNum) || (budgetNum ?? 0) <= 0)) {
        alert(t('common.error'), t('profile.budgetInvalid'));
        return;
      }
      const occ = occupants.trim() ? Number(occupants) : null;
      if (occupants.trim() && (!Number.isInteger(occ) || (occ ?? 0) < 1 || (occ ?? 0) > 4)) {
        alert(t('common.error'), t('profile.occupantsInvalid'));
        return;
      }
    }
    setSaving(true);
    try {
      await setPushEnabled(pushMaster, profile.id);
      const budgetNum = budget.trim() ? Number(budget.replace(/[^\d.]/g, '')) : null;
      const occ = occupants.trim() ? Number(occupants) : null;
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_visibility: phoneVisibility,
          whatsapp_visibility: whatsappVisibility,
          hide_last_seen: hideLastSeen,
          share_emergency: shareEmergency,
          notify_booking: notifyBooking,
          notify_chat: notifyChat,
          notify_review: notifyReview,
          ...(isOwner
            ? { notify_listing: notifyListing }
            : {
                hide_saved_count: hideSavedCount,
                pref_budget_max: budgetNum,
                pref_gender_policy: genderPolicy || null,
                pref_move_in: moveIn || null,
                pref_occupants: occ,
                pref_lease_months: leaseMonths ? Number(leaseMonths) : null,
              }),
        })
        .eq('id', profile.id);
      if (error) throw error;
      onSaved();
      alert(t('common.done'), t('profile.settingsSaved'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendReport = async () => {
    const body = reportBody.trim();
    if (body.length < 12) {
      alert(t('common.error'), t('profile.reportBodyShort'));
      return;
    }
    setSendingReport(true);
    try {
      await submitAppReport(profile.id, {
        kind: reportKind,
        subject:
          reportKind === 'safety' ? t('menu.reportSafetySubject') : t('menu.reportTechSubject'),
        body,
      });
      setReportBody('');
      await reloadReports();
      alert(t('common.done'), t('profile.reportSent'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.reportFailed'));
    } finally {
      setSendingReport(false);
    }
  };

  const privacyLevel =
    phoneVisibility === 'none' && whatsappVisibility === 'none'
      ? t('profile.privacyLevelStrict')
      : phoneVisibility === 'confirmed' || whatsappVisibility === 'confirmed'
        ? t('profile.privacyLevelCareful')
        : t('profile.privacyLevelOpen');

  return (
    <>
      <Card compact>
        <View style={styles.dense}>
          <SectionHead compact icon="eye-outline" title={t('profile.privacyTitle')} />
          <View style={[styles.levelChip, row, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
            <Text style={[styles.levelText, rtlText, { color: colors.text }]}>{privacyLevel}</Text>
          </View>
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.privacyIntro')}</Text>

          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('common.phone')}</Text>
          <FilterPills compact value={phoneVisibility} onChange={setPhoneVisibilityLive} items={visibilityItems} />
          <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>
            {contactVisibilityLabel(phoneVisibility, t)}
          </Text>

          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.whatsapp')}</Text>
          <FilterPills
            compact
            value={whatsappVisibility}
            onChange={setWhatsappVisibilityLive}
            items={visibilityItems}
          />
          <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>
            {contactVisibilityLabel(whatsappVisibility, t)}
          </Text>

          <ToggleRow
            label={t('profile.shareEmergency')}
            hint={isOwner ? t('profile.shareEmergencyOwnerHint') : t('profile.shareEmergencyHint')}
            value={shareEmergency}
            onChange={setShareEmergencyLive}
          />
          <ToggleRow
            label={t('profile.hideLastSeen')}
            hint={t('profile.hideLastSeenHint')}
            value={hideLastSeen}
            onChange={setHideLastSeenLive}
          />
          {!isOwner ? (
            <ToggleRow
              label={t('profile.hideSavedCount')}
              hint={t('profile.hideSavedCountHint')}
              value={hideSavedCount}
              onChange={setHideSavedCountLive}
            />
          ) : null}
        </View>
      </Card>

      {!isOwner ? (
      <Card compact>
        <View style={styles.dense}>
          <SectionHead compact icon="home-outline" title={t('profile.prefsTitle')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.prefsIntro')}</Text>
          <Input
            compact
            label={t('profile.budgetMax')}
            value={budget}
            onChangeText={setBudget}
            keyboardType="number-pad"
            ltr
            placeholder={t('profile.budgetPlaceholder')}
          />
          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.houseGender')}</Text>
          <FilterPills<GenderPolicy | ''>
            compact
            value={genderPolicy}
            onChange={setGenderPolicy}
            allowDeselect
            items={[
              { value: 'any', label: t('gender.any') },
              { value: 'female', label: t('gender.female') },
              { value: 'male', label: t('gender.male') },
            ]}
          />
          <DateField compact kind="booking" label={t('profile.moveInPref')} value={moveIn} onChange={setMoveIn} />
          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.leasePref')}</Text>
          <FilterPills
            compact
            value={leaseMonths}
            onChange={setLeaseMonths}
            allowDeselect
            items={[
              { value: '3', label: t('profile.leaseSemester') },
              { value: '6', label: t('profile.leaseHalf') },
              { value: '12', label: t('profile.leaseYear') },
            ]}
          />
          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.roommateCount')}</Text>
          <FilterPills
            compact
            value={occupants}
            onChange={setOccupants}
            allowDeselect
            items={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
            ]}
          />
        </View>
      </Card>
      ) : null}

      <Card compact>
        <View style={styles.dense}>
          <SectionHead compact icon="notifications-outline" title={t('profile.notifyTitle')} />
          <ToggleRow
            label={t('menu.notifications')}
            hint={t('profile.notifyMasterHint')}
            value={pushMaster}
            onChange={setPushMaster}
          />
          <ToggleRow
            label={t('profile.notifyBooking')}
            hint={t('profile.notifyBookingHint')}
            value={notifyBooking}
            onChange={setNotifyBooking}
          />
          <ToggleRow
            label={t('profile.notifyChat')}
            hint={t('profile.notifyChatHint')}
            value={notifyChat}
            onChange={setNotifyChat}
          />
          {isOwner ? (
            <ToggleRow
              label={t('profile.notifyListing')}
              hint={t('profile.notifyListingHint')}
              value={notifyListing}
              onChange={setNotifyListing}
            />
          ) : null}
          <ToggleRow
            label={t('profile.notifyReview')}
            hint={t('profile.notifyReviewHint')}
            value={notifyReview}
            onChange={setNotifyReview}
          />
        </View>
      </Card>

      <Card compact>
        <View style={styles.dense}>
          <SectionHead compact icon="flag-outline" title={t('profile.reportsTitle')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.reportsIntro')}</Text>
          <FilterPills
            compact
            value={reportKind}
            onChange={setReportKind}
            items={[
              { value: 'safety', label: t('menu.reportSafety') },
              { value: 'tech', label: t('menu.reportTech') },
            ]}
          />
          <Input
            compact
            label={t('profile.reportDetails')}
            value={reportBody}
            onChangeText={setReportBody}
            multiline
          />
          <Button title={t('profile.sendReport')} onPress={() => void sendReport()} loading={sendingReport} pill />
          {reports.length === 0 ? (
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.reportsEmpty')}</Text>
          ) : (
            reports.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.reportRow,
                  {
                    backgroundColor:
                      highlightReportId === item.id ? colors.accentSoft : colors.surfaceMuted,
                    borderColor: highlightReportId === item.id ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={[styles.reportHead, row]}>
                  <Text style={[styles.reportKind, rtlText, { color: colors.primary }]}>
                    {item.kind === 'safety' ? t('menu.reportSafety') : t('menu.reportTech')}
                  </Text>
                  <Text style={[styles.reportStatus, { color: colors.textMuted }]}>
                    {reportStatusLabel(item.status, t)}
                  </Text>
                </View>
                <Text style={[styles.reportBody, rtlText, { color: colors.text }]} numberOfLines={3}>
                  {item.body}
                </Text>
                <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>
                  {new Date(item.created_at).toLocaleDateString(i18n.language.startsWith('ar') ? 'ar' : 'en')}
                </Text>
                {item.admin_note ? (
                  <Text style={[styles.mini, rtlText, { color: colors.text }]}>
                    {t('profile.reportAdminNote')}: {item.admin_note}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </Card>

      <Button title={t('profile.saveSettings')} onPress={() => void save()} loading={saving} pill />
    </>
  );
}

const styles = StyleSheet.create({
  dense: { gap: spacing.xs },
  denseLabel: { fontWeight: '700', fontSize: 12, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
  mini: { fontSize: 11, lineHeight: 15, fontFamily: 'Cairo_400Regular' },
  levelChip: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  levelText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  toggleBlock: { gap: 2 },
  toggleRow: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleLabel: { flex: 1, fontSize: 13, fontFamily: 'Cairo_700Bold' },
  reportRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  reportHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reportKind: { fontSize: 12, fontFamily: 'Cairo_800ExtraBold' },
  reportStatus: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  reportBody: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
});
