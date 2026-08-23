import {
  ValidationArguments,
  ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';
import { POSTABLE_MEDIA_EXTENSIONS } from '@gitroom/nestjs-libraries/upload/allowed.mime.types';

@ValidatorConstraint({ name: 'checkValidExtension', async: false })
export class ValidUrlExtension implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    const withoutQuery = text?.split?.('?')?.[0];
    if (!withoutQuery) {
      return false;
    }
    return POSTABLE_MEDIA_EXTENSIONS.some((ext) => withoutQuery.endsWith(ext));
  }

  defaultMessage(args: ValidationArguments) {
    // Derived from the list, so the message can never name a different set of
    // extensions than the one actually enforced.
    const all = POSTABLE_MEDIA_EXTENSIONS;
    return `File must have a valid extension: ${all
      .slice(0, -1)
      .join(', ')}, or ${all[all.length - 1]}`;
  }
}

@ValidatorConstraint({ name: 'checkValidPath', async: false })
export class ValidUrlPath implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    if (!process.env.RESTRICT_UPLOAD_DOMAINS) {
      return true;
    }

    return (
      (text || 'invalid url').indexOf(process.env.RESTRICT_UPLOAD_DOMAINS) > -1
    );
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    return (
      'URL must contain the domain: ' + process.env.RESTRICT_UPLOAD_DOMAINS + ' Make sure you first use the upload API route.'
    );
  }
}
