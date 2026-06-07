import { trpc } from '@gloe/api-client';
import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { formatPrice } from '../../../features/discover/format';
import { Icon, type IconName } from '../../../features/icon/Icon';
import { CachedImage } from '../../../features/image/CachedImage';
import { useSavedVendors } from '../../../features/saved/SavedVendorsProvider';

/**
 * Public-facing vendor storefront. Reached from:
 *   - tapping a deal card → "see more from this vendor"
 *   - tapping a voucher → "visit [vendor]" after redemption
 *   - search results / favorites list
 *
 * Layout (top to bottom):
 *   1. Hero image with back button overlay
 *   2. Name + ratings (Gloe + Google side-by-side)
 *   3. Quick actions: directions / call / website
 *   4. Contact info: address, phone, hours, Instagram
 *   5. About (vendor description)
 *   6. Amenities (what to expect)
 *   7. Providers (med spas: MDs, NPs, PAs)
 *   8. Active deals (cross-sell)
 *   9. Inside the spa (video reel)
 *  10. Gloe reviews + Google reviews as separate sections
 */
export default function VendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();

  const q = trpc.vendors.storefront.useQuery({ id: id! }, { enabled: !!id });
  const d = q.data;

  const savedVendors = useSavedVendors();
  const requireAuth = useRequireAuth();
  const isSaved = id ? savedVendors.isSaved(id) : false;
  const onToggleSave = requireAuth('save', () => {
    if (id) savedVendors.toggle(id);
  });

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.surface.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.brand[500]} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.surface.primary, alignItems: 'center', justifyContent: 'center', padding: space[6] }}>
        <Stack gap={3} align="center">
          <Text variant="display-sm" tone="primary">Vendor not found</Text>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ paddingVertical: space[3] }}>
            <Text variant="body-md" tone="link" weight="semibold">Go back</Text>
          </Pressable>
        </Stack>
      </View>
    );
  }

  const v = d.vendor;
  const fullAddress = [v.addressLine1, v.addressLine2, `${v.city}, ${v.region}`].filter(Boolean).join(', ');

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ───── Hero ───── */}
        <View style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: palette.neutral[200], position: 'relative' }}>
          {v.heroImageUrl ? (
            <CachedImage uri={v.heroImageUrl} style={{ width: '100%', height: '100%' }} />
          ) : null}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: insets.top + space[2],
              left: space[3],
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="body-md" weight="semibold" style={{ color: '#FFFFFF' }}>←</Text>
          </Pressable>
          {/* Save vendor — top-right floating heart. Mirrors deal card heart styling. */}
          <Pressable
            onPress={onToggleSave}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: insets.top + space[2],
              right: space[3],
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="heart"
              size={18}
              color={isSaved ? palette.accent[500] : '#FFFFFF'}
              fill={isSaved ? palette.accent[500] : 'none'}
              strokeWidth={2.25}
            />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space[5], paddingTop: space[5] }}>
          <Stack gap={6}>
            {/* ───── Title + ratings ───── */}
            <Stack gap={2}>
              <Text variant="display-md" tone="primary" weight="medium">
                {v.businessName}
              </Text>
              <Stack direction="row" gap={3} align="center" style={{ flexWrap: 'wrap' }}>
                {v.ratingAvg !== null ? (
                  <Stack direction="row" gap={1} align="center">
                    <Text variant="body-md" tone="primary" weight="semibold">★ {Number(v.ratingAvg).toFixed(1)}</Text>
                    <Text variant="body-sm" tone="tertiary">({v.reviewCount} on Gloē)</Text>
                  </Stack>
                ) : null}
                {v.googleRating !== null ? (
                  <Stack direction="row" gap={1} align="center">
                    <Text variant="body-md" tone="primary" weight="semibold">★ {Number(v.googleRating).toFixed(1)}</Text>
                    <Text variant="body-sm" tone="tertiary">({v.googleReviewCount ?? 0} on Google)</Text>
                  </Stack>
                ) : null}
              </Stack>
              <Text variant="body-sm" tone="tertiary">{v.city}, {v.region}</Text>
            </Stack>

            {/* ───── Quick actions ───── */}
            <Stack direction="row" gap={3}>
              {v.lat != null && v.lng != null ? (
                <ActionButton
                  icon="map-pin"
                  label="Directions"
                  onPress={() => Linking.openURL(`https://maps.apple.com/?daddr=${v.lat},${v.lng}`)}
                />
              ) : null}
              {v.phone ? (
                <ActionButton
                  icon="phone"
                  label="Call"
                  onPress={() => Linking.openURL(`tel:${v.phone!.replace(/\D/g, '')}`)}
                />
              ) : null}
              {v.website ? (
                <ActionButton
                  icon="globe"
                  label="Website"
                  onPress={() => Linking.openURL(v.website!)}
                />
              ) : null}
            </Stack>

            {/* ───── Contact ───── */}
            <Stack gap={2}>
              <Row icon="map-pin" text={fullAddress} />
              {v.phone ? <Row icon="phone" text={v.phone} /> : null}
              {v.hoursSummary ? <Row icon="clock" text={v.hoursSummary} /> : null}
              {v.instagramHandle ? (
                <Pressable onPress={() => Linking.openURL(`https://instagram.com/${v.instagramHandle!.replace(/^@/, '')}`)}>
                  <Row icon="instagram" text={`@${v.instagramHandle.replace(/^@/, '')}`} link />
                </Pressable>
              ) : null}
            </Stack>

            {/* ───── About ───── */}
            {v.description ? (
              <Section title="About">
                <Text variant="body-md" tone="secondary" style={{ lineHeight: 22 }}>
                  {v.description}
                </Text>
              </Section>
            ) : null}

            {/* ───── Amenities ───── */}
            {v.amenities.length > 0 ? (
              <Section title="What to expect">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                  {v.amenities.map((a) => (
                    <View
                      key={a}
                      style={{
                        paddingHorizontal: space[3],
                        paddingVertical: space[2],
                        borderRadius: radius.pill,
                        backgroundColor: palette.surface.elevated,
                      }}
                    >
                      <Text variant="body-sm" tone="secondary">{humanizeAmenity(a)}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            {/* ───── Providers ───── */}
            {d.providers.length > 0 ? (
              <Section title="Your providers">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
                  {d.providers.map((p) => (
                    <View key={p.id} style={{ width: 140 }}>
                      <View
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: radius.lg,
                          backgroundColor: palette.neutral[200],
                          overflow: 'hidden',
                        }}
                      >
                        {p.photoUrl ? (
                          <CachedImage uri={p.photoUrl} style={{ width: '100%', height: '100%' }} />
                        ) : null}
                      </View>
                      <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1} style={{ marginTop: space[2] }}>
                        {p.name}
                      </Text>
                      <Text variant="caption" tone="tertiary">{p.title}</Text>
                    </View>
                  ))}
                </ScrollView>
              </Section>
            ) : null}

            {/* ───── Active deals ───── */}
            <Section title={`Active deals (${d.activeDeals.length})`}>
              {d.activeDeals.length === 0 ? (
                <Text variant="body-md" tone="tertiary">No active deals right now. Save this vendor to be notified.</Text>
              ) : (
                <Stack gap={3}>
                  {d.activeDeals.map((deal) => (
                    <Pressable
                      key={deal.id}
                      onPress={() => router.push(`/(app)/deal/${deal.id}`)}
                      style={{
                        flexDirection: 'row',
                        gap: space[3],
                        backgroundColor: palette.surface.elevated,
                        borderRadius: radius.lg,
                        padding: space[3],
                        ...shadow.sm,
                      }}
                    >
                      <View style={{ width: 80, height: 80, borderRadius: radius.md, overflow: 'hidden', backgroundColor: palette.neutral[200] }}>
                        {deal.primaryPhotoUrl ? (
                          <CachedImage uri={deal.primaryPhotoUrl} style={{ width: '100%', height: '100%' }} />
                        ) : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="caption" tone="tertiary" weight="medium">{deal.categoryName}</Text>
                        <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={2}>
                          {deal.title}
                        </Text>
                        {deal.minDealPriceCents != null ? (
                          <Stack direction="row" gap={2} align="baseline" style={{ marginTop: 2 }}>
                            <Text variant="body-md" tone="primary" weight="semibold">
                              {formatPrice(deal.minDealPriceCents)}
                            </Text>
                            {deal.minOriginalPriceCents != null && deal.minOriginalPriceCents > deal.minDealPriceCents ? (
                              <Text
                                variant="caption"
                                tone="tertiary"
                                style={{ textDecorationLine: 'line-through' }}
                              >
                                {formatPrice(deal.minOriginalPriceCents)}
                              </Text>
                            ) : null}
                          </Stack>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </Stack>
              )}
            </Section>

            {/* ───── Inside the spa (videos) ───── */}
            {d.videos.length > 0 ? (
              <Section title="Inside the spa">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
                  {d.videos.map((vid) => (
                    <Pressable
                      key={vid.id}
                      onPress={() => Linking.openURL(vid.videoUrl)}
                      style={{ width: 140 }}
                    >
                      <View style={{ width: 140, height: 200, borderRadius: radius.md, overflow: 'hidden', backgroundColor: palette.neutral[200] }}>
                        <CachedImage uri={vid.thumbnailUrl} style={{ width: '100%', height: '100%' }} />
                        <View
                          style={{
                            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 32, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}>▶</Text>
                        </View>
                      </View>
                      {vid.caption ? (
                        <Text variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: space[1] }}>
                          {vid.caption}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </Section>
            ) : null}

            {/* ───── Gloē reviews ───── */}
            {d.gloeReviews.length > 0 ? (
              <Section title={`Reviews on Gloē (${v.reviewCount})`}>
                <Stack gap={4}>
                  {d.gloeReviews.slice(0, 3).map((r) => (
                    <ReviewCard
                      key={r.id}
                      authorName={r.authorFirstName ?? 'Anonymous'}
                      rating={r.rating}
                      text={r.body}
                      relativeTime={shortDate(r.createdAt)}
                      photoUrls={r.photoUrls}
                    />
                  ))}
                </Stack>
              </Section>
            ) : null}

            {/* ───── Google reviews ───── */}
            {d.googleReviews.length > 0 ? (
              <Section title={`Reviews on Google${v.googleReviewCount != null ? ` (${v.googleReviewCount})` : ''}`}>
                <Stack gap={4}>
                  {d.googleReviews.map((r, i) => (
                    <ReviewCard
                      key={`g-${i}`}
                      authorName={r.authorName}
                      photoUrl={r.profilePhotoUrl}
                      rating={r.rating}
                      text={r.text}
                      relativeTime={r.relativeTime}
                    />
                  ))}
                </Stack>
                <Text variant="caption" tone="tertiary" style={{ marginTop: space[3], fontStyle: 'italic' }}>
                  Powered by Google. Shows the 5 most recent reviews.
                </Text>
              </Section>
            ) : null}

            {/* Empty state if NO reviews of either kind */}
            {d.gloeReviews.length === 0 && d.googleReviews.length === 0 ? (
              <Section title="Reviews">
                <Text variant="body-md" tone="tertiary">No reviews yet. Be the first to share your experience.</Text>
              </Section>
            ) : null}
          </Stack>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────── small components ─────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="tertiary" weight="semibold" style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function Row({ icon, text, link }: { icon: IconName; text: string; link?: boolean }) {
  const { color: palette } = useTheme();
  return (
    <Stack direction="row" gap={3} align="center">
      <Icon name={icon} size={16} color={palette.text.tertiary} />
      <Text variant="body-md" tone={link ? 'link' : 'primary'} weight={link ? 'semibold' : 'regular'} style={{ flex: 1 }}>
        {text}
      </Text>
    </Stack>
  );
}

function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        paddingVertical: space[3],
        borderRadius: radius.md,
        backgroundColor: palette.surface.elevated,
        ...shadow.sm,
      }}
    >
      <Icon name={icon} size={16} color={palette.text.primary} />
      <Text variant="body-sm" tone="primary" weight="semibold">{label}</Text>
    </Pressable>
  );
}

function ReviewCard({
  authorName, rating, text, relativeTime, photoUrl, photoUrls,
}: {
  authorName: string;
  rating: number;
  text: string | null;
  relativeTime: string;
  photoUrl?: string | null;   // Google reviewer avatar
  photoUrls?: string[];       // Gloe review attached photos
}) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={2}>
      <Stack direction="row" gap={3} align="center">
        {photoUrl ? (
          <CachedImage uri={photoUrl} style={{ width: 32, height: 32, borderRadius: 16 }} />
        ) : (
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: palette.brand[100],
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text variant="body-sm" weight="semibold" style={{ color: palette.brand[600] }}>{authorName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>{authorName}</Text>
          <Stack direction="row" gap={2} align="baseline">
            <Text variant="caption" tone="primary" weight="semibold">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</Text>
            <Text variant="caption" tone="tertiary">· {relativeTime}</Text>
          </Stack>
        </View>
      </Stack>
      {text ? (
        <Text variant="body-sm" tone="secondary" style={{ lineHeight: 20 }} numberOfLines={6}>
          {text}
        </Text>
      ) : null}
      {photoUrls && photoUrls.length > 0 ? (
        <Stack direction="row" gap={2} style={{ marginTop: space[1], flexWrap: 'wrap' }}>
          {photoUrls.map((url) => (
            <CachedImage
              key={url}
              uri={url}
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.md,
                backgroundColor: palette.surface.elevated,
              }}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function humanizeAmenity(slug: string): string {
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${diffDays < 14 ? '' : 's'} ago`;
  return d.toLocaleDateString();
}
