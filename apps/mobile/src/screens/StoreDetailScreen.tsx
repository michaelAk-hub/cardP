import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Screen, Loading, ErrorState } from '../components/Screen';
import { OfferCard } from '../components/cards';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { Store } from '../api/types';
import { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'StoreDetail'>;

export function StoreDetailScreen({ route }: Props) {
  const { storeId } = route.params;
  const { t, i18n } = useTranslation();
  const { request } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<Store>(`/stores/${storeId}`)
      .then(setStore)
      .catch((e) => setError((e as Error).message));
  }, [request, storeId]);

  if (error) return <ErrorState message={error} />;
  if (!store) return <Loading />;

  const name = i18n.language === 'el' ? store.nameEl : store.nameEn;
  const desc = i18n.language === 'el' ? store.descriptionEl : store.descriptionEn;
  const offers = store.offers ?? [];

  return (
    <Screen>
      <View style={styles.header}>
        <Image
          source={{ uri: `${API_URL}/stores/${store.id}/logo` }}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.name}>{name}</Text>
      </View>
      <Text style={styles.desc}>{desc}</Text>

      <Text style={styles.section}>{t('stores.offers')}</Text>
      {offers.length === 0 ? (
        <Text style={styles.empty}>{t('stores.noOffers')}</Text>
      ) : (
        offers.map((o) => <OfferCard key={o.id} offer={o} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.lg },
  logo: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  desc: { fontSize: 15, color: colors.muted, marginBottom: spacing.xl, textAlign: 'center' },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  empty: { color: colors.muted },
});
