import { IsBoolean, IsDefined } from 'class-validator';

/**
 * The org-level approvals gate switch.
 *
 * @IsBoolean with no implicit conversion is deliberate: this endpoint decides
 * whether posts can publish without review, and a string 'false' coerced to
 * `true` would silently gate an entire instance (or, worse, ungate one).
 */
export class ApprovalsSettingsDto {
  @IsDefined()
  @IsBoolean()
  requireApproval: boolean;
}
