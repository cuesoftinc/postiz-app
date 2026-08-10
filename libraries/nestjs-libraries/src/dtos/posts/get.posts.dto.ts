import {
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
} from 'class-validator';
import { PostListStateFilter } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.list.dto';

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

  /** Filter by post state (same semantics as the list view's stateFilter).
   *  Absent or 'all' adds no clause — the calendar keeps returning every
   *  state, including ERROR. */
  @IsOptional()
  @IsIn(['all', 'scheduled', 'draft', 'published'])
  state?: PostListStateFilter;

  /** Comma-separated tag ids; posts matching ANY of the tags are returned. */
  @IsOptional()
  @IsString()
  tags?: string;
}
