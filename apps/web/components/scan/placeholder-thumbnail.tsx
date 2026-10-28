/**
 * Neutral stand-in for the part's picture until the thumbnail is cut from the
 * analyzed frame (HU-18). It must never show an image that is not the part.
 */
export function PlaceholderThumbnail() {
  return (
    <span
      aria-hidden="true"
      className="block size-10 shrink-0 rounded-lg border bg-muted"
    />
  );
}
