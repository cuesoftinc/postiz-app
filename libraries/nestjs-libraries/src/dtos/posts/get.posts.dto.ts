import {
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class GetPostsDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  customer: string;

  /** Filter to a single channel (integration id) — powers the sidebar's
   *  per-channel queue view. */
  @IsOptional()
  @IsString()
  integration: string;
}
