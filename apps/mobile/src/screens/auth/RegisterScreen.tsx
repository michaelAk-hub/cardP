import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../api/http';
import { University } from '../../api/types';
import { AuthStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    password: '',
  });
  const [consent, setConsent] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]);
  const [university, setUniversity] = useState<University | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<University[]>('/universities').then((r) => {
      if (r.status < 400 && Array.isArray(r.data)) setUniversities(r.data);
    });
  }, []);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async () => {
    if (!university) {
      Alert.alert(t('common.error'), t('auth.selectUniversity'));
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        universityId: university.id,
        password: form.password,
        marketingConsent: consent,
      });
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const uniName = (u: University) => (i18n.language === 'el' ? u.nameEl : u.nameEn);

  return (
    <Screen>
      <Text style={styles.title}>{t('auth.register')}</Text>

      <TextField label={t('auth.name')} value={form.name} onChangeText={set('name')} />
      <TextField label={t('auth.surname')} value={form.surname} onChangeText={set('surname')} />
      <TextField
        label={t('auth.email')}
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextField
        label={t('auth.phone')}
        value={form.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>{t('auth.university')}</Text>
      <Pressable style={styles.select} onPress={() => setPickerOpen(true)}>
        <Text style={university ? styles.selectValue : styles.selectPlaceholder}>
          {university ? uniName(university) : t('auth.selectUniversity')}
        </Text>
      </Pressable>

      <TextField
        label={t('auth.password')}
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
      />

      <View style={styles.consent}>
        <Switch value={consent} onValueChange={setConsent} />
        <Text style={styles.consentText}>{t('auth.marketingConsent')}</Text>
      </View>

      <Button title={t('auth.register')} onPress={onSubmit} loading={loading} />

      <Pressable style={styles.link} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>{t('auth.haveAccount')}</Text>
      </Pressable>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Screen scroll={false}>
          <Text style={styles.title}>{t('auth.selectUniversity')}</Text>
          <FlatList
            data={universities}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.uniRow}
                onPress={() => {
                  setUniversity(item);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.uniName}>{uniName(item)}</Text>
              </Pressable>
            )}
          />
          <Button title={t('common.cancel')} variant="secondary" onPress={() => setPickerOpen(false)} />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  label: { color: colors.muted, fontSize: 13, marginBottom: spacing.xs, fontWeight: '600' },
  select: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  selectValue: { color: colors.text, fontSize: 16 },
  selectPlaceholder: { color: colors.muted, fontSize: 16 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  consentText: { flex: 1, color: colors.muted },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.primary, fontWeight: '600' },
  uniRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  uniName: { fontSize: 16, color: colors.text },
});
