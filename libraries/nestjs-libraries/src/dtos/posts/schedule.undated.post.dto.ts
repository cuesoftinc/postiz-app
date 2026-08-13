import { IsDateString, IsDefined, IsIn, IsOptional } from 'class-validator';

/**
 * Promotes an undated draft into a real slot.
 *
 * `date` is @IsDefined on purpose: this route exists precisely to supply the
 * date the post is missing, and an absent one would reach `dayjs(undefined)`,
 * which is NOW — turning "give this draft a slot" into "publish it immediately".
 */
export class ScheduleUndatedPostDto {
  @IsDefined()
  @IsDateString()
  date: string;

  /**
   * 'queue' (the default) schedules the post. 'draft' only pins the date and
   * leaves it a draft, which is what a non-approver gets to do when the org's
   * approvals gate is on: they can propose a slot without publishing into it.
   */
  @IsOptional()
  @IsIn(['queue', 'draft'])
  target?: 'queue' | 'draft' = 'queue';
}
