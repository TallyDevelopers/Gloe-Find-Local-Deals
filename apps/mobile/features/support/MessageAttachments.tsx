import { radius, space, useTheme } from '@gloe/ui';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Modal, Pressable, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CachedImage, resizedUrl } from '../image/CachedImage';

/**
 * A single attachment on a support message. Shape is the camelCase projection
 * the API returns for each row of `support_message_attachments`.
 */
export interface MessageAttachment {
  id: string;
  kind: 'image' | 'video';
  url: string;
  /** Poster/first-frame for videos; may also exist for images. */
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
}

const THUMB = 140;

/**
 * Renders the photos + videos attached to a support-ticket message inline in
 * the chat thread (mobile + mirrored shape in god-mode). Mirrors the rounded,
 * clean review-photo aesthetic.
 *
 * - Images: rounded ~140px thumbnails in a wrapping row, tap to open a
 *   self-contained full-screen viewer (a plain Modal — no extra deps).
 * - Videos: thumbnail/first-frame with a play-button overlay. We don't bundle
 *   a video player (no expo-video / expo-av in this app), so tapping opens the
 *   video URL via Linking.
 *   TODO: when expo-video (VideoView) lands in the app, swap the Linking.open
 *   for an in-app player in the full-screen viewer instead of leaving the app.
 */
export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const { color: palette } = useTheme();
  const insets = useSafeAreaInsets();
  // The image currently shown full-screen, or null when the viewer is closed.
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  function onPress(att: MessageAttachment) {
    if (att.kind === 'image') {
      // Full-screen: a screen-sized resize (~1200px), not the raw multi-MB file.
      setViewerUri(resizedUrl(att.url, 1200) ?? att.url);
    } else {
      // No bundled video player — hand off to the OS. See TODO above.
      void Linking.openURL(att.url);
    }
  }

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: space[2],
          marginTop: space[2],
        }}
      >
        {attachments.map((att) => {
          // Load a small resized version for the in-chat thumbnail, not the
          // full multi-MB original (6MB phone photo → ~170KB at width 300).
          const previewUri = att.kind === 'image' ? resizedUrl(att.url, 300) : (att.thumbnailUrl ?? att.url);
          return (
            <Pressable
              key={att.id}
              onPress={() => onPress(att)}
              style={({ pressed }) => ({
                width: THUMB,
                height: THUMB,
                borderRadius: radius.lg,
                overflow: 'hidden',
                backgroundColor: palette.surface.secondary,
                borderWidth: 1,
                borderColor: palette.border.subtle,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <CachedImage
                uri={previewUri}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />

              {att.kind === 'video' ? (
                <View
                  style={{
                    ...StyleSheetAbsoluteFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.surface.overlay,
                  }}
                  pointerEvents="none"
                >
                  <PlayBadge palette={palette} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Self-contained full-screen image viewer. */}
      <Modal
        visible={viewerUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" />
        <Pressable
          onPress={() => setViewerUri(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(13, 9, 7, 0.96)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space[4],
          }}
        >
          {viewerUri ? (
            <CachedImage
              uri={viewerUri}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          ) : null}

          {/* Close affordance — top-right, clear of the notch. */}
          <Pressable
            onPress={() => setViewerUri(null)}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: insets.top + space[3],
              right: space[5],
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
            }}
          >
            <View
              style={{
                width: 16,
                height: 2,
                borderRadius: 1,
                backgroundColor: '#FFFFFF',
                transform: [{ rotate: '45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: 16,
                height: 2,
                borderRadius: 1,
                backgroundColor: '#FFFFFF',
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Inlined to avoid importing StyleSheet just for one absoluteFill object. */
const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/**
 * Rounded "play" chip drawn with views (no icon font / svg asset needed): a
 * frosted disc with a right-pointing triangle made from borders.
 */
function PlayBadge({ palette }: { palette: ReturnType<typeof useTheme>['color'] }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
      }}
    >
      <View
        style={{
          marginLeft: 3,
          width: 0,
          height: 0,
          borderTopWidth: 9,
          borderBottomWidth: 9,
          borderLeftWidth: 15,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: '#1A130F',
        }}
      />
    </View>
  );
}
