import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Screen, Loading } from '../components/Screen';
import { OfferCard } from '../components/cards';
import { Button } from '../components/Button';
import { useAuth } from '../auth/AuthContext';
import { Store, Offer } from '../api/types';
import { TabsParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

export function HomeScreen() {
  const { t } = useTranslation();
  const { request, student } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const [offers, setOffers] = useState<Offer[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      request<Store[]>('/stores')
        .then((stores) => {
          if (!active) return;
          const featured = stores.flatMap((s) => s.offers ?? []).slice(0, 5);
          setOffers(featured);
        })
        .catch(() => active && setOffers([]));
      return () => {
        active = false;
      };
    }, [request]),
  );

  return (
    <Screen>
      <Text style={styles.welcome}>
        {t('home.welcome', { name: student?.name ?? '' })}
      </Text>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>{t('home.banner')}</Text>
      </View>

      <Text style={styles.section}>{t('home.featured')}</Text>
      {offers === null ? (
        <Loading />
      ) : offers.length === 0 ? (
        <Text style={styles.empty}>{t('common.empty')}</Text>
      ) : (
        offers.map((o) => <OfferCard key={o.id} offer={o} />)
      )}

      <Button title={t('home.browse')} onPress={() => navigation.navigate('Stores')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  banner: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  bannerText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  empty: { color: colors.muted, marginBottom: spacing.lg },
});
