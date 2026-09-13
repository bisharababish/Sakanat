import { useEffect } from 'react';
import { useNavigation } from 'expo-router';

export function useHubTabBack(atHub: boolean, goHub: () => void) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsub = navigation.addListener('tabPress', (event) => {
      if (atHub) return;
      event.preventDefault();
      goHub();
    });
    return unsub;
  }, [atHub, goHub, navigation]);
}
