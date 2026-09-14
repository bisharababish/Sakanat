import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { alert } from '@/src/lib/notice';
import { isValidHomeAddress } from '@/src/lib/trust';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

const FALLBACK_REGION: Region = {
  latitude: 31.9038,
  longitude: 35.2034,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type Coords = { latitude: number; longitude: number };

function formatAddress(parts: Location.LocationGeocodedAddress) {
  const line = [
    parts.name && parts.name !== parts.street ? parts.name : '',
    [parts.streetNumber, parts.street].filter(Boolean).join(' ').trim(),
    parts.district,
    parts.city || parts.subregion,
    parts.region,
    parts.postalCode,
    parts.country,
  ]
    .map((item) => (item ?? '').trim())
    .filter(Boolean);
  return Array.from(new Set(line)).join(', ');
}

function toHomeAddress(raw: string, latitude: number, longitude: number) {
  const v = raw.trim();
  if (isValidHomeAddress(v)) return v;
  if (v.length >= 5 && /[A-Za-z\u0600-\u06FF]/.test(v)) {
    const padded = `${v} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    if (isValidHomeAddress(padded)) return padded;
  }
  return `Home near ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const results = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<Location.LocationGeocodedAddress[]>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      ),
    ]);
    return results[0] ? formatAddress(results[0]) : '';
  } catch {
    return '';
  }
}

async function readGps(): Promise<Coords | null> {
  try {
    const last = await Promise.race([
      Location.getLastKnownPositionAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ]);
    if (last?.coords) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!current?.coords) return null;
    return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  } catch {
    return null;
  }
}

export function AddressMapPicker({
  visible,
  onClose,
  onPick,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (address: string) => void;
  initial?: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const safe = useModalSafeArea();
  const mapRef = useRef<MapView>(null);
  const pinRef = useRef<Coords>({
    latitude: initial?.lat ?? FALLBACK_REGION.latitude,
    longitude: initial?.lng ?? FALLBACK_REGION.longitude,
  });
  const previewRef = useRef('');

  const seed: Coords = {
    latitude: initial?.lat ?? FALLBACK_REGION.latitude,
    longitude: initial?.lng ?? FALLBACK_REGION.longitude,
  };

  const [pin, setPin] = useState<Coords>(seed);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [centering, setCentering] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const updatePin = (next: Coords) => {
    pinRef.current = next;
    setPin(next);
  };

  const updatePreview = (next: string) => {
    previewRef.current = next;
    setPreview(next);
  };

  const lookupPin = async (latitude: number, longitude: number) => {
    setBusy(true);
    const formatted = await reverseGeocode(latitude, longitude);
    updatePreview(formatted);
    setBusy(false);
    return formatted;
  };

  const goTo = useCallback((coords: Coords, delta = 0.012) => {
    updatePin(coords);
    mapRef.current?.animateToRegion(
      {
        ...coords,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      350,
    );
  }, []);

  const confirmAddress = () => {
    const { latitude, longitude } = pinRef.current;
    const address = toHomeAddress(previewRef.current, latitude, longitude);
    if (!isValidHomeAddress(address)) {
      alert(t('common.error'), t('profile.homeAddressMapInvalid'));
      return;
    }
    onPick(address);
  };

  useEffect(() => {
    if (!visible) {
      updatePreview('');
      setBusy(false);
      setCentering(false);
      return;
    }

    const fallback = {
      latitude: initial?.lat ?? FALLBACK_REGION.latitude,
      longitude: initial?.lng ?? FALLBACK_REGION.longitude,
    };
    updatePin(fallback);
    updatePreview('');

    let cancelled = false;
    void (async () => {
      setCentering(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        setHasPermission(status === 'granted');

        let target = fallback;
        if (status === 'granted') {
          const gps = await readGps();
          if (cancelled) return;
          if (gps) target = gps;
        }

        goTo(target, gpsDelta(target, fallback));
        await lookupPin(target.latitude, target.longitude);
      } finally {
        if (!cancelled) setCentering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, initial?.lat, initial?.lng, goTo]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.frame, { backgroundColor: colors.background, paddingTop: safe.top }]}>
        <View style={[styles.head, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('profile.pickAddressMap')}</Text>
          <View style={styles.headSpacer} />
        </View>

        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: seed.latitude,
              longitude: seed.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            showsUserLocation={hasPermission}
            showsMyLocationButton={false}
            onPress={(event) => {
              if (centering) return;
              const { latitude, longitude } = event.nativeEvent.coordinate;
              updatePin({ latitude, longitude });
              void lookupPin(latitude, longitude);
            }}
          >
            <Marker
              coordinate={pin}
              draggable={!centering}
              onDragEnd={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                updatePin({ latitude, longitude });
                void lookupPin(latitude, longitude);
              }}
            />
          </MapView>
          {centering ? (
            <View style={[styles.mapOverlay, { backgroundColor: colors.overlay }]} pointerEvents="auto">
              <ActivityIndicator color={colors.white} />
              <Text style={[styles.overlayText, { color: colors.white }]}>{t('profile.findingLocation')}</Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(safe.bottom, spacing.md),
            },
          ]}
        >
          <Text style={[styles.help, rtlText, { color: colors.textMuted }]}>{t('profile.pickAddressHelp')}</Text>
          {busy && !centering ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text
              style={[styles.preview, rtlText, { color: preview ? colors.text : colors.textMuted }]}
              numberOfLines={3}
            >
              {preview || t('profile.pickAddressEmpty')}
            </Text>
          )}
          <Button
            title={t('profile.confirmAddress')}
            pill
            disabled={busy || centering || !preview.trim()}
            onPress={confirmAddress}
          />
        </View>
      </View>
    </Modal>
  );
}

function gpsDelta(target: Coords, fallback: Coords) {
  const moved =
    Math.abs(target.latitude - fallback.latitude) > 0.0001 ||
    Math.abs(target.longitude - fallback.longitude) > 0.0001;
  return moved ? 0.01 : 0.04;
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 16, fontFamily: 'Cairo_800ExtraBold' },
  headSpacer: { width: 22 },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  overlayText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  help: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
  preview: { fontSize: 14, lineHeight: 20, fontFamily: 'Cairo_600SemiBold', minHeight: 40 },
});
