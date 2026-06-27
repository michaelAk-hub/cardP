import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { useAuth } from '../auth/AuthContext';
import { AppStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'VerifyPhone'>;

export function VerifyPhoneScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { request, refreshProfile, student } = useAuth();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    try {
      await request('/student/phone/send-otp', { method: 'POST' });
      setSent(true);
      Alert.alert(t('verify.codeSent'));
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await request('/student/phone/verify-otp', { method: 'POST', body: { code: code.trim() } });
      await refreshProfile();
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>{t('verify.phone')}</Text>
      <Text style={styles.phone}>{student?.phone}</Text>

      <Button
        title={t('verify.sendCode')}
        variant="secondary"
        onPress={sendCode}
        loading={busy && !sent}
      />

      {sent && (
        <>
          <TextField
            label={t('verify.enterCode')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={{ marginTop: spacing.lg }}
          />
          <Button title={t('verify.verifyCode')} onPress={verify} loading={busy} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: spacing.lg },
  phone: { color: colors.muted, fontSize: 16, marginVertical: spacing.md },
});
