import * as Location from 'expo-location';
import { Link } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { backendConfigured } from '../lib/listings';
import { getAlertMode, getTestListings, setAlertMode, setTestListings } from '../lib/storage';
import type { AlertMode } from '../lib/types';
import { isDriveModeOn, startDriveMode, stopDriveMode } from '../tasks/driveTask';

const SAFETY_ACK_KEY = 'safetyNoticeAccepted';

function confirmSafetyNotice(): Promise<boolean> {
  if (Storage.getItemSync(SAFETY_ACK_KEY) === 'yes') return Promise.resolve(true);
  return new Promise((resolve) =>
    Alert.alert(
      'Eyes on the road',
      'Alerts are short so you never need to touch your phone while driving. Open listings only when parked, or let a passenger do it. Turn on "Save for later" to get one summary when you park instead.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'I understand',
          onPress: () => {
            Storage.setItemSync(SAFETY_ACK_KEY, 'yes');
            resolve(true);
          },
        },
      ],
    ),
  );
}

export default function Home() {
  const [driving, setDriving] = useState(false);
  const [mode, setMode] = useState<AlertMode>(getAlertMode());
  const [testCount, setTestCount] = useState(getTestListings().length);

  useEffect(() => {
    isDriveModeOn().then(setDriving);
  }, []);

  async function toggleDrive() {
    if (driving) {
      await stopDriveMode();
      setDriving(false);
      return;
    }
    if (!(await confirmSafetyNotice())) return;
    const result = await startDriveMode();
    if (result === 'started') setDriving(true);
    else
      Alert.alert(
        'Location access needed',
        result === 'no-background-permission'
          ? 'Drive mode needs location set to "Allow all the time" (Android) or "Always" (iPhone) so it works with the screen off.'
          : 'Drive mode needs your location to find homes for sale you pass.',
        [{ text: 'Not now' }, { text: 'Open settings', onPress: () => Linking.openSettings() }],
      );
  }

  function toggleMode(saveForLater: boolean) {
    const next: AlertMode = saveForLater ? 'saveForLater' : 'live';
    setAlertMode(next);
    setMode(next);
  }

  async function dropTestListing() {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return;
    const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const tests = getTestListings();
    const n = tests.length + 1;
    setTestListings([
      ...tests,
      {
        id: `test-${Date.now()}`,
        address: `Test home ${n}`,
        price: 450_000,
        lat: here.coords.latitude,
        lng: here.coords.longitude,
        bedrooms: 3,
        bathrooms: 2,
        isTest: true,
      },
    ]);
    setTestCount(n);
    Alert.alert('Test listing added', 'Drive away and come back past this spot with Drive mode on.');
  }

  function clearTestListings() {
    setTestListings([]);
    setTestCount(0);
  }

  return (
    <View style={styles.screen}>
      <Pressable style={[styles.driveButton, driving && styles.driveButtonOn]} onPress={toggleDrive}>
        <Text style={styles.driveButtonText}>{driving ? 'Stop Drive mode' : 'Start Drive mode'}</Text>
      </Pressable>
      <Text style={styles.hint}>
        {driving
          ? 'You will get an alert when you pass a home for sale.'
          : 'Turn on before you drive. Works with the screen off.'}
      </Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Save for later</Text>
          <Text style={styles.hint}>No alerts while moving; one summary when you park.</Text>
        </View>
        <Switch value={mode === 'saveForLater'} onValueChange={toggleMode} />
      </View>

      <Link href="/log" style={styles.link}>
        View drive log
      </Link>

      <View style={styles.devBox}>
        <Text style={styles.label}>Testing</Text>
        {!backendConfigured() && (
          <Text style={styles.hint}>No listings server set up yet, so only test listings will alert.</Text>
        )}
        <Pressable onPress={dropTestListing}>
          <Text style={styles.link}>Drop a test listing where I am</Text>
        </Pressable>
        {testCount > 0 && (
          <Pressable onPress={clearTestListings}>
            <Text style={styles.link}>Remove {testCount} test listing{testCount === 1 ? '' : 's'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  driveButton: { backgroundColor: '#1f6feb', borderRadius: 14, paddingVertical: 22, alignItems: 'center' },
  driveButtonOn: { backgroundColor: '#cf222e' },
  driveButtonText: { color: 'white', fontSize: 20, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14, color: '#57606a' },
  link: { fontSize: 16, color: '#1f6feb', paddingVertical: 6 },
  devBox: { marginTop: 'auto', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#d0d7de', paddingTop: 12 },
});
