import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { apiFetch } from '../../api/http';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    // Always reports success — the API never reveals whether the email exists.
    await apiFetch('/auth/student/forgot-password', {
      method: 'POST',
      body: { email: email.trim() },
    }).catch(() => undefined);
    setLoading(false);
    setSent(true);
  };

  return (
    <Screen>
      <Text style={styles.title}>{t('auth.resetTitle')}</Text>
      <Text style={styles.intro}>{t('auth.resetIntro')}</Text>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {sent ? (
        <Text style={styles.sent}>{t('auth.resetSent')}</Text>
      ) : (
        <Button title={t('common.submit')} onPress={onSubmit} loading={loading} />
      )}
      <Button
        title={t('auth.login')}
        variant="secondary"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: spacing.xl },
  intro: { color: colors.muted, marginVertical: spacing.md },
  sent: { color: colors.success, fontWeight: '600', marginVertical: spacing.md, textAlign: 'center' },
});
