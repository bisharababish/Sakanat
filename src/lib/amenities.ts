import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { Amenity } from '@/src/types/database';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const AMENITY_ICONS: Record<Amenity, IconName> = {
  wifi: 'wifi-outline',
  furnished: 'bed-outline',
  private_bathroom: 'water-outline',
  kitchen: 'restaurant-outline',
  heating: 'thermometer-outline',
  ac: 'snow-outline',
  washing_machine: 'sync-outline',
  solar_heater: 'sunny-outline',
  elevator: 'swap-vertical-outline',
  study_desk: 'desktop-outline',
  balcony: 'images-outline',
  parking: 'car-outline',
};

export const SEARCH_AMENITY_PRIMARY: Amenity[] = [
  'wifi',
  'furnished',
  'ac',
  'private_bathroom',
  'kitchen',
  'washing_machine',
];
