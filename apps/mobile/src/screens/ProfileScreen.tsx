import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { openGoogleWallet, addAppleWallet } from '../wallet/walletActions';
import { AppStackParamList } from '../navigation/types';
import { AccountStatus } from '../api/types';
import { colors, radius, spacing } from '../theme';

const statusColor: Record<AccountStatus, string> = {
  active: colors.success,
  pending: colors.warning,
  deactive: colors.danger,
};

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { student, request, refreshProfile, logout, accessToken } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [busy, setBusy] = useState<string | null>(null);

  if (!student) return null;
  const isActive = student.accountStatus === 'active';

  const pick = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    return res.canceled ? null : res.assets[0];
  };

  const uploadId = async () => {
    const front = await pick();
    if (!front) return;
    const back = await pick();
    if (!back) return;

    setBusy('id');
    try {
      const form = new FormData();
      const part = (a: ImagePicker.ImagePickerAsset, name: string) =>
        ({ uri: a.uri, name: `${name}.jpg`, type: a.mimeType ?? 'image/jpeg' } as any);
      form.append('front', part(front, 'front'));
      form.append('back', part(back, 'back'));

      const res = await fetch(`${API_URL}/student/id-document`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      Alert.alert(t('verify.uploadDone'));
      await refreshProfile();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendEmail = async () => {
    setBusy('email');
    try {
      await request('/student/email/send-verification', { method: 'POST' });
      Alert.alert(t('verify.emailSent'));
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runWallet = async (platform: 'apple' | 'google') => {
    setBusy(platform);
    try {
      if (platform === 'google') await openGoogleWallet(request);
      else await addAppleWallet(accessToken() ?? '');
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Text style={styles.name}>
        {student.name} {student.surname}
      </Text>
      <Text style={styles.email}>{student.email}</Text>

      <View style={[styles.pill, { backgroundColor: statusColor[student.accountStatus] }]}>
        <Text style={styles.pillText}>{t(`profile.${student.accountStatus}`)}</Text>
      </View>
      {!!student.cardSerial && (
        <Text style={styles.serial}>
          {t('profile.cardSerial')}: {student.cardSerial}
        </Text>
      )}

      {/* Verification */}
      <Text style={styles.section}>{t('profile.verification')}</Text>
      <StatusRow
        label={t('verify.phone')}
        done={student.phoneVerified}
        doneLabel={t('verify.phoneVerified')}
        actionLabel={t('verify.sendCode')}
        onAction={() => navigation.navigate('VerifyPhone')}
      />
      <StatusRow
        label={t('verify.id')}
        done={student.idVerified}
        doneLabel={t('verify.idVerified')}
        actionLabel={t('verify.uploadId')}
        loading={busy === 'id'}
        onAction={uploadId}
      />
      <StatusRow
        label={t('verify.email')}
        done={student.emailVerified}
        doneLabel={t('verify.emailVerified')}
        actionLabel={t('verify.sendEmail')}
        loading={busy === 'email'}
        onAction={sendEmail}
      />

      {/* Wallet */}
      <Text style={styles.section}>{t('profile.wallet')}</Text>
      {isActive ? (
        <>
          <Button
            title={t('profile.addApple')}
            onPress={() => runWallet('apple')}
            loading={busy === 'apple'}
          />
          <View style={{ height: spacing.md }} />
          <Button
            title={t('profile.addGoogle')}
            variant="secondary"
            onPress={() => runWallet('google')}
            loading={busy === 'google'}
          />
        </>
      ) : (
        <Text style={styles.locked}>{t('profile.walletLocked')}</Text>
      )}

      {/* Settings */}
      <Text style={styles.section}>{t('profile.language')}</Text>
      <Pressable
        style={styles.langRow}
        onPress={() => i18n.changeLanguage(i18n.language === 'el' ? 'en' : 'el')}
      >
        <Ionicons name="language" size={20} color={colors.primary} />
        <Text style={styles.langText}>{i18n.language === 'el' ? 'Ελληνικά' : 'English'}</Text>
      </Pressable>

      <Button
        title={t('profile.logout')}
        variant="danger"
        onPress={logout}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

function StatusRow({
  label,
  done,
  doneLabel,
  actionLabel,
  onAction,
  loading,
}: {
  label: string;
  done: boolean;
  doneLabel: string;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {done && (
          <View style={styles.doneWrap}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.doneText}>{doneLabel}</Text>
          </View>
        )}
      </View>
      {!done && (
        <Button title={actionLabel} variant="secondary" onPress={onAction} loading={loading} style={styles.rowBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  email: { color: colors.muted, marginTop: 2 },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  pillText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  serial: { color: colors.muted, marginTop: spacing.sm, fontVariant: ['tabular-nums'] },
  section: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowBtn: { height: 40, paddingHorizontal: spacing.md },
  doneWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  doneText: { color: colors.success, fontSize: 13 },
  locked: { color: colors.muted, fontStyle: 'italic' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
});
