import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type PostListStateFilter = 'all' | 'scheduled' | 'draft' | 'published';

export class GetPostsListDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @IsOptional()
  @IsString()
  customer?: string;

  /** Filter to a single channel (integration id). */
  @IsOptional()
  @IsString()
  integration?: string;

  @IsOptional()
  @IsIn(['all', 'scheduled', 'draft', 'published'])
  state?: PostListStateFilter = 'all';

  /** Comma-separated tag ids; posts matching ANY of the tags are returned. */
  @IsOptional()
  @IsString()
  tags?: string;

  /**
   * Undated drafts — posts captured with no slot committed yet.
   *
   * 'exclude' (the default, and what an absent param means) keeps them out of
   * every date-ordered tab, which is both the sane view and the reason a null
   * date can never reach an `orderBy publishDate`. 'only' returns exactly them,
   * newest-created first.
   *
   * Deliberately not a boolean: `undated=false` arriving as the string 'false'
   * is a classic query-string trap, and a gate that reads a truthy 'false' as
   * "show me the undated ones" would be a silent wrong answer.
   */
  @IsOptional()
  @IsIn(['exclude', 'only'])
  undated?: 'exclude' | 'only' = 'exclude';

  /**
   * Restrict to posts the approvals gate has flagged. Reads the needsApproval
   * FIELD, not the 'needs-approval' tag: a tag can be renamed or deleted, and
   * the approvals view must not be disarmable that way.
   */
  @IsOptional()
  @IsIn(['only'])
  needsApproval?: 'only';
}
