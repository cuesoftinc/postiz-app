const assert = require('node:assert/strict');
const test = require('node:test');
const {
  AUDIO_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  IMAGE_MIME_TYPES,
  POSTABLE_MEDIA_EXTENSIONS,
  STORAGE_ALLOWED_MIME_TYPES,
  UPLOAD_ALLOWED_MIME_TYPES,
} = require('@gitroom/nestjs-libraries/upload/allowed.mime.types');
const {
  ValidUrlExtension,
} = require('@gitroom/helpers/utils/valid.url.path');
const {
  getMaxSize,
} = require('@gitroom/nestjs-libraries/upload/custom.upload.validation');

// The 2026-08-23 outage, as invariants. `application/pdf` was allowed in the
// validation pipe so LinkedinProvider could use LinkedIn's /documents endpoint,
// but the same allow-list had been retyped in four other places and none were
// updated. A carousel PDF passed the API boundary and was rejected one layer
// deeper by CloudflareStorage, as a bare Error rather than an HttpException, so
// a refused file type reached the caller as an opaque HTTP 500.
//
// These tests exist because the fix's only other guard is a comment asking
// people not to "reconcile" lists that differ on purpose. A comment cannot fail
// a build.

test('a PDF is uploadable, storable and postable — the whole carousel path', () => {
  assert.ok(UPLOAD_ALLOWED_MIME_TYPES.has('application/pdf'));
  assert.ok(STORAGE_ALLOWED_MIME_TYPES.has('application/pdf'));
  assert.ok(POSTABLE_MEDIA_EXTENSIONS.includes('.pdf'));
});

test('every uploadable type is also storable', () => {
  // The inverse is deliberately false (see audio, below). This direction is
  // what actually broke: a type accepted at the boundary and refused by the
  // provider is an opaque 500 on a file the system said it would take.
  for (const mime of UPLOAD_ALLOWED_MIME_TYPES) {
    assert.ok(
      STORAGE_ALLOWED_MIME_TYPES.has(mime),
      `${mime} is uploadable but not storable — it would 500 inside the storage provider`
    );
  }
});

test('audio is storable but NOT uploadable', () => {
  // Providers must persist audio handed to them internally; no caller may send
  // it. Flattening the two sets into one would silently open the upload
  // endpoints to audio.
  for (const mime of AUDIO_MIME_TYPES) {
    assert.ok(STORAGE_ALLOWED_MIME_TYPES.has(mime), `${mime} should be storable`);
    assert.equal(
      UPLOAD_ALLOWED_MIME_TYPES.has(mime),
      false,
      `${mime} must not be uploadable`
    );
  }
});

test('avif, bmp and tiff are storable but NOT postable', () => {
  // Storable because uploadSimple also ingests integration avatars straight off
  // the platforms' own CDNs, which increasingly serve avif. Not postable
  // because the platforms refuse them, and a format that passes validation and
  // dies at its publish minute is worse than one refused at upload.
  const extFor = { 'image/avif': '.avif', 'image/bmp': '.bmp', 'image/tiff': '.tiff' };
  for (const [mime, ext] of Object.entries(extFor)) {
    assert.ok(STORAGE_ALLOWED_MIME_TYPES.has(mime), `${mime} should be storable`);
    assert.equal(
      POSTABLE_MEDIA_EXTENSIONS.includes(ext),
      false,
      `${ext} must not be postable`
    );
  }
});

test('getMaxSize caps every type the sets allow, and rejects the rest', () => {
  // A type present in a set but absent from getMaxSize throws
  // BadRequestException from the size check instead of the type check — the
  // same confusing shape the original bug had.
  for (const mime of STORAGE_ALLOWED_MIME_TYPES) {
    assert.ok(getMaxSize(mime) > 0, `${mime} has no size cap`);
  }
  assert.throws(() => getMaxSize('application/x-msdownload'));
});

test('a PDF gets LinkedIn document headroom, not the image cap', () => {
  // 10MB is the image cap; a carousel PDF routinely exceeds it.
  assert.equal(getMaxSize('application/pdf'), 100 * 1024 * 1024);
  assert.ok(getMaxSize('application/pdf') > getMaxSize('image/png'));
});

test('ValidUrlExtension accepts a stored PDF and still refuses the rest', () => {
  const v = new ValidUrlExtension();
  const url = (name) => `https://media-postiz.cuesoft.io/${name}`;
  assert.ok(v.validate(url('abc.pdf'), {}));
  assert.ok(v.validate(url('abc.png'), {}));
  assert.ok(v.validate(url('abc.mp4'), {}));
  // A query string must not defeat the check in either direction.
  assert.ok(v.validate(url('abc.pdf?v=2'), {}));
  assert.equal(v.validate(url('abc.exe'), {}), false);
  assert.equal(v.validate(url('abc.svg'), {}), false);
  // Absent/empty input is a rejection, not a truthy pass.
  assert.equal(v.validate('', {}), false);
  assert.equal(v.validate(undefined, {}), false);
});

test('the rejection message names exactly what is enforced', () => {
  // The message used to be hand-written beside the list. Derived from it now,
  // so it cannot advertise a set the validator does not implement.
  const message = new ValidUrlExtension().defaultMessage({});
  for (const ext of POSTABLE_MEDIA_EXTENSIONS) {
    assert.ok(message.includes(ext), `message omits ${ext}`);
  }
});

test('the image group is not silently narrowed', () => {
  // A regression here would quietly stop accepting a format the platforms take.
  for (const mime of IMAGE_MIME_TYPES) {
    assert.ok(UPLOAD_ALLOWED_MIME_TYPES.has(mime), `${mime} should be uploadable`);
  }
  assert.deepEqual([...DOCUMENT_MIME_TYPES], ['application/pdf']);
});
