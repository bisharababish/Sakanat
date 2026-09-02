import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListingEditor } from '@/components/ListingEditor';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Profile } from '@/src/types/database';

export default function AdminNewListing() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [owners, setOwners] = useState<Profile[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [ready, setReady] = useState(false);

  const loadOwners = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, owner_status')
      .eq('role', 'owner')
      .order('full_name');
    setOwners((data as Profile[]) ?? []);
  }, []);

  const { refreshing, refresh } = useLiveReload(loadOwners, ['profiles'], 'admin-new-listing-owners');

  const ownerOptions = useMemo(
    () =>
      owners.map((owner) => ({
        value: owner.id,
        label: `${owner.full_name || owner.email}${owner.owner_status !== 'approved' ? ` (${t('admin.ownerWaiting')})` : ''}`,
      })),
    [owners, t],
  );

  if (!ready) {
    return (
      <Screen back refreshing={refreshing} onRefresh={() => void refresh()}>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('owner.addListing')}</Text>
        <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>{t('admin.pickOwner')}</Text>
        <Card>
          <SearchSelect
            label={t('admin.ownerName')}
            value={ownerId}
            placeholder={t('common.select')}
            options={ownerOptions}
            onChange={setOwnerId}
          />
        </Card>
        <Button
          title={t('common.continue')}
          pill
          disabled={!ownerId}
          onPress={() => {
            if (!ownerId) {
              alert(t('common.error'), t('admin.pickOwner'));
              return;
            }
            setReady(true);
          }}
        />
      </Screen>
    );
  }

  return <ListingEditor asAdmin ownerId={ownerId} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
});
