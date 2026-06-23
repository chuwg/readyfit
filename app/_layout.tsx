import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadUserProfile } from '../src/services/db';
import { registerMorningRefresh } from '../src/services/background';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await loadUserProfile();
        const inOnboarding = segments[0] === 'onboarding';
        if (!profile.onboarded && !inOnboarding) {
          router.replace('/onboarding');
        }
      } catch {}
      setChecked(true);
    })();
  }, [router, segments]);

  useEffect(() => {
    registerMorningRefresh();
  }, []);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | { kind?: string }
        | undefined;
      if (data?.kind === 'morning') {
        router.push('/morning-report');
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(
      handleResponse,
    );
    return () => sub.remove();
  }, [router]);

  if (!checked) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.mint} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerShown: false,
        }}
      />
    </SafeAreaProvider>
  );
}
