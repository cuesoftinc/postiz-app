import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { UPLOAD_ALLOWED_MIME_TYPES } from '@gitroom/nestjs-libraries/upload/allowed.mime.types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromBuffer } = require('file-type');

@Injectable()
export class CustomFileValidationPipe implements PipeTransform {
  async transform(value: any) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    // Skip non-file parameters (org, body, query, etc.)
    if (!('buffer' in value) && !('mimetype' in value) && !('fieldname' in value)) {
      return value;
    }

    if (!value.buffer || !Buffer.isBuffer(value.buffer)) {
      throw new BadRequestException('Invalid file upload.');
    }

    const detected = await fromBuffer(value.buffer);
    if (!detected || !UPLOAD_ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new BadRequestException('Unsupported file type.');
    }

    const maxSize = getMaxSize(detected.mime);
    if (value.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of ${maxSize} bytes.`
      );
    }

    value.mimetype = detected.mime;
    const safeBase = (value.originalname || 'upload')
      .replace(/\.[^./\\]*$/, '')
      .replace(/[\\/]/g, '_')
      .slice(0, 100) || 'upload';
    value.originalname = `${safeBase}.${detected.ext}`;

    return value;
  }

}

export function getMaxSize(mimeType: string): number {
  if (mimeType.startsWith('image/')) {
    return 10 * 1024 * 1024; // 10 MB
  } else if (mimeType.startsWith('video/')) {
    return 1024 * 1024 * 1024; // 1 GB
  } else if (mimeType === 'application/pdf') {
    return 100 * 1024 * 1024; // 100 MB — LinkedIn's document upload cap
  } else if (mimeType.startsWith('audio/')) {
    // STORAGE_ALLOWED_MIME_TYPES accepts audio (music beds);
    // UPLOAD_ALLOWED_MIME_TYPES does not, and rejects it BEFORE reaching here,
    // so this branch widens nothing. It exists so uploadSimple can cap audio
    // rather than throw "Unsupported file type" on a file its own allow-list
    // permitted.
    return 100 * 1024 * 1024; // 100 MB
  } else {
    throw new BadRequestException('Unsupported file type.');
  }
}
