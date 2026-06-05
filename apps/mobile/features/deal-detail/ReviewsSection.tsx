import { trpc, type RouterOutputs } from '@gloe/api-client';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { Section } from './Section';

interface InternalReview {
  id: string;
  authorFirstName: string | null;
  rating: number;
  body: string | null;
  photoUrls: string[];
}

interface ReviewsSectionProps {
  vendorId: string;
  googlePlaceId: string | null;
  reviewCount: number;
  internalReviews: InternalReview[];
  /** Whether the Gloē reviews are still loading (so auto-select waits for them). */
  reviewsLoading?: boolean;
}

type Tab = 'gloe' | 'google';

/**
 * Reviews with a Gloē / Google toggle. Gloē (verified-booking) reviews show by
 * default. The Google tab lazy-loads — we only call Google when the user taps
 * it, so there's no per-view cost. Google reviews are shown live with required
 * attribution, never cached.
 */
export function ReviewsSection({ vendorId, googlePlaceId, reviewCount, internalReviews, reviewsLoading = false }: ReviewsSectionProps) {
  const [tab, setTab] = useState<Tab>('gloe');
  const [autoPicked, setAutoPicked] = useState(false);
  const hasGoogle = !!googlePlaceId;

  // Once our reviews load, default to Google when we have fewer than 5 of our
  // own (and Google is available) — lead with whichever side has substance.
  useEffect(() => {
    if (autoPicked || reviewsLoading) return;
    if (hasGoogle && internalReviews.length < 5) setTab('google');
    setAutoPicked(true);
  }, [reviewsLoading, internalReviews.length, hasGoogle, autoPicked]);

  // Lazy: only fires once the Google tab is selected.
  const googleQuery = trpc.maps.googleReviews.useQuery(
    { placeId: googlePlaceId ?? '' },
    { enabled: tab === 'google' && hasGoogle, staleTime: 10 * 60_000 },
  );

  return (
    <Section title="Reviews">
      {hasGoogle ? (
        <Stack direction="row" gap={2}>
          <TabPill label="Gloē" active={tab === 'gloe'} onPress={() => setTab('gloe')} />
          <TabPill label="Google" active={tab === 'google'} onPress={() => setTab('google')} />
        </Stack>
      ) : null}

      {tab === 'gloe' ? (
        <GloeReviews reviews={internalReviews} reviewCount={reviewCount} />
      ) : (
        <GoogleReviews data={googleQuery.data} loading={googleQuery.isLoading} />
      )}
    </Section>
  );
}

function GloeReviews({ reviews }: { reviews: InternalReview[]; reviewCount: number }) {
  const [showAll, setShowAll] = useState(false);
  if (reviews.length === 0) {
    return (
      <Text variant="body-sm" tone="tertiary">
        No reviews yet. Be the first after your appointment.
      </Text>
    );
  }
  // Collapse to the first review so long ones don't dominate; expand on tap.
  const shown = showAll ? reviews : reviews.slice(0, 1);
  return (
    <Stack gap={4}>
      {shown.map((r) => (
        <Stack key={r.id} gap={2}>
          <Stack direction="row" gap={2} align="baseline">
            <Text variant="body-md" tone="primary" weight="semibold">{r.authorFirstName ?? 'Member'}</Text>
            <Text variant="body-sm" tone="brand">{'★'.repeat(r.rating)}</Text>
          </Stack>
          {r.body ? <Text variant="body-md" tone="secondary">{r.body}</Text> : null}
          {r.photoUrls.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {r.photoUrls.map((u, i) => (
                <CachedImage key={i} uri={u} style={{ width: 76, height: 76, borderRadius: radius.md }} />
              ))}
            </View>
          ) : null}
        </Stack>
      ))}
      {reviews.length > 1 ? (
        <Pressable hitSlop={8} onPress={() => setShowAll((v) => !v)}>
          <Text variant="body-sm" tone="link" weight="semibold">
            {showAll ? 'Show less' : `Show ${reviews.length - 1} more review${reviews.length - 1 === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      ) : null}
    </Stack>
  );
}

type GoogleReviewsData = RouterOutputs['maps']['googleReviews'];

function GoogleReviews({ data, loading }: { data: GoogleReviewsData | undefined; loading: boolean }) {
  const { color: palette } = useTheme();
  if (loading) {
    return (
      <View style={{ paddingVertical: space[5], alignItems: 'center' }}>
        <ActivityIndicator color={palette.brand[500]} />
      </View>
    );
  }
  if (!data || !data.available || data.reviews.length === 0) {
    return <Text variant="body-sm" tone="tertiary">No Google reviews available.</Text>;
  }

  return (
    <Stack gap={4}>
      {data.rating != null ? (
        <Text variant="body-sm" tone="secondary">
          {data.rating.toFixed(1)} ★ on Google
          {data.totalRatings ? ` · ${data.totalRatings} ratings` : ''}
        </Text>
      ) : null}

      {data.reviews.map((r, i) => (
        <Stack key={`${r.authorName}-${i}`} direction="row" gap={3} align="flex-start">
          {r.photoUrl ? (
            <CachedImage uri={r.photoUrl} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: palette.brand[100],
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text variant="body-sm" weight="semibold" style={{ color: palette.brand[600] }}>
                {r.authorName.charAt(0)}
              </Text>
            </View>
          )}
          <Stack gap={1} style={{ flex: 1 }}>
            <Stack direction="row" gap={2} align="baseline">
              <Text variant="body-md" tone="primary" weight="semibold">{r.authorName}</Text>
              <Text variant="body-sm" tone="brand">{'★'.repeat(r.rating)}</Text>
              <Text variant="caption" tone="tertiary">{r.relativeTime}</Text>
            </Stack>
            {r.text ? <Text variant="body-md" tone="secondary">{r.text}</Text> : null}
          </Stack>
        </Stack>
      ))}

      {/* Google requires attribution + a link back to the listing. */}
      <Pressable
        hitSlop={8}
        onPress={() => data.attributionUrl && Linking.openURL(data.attributionUrl)}
      >
        <Stack direction="row" gap={2} align="center">
          <CachedImage
            uri="https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png"
            style={{ width: 60, height: 20 }}
            contentFit="contain"
          />
          <Text variant="caption" tone="link">View more on Google →</Text>
        </Stack>
      </Pressable>
    </Stack>
  );
}

function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space[4],
        paddingVertical: space[2],
        borderRadius: radius.pill,
        backgroundColor: active ? palette.brand[500] : palette.surface.elevated,
        borderWidth: 1,
        borderColor: active ? palette.brand[500] : palette.border.default,
      }}
    >
      <Text variant="body-sm" tone={active ? 'inverse' : 'primary'} weight="semibold">{label}</Text>
    </Pressable>
  );
}
