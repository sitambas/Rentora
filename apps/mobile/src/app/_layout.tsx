import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { useColors } from '@/components/ui';

export default function RootLayout() {
  const c = useColors();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{
          headerStyle: { backgroundColor: c.surface }, headerTintColor: c.ink, headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: c.bg }, headerBackButtonDisplayMode: 'minimal'
        }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(owner)" options={{ headerShown: false }} />
          <Stack.Screen name="(tenant)" options={{ headerShown: false }} />
          <Stack.Screen name="unit/[id]" options={{ title: 'Unit' }} />
          <Stack.Screen name="chat/[userId]" options={{ title: 'Messages' }} />
          <Stack.Screen name="messages" options={{ title: 'Messages' }} />
          <Stack.Screen name="maintenance" options={{ title: 'Maintenance' }} />
          <Stack.Screen name="applications" options={{ title: 'Applications' }} />
          <Stack.Screen name="community" options={{ title: 'Notices & parcels' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
          <Stack.Screen name="add-unit" options={{ title: 'Add a unit', presentation: 'modal' }} />
          <Stack.Screen name="new-request" options={{ title: 'New request', presentation: 'modal' }} />
          <Stack.Screen name="post-notice" options={{ title: 'Post a notice', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
