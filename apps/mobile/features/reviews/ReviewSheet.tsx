import { trpc } from '@gloe/api-client';
import { BottomSheet, BottomSheetScrollView, Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CachedImage } from '../image/CachedImage';

interface ReviewSheetProps {
  open: boolean;
  claimId: string;
  vendorName: string;
  onClose: () => void;
  /** Fires after a successful save so the caller can refetch / show a thank-you. */
  onSaved?: () => void;
}

const MAX_PHOTOS = 3;

/**
 * Bottom-sheet for leaving (or editing) a review on a redeemed voucher.
 *
 * Photos: pick up to 3 at once from the camera roll. Each one uploads in
 * parallel via a signed Supabase URL; once all reach `done`, the submit
 * button enables and review.create is called with photoUrls=[…]. Submit is
 * idempotent on the server (upsert by claim_id), so re-saving updates
 * everything including replacing the photo set.
 */
export function ReviewSheet({ open, claimId, vendorName, onClose, onSaved }: ReviewSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const existing = trpc.reviews.byClaim.useQuery({ claimId }, { enabled: open });
  const sign = trpc.reviews.signPhotoUpload.useMutation();
  const utils = trpc.useUtils();

  const [rating, setRating] = useState<number>(0);
  const [body, setBody] = useState<string>('');
  // Each slot tracks its own upload lifecycle so the UI can show per-photo state.
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seedKey = useRef<string | null>(null);

  // Pre-fill from existing review whenever the sheet opens (or claim id changes).
  useEffect(() => {
    if (!open) return;
    const key = `${claimId}:${existing.data?.id ?? ''}`;
    if (seedKey.current === key) return;  // Already seeded for this open + claim.
    if (existing.data) {
      setRating(existing.data.rating);
      setBody(existing.data.body ?? '');
      setPhotos(existing.data.photoUrls.map((url) => ({ status: 'done', publicUrl: url, localUri: url })));
    } else if (existing.data === null) {
      setRating(0);
      setBody('');
      setPhotos([]);
    }
    setError(null);
    seedKey.current = key;
  }, [open, claimId, existing.data]);

  // Reset the seed lock when the sheet closes so the next open re-seeds fresh.
  useEffect(() => {
    if (!open) seedKey.current = null;
  }, [open]);

  const create = trpc.reviews.create.useMutation();

  const isEditing = !!existing.data;
  const photosUploading = photos.some((p) => p.status === 'uploading');
  const photosErrored = photos.some((p) => p.status === 'error');
  const canSubmit =
    rating >= 1 && rating <= 5 &&
    !create.isPending &&
    !photosUploading &&
    !photosErrored;

  const pickPhotos = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    // Ask permission lazily — first add is when we need it.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photos access is off. Enable it in Settings → Gloe → Photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    // Insert pending slots first (so user sees them immediately), then fire
    // uploads in parallel. State updates use the slot's localUri as the key.
    const newSlots: PhotoSlot[] = result.assets.map((a) => ({
      status: 'uploading',
      localUri: a.uri,
      progress: 0,
      mimeType: a.mimeType ?? 'image/jpeg',
    }));
    setPhotos((prev) => [...prev, ...newSlots]);

    await Promise.all(newSlots.map((slot) => uploadOne(slot)));
  };

  const uploadOne = async (slot: PhotoSlot) => {
    // Only uploading/error slots carry mimeType — `done` slots never re-upload.
    const mimeType = slot.status === 'done' ? 'image/jpeg' : (slot.mimeType ?? 'image/jpeg');
    try {
      const ext = (slot.localUri.split('.').pop() ?? 'jpg').slice(0, 5);
      const signed = await sign.mutateAsync({ fileExt: ext });
      // Read the file's bytes — Expo URIs are already file:// or content://
      const res = await fetch(slot.localUri);
      const blob = await res.blob();
      await uploadWithProgress(signed.uploadUrl, blob, mimeType, (pct) => {
        setPhotos((prev) =>
          prev.map((p) => (p.localUri === slot.localUri ? { ...p, progress: pct } : p)),
        );
      });
      setPhotos((prev) =>
        prev.map((p) =>
          p.localUri === slot.localUri
            ? { status: 'done', localUri: slot.localUri, publicUrl: signed.publicUrl }
            : p,
        ),
      );
    } catch (e) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.localUri === slot.localUri
            ? { status: 'error', localUri: slot.localUri, errorMsg: (e as Error).message }
            : p,
        ),
      );
    }
  };

  const removePhoto = (localUri: string) => {
    Haptics.selectionAsync();
    setPhotos((prev) => prev.filter((p) => p.localUri !== localUri));
  };

  const retryPhoto = (slot: PhotoSlot) => {
    setPhotos((prev) =>
      prev.map((p) => (p.localUri === slot.localUri ? { ...p, status: 'uploading', progress: 0 } : p)),
    );
    void uploadOne({ ...slot, status: 'uploading', progress: 0 });
  };

  const submit = async () => {
    setError(null);
    if (!canSubmit) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const photoUrls = photos
        .filter((p): p is PhotoSlotDone => p.status === 'done')
        .map((p) => p.publicUrl);
      await create.mutateAsync({
        claimId,
        rating,
        body: body.trim() ? body.trim() : undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });
      await Promise.all([
        utils.reviews.byClaim.invalidate({ claimId }),
        utils.vendors.storefront.invalidate(),
      ]);
      onSaved?.();
      onClose();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : 'Could not save review.');
    }
  };

  return (
    // keyboardAvoiding lifts the sheet above the keyboard so the text field and
    // Submit button stay visible while typing.
    <BottomSheet
      open={open}
      onClose={onClose}
      keyboardAvoiding
      style={{ paddingHorizontal: space[5], paddingBottom: insets.bottom + space[4] }}
    >
      <BottomSheetScrollView>
        <Stack gap={5}>
              <Stack gap={1}>
                <Text variant="display-sm" tone="primary" weight="medium">
                  {isEditing ? 'Edit your review' : 'How was your visit?'}
                </Text>
                <Text variant="body-md" tone="secondary">{vendorName}</Text>
              </Stack>

              <StarRow rating={rating} onChange={setRating} />

              <TextInput
                placeholder="Add a few words (optional)"
                placeholderTextColor={palette.text.tertiary}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={2000}
                style={{
                  minHeight: 96,
                  padding: space[3],
                  borderRadius: radius.md,
                  backgroundColor: palette.surface.elevated,
                  borderWidth: 1,
                  borderColor: palette.border.default,
                  fontSize: 15,
                  color: palette.text.primary,
                  textAlignVertical: 'top',
                }}
              />

              <PhotoGrid
                photos={photos}
                onPick={pickPhotos}
                onRemove={removePhoto}
                onRetry={retryPhoto}
              />

              {error ? <Text variant="body-sm" tone="error">{error}</Text> : null}

              <Stack direction="row" gap={3}>
                <View style={{ flex: 1 }}>
                  <Button label="Cancel" variant="secondary" size="lg" fullWidth onPress={onClose} />
                </View>
                <View style={{ flex: 2 }}>
                  <Button
                    label={
                      create.isPending ? 'Saving…'
                      : photosUploading ? 'Uploading photos…'
                      : isEditing ? 'Update review'
                      : 'Submit review'
                    }
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={submit}
                    disabled={!canSubmit}
                  />
                </View>
              </Stack>
            </Stack>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

/* ─────────────── sub-components ─────────────── */

function StarRow({ rating, onChange }: { rating: number; onChange: (next: number) => void }) {
  const { color: palette } = useTheme();
  return (
    <Stack direction="row" justify="center" gap={2} style={{ paddingVertical: space[2] }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rating;
        return (
          <Pressable
            key={n}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(n);
            }}
            hitSlop={10}
          >
            <Text style={{ fontSize: 40, color: filled ? palette.brand[500] : palette.border.default, lineHeight: 44 }}>
              {filled ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </Stack>
  );
}

function PhotoGrid({
  photos, onPick, onRemove, onRetry,
}: {
  photos: PhotoSlot[];
  onPick: () => void;
  onRemove: (localUri: string) => void;
  onRetry: (slot: PhotoSlot) => void;
}) {
  const { color: palette } = useTheme();
  const remaining = MAX_PHOTOS - photos.length;
  const cellSize = 88;
  return (
    <Stack gap={2}>
      <Text variant="caption" tone="tertiary" weight="semibold" style={{ letterSpacing: 1.4, textTransform: 'uppercase' }}>
        Photos (optional · {photos.length}/{MAX_PHOTOS})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {photos.map((p) => (
          <View
            key={p.localUri}
            style={{
              position: 'relative',
              width: cellSize,
              height: cellSize,
              borderRadius: radius.md,
              overflow: 'hidden',
              backgroundColor: palette.surface.elevated,
              borderWidth: 1,
              borderColor: p.status === 'error' ? palette.semantic.error : palette.border.subtle,
            }}
          >
            <CachedImage uri={p.localUri} style={{ width: '100%', height: '100%' }} />
            {p.status === 'uploading' ? (
              <View style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color="#fff" />
                <Text variant="caption" style={{ color: '#fff', marginTop: 4 }}>
                  {p.progress}%
                </Text>
              </View>
            ) : null}
            {p.status === 'error' ? (
              <Pressable
                onPress={() => onRetry(p)}
                style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                  backgroundColor: 'rgba(178,69,69,0.7)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text variant="caption" style={{ color: '#fff' }}>Retry</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onRemove(p.localUri)}
              hitSlop={6}
              style={{
                position: 'absolute',
                top: -6, right: -6,
                width: 22, height: 22,
                borderRadius: 11,
                backgroundColor: palette.text.primary,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, lineHeight: 14 }}>×</Text>
            </Pressable>
          </View>
        ))}

        {remaining > 0 ? (
          <Pressable
            onPress={onPick}
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: radius.md,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: palette.border.default,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28, color: palette.text.tertiary, lineHeight: 30 }}>+</Text>
            <Text variant="caption" tone="tertiary">Add</Text>
          </Pressable>
        ) : null}
      </View>
    </Stack>
  );
}

/* ─────────────── upload helper ─────────────── */

/**
 * PUT to a signed Supabase URL with progress. Same pattern the vendor
 * uploaders use, kept inline here to avoid a cross-module dep.
 */
function uploadWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType || 'image/jpeg');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error('File too large.'));
      else if (xhr.status === 401 || xhr.status === 403) reject(new Error('Upload link expired.'));
      else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(body);
  });
}

/* ─────────────── slot types ─────────────── */

type PhotoSlot =
  | { status: 'uploading'; localUri: string; progress: number; mimeType?: string }
  | { status: 'error';     localUri: string; errorMsg: string; mimeType?: string }
  | PhotoSlotDone;

interface PhotoSlotDone {
  status: 'done';
  localUri: string;     // Could be local file:// or remote URL (when seeded from existing review)
  publicUrl: string;    // The Supabase public URL
}
