import { Stack } from 'expo-router';

import { BookScreenBody } from '@/features/book/BookScreen';

/**
 * Signed-out showcase of the Book — the auth gate exempts this segment.
 * Static canon only; the launch band scrubs without a session, so nothing
 * here can read or write household data.
 */
export default function BookPreviewScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BookScreenBody previewMode />
    </>
  );
}
