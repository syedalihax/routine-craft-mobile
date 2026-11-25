import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Updates from 'expo-updates';
import { Colors } from '../constants/colors';
import { appVersionAPI } from '../services/api';

export default function UpdatePrompt({ enabled, themeMode }) {
  const colors = Colors[themeMode === 'LIGHT' ? 'light' : 'dark'];
  const [release, setRelease] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const checkForUpdate = async () => {
      if (!enabled || Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return;

      try {
        const update = await Updates.checkForUpdateAsync();
        if (!active || !update.isAvailable) return;

        let releaseInfo = {
          version: 'New version',
          notes: 'An update is ready to install.',
          required: false,
        };

        try {
          const response = await appVersionAPI.getLatest();
          releaseInfo = response.data.data;
        } catch (requestError) {
          console.warn('Could not load update details', requestError.message);
        }

        if (active) {
          setRelease(releaseInfo);
          setVisible(true);
        }
      } catch (updateError) {
        console.warn('Could not check for app updates', updateError.message);
      }
    };

    checkForUpdate();
    return () => {
      active = false;
    };
  }, [enabled]);

  const installUpdate = async () => {
    setInstalling(true);
    setError('');
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await Updates.reloadAsync();
        return;
      }
      setError('Update could not be installed. Please try again.');
    } catch (installError) {
      setError('Update could not be installed. Please try again.');
      console.warn('Could not install app update', installError.message);
    } finally {
      setInstalling(false);
    }
  };

  if (!release) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!release.required) setVisible(false);
      }}
    >
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>UPDATE AVAILABLE</Text>
          <Text style={[styles.title, { color: colors.text }]}>Version {release.version}</Text>
          <Text style={[styles.notes, { color: colors.textSecondary }]}>{release.notes}</Text>
          {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={installing}
            onPress={installUpdate}
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          >
            {installing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Update now</Text>
            )}
          </Pressable>
          {!release.required && (
            <Pressable
              accessibilityRole="button"
              disabled={installing}
              onPress={() => setVisible(false)}
              style={styles.secondaryButton}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '700',
  },
  notes: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});