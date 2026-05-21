import { trpc, type RouterOutputs } from '@gloe/api-client';
import { Stack, Text, color, radius, space } from '@gloe/ui';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, View } from 'react-native';

import { Section } from './Section';

interface InternalReview {
  id: string;
  authorFirstName: string | null;
  rating: number;
  body: string | null;
}

interface ReviewsSectionProps {
  vendorId: string;
  googlePlaceId: string | null;
  reviewCount: number;
  internalReviews: InternalReview[];
}

type Tab = 'gloe' | 'google';

/**
 * Reviews with a Gloē / Google toggle. Gloē (verified-booking) reviews show by
 * default. The Google tab lazy-loads — we only call Google when the user taps
 * it, so there's no per-view cost. Google reviews are shown live with required
 * attribution, never cached.
 */
export function ReviewsSection({ vendorId, googlePlaceId, reviewCount, internalReviews }: ReviewsSectionProps) {
  const [tab, setTab] = useState<Tab>('gloe');
  const hasGoogle = !!googlePlaceId;

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

function GloeReviews({ reviews, reviewCount }: { reviews: InternalReview[]; reviewCount: number }) {
  if (reviews.length === 0) {
    return (
      <Text variant="body-sm" tone="tertiary">
        No reviews yet. Be the first after your appointment.
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {reviews.map((r) => (
        <Stack key={r.id} gap={1}>
          <Stack direction="row" gap={2} align="baseline">
            <Text variant="body-md" tone="primary" weight="semibold">{r.authorFirstName ?? 'Member'}</Text>
            <Text variant="body-sm" tone="brand">{'★'.repeat(r.rating)}</Text>
          </Stack>
          {r.body ? <Text variant="body-md" tone="secondary">{r.body}</Text> : null}
        </Stack>
      ))}
      {reviewCount > reviews.length ? (
        <Pressable hitSlop={8}>
          <Text variant="body-sm" tone="link" weight="semibold">See all {reviewCount} →</Text>
        </Pressable>
      ) : null}
    </Stack>
  );
}

type GoogleReviewsData = RouterOutputs['maps']['googleReviews'];

function GoogleReviews({ data, loading }: { data: GoogleReviewsData | undefined; loading: boolean }) {
  if (loading) {
    return (
      <View style={{ paddingVertical: space[5], alignItems: 'center' }}>
        <ActivityIndicator color={color.brand[500]} />
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
        <Stack key={`${r.authorName}-${i}`} gap={1}>
          <Stack direction="row" gap={2} align="baseline">
            <Text variant="body-md" tone="primary" weight="semibold">{r.authorName}</Text>
            <Text variant="body-sm" tone="brand">{'★'.repeat(r.rating)}</Text>
            <Text variant="caption" tone="tertiary">{r.relativeTime}</Text>
          </Stack>
          {r.text ? <Text variant="body-md" tone="secondary">{r.text}</Text> : null}
        </Stack>
      ))}

      {/* Google requires attribution + a link back to the listing. */}
      <Pressable
        hitSlop={8}
        onPress={() => data.attributionUrl && Linking.openURL(data.attributionUrl)}
      >
        <Stack direction="row" gap={2} align="center">
          <Image
            source={{ uri: 'https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png' }}
            style={{ width: 60, height: 20 }}
            resizeMode="contain"
          />
          <Text variant="caption" tone="link">View on Google →</Text>
        </Stack>
      </Pressable>
    </Stack>
  );
}

function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space[4],
        paddingVertical: space[2],
        borderRadius: radius.pill,
        backgroundColor: active ? color.brand[500] : color.surface.elevated,
        borderWidth: 1,
        borderColor: active ? color.brand[500] : color.border.default,
      }}
    >
      <Text variant="body-sm" tone={active ? 'inverse' : 'primary'} weight="semibold">{label}</Text>
    </Pressable>
  );
}
