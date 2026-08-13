import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Post as PostBody } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import {
  APPROVED_SUBMIT_FOR_ORDER,
  CreationMethod,
  Post,
  Prisma,
  State,
} from '@prisma/client';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { GetPostsListDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.list.dto';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import utc from 'dayjs/plugin/utc';
import { v4 as uuidv4 } from 'uuid';
import { CreateTagDto } from '@gitroom/nestjs-libraries/dtos/posts/create.tag.dto';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);

@Injectable()
export class PostsRepository {
  constructor(
    private _post: PrismaRepository<'post'>,
    private _popularPosts: PrismaRepository<'popularPosts'>,
    private _comments: PrismaRepository<'comments'>,
    private _tags: PrismaRepository<'tags'>,
    private _tagsPosts: PrismaRepository<'tagsPosts'>,
    private _errors: PrismaRepository<'errors'>
  ) {}

  searchForMissingThreeHoursPosts() {
    return this._post.model.post.findMany({
      where: {
        integration: {
          refreshNeeded: false,
          inBetweenSteps: false,
          disabled: false,
          deletedAt: null,
        },
        publishDate: {
          gte: dayjs.utc().subtract(2, 'day').toDate(),
          lt: dayjs.utc().toDate(),
        },
        state: 'QUEUE',
        deletedAt: null,
        parentPostId: null,
      },
      select: {
        id: true,
        organizationId: true,
        integration: {
          select: {
            providerIdentifier: true,
          },
        },
        publishDate: true,
      },
    });
  }

  getOldPosts(orgId: string, date: string) {
    return this._post.model.post.findMany({
      where: {
        integration: {
          refreshNeeded: false,
          inBetweenSteps: false,
          disabled: false,
        },
        organizationId: orgId,
        publishDate: {
          lte: dayjs(date).toDate(),
        },
        deletedAt: null,
        parentPostId: null,
      },
      orderBy: {
        publishDate: 'desc',
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        state: true,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            picture: true,
            type: true,
          },
        },
      },
    });
  }

  updateImages(id: string, images: string) {
    return this._post.model.post.update({
      where: {
        id,
      },
      data: {
        image: images,
      },
    });
  }

  getPostUrls(orgId: string, ids: string[]) {
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        releaseURL: true,
      },
    });
  }

  async getPosts(orgId: string, query: GetPostsDto) {
    // Use the provided start and end dates directly
    const startDate = dayjs.utc(query.startDate).toDate();
    const endDate = dayjs.utc(query.endDate).toDate();

    const list = await this._post.model.post.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                organizationId: orgId,
              },
            ],
          },
          // An undated draft has no cell to occupy, so the calendar never shows
          // one — they are reached through getUndatedDrafts instead. This clause
          // is stated explicitly rather than left to the range filter below:
          // `publishDate: { gte, lte }` already drops NULL in SQL, but the
          // second OR branch (repeating posts) does not, so a dateless row with
          // intervalInDays set would otherwise reach the expansion loop below
          // and be silently swallowed by Invalid Date arithmetic.
          {
            publishDate: {
              not: null,
            },
          },
          {
            OR: [
              {
                publishDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              {
                intervalInDays: {
                  not: null,
                },
              },
            ],
          },
        ],
        integration: {
          deletedAt: null,
          organizationId: orgId,
        },
        deletedAt: null,
        parentPostId: null,
        ...(query.customer
          ? {
              integration: {
                customerId: query.customer,
              },
            }
          : {}),
        ...(query.integration
          ? {
              integrationId: query.integration.includes(',')
                ? { in: query.integration.split(',') }
                : query.integration,
            }
          : {}),
        // Additive state filter (same mapping as the list view's stateFilter).
        // Absent or 'all' adds no clause, preserving today's calendar
        // behavior exactly — including ERROR-state posts.
        ...(query.state === 'scheduled'
          ? // 'Scheduled' has to resolve to the same set the list's Queue tab
            // resolves to, QUEUE plus ERROR. The calendar is the view that
            // flags a failure (red ring on the card), so filtering to
            // 'Scheduled' was the one way to make a failed post vanish from it.
            { state: { in: [State.QUEUE, State.ERROR] } }
          : query.state === 'draft'
          ? { state: State.DRAFT }
          : query.state === 'published'
          ? { state: State.PUBLISHED }
          : {}),
        // Additive tag filter: match posts carrying ANY of the given tag ids.
        ...(query.tags
          ? {
              tags: {
                some: {
                  tagId: { in: query.tags.split(',') },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        releaseId: true,
        state: true,
        intervalInDays: true,
        group: true,
        creationMethod: true,
        image: true,
        // The approvals gate's own state, so a card can show "awaiting approval"
        // without having to resolve a tag by name first.
        needsApproval: true,
        // settings carries the composer's per-provider options; the day-view
        // card reads post_type from it to name caption-less posts
        // ('Instagram story') instead of rendering an empty body
        settings: true,
        createdAt: true,
        tags: {
          select: {
            tag: true,
          },
        },
        integration: {
          select: {
            id: true,
            providerIdentifier: true,
            name: true,
            picture: true,
          },
        },
      },
    });

    return list.reduce((all, post) => {
      // Belt and braces against the where-clause above ever being relaxed: the
      // expansion below is date arithmetic, and dayjs turns a null into an
      // Invalid Date that compares false against everything, which would drop
      // the post from the calendar with no error anywhere.
      if (!post.publishDate || !post.intervalInDays) {
        return [...all, post];
      }

      const addMorePosts = [];
      let startingDate = dayjs.utc(post.publishDate);
      while (dayjs.utc(endDate).isSameOrAfter(startingDate)) {
        if (dayjs(startingDate).isSameOrAfter(dayjs.utc(post.publishDate))) {
          addMorePosts.push({
            ...post,
            publishDate: startingDate.toDate(),
            actualDate: post.publishDate,
          });
        }

        startingDate = startingDate.add(post.intervalInDays, 'days');
      }

      return [...all, ...addMorePosts];
    }, [] as any[]);
  }

  async getPostsList(orgId: string, query: GetPostsListDto) {
    const page = query.page || 0;
    const limit = query.limit || 20;
    const skip = page * limit;

    const stateFilter = query.state || 'all';

    // Undated drafts are a view of their own, never rows mixed into a
    // date-ordered tab. 'only' returns exactly them; anything else excludes
    // them, which is what keeps every existing tab byte-identical to before
    // publishDate became nullable AND keeps a null out of the orderBy below.
    const undatedOnly = query.undated === 'only';

    // A post that FAILED to publish used to appear in no tab at all: not in
    // Queue (its date is now in the past), not in Drafts, not in Sent. It only
    // showed on the calendar, so a failure was invisible in the view people
    // actually work from. Failures ride along with the queue — they are the
    // most actionable thing in it — and the date floor below deliberately does
    // not apply to them, since a failure is always in the past.
    const stateAndDate = undatedOnly
      ? // DRAFT is not a filter here so much as an invariant: a post with no
        // date cannot be in any other state, because nothing may enter QUEUE
        // without a date. Stating it keeps a contradictory request
        // (state=scheduled&undated=only) returning an empty page instead of
        // something that implies dateless posts can be queued.
        { state: State.DRAFT }
      : stateFilter === 'scheduled'
      ? {
          state: { in: [State.QUEUE, State.ERROR] },
        }
      : stateFilter === 'draft'
      ? { state: State.DRAFT }
      : stateFilter === 'published'
      ? { state: State.PUBLISHED }
      : {
          state: {
            in: [State.QUEUE, State.DRAFT, State.PUBLISHED, State.ERROR],
          },
        };

    const orderDirection: 'asc' | 'desc' =
      stateFilter === 'published' ? 'desc' : 'asc';

    const where = {
      AND: [
        {
          OR: [
            {
              organizationId: orgId,
            },
          ],
        },
        // This lives in AND rather than as a top-level `publishDate` key because
        // the date floor further down already claims that key for the 'all' and
        // 'scheduled' branches; a second one would just overwrite the first.
        // `not: null` needs the cast: inside a ternary in an array literal there
        // is no contextual type from Prisma's filter, so the bare null widens to
        // an implicit any and noImplicitAny rejects it.
        undatedOnly
          ? { publishDate: null }
          : ({ publishDate: { not: null } } as Prisma.PostWhereInput),
      ],
      ...stateAndDate,
      // The date floor belongs to the queue alone, since the queue is what is
      // still coming. Published posts were already posted and failures are
      // always in the past, which is why the 'scheduled' branch expresses the
      // floor per-state. Drafts carry no floor either: a draft whose slot has
      // elapsed is late, not gone, and the Drafts and Approvals tabs (approvals
      // are drafts carrying the approval tag) exist precisely to review it, so
      // a week of drafts queued for a human must never age out of sight.
      // 'all' keeps the upcoming-only floor it has always had, because no tab
      // asks for it (Queue/Drafts/Approvals/Sent each send an explicit state);
      // it is only the transient default before the list view coerces it.
      // An undated draft is excluded by every form of this floor (NULL fails a
      // `gte` comparison in SQL), so the undated view has to skip it outright
      // rather than filter against a date it does not have.
      ...(undatedOnly ||
      stateFilter === 'published' ||
      stateFilter === 'draft'
        ? {}
        : stateFilter === 'scheduled'
        ? {
            OR: [
              { state: State.QUEUE, publishDate: { gte: dayjs.utc().toDate() } },
              { state: State.ERROR },
            ],
          }
        : { publishDate: { gte: dayjs.utc().toDate() } }),
      deletedAt: null as Date | null,
      parentPostId: null as string | null,
      intervalInDays: null as number | null,

      integration: {
        deletedAt: null as any,
        organizationId: orgId,
        ...(query.customer
          ? {
              customerId: query.customer,
            }
          : {}),
      },
      ...(query.integration
        ? {
            integrationId: query.integration.includes(',')
              ? { in: query.integration.split(',') }
              : query.integration,
          }
        : {}),
      // Additive tag filter: match posts carrying ANY of the given tag ids.
      ...(query.tags
        ? {
            tags: {
              some: {
                tagId: { in: query.tags.split(',') },
              },
            },
          }
        : {}),
      // Approvals feed, read off the field rather than the tag name — see the
      // DTO. Additive, so it composes with state and undated.
      ...(query.needsApproval === 'only' ? { needsApproval: true } : {}),
    };

    const [posts, total] = await Promise.all([
      this._post.model.post.findMany({
        where,
        skip,
        take: limit,
        // Undated drafts cannot be ordered by the date they do not have, and
        // ordering them by publishDate would hand Postgres an all-NULL sort key
        // whose tie-break is arbitrary, so pages would reshuffle between
        // requests and rows could repeat or vanish across page boundaries.
        // createdAt is the meaningful axis for a captured idea, newest first.
        // Every other tab still sorts by publishDate, and cannot see a null one:
        // the AND clause above filters them out, which is what stops a dateless
        // post from sorting as the epoch (asc) or as the far future (desc).
        orderBy: undatedOnly
          ? { createdAt: 'desc' as const }
          : {
              publishDate: orderDirection,
            },
        select: {
          id: true,
          content: true,
          publishDate: true,
          releaseURL: true,
          releaseId: true,
          state: true,
          intervalInDays: true,
          group: true,
          creationMethod: true,
          image: true,
          // The approvals gate's own state, so a card can show "awaiting
          // approval" without having to resolve a tag by name first.
          needsApproval: true,
          // settings carries the composer's per-provider options; the list
          // card reads post_type from it to name caption-less posts
          // ('Instagram story') — the calendar query already selects it,
          // this one had been left behind
          settings: true,
          // the card footer reads 'You created this N ago' from createdAt; with
          // the field absent it fell back to publishDate, so a future-dated
          // queue post claimed it was created days from now
          createdAt: true,
          tags: {
            select: {
              tag: true,
            },
          },
          integration: {
            select: {
              id: true,
              providerIdentifier: true,
              name: true,
              picture: true,
            },
          },
        },
      }),
      this._post.model.post.count({ where }),
    ]);

    return {
      posts,
      total,
      page,
      limit,
      hasMore: skip + posts.length < total,
    };
  }

  async deletePost(orgId: string, group: string) {
    await this._post.model.post.updateMany({
      where: {
        organizationId: orgId,
        group,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return this._post.model.post.findFirst({
      where: {
        organizationId: orgId,
        group,
        parentPostId: null,
      },
      select: {
        id: true,
      },
    });
  }

  getPostsByGroup(orgId: string, group: string) {
    return this._post.model.post.findMany({
      where: {
        group,
        ...(orgId ? { organizationId: orgId } : {}),
        deletedAt: null,
      },
      include: {
        integration: true,
        tags: {
          select: {
            tag: true,
          },
        },
      },
    });
  }

  getPost(
    id: string,
    includeIntegration = false,
    orgId?: string,
    isFirst?: boolean
  ) {
    return this._post.model.post.findUnique({
      where: {
        id,
        ...(orgId ? { organizationId: orgId } : {}),
        deletedAt: null,
      },
      include: {
        ...(includeIntegration
          ? {
              integration: true,
              tags: {
                select: {
                  tag: true,
                },
              },
            }
          : {}),
        childrenPost: true,
      },
    });
  }

  updatePost(id: string, postId: string, releaseURL: string) {
    return this._post.model.post.update({
      where: {
        id,
      },
      data: {
        state: 'PUBLISHED',
        releaseURL,
        releaseId: postId,
      },
    });
  }

  updateReleaseId(id: string, orgId: string, releaseId: string) {
    return this._post.model.post.update({
      where: {
        id,
        organizationId: orgId,
        releaseId: 'missing',
      },
      data: {
        releaseId: String(releaseId),
      },
    });
  }

  async changeState(id: string, state: State, err?: any, body?: any) {
    const update = await this._post.model.post.update({
      where: {
        id,
      },
      data: {
        state,
        ...(err
          ? { error: typeof err === 'string' ? err : JSON.stringify(err) }
          : {}),
      },
      include: {
        integration: {
          select: {
            providerIdentifier: true,
          },
        },
      },
    });

    if (state === 'ERROR' && err && body) {
      try {
        await this._errors.model.errors.create({
          data: {
            message: typeof err === 'string' ? err : JSON.stringify(err),
            organizationId: update.organizationId,
            platform: update.integration.providerIdentifier,
            postId: update.id,
            body: typeof body === 'string' ? body : JSON.stringify(body),
          },
        });
      } catch (err) {}
    }

    return update;
  }

  getErrorsByPostIds(postIds: string[]) {
    return this._errors.model.errors.findMany({
      where: {
        postId: { in: postIds },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async changeDate(
    orgId: string,
    id: string,
    date: string,
    isDraft: boolean,
    action: 'schedule' | 'update' = 'schedule'
  ) {
    return this._post.model.post.update({
      where: {
        organizationId: orgId,
        id,
      },
      data: {
        publishDate: dayjs(date).toDate(),
        // schedule: set state to QUEUE (or DRAFT if it was a draft)
        // update: don't change the state
        ...(action === 'schedule'
          ? {
              state: isDraft ? 'DRAFT' : 'QUEUE',
              releaseId: null,
              releaseURL: null,
            }
          : {}),
      },
    });
  }

  /**
   * Give a post a date and a state in one write. This is the promotion path for
   * an undated draft, kept separate from changeDate because changeDate infers
   * the target state from the current one (a draft stays a draft), which is
   * exactly what a promotion must not do.
   *
   * Reaching QUEUE also clears needsApproval: the post has been approved by
   * whoever was allowed to call this, and it must not keep showing up in the
   * approvals queue afterwards.
   */
  async setDateAndState(
    orgId: string,
    id: string,
    date: string,
    state: State
  ) {
    return this._post.model.post.update({
      where: {
        organizationId: orgId,
        id,
      },
      data: {
        publishDate: dayjs(date).toDate(),
        state,
        releaseId: null,
        releaseURL: null,
        ...(state === State.QUEUE ? { needsApproval: false } : {}),
      },
    });
  }

  /**
   * Clears the approvals flag. Called when a post is moved into QUEUE by an
   * approver: the field is the gate's state, so leaving it raised would keep an
   * already-approved post in the approvals view forever.
   */
  clearNeedsApproval(orgId: string, id: string) {
    return this._post.model.post.update({
      where: {
        organizationId: orgId,
        id,
      },
      data: {
        needsApproval: false,
      },
    });
  }

  /**
   * Finds or creates the org's approval tag by name.
   *
   * The tag is the UI's label for the gate, not the gate itself — but the
   * Approvals tab resolves it by name, and createOrUpdatePost attaches tags by
   * name too, so if the row is missing the gate would still hold (the field is
   * authoritative) while the post showed up unlabelled. Creating it on demand
   * keeps the two in step. Tags carry no unique constraint on (orgId, name),
   * hence findFirst-then-create rather than an upsert.
   */
  async ensureTagByName(orgId: string, name: string, color: string) {
    const existing = await this._tags.model.tags.findFirst({
      where: {
        orgId,
        name,
        deletedAt: null,
      },
    });

    if (existing) {
      return existing;
    }

    return this._tags.model.tags.create({
      data: {
        orgId,
        name,
        color,
      },
    });
  }

  countPostsFromDay(orgId: string, date: Date) {
    return this._post.model.post.count({
      where: {
        organizationId: orgId,
        publishDate: {
          gte: date,
        },
        OR: [
          {
            deletedAt: null,
            state: {
              in: ['QUEUE'],
            },
          },
          {
            state: 'PUBLISHED',
          },
        ],
      },
    });
  }

  async createOrUpdatePost(
    state: 'draft' | 'schedule' | 'now' | 'update',
    orgId: string,
    // null means "undated draft": captured, with no slot committed yet.
    date: string | null,
    body: PostBody,
    tags: { value: string; label: string }[],
    creationMethod: CreationMethod,
    inter?: number,
    // The org's approvals gate, resolved once by the caller. When on, nothing
    // this method writes is allowed to reach QUEUE.
    requireApproval = false
  ) {
    const posts: Post[] = [];
    const uuid = uuidv4();

    const stateFor = (type: 'create' | 'update') => {
      // No date implies not queued, in every case including an edit. The publish
      // workflow's first act is to sleep until publishDate, so a queued row with
      // a null date is not "published early", it is undefined behaviour. This
      // branch is also what stops an edit that clears the date from leaving an
      // existing QUEUE post dateless, since the write below sets publishDate to
      // null unconditionally.
      if (!date) {
        return { state: 'DRAFT' as const };
      }

      if (state !== 'update') {
        return {
          state:
            requireApproval || state === 'draft'
              ? ('DRAFT' as const)
              : ('QUEUE' as const),
        };
      }

      // For a real edit of an existing row the state is deliberately left alone:
      // flipping a PUBLISHED post back to DRAFT because someone fixed a typo
      // would destroy the record of it having gone out. But the 'update' path
      // also CREATES a row whenever the caller passes no id — the upsert below
      // falls through to a fresh uuid — and such a row would take the schema
      // default of QUEUE, walking straight past the gate. So the create half
      // always states a state explicitly.
      return type === 'create' && requireApproval
        ? { state: 'DRAFT' as const }
        : {};
    };

    for (const value of body.value) {
      const updateData = (type: 'create' | 'update') => ({
        publishDate: date ? dayjs(date).toDate() : null,
        // The gate is a field, not a tag: a tag named 'needs-approval' can be
        // renamed or deleted by any user, and the gate must not be disarmable
        // that way. A create states the flag outright; an edit only ever raises
        // it, never clears it, because clearing is what approving does.
        ...(type === 'create'
          ? { needsApproval: requireApproval }
          : requireApproval
          ? { needsApproval: true }
          : {}),
        integration: {
          connect: {
            id: body.integration.id,
            organizationId: orgId,
          },
        },
        ...(posts?.[posts.length - 1]?.id
          ? {
              parentPost: {
                connect: {
                  id: posts[posts.length - 1]?.id,
                },
              },
            }
          : type === 'update'
          ? {
              parentPost: {
                disconnect: true,
              },
            }
          : {}),
        content: value.content,
        delay: value.delay || 0,
        group: uuid,
        intervalInDays: inter ? +inter : null,
        approvedSubmitForOrder: APPROVED_SUBMIT_FOR_ORDER.NO,
        ...(type === 'create' ? { creationMethod } : {}),
        ...stateFor(type),
        image: JSON.stringify(value.image),
        settings: JSON.stringify(body.settings),
        organization: {
          connect: {
            id: orgId,
          },
        },
      });

      posts.push(
        await this._post.model.post.upsert({
          where: {
            id: value.id || uuidv4(),
          },
          create: { ...updateData('create') },
          update: {
            ...updateData('update'),
            lastMessage: {
              disconnect: true,
            },
            submittedForOrder: {
              disconnect: true,
            },
          },
        })
      );

      if (posts.length === 1) {
        await this._tagsPosts.model.tagsPosts.deleteMany({
          where: {
            post: {
              id: posts[0].id,
            },
          },
        });

        if (tags.length) {
          const tagsList = await this._tags.model.tags.findMany({
            where: {
              orgId: orgId,
              name: {
                in: tags.map((tag) => tag.label).filter((f) => f),
              },
            },
          });

          if (tagsList.length) {
            await this._post.model.post.update({
              where: {
                id: posts[posts.length - 1].id,
              },
              data: {
                tags: {
                  createMany: {
                    data: tagsList.map((tag) => ({
                      tagId: tag.id,
                    })),
                  },
                },
              },
            });
          }
        }
      }
    }

    const previousPost = body.group
      ? (
          await this._post.model.post.findFirst({
            where: {
              group: body.group,
              deletedAt: null,
              parentPostId: null,
            },
            select: {
              id: true,
            },
          })
        )?.id!
      : undefined;

    if (body.group) {
      await this._post.model.post.updateMany({
        where: {
          group: body.group,
          deletedAt: null,
        },
        data: {
          parentPostId: null,
          deletedAt: new Date(),
        },
      });
    }

    return { previousPost, posts };
  }

  async submit(id: string, order: string, buyerOrganizationId: string) {
    return this._post.model.post.update({
      where: {
        id,
      },
      data: {
        submittedForOrderId: order,
        approvedSubmitForOrder: 'WAITING_CONFIRMATION',
        submittedForOrganizationId: buyerOrganizationId,
      },
      select: {
        id: true,
        description: true,
        submittedForOrder: {
          select: {
            messageGroupId: true,
          },
        },
      },
    });
  }

  updateMessage(id: string, messageId: string) {
    return this._post.model.post.update({
      where: {
        id,
      },
      data: {
        lastMessageId: messageId,
      },
    });
  }

  getPostById(id: string, org?: string) {
    return this._post.model.post.findUnique({
      where: {
        id,
        ...(org ? { organizationId: org } : {}),
      },
      include: {
        integration: true,
        submittedForOrder: {
          include: {
            posts: {
              where: {
                state: 'PUBLISHED',
              },
            },
            ordersItems: true,
            seller: {
              select: {
                id: true,
                account: true,
              },
            },
          },
        },
      },
    });
  }

  findAllExistingCategories() {
    return this._popularPosts.model.popularPosts.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
    });
  }

  findAllExistingTopicsOfCategory(category: string) {
    return this._popularPosts.model.popularPosts.findMany({
      where: {
        category,
      },
      select: {
        topic: true,
      },
      distinct: ['topic'],
    });
  }

  findPopularPosts(category: string, topic?: string) {
    return this._popularPosts.model.popularPosts.findMany({
      where: {
        category,
        ...(topic ? { topic } : {}),
      },
      select: {
        content: true,
        hook: true,
      },
    });
  }

  createPopularPosts(post: {
    category: string;
    topic: string;
    content: string;
    hook: string;
  }) {
    return this._popularPosts.model.popularPosts.create({
      data: {
        category: 'category',
        topic: 'topic',
        content: 'content',
        hook: 'hook',
      },
    });
  }

  async getPostsCountsByDates(
    orgId: string,
    times: number[],
    date: dayjs.Dayjs
  ) {
    const dates = await this._post.model.post.findMany({
      where: {
        deletedAt: null,
        organizationId: orgId,
        publishDate: {
          in: times.map((time) => {
            return date.clone().add(time, 'minutes').toDate();
          }),
        },
      },
    });

    return times.filter(
      (time) =>
        date.clone().add(time, 'minutes').isAfter(dayjs.utc()) &&
        !dates.find((dateFind) => {
          // The `in` filter above cannot match a NULL, so this is defensive
          // only — but dayjs.utc(null) is an Invalid Date whose diff is NaN, and
          // NaN == time is false, which would quietly report an occupied slot as
          // free. Stating the guard is cheaper than relying on that.
          if (!dateFind.publishDate) {
            return false;
          }

          return (
            dayjs
              .utc(dateFind.publishDate)
              .diff(date.clone().startOf('day'), 'minutes') == time
          );
        })
    );
  }

  async getComments(postId: string) {
    return this._comments.model.comments.findMany({
      where: {
        postId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getCommentsWithUser(orgId: string, postId: string) {
    return this._comments.model.comments.findMany({
      where: {
        postId,
        organizationId: orgId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async getTags(orgId: string) {
    return this._tags.model.tags.findMany({
      where: {
        orgId,
        deletedAt: null,
      },
    });
  }

  createTag(orgId: string, body: CreateTagDto) {
    return this._tags.model.tags.create({
      data: {
        orgId,
        name: body.name,
        color: body.color,
      },
    });
  }

  editTag(id: string, orgId: string, body: CreateTagDto) {
    return this._tags.model.tags.update({
      where: {
        id,
      },
      data: {
        name: body.name,
        color: body.color,
      },
    });
  }

  deleteTag(id: string, orgId: string) {
    return this._tags.model.tags.update({
      where: {
        id,
        orgId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  createComment(
    orgId: string,
    userId: string,
    postId: string,
    content: string
  ) {
    return this._comments.model.comments.create({
      data: {
        organizationId: orgId,
        userId,
        postId,
        content,
      },
    });
  }

  async getPostByForWebhookId(postId: string) {
    return this._post.model.post.findMany({
      where: {
        id: postId,
        deletedAt: null,
        parentPostId: null,
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        state: true,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            picture: true,
            type: true,
          },
        },
      },
    });
  }

  async getPostsSince(orgId: string, since: string) {
    return this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        publishDate: {
          gte: new Date(since),
        },
        deletedAt: null,
        parentPostId: null,
      },
      select: {
        id: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        state: true,
        integration: {
          select: {
            id: true,
            name: true,
            providerIdentifier: true,
            picture: true,
            type: true,
          },
        },
      },
    });
  }
}
