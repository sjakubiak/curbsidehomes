import '../tasks/driveTask';

import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { setUpNotifications } from '../lib/notify';

function openFromNotification(data: Record<string, unknown> | undefined) {
  if (typeof data?.url === 'string') WebBrowser.openBrowserAsync(data.url);
  else if (data?.route === '/log') router.push('/log');
}

export default function RootLayout() {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    setUpNotifications();
  }, []);

  // Covers both a tap while the app is running and a tap that launched it.
  useEffect(() => {
    if (lastResponse?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    openFromNotification(lastResponse.notification.request.content.data);
    Notifications.clearLastNotificationResponseAsync();
  }, [lastResponse]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Curbside Homes' }} />
      <Stack.Screen name="log" options={{ title: 'Drive log' }} />
    </Stack>
  );
}
