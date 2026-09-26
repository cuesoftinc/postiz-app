const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const multer = require('multer');
const {
  fileUploadOptions,
} = require('../../libraries/nestjs-libraries/src/upload/multer.options.ts');

function isPatched(version) {
  const [major, minor] = version.split('.').map(Number);
  return major > 2 || (major === 2 && minor >= 4);
}

function parseUpload(fieldName) {
  const boundary = 'postiz-upload-test';
  const body = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"\r\n\r\n` +
      'true\r\n' +
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="ok.txt"\r\n' +
      'Content-Type: text/plain\r\n\r\n' +
      'ok\r\n' +
      `--${boundary}--\r\n`
  );
  const req = Readable.from([body]);
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
  };
  req.method = 'POST';
  req.url = '/upload';

  return new Promise((resolve) => {
    multer(fileUploadOptions).single('file')(req, {}, (error) => {
      resolve({ error, req });
    });
  });
}

test('Nest upload interceptor resolves patched Multer', () => {
  const nestDir = path.dirname(
    require.resolve('@nestjs/platform-express/package.json')
  );
  const multerPackage = require.resolve('multer/package.json', {
    paths: [nestDir],
  });

  assert.ok(isPatched(require(multerPackage).version));
  assert.ok(isPatched(require('multer/package.json').version));
});

test('multipart uploads accept scalar fields and reject indexed fields', async () => {
  assert.ok(isPatched(require('multer/package.json').version));

  const accepted = await parseUpload('preventSave');
  assert.equal(accepted.error, undefined);
  assert.equal(accepted.req.file.buffer.toString(), 'ok');

  const rejected = await parseUpload('items[1]');
  assert.equal(rejected.error?.code, 'LIMIT_FIELD_ARRAY_INDEX');
});
