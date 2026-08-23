// Single source of truth for the MIME types this instance accepts.
//
// These lists were previously retyped in every validator and storage provider.
// That is how a LinkedIn carousel PDF came to pass the API-boundary check and
// then be rejected one layer deeper: `application/pdf` was added to the
// validation pipe's copy and to getMaxSize, but CloudflareStorage kept its own
// stale copy, so every carousel upload died inside the storage provider as a
// bare Error -> HTTP 500. Compose from the groups below; never retype a list.
//
// The split between what may be UPLOADED and what a provider will STORE is
// deliberate, not an oversight — see AUDIO_MIME_TYPES.

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
] as const;

export const VIDEO_MIME_TYPES = ['video/mp4'] as const;

// LinkedIn carousels are documents, not image sets: LinkedinProvider uploads a
// PDF to LinkedIn's /documents endpoint and titles the post from it (see
// linkedin.provider.ts). getMaxSize caps these at LinkedIn's 100MB document
// limit rather than the 10MB image limit.
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

// Music beds. DELIBERATELY absent from UPLOAD_ALLOWED_MIME_TYPES: a storage
// provider must be able to persist audio it is handed internally, but no
// caller may upload it directly. Keeping this a separate group is what stops
// a future "just share one list" cleanup from quietly opening the upload
// endpoints to audio.
export const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
] as const;

// What a caller may upload — validation pipes and the public API boundary.
export const UPLOAD_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set<string>([
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
]);

// What a storage provider will persist: everything uploadable, plus the audio
// handed to it internally.
export const STORAGE_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set<string>([
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
]);

// What may be ATTACHED to a post, checked by extension off the stored URL
// rather than by sniffing bytes (ValidUrlExtension, applied to MediaDto).
//
// Deliberately NARROWER than UPLOAD_ALLOWED_MIME_TYPES. The gap is load-bearing
// in BOTH directions, so do not "reconcile" the two lists:
//
//   - Widening THIS list is a publish-time risk, not a validation nicety. A
//     format the platforms refuse fails at the publish minute, on a post that
//     was already accepted and scheduled, instead of at upload with a clean 400.
//
//   - Narrowing the UPLOAD list to match would break avatar ingest. uploadSimple
//     also pulls integration profile pictures straight off the platforms' own
//     CDNs (integration.repository.ts, updateIntegration) and third-party
//     generated images. Those CDNs serve whatever they like, increasingly avif
//     and webp, and those bytes have to be storable whether or not anyone could
//     attach them to a post.
//
// So .avif, .bmp and .tiff are storable and not postable, on purpose.
export const POSTABLE_MEDIA_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp4',
  // LinkedIn carousels; see DOCUMENT_MIME_TYPES.
  '.pdf',
] as const;
