import * as Notifications from 'expo-notifications';

import { formatFacts, formatPrice, listingUrl } from './format';
import type { Listing } from './types';

export const CHANNEL_ID = 'homes-for-sale';

export async function setUpNotifications(): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  // Android 13+ only shows the permission prompt once a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Homes for sale you pass',
    importance: Notifications.AndroidImportance.HIGH,
  });
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

// Kept short so it can be read at a glance; nothing in it needs a tap while driving.
export function notifyListing(l: Listing) {
  const facts = formatFacts(l);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${l.isTest ? '[TEST] ' : ''}For sale: ${formatPrice(l.price)}`,
      body: facts ? `${l.address} · ${facts}` : l.address,
      data: { url: listingUrl(l) },
    },
    trigger: { channelId: CHANNEL_ID },
  });
}

export function notifyParkedSummary(listings: Listing[]) {
  const n = listings.length;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `You passed ${n} home${n === 1 ? '' : 's'} for sale`,
      body: listings
        .slice(0, 3)
        .map((l) => `${formatPrice(l.price)} · ${l.address}`)
        .join('\n'),
      data: { route: '/log' },
    },
    trigger: { channelId: CHANNEL_ID },
  });
}
