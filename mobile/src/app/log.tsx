import { Stack, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatFacts, formatPrice, listingUrl } from '../lib/format';
import { clearDriveLog, getDriveLog } from '../lib/storage';
import type { DriveLogEntry } from '../lib/types';

const when = (ts: number) =>
  new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function DriveLog() {
  const [entries, setEntries] = useState<DriveLogEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      setEntries(getDriveLog());
    }, []),
  );

  function clear() {
    clearDriveLog();
    setEntries([]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            entries.length > 0 ? (
              <Pressable onPress={clear}>
                <Text style={styles.headerAction}>Clear</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={entries}
        keyExtractor={(e) => `${e.listing.id}-${e.passedAt}`}
        contentContainerStyle={entries.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.empty}>Homes for sale you pass will show up here.</Text>}
        renderItem={({ item: { listing, passedAt } }) => (
          <Pressable style={styles.item} onPress={() => WebBrowser.openBrowserAsync(listingUrl(listing))}>
            <View style={styles.itemTop}>
              <Text style={styles.price}>{formatPrice(listing.price)}</Text>
              <Text style={styles.when}>{when(passedAt)}</Text>
            </View>
            <Text style={styles.address}>
              {listing.isTest ? '[TEST] ' : ''}
              {listing.address}
            </Text>
            {formatFacts(listing) !== '' && <Text style={styles.facts}>{formatFacts(listing)}</Text>}
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerAction: { color: '#1f6feb', fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#57606a', fontSize: 16, padding: 24 },
  item: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#d0d7de', gap: 2 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between' },
  price: { fontSize: 18, fontWeight: '600' },
  when: { color: '#57606a' },
  address: { fontSize: 15 },
  facts: { color: '#57606a' },
});
