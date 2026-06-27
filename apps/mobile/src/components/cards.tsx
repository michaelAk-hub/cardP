import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../config';
import { colors, radius, spacing } from '../theme';
import { Offer, Store } from '../api/types';

function localized<T extends Record<string, any>>(obj: T, base: string, lang: string): string {
  return lang === 'el' ? obj[`${base}El`] : obj[`${base}En`];
}

export function discountLabel(offer: Offer, lang: string): string {
  const value = Number(offer.discountValue);
  return offer.discountType === 'percent'
    ? lang === 'el' ? `${value}% έκπτωση` : `${value}% off`
    : lang === 'el' ? `€${value} έκπτωση` : `€${value} off`;
}

export function StoreCard({ store, onPress }: { store: Store; onPress: () => void }) {
  const { i18n } = useTranslation();
  return (
    <Pressable style={styles.storeCard} onPress={onPress}>
      <Image
        source={{ uri: `${API_URL}/stores/${store.id}/logo` }}
        style={styles.logo}
        resizeMode="cover"
      />
      <View style={styles.storeBody}>
        <Text style={styles.storeName} numberOfLines={1}>
          {localized(store, 'name', i18n.language)}
        </Text>
        <Text style={styles.storeDesc} numberOfLines={2}>
          {localized(store, 'description', i18n.language)}
        </Text>
      </View>
    </Pressable>
  );
}

export function OfferCard({ offer }: { offer: Offer }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.offerCard}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{discountLabel(offer, i18n.language)}</Text>
      </View>
      <Text style={styles.offerTitle}>{localized(offer, 'title', i18n.language)}</Text>
      <Text style={styles.offerDesc}>{localized(offer, 'description', i18n.language)}</Text>
      {!!offer.terms && <Text style={styles.terms}>{t('stores.terms')}: {offer.terms}</Text>}
      <Text style={styles.expiry}>
        {t('stores.expires', { date: offer.expiryDate.slice(0, 10) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  storeCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    marginRight: spacing.md,
  },
  storeBody: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: '700', color: colors.text },
  storeDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  offerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  badgeText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  offerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  offerDesc: { fontSize: 14, color: colors.muted, marginTop: 2 },
  terms: { fontSize: 12, color: colors.muted, marginTop: spacing.sm, fontStyle: 'italic' },
  expiry: { fontSize: 12, color: colors.warning, marginTop: spacing.xs },
});
