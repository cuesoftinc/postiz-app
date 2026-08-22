import {
  UploadPartCommand,
  S3Client,
  ListPartsCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromBuffer } = require('file-type');

const ALLOWED_EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.mp4': 'video/mp4',
  // LinkedIn carousels; kept in step with DOCUMENT_MIME_TYPES in
  // allowed.mime.types.ts. This map stays extension-keyed because the
  // multipart flow has to name the object's key before it has any bytes to
  // sniff, so it cannot consume the shared Sets directly.
  '.pdf': 'application/pdf',
};

function normalizeExtension(filename: string): string | null {
  const ext = path.extname(filename || '').toLowerCase();
  return ALLOWED_EXT_TO_MIME[ext] ? ext : null;
}

const {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_ACCESS_KEY,
  CLOUDFLARE_SECRET_ACCESS_KEY,
  CLOUDFLARE_BUCKETNAME,
  CLOUDFLARE_BUCKET_URL,
} = process.env;

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_ACCESS_KEY!,
    secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
});

// Function to generate a random string
function generateRandomString() {
  return makeId(20);
}

export default async function handleR2Upload(
  endpoint: string,
  req: Request,
  res: Response
) {
  switch (endpoint) {
    case 'create-multipart-upload':
      return createMultipartUpload(req, res);
    case 'prepare-upload-parts':
      return prepareUploadParts(req, res);
    case 'complete-multipart-upload':
      return completeMultipartUpload(req, res);
    case 'list-parts':
      return listParts(req, res);
    case 'abort-multipart-upload':
      return abortMultipartUpload(req, res);
    case 'sign-part':
      return signPart(req, res);
  }
  return res.status(404).end();
}

export async function simpleUpload(
  data: Buffer,
  originalFilename: string,
  _contentType: string
) {
  const detected = await fromBuffer(data);
  if (!detected || !Object.values(ALLOWED_EXT_TO_MIME).includes(detected.mime)) {
    throw new Error('Unsupported file type.');
  }
  const fileExtension = `.${detected.ext}`;
  const safeContentType = detected.mime;
  const randomFilename = generateRandomString() + fileExtension;

  const params = {
    Bucket: CLOUDFLARE_BUCKETNAME,
    Key: randomFilename,
    Body: data,
    ContentType: safeContentType,
  };

  const command = new PutObjectCommand({ ...params });
  await R2.send(command);

  return CLOUDFLARE_BUCKET_URL + '/' + randomFilename;
}

export async function createMultipartUpload(req: Request, res: Response) {
  const { file, fileHash } = req.body;
  const safeExt = normalizeExtension(file?.name || '');
  if (!safeExt) {
    return res.status(400).json({ message: 'Unsupported file type.' });
  }
  const safeContentType = ALLOWED_EXT_TO_MIME[safeExt];
  const randomFilename = generateRandomString() + safeExt;

  try {
    const params = {
      Bucket: CLOUDFLARE_BUCKETNAME,
      Key: `${randomFilename}`,
      ContentType: safeContentType,
      Metadata: {
        'x-amz-meta-file-hash': fileHash,
      },
    };

    const command = new CreateMultipartUploadCommand({ ...params });
    const response = await R2.send(command);
    return res.status(200).json({
      uploadId: response.UploadId,
      key: response.Key,
    });
  } catch (err) {
    console.log('Error', err);
    return res.status(500).json({ source: { status: 500 } });
  }
}

// S3 multipart part numbers, per the API contract. Anything outside this is
// not a part number, it is a property name.
const MIN_PART_NUMBER = 1;
const MAX_PART_NUMBER = 10000;

export async function prepareUploadParts(req: Request, res: Response) {
  const { partData } = req.body;

  const parts = partData?.parts;

  if (!Array.isArray(parts)) {
    return res.status(400).json({ source: { status: 400 } });
  }

  // `Object.create(null)` has no prototype, so a part number cannot reach
  // `__proto__` or any other inherited slot even before the range check below.
  const presignedUrls: Record<number, string> = Object.create(null);

  for (const part of parts) {
    // The part number is written straight back as a property name and is read
    // from the request body, so it has to be a real part number and nothing
    // else - not '__proto__', not 'constructor', not a string at all.
    const partNumber = Number(part?.number);
    if (
      !Number.isInteger(partNumber) ||
      partNumber < MIN_PART_NUMBER ||
      partNumber > MAX_PART_NUMBER
    ) {
      return res.status(400).json({ source: { status: 400 } });
    }

    try {
      const params = {
        Bucket: CLOUDFLARE_BUCKETNAME,
        Key: partData.key,
        PartNumber: partNumber,
        UploadId: partData.uploadId,
      };
      const command = new UploadPartCommand({ ...params });
      const url = await getSignedUrl(R2, command, { expiresIn: 3600 });

      presignedUrls[partNumber] = url;
    } catch (err) {
      // Never echo the raw error: S3/R2 SDK errors serialise bucket names,
      // request ids and stack frames. Log it server side and answer with the
      // same minimal shape createMultipartUpload uses (Uppy reads
      // `source.status` for its retry logic).
      console.log('Error', err);
      return res.status(500).json({ source: { status: 500 } });
    }
  }

  return res.status(200).json({ presignedUrls: { ...presignedUrls } });
}

export async function listParts(req: Request, res: Response) {
  const { key, uploadId } = req.body;

  try {
    const params = {
      Bucket: CLOUDFLARE_BUCKETNAME,
      Key: key,
      UploadId: uploadId,
    };
    const command = new ListPartsCommand({ ...params });
    const response = await R2.send(command);

    return res.status(200).json(response['Parts']);
  } catch (err) {
    console.log('Error', err);
    return res.status(500).json({ source: { status: 500 } });
  }
}

export async function completeMultipartUpload(req: Request, res: Response) {
  const { key, uploadId, parts } = req.body;

  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: CLOUDFLARE_BUCKETNAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    const response = await R2.send(command);

    const safeExt = normalizeExtension(key || '');
    if (!safeExt) {
      await R2.send(
        new DeleteObjectCommand({ Bucket: CLOUDFLARE_BUCKETNAME, Key: key })
      );
      return res.status(400).json({ message: 'Unsupported file type.' });
    }
    const expectedMime = ALLOWED_EXT_TO_MIME[safeExt];

    const head = await R2.send(
      new GetObjectCommand({
        Bucket: CLOUDFLARE_BUCKETNAME,
        Key: key,
        Range: 'bytes=0-4100',
      })
    );
    const chunks: Buffer[] = [];
    // @ts-ignore
    for await (const chunk of head.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const prefix = Buffer.concat(chunks);
    const detected = await fromBuffer(prefix);

    if (!detected || detected.mime !== expectedMime) {
      await R2.send(
        new DeleteObjectCommand({ Bucket: CLOUDFLARE_BUCKETNAME, Key: key })
      );
      return res
        .status(400)
        .json({ message: 'File contents do not match declared type.' });
    }

    response.Location =
      process.env.CLOUDFLARE_BUCKET_URL +
      '/' +
      response?.Location?.split('/').at(-1);
    return response;
  } catch (err) {
    console.log('Error', err);
    return res.status(500).json({ source: { status: 500 } });
  }
}

export async function abortMultipartUpload(req: Request, res: Response) {
  const { key, uploadId } = req.body;

  try {
    const params = {
      Bucket: CLOUDFLARE_BUCKETNAME,
      Key: key,
      UploadId: uploadId,
    };
    const command = new AbortMultipartUploadCommand({ ...params });
    const response = await R2.send(command);

    return res.status(200).json(response);
  } catch (err) {
    console.log('Error', err);
    return res.status(500).json({ source: { status: 500 } });
  }
}

export async function signPart(req: Request, res: Response) {
  const { key, uploadId } = req.body;
  const partNumber = parseInt(req.body.partNumber);

  const params = {
    Bucket: CLOUDFLARE_BUCKETNAME,
    Key: key,
    PartNumber: partNumber,
    UploadId: uploadId,
    Expires: 3600,
  };

  const command = new UploadPartCommand({ ...params });
  const url = await getSignedUrl(R2, command, { expiresIn: 3600 });

  return res.status(200).json({
    url: url,
  });
}
