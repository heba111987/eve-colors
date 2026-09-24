import { useFonts, Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { queryClient } from '../lib/queryClient';
import { useMe } from '../lib/hooks/useMe';
import { theme } from '../lib/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError } = useMe();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent500} />
      </View>
    );
  }

  const signedIn = !isError && !!me;
  const consented = signedIn && !!me.consentAcceptedAt;

  const preAuthRoutes = ['/intro', '/intro2', '/sign-in'];
  if (!signedIn && !preAuthRoutes.includes(pathname)) {
    return <Redirect href="/intro" />;
  }
  if (signedIn && !consented && pathname !== '/consent') {
    return <Redirect href="/consent" />;
  }
  if (signedIn && consented && [...preAuthRoutes, '/consent', '/'].includes(pathname)) {
    return <Redirect href="/today" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent500} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
