import { useEffect } from 'react';
import { useNavigation } from 'expo-router';

// expo-router's useNavigation is typed for the generic navigator, which has no tabPress.
type TabPressNavigation = {
  addListener: (
    type: 'tabPress',
    listener: (event: { preventDefault: () => void }) => void,
  ) => () => void;
};

export function useHubTabBack(atHub: boolean, goHub: () => void) {
  const navigation = useNavigation() as unknown as TabPressNavigation;

  useEffect(() => {
    const unsub = navigation.addListener('tabPress', (event) => {
      if (atHub) return;
      event.preventDefault();
      goHub();
    });
    return unsub;
  }, [atHub, goHub, navigation]);
}
