import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { PostsRepository } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import dayjs from 'dayjs';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import {
  Integration,
  Post,
  Media,
  From,
  CreationMethod,
  Role,
  State,
} from '@prisma/client';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { GetPostsListDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.list.dto';
import { shuffle } from 'lodash';
import { CreateGeneratedPostsDto } from '@gitroom/nestjs-libraries/dtos/generator/create.generated.posts.dto';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import utc from 'dayjs/plugin/utc';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ShortLinkService } from '@gitroom/nestjs-libraries/short-linking/short.link.service';
import { CreateTagDto } from '@gitroom/nestjs-libraries/dtos/posts/create.tag.dto';
import {
  minifyPostsList,
  minifyPosts,
} from '@gitroom/helpers/utils/posts.list.minify';
import axios from 'axios';
import sharp from 'sharp';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { Readable } from 'stream';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
dayjs.extend(utc);
import * as Sentry from '@sentry/nestjs';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import {
  organizationId,
  postId as postIdSearchParam,
} from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { AnalyticsData } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { stripLinks } from '@gitroom/helpers/utils/strip.links';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { weightedLength } from '@gitroom/helpers/utils/count.length';

type PostWithConditionals = Post & {
  integration?: Integration;
  childrenPost: Post[];
};

/**
 * The org tag that labels a post awaiting approval. The tag is the UI's label
 * only — Post.needsApproval is the rule the server enforces — but the Approvals
 * tab resolves this exact name (see calendar.context.tsx APPROVAL_TAG_NAME), so
 * the two must agree.
 */
export const APPROVAL_TAG_NAME = 'needs-approval';
const APPROVAL_TAG_COLOR = '#B191FF';

/**
 * Who may move a post into QUEUE when the org's approvals gate is on.
 *
 * USER is deliberately excluded and undefined is deliberately excluded: an
 * unknown role is not an approver. This is the whole authorization surface of
 * the gate, so it fails closed.
 */
const APPROVER_ROLES: ReadonlyArray<Role> = [Role.SUPERADMIN, Role.ADMIN];

export const isApproverRole = (role?: Role | null): boolean =>
  !!role && APPROVER_ROLES.includes(role);

/**
 * How far ahead the next-free-slot search may walk before it gives up.
 *
 * The search advances one day per DATABASE QUERY, so this is a cost ceiling as
 * much as a termination guard: a year of queries to answer one composer click
 * is not a better outcome than an error. Two months is far past any real
 * posting queue, and an org whose next sixty days are solid has a scheduling
 * problem the answer to which is not "keep looking".
 */
const MAX_FIND_SLOT_DAYS = 60;

@Injectable()
export class PostsService {
  private storage = UploadFactory.createStorage();
  constructor(
    private _postRepository: PostsRepository,
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _mediaService: MediaService,
    private _shortLinkService: ShortLinkService,
    private _openaiService: OpenaiService,
    private _temporalService: TemporalService,
    private _refreshIntegrationService: RefreshIntegrationService,
    // Reads the org's approvals gate. OrganizationRepository is already a
    // provider on the @Global() DatabaseModule alongside this service, so this
    // needs no module change, and it depends only on PrismaRepository — no cycle
    // back to PostsService.
    private _organizationRepository: OrganizationRepository
  ) {}

  searchForMissingThreeHoursPosts() {
    return this._postRepository.searchForMissingThreeHoursPosts();
  }

  updatePost(id: string, postId: string, releaseURL: string) {
    return this._postRepository.updatePost(id, postId, releaseURL);
  }

  async getMissingContent(
    orgId: string,
    postId: string,
    forceRefresh = false
  ): Promise<{ id: string; url: string }[]> {
    const post = await this._postRepository.getPostById(postId, orgId);
    if (!post || post.releaseId !== 'missing') {
      return [];
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );

    if (!integrationProvider.missing) {
      return [];
    }

    const getIntegration = post.integration!;

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(
        getIntegration
      );
      if (!data) {
        return [];
      }

      const { accessToken } = data;

      if (accessToken) {
        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this._integrationService.disconnectChannel(orgId, getIntegration);
        return [];
      }
    }

    try {
      return await integrationProvider.missing(
        getIntegration.internalId,
        getIntegration.token
      );
    } catch (e) {
      console.log(e);
      if (e instanceof RefreshToken) {
        return this.getMissingContent(orgId, postId, true);
      }
    }

    return [];
  }

  async getPostById(postId: string, orgId: string) {
    return this._postRepository.getPostById(postId, orgId);
  }

  async updateReleaseId(orgId: string, postId: string, releaseId: string) {
    return this._postRepository.updateReleaseId(postId, orgId, releaseId);
  }

  async checkPostAnalytics(
    orgId: string,
    postId: string,
    date: number,
    forceRefresh = false
  ): Promise<AnalyticsData[] | { missing: true }> {
    const post = await this._postRepository.getPostById(postId, orgId);
    if (!post || !post.releaseId) {
      return [];
    }

    if (post.releaseId === 'missing') {
      return { missing: true };
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      post.integration.providerIdentifier
    );

    if (!integrationProvider.postAnalytics) {
      return [];
    }

    const getIntegration = post.integration!;

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(
        getIntegration
      );
      if (!data) {
        return [];
      }

      const { accessToken } = data;

      if (accessToken) {
        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this._integrationService.disconnectChannel(orgId, getIntegration);
        return [];
      }
    }

    // const getIntegrationData = await ioRedis.get(
    //   `integration:${orgId}:${post.id}:${date}`
    // );
    // if (getIntegrationData) {
    //   return JSON.parse(getIntegrationData);
    // }

    try {
      const loadAnalytics = await integrationProvider.postAnalytics(
        getIntegration.internalId,
        getIntegration.token,
        post.releaseId,
        date
      );
      await ioRedis.set(
        `integration:${orgId}:${post.id}:${date}`,
        JSON.stringify(loadAnalytics),
        'EX',
        !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
          ? 1
          : 3600
      );
      return loadAnalytics;
    } catch (e) {
      console.log(e);
      if (e instanceof RefreshToken) {
        return this.checkPostAnalytics(orgId, postId, date, true);
      }
    }

    return [];
  }

  async getStatistics(orgId: string, id: string) {
    const getPost = await this.getPostsRecursively(id, true, orgId, true);
    const content = getPost.map((p) => p.content);
    const shortLinksTracking = await this._shortLinkService.getStatistics(
      content
    );

    return {
      clicks: shortLinksTracking,
    };
  }

  async mapTypeToPost(
    body: CreatePostDto,
    organization: string,
    replaceDraft: boolean = false
  ): Promise<CreatePostDto> {
    if (!body?.posts?.every((p) => p?.integration?.id)) {
      throw new BadRequestException('All posts must have an integration id');
    }

    const mappedValues = {
      ...body,
      type: replaceDraft ? 'schedule' : body?.type,
      posts: await Promise.all(
        body?.posts?.map(async (post) => {
          const integration = await this._integrationService.getIntegrationById(
            organization,
            post.integration.id
          );

          if (!integration) {
            throw new BadRequestException(
              `Integration with id ${post.integration.id} not found`
            );
          }

          return {
            type: replaceDraft ? 'schedule' : body?.type,
            ...post,
            settings: {
              ...(post.settings || ({} as any)),
              __type: integration.providerIdentifier,
            },
          };
        }) || []
      ),
    };

    const validationPipe = new ValidationPipe({
      skipMissingProperties: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });

    return await validationPipe.transform(mappedValues, {
      type: 'body',
      metatype: CreatePostDto,
    });
  }

  async getPostsRecursively(
    id: string,
    includeIntegration = false,
    orgId?: string,
    isFirst?: boolean
  ): Promise<PostWithConditionals[]> {
    const post = await this._postRepository.getPost(
      id,
      includeIntegration,
      orgId,
      isFirst
    );

    if (!post) {
      return [];
    }

    return [
      post!,
      ...(post?.childrenPost?.length
        ? await this.getPostsRecursively(
            post?.childrenPost?.[0]?.id,
            false,
            orgId,
            false
          )
        : []),
    ];
  }

  async getPosts(orgId: string, query: GetPostsDto) {
    return this._postRepository.getPosts(orgId, query);
  }

  async getPostsMinified(orgId: string, query: GetPostsDto) {
    return minifyPosts({
      posts: await this._postRepository.getPosts(orgId, query),
    });
  }

  async getPostsList(orgId: string, query: GetPostsListDto) {
    return minifyPostsList(
      await this._postRepository.getPostsList(orgId, query)
    );
  }

  async updateMedia(id: string, imagesList: any[], convertToJPEG = false) {
    try {
      let imageUpdateNeeded = false;
      const getImageList = await Promise.all(
        (
          await Promise.all(
            (imagesList || []).map(async (p: any) => {
              if (!p.path && p.id) {
                imageUpdateNeeded = true;
                return this._mediaService.getMediaById(p.id);
              }

              return p;
            })
          )
        )
          .map((m) => {
            return {
              ...m,
              url:
                m.path.indexOf('http') === -1
                  ? process.env.FRONTEND_URL +
                    '/' +
                    process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY +
                    m.path
                  : m.path,
              type: 'image',
              path:
                m.path.indexOf('http') === -1
                  ? process.env.UPLOAD_DIRECTORY + m.path
                  : m.path,
            };
          })
          .map(async (m) => {
            if (!convertToJPEG) {
              return m;
            }

            if (hasExtension(m.path, 'png')) {
              imageUpdateNeeded = true;
              const response = await axios.get(m.url, {
                responseType: 'arraybuffer',
              });

              const imageBuffer = Buffer.from(response.data);

              // Use sharp to get the metadata of the image
              const buffer = await sharp(imageBuffer)
                .jpeg({ quality: 100 })
                .toBuffer();

              const { path, originalname } = await this.storage.uploadFile({
                buffer,
                mimetype: 'image/jpeg',
                size: buffer.length,
                path: '',
                fieldname: '',
                destination: '',
                stream: new Readable(),
                filename: '',
                originalname: '',
                encoding: '',
              });

              return {
                ...m,
                name: originalname,
                url:
                  path.indexOf('http') === -1
                    ? process.env.FRONTEND_URL +
                      '/' +
                      process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY +
                      path
                    : path,
                type: 'image',
                path:
                  path.indexOf('http') === -1
                    ? process.env.UPLOAD_DIRECTORY + path
                    : path,
              };
            }

            return m;
          })
      );

      if (imageUpdateNeeded) {
        await this._postRepository.updateImages(
          id,
          JSON.stringify(getImageList)
        );
      }

      return getImageList;
    } catch (err: any) {
      return imagesList;
    }
  }

  async getPostGroupDebugExport(orgId: string, group: string) {
    const loadAll = await this._postRepository.getPostsByGroup(orgId, group);
    const errors = await this._postRepository.getErrorsByPostIds(
      loadAll.map((p) => p.id)
    );
    const posts = this.arrangePostsByGroup(loadAll, undefined);
    const rootPost = posts[0] as any;

    return {
      type: 'draft' as const,
      shortLink: false,
      // An undated draft has no date to export, and this used to be an
      // unconditional .toISOString() — a hard TypeError the moment publishDate
      // became nullable. null is the honest value: the export's type is 'draft',
      // and a draft is exactly what is allowed to have no date, so re-importing
      // this payload reproduces an undated draft rather than inventing a slot.
      date: rootPost.publishDate
        ? rootPost.publishDate.toISOString()
        : null,
      tags:
        rootPost.tags?.map((t: any) => ({
          value: t.tag.id,
          label: t.tag.name,
        })) || [],
      posts: [
        {
          integration: { id: 'REPLACE_WITH_LOCAL_INTEGRATION_ID' },
          group: rootPost.group,
          settings: JSON.parse(rootPost.settings || '{}'),
          value: posts.map((post) => ({
            content: post.content,
            image: JSON.parse(post.image || '[]'),
            delay: post.delay || 0,
          })),
        },
      ],
      _debug: {
        providerIdentifier: rootPost.integration?.providerIdentifier,
        providerName: rootPost.integration?.name,
        state: rootPost.state,
        error: rootPost.error,
        errors: errors.map((e) => ({
          message: e.message,
          platform: e.platform,
          body: e.body,
          createdAt: e.createdAt,
        })),
        originalGroup: group,
        originalPublishDate: rootPost.publishDate,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  async getPostsByGroup(orgId: string, group: string) {
    const convertToJPEG = false;
    const loadAll = await this._postRepository.getPostsByGroup(orgId, group);
    const posts = this.arrangePostsByGroup(loadAll, undefined);

    return {
      group: posts?.[0]?.group,
      posts: await Promise.all(
        (posts || []).map(async (post) => ({
          ...post,
          image: await this.updateMedia(
            post.id,
            JSON.parse(post.image || '[]'),
            convertToJPEG
          ),
        }))
      ),
      integrationPicture: posts[0]?.integration?.picture,
      integration: posts[0].integrationId,
      settings: JSON.parse(posts[0].settings || '{}'),
    };
  }

  arrangePostsByGroup(all: any, parent?: string): PostWithConditionals[] {
    const findAll = all
      .filter((p: any) =>
        !parent ? !p.parentPostId : p.parentPostId === parent
      )
      .map(({ integration, ...all }: any) => ({
        ...all,
        ...(!parent ? { integration } : {}),
      }));

    return [
      ...findAll,
      ...(findAll.length
        ? findAll.flatMap((p: any) => this.arrangePostsByGroup(all, p.id))
        : []),
    ];
  }

  async getPost(orgId: string, id: string, convertToJPEG = false) {
    const posts = await this.getPostsRecursively(id, true, orgId, true);
    const list = {
      group: posts?.[0]?.group,
      posts: await Promise.all(
        (posts || []).map(async (post) => ({
          ...post,
          image: await this.updateMedia(
            post.id,
            JSON.parse(post.image || '[]'),
            convertToJPEG
          ),
        }))
      ),
      integrationPicture: posts[0]?.integration?.picture,
      integration: posts[0].integrationId,
      settings: JSON.parse(posts[0].settings || '{}'),
    };

    return list;
  }

  async getOldPosts(orgId: string, date: string) {
    return this._postRepository.getOldPosts(orgId, date);
  }

  public async updateTags(orgId: string, post: Post[]): Promise<Post[]> {
    const plainText = JSON.stringify(post);
    const extract = Array.from(
      plainText.match(/\(post:[a-zA-Z0-9-_]+\)/g) || []
    );
    if (!extract.length) {
      return post;
    }

    const ids = (extract || []).map((e) =>
      e.replace('(post:', '').replace(')', '')
    );
    const urls = await this._postRepository.getPostUrls(orgId, ids);
    const newPlainText = ids.reduce((acc, value) => {
      const findUrl = urls?.find?.((u) => u.id === value)?.releaseURL || '';
      return acc.replace(
        new RegExp(`\\(post:${value}\\)`, 'g'),
        findUrl.split(',')[0]
      );
    }, plainText);

    return this.updateTags(orgId, JSON.parse(newPlainText) as Post[]);
  }

  public async checkInternalPlug(
    integration: Integration,
    orgId: string,
    id: string,
    settings: any
  ) {
    const plugs = Object.entries(settings).filter(([key]) => {
      return key.indexOf('plug-') > -1;
    });

    if (plugs.length === 0) {
      return [];
    }

    const parsePlugs = plugs.reduce((all, [key, value]) => {
      const [_, name, identifier] = key.split('--');
      all[name] = all[name] || { name };
      all[name][identifier] = value;
      return all;
    }, {} as any);

    const list: {
      name: string;
      integrations: { id: string }[];
      delay: string;
      active: boolean;
    }[] = Object.values(parsePlugs);

    return (list || []).flatMap((trigger) => {
      return (trigger?.integrations || []).flatMap((int) => ({
        type: 'internal-plug',
        post: id,
        originalIntegration: integration.id,
        integration: int.id,
        plugName: trigger.name,
        orgId: orgId,
        delay: +trigger.delay,
        information: trigger,
      }));
    });
  }

  public async checkPlugs(
    orgId: string,
    providerName: string,
    integrationId: string
  ) {
    const loadAllPlugs = this._integrationManager.getAllPlugs();
    const getPlugs = await this._integrationService.getPlugs(
      orgId,
      integrationId
    );

    const currentPlug = loadAllPlugs.find((p) => p.identifier === providerName);

    return getPlugs
      .filter((plug) => {
        return currentPlug?.plugs?.some(
          (p: any) => p.methodName === plug.plugFunction
        );
      })
      .map((plug) => {
        const runPlug = currentPlug?.plugs?.find(
          (p: any) => p.methodName === plug.plugFunction
        )!;
        return {
          type: 'global',
          plugId: plug.id,
          delay: runPlug.runEveryMilliseconds,
          totalRuns: runPlug.totalRuns,
        };
      });
  }

  async deletePost(orgId: string, group: string) {
    const post = await this._postRepository.deletePost(orgId, group);

    if (post?.id) {
      try {
        const workflows = this._temporalService.client
          .getRawClient()
          ?.workflow.list({
            query: `postId="${post.id}" AND ExecutionStatus="Running"`,
          });

        for await (const executionInfo of workflows) {
          try {
            const workflow =
              await this._temporalService.client.getWorkflowHandle(
                executionInfo.workflowId
              );
            if (
              workflow &&
              (await workflow.describe()).status.name !== 'TERMINATED'
            ) {
              await workflow.terminate();
            }
          } catch (err) {}
        }
      } catch (err) {}
    }

    return { error: true };
  }

  async countPostsFromDay(orgId: string, date: Date) {
    return this._postRepository.countPostsFromDay(orgId, date);
  }

  getPostByForWebhookId(id: string) {
    return this._postRepository.getPostByForWebhookId(id);
  }

  async startWorkflow(
    taskQueue: string,
    postId: string,
    orgId: string,
    state: State
  ) {
    try {
      const workflows = this._temporalService.client
        .getRawClient()
        ?.workflow.list({
          query: `postId="${postId}" AND ExecutionStatus="Running"`,
        });

      for await (const executionInfo of workflows) {
        try {
          const workflow = await this._temporalService.client.getWorkflowHandle(
            executionInfo.workflowId
          );
          if (
            workflow &&
            (await workflow.describe()).status.name !== 'TERMINATED'
          ) {
            await workflow.terminate();
          }
        } catch (err) {}
      }
    } catch (err) {}

    if (state === 'DRAFT') {
      return;
    }

    try {
      await this._temporalService.client
        .getRawClient()
        ?.workflow.start('postWorkflowV106', {
          workflowId: `post_${postId}`,
          taskQueue: 'main',
          workflowIdConflictPolicy: 'TERMINATE_EXISTING',
          args: [
            {
              taskQueue: taskQueue,
              postId: postId,
              organizationId: orgId,
            },
          ],
          typedSearchAttributes: new TypedSearchAttributes([
            {
              key: postIdSearchParam,
              value: postId,
            },
            {
              key: organizationId,
              value: orgId,
            },
          ]),
        });
    } catch (err) {}
  }

  /**
   * Server-side validation that used to live on the client (`checkValidity` +
   * the manage modal loop). Runs the provider's settings DTO validation, the
   * provider `checkValidity` (media rules) and the empty-content / too-long
   * character checks. Returns one result per post so the frontend can show the
   * same toasts it did before — and so `/posts` can refuse to create invalid
   * posts.
   */
  async validatePosts(
    orgId: string,
    posts: Array<{
      integration: { id: string };
      value: Array<{
        content?: string;
        image?: Array<{ path: string; thumbnail?: string }>;
      }>;
      settings?: any;
    }>
  ) {
    return Promise.all(
      (posts || []).map(async (post) => {
        const integration = await this._integrationService.getIntegrationById(
          orgId,
          post?.integration?.id
        );

        if (!integration) {
          throw new BadRequestException(
            `Integration with id ${post?.integration?.id} not found`
          );
        }

        const provider = this._integrationManager.getSocialIntegration(
          integration.providerIdentifier
        );

        let additionalSettings: any[] = [];
        try {
          additionalSettings = JSON.parse(
            integration.additionalSettings || '[]'
          );
        } catch {
          additionalSettings = [];
        }

        const settings = post.settings || {};
        const media = (post.value || []).map((p) => p.image || []);

        // Settings DTO validation — mirrors the client `form.trigger()`.
        let valid = true;
        let settingsError = '';
        if (provider?.dto) {
          const instance = plainToInstance(provider.dto, settings, {
            enableImplicitConversion: false,
          });
          const validationErrors = await validate(instance as object, {
            skipMissingProperties: false,
          });
          settingsError = this.firstValidationError(validationErrors);
          valid = validationErrors.length === 0;
        }

        // Provider-specific media validation (the old client `checkValidity`).
        let errors: string | true = true;
        try {
          errors = await provider.checkValidity(
            media,
            settings,
            additionalSettings
          );
        } catch (err: any) {
          errors = err?.message || 'Invalid media';
        }

        const maximumCharacters = provider.maxLength(additionalSettings);
        const isX = integration.providerIdentifier === 'x';

        const emptyContent = (post.value || []).some((a) => {
          const strip = stripHtmlValidation('normal', a.content || '', true);
          const length = isX ? weightedLength(strip) : strip.length;
          return length === 0 && (a.image || []).length === 0;
        });

        const tooLong = (post.value || []).some((a) => {
          const strip = stripHtmlValidation('normal', a.content || '', true);
          const weighted = isX ? weightedLength(strip) : strip.length;
          const totalCharacters =
            weighted > strip.length ? weighted : strip.length;
          return totalCharacters > (maximumCharacters || 1000000);
        });

        return {
          id: integration.id,
          identifier: integration.providerIdentifier,
          name: integration.name,
          valid,
          settingsError,
          errors,
          emptyContent,
          tooLong,
          maximumCharacters,
        };
      })
    );
  }

  /** Returns the first class-validator message (incl. nested children), or ''. */
  private firstValidationError(errors: any[]): string {
    for (const e of errors || []) {
      if (e?.constraints) {
        return Object.values(e.constraints as Record<string, string>)[0] || '';
      }
      const child = e?.children?.length
        ? this.firstValidationError(e.children)
        : '';
      if (child) {
        return child;
      }
    }
    return '';
  }

  /**
   * Resolves the org's approvals gate and, when it is on, rewrites the request
   * so that nothing can be created live.
   *
   * This sits in the service rather than on a route decorator on purpose. The
   * obvious-looking home would be @CheckPolicies, but PermissionsService.check()
   * short-circuits and grants every requested permission when
   * STRIPE_PUBLISHABLE_KEY is unset (permissions.service.ts:52-67), which is the
   * case in this deployment — so a policy-based gate would be a no-op today and
   * would silently start enforcing the day billing is switched on. Enforcing
   * here means every caller of createPost is gated: the composer's POST /posts,
   * the public API's POST /public/v1/posts, and anything added later, because
   * they all funnel through this one method.
   */
  private async applyApprovalGate(
    orgId: string,
    body: CreatePostDto
  ): Promise<{ requireApproval: boolean; type: CreatePostDto['type'] }> {
    const requireApproval =
      await this._organizationRepository.getRequireApproval(orgId);

    if (!requireApproval) {
      return { requireApproval, type: body.type };
    }

    // 'update' keeps its type because it edits an existing post, whose state
    // must be left alone — reverting a PUBLISHED post to DRAFT over a typo fix
    // would destroy the record of it having gone out. The repository still
    // refuses to let the 'update' path CREATE a live row (see stateFor there),
    // so this is not a hole.
    const type = body.type === 'update' ? body.type : ('draft' as const);

    // Keep the tag in step with the field. The field is what the server
    // enforces, but the Approvals tab resolves this tag by name, so a gated post
    // with no such tag row would sit in the approvals feed unlabelled.
    const tag = await this._postRepository.ensureTagByName(
      orgId,
      APPROVAL_TAG_NAME,
      APPROVAL_TAG_COLOR
    );

    const alreadyTagged = (body.tags || []).some(
      (t) => t?.label === APPROVAL_TAG_NAME
    );

    if (!alreadyTagged) {
      // createOrUpdatePost attaches tags by matching `label` against tag names,
      // so the label is the load-bearing half here.
      body.tags = [
        ...(body.tags || []),
        { value: tag.id, label: APPROVAL_TAG_NAME },
      ];
    }

    return { requireApproval, type };
  }

  async createPost(
    orgId: string,
    body: CreatePostDto,
    creationMethod: CreationMethod
  ): Promise<any[]> {
    // Resolved once per request, before the loop: one query, and every post in
    // the batch is gated identically even if the flag were flipped mid-request.
    const { requireApproval, type } = await this.applyApprovalGate(orgId, body);

    // Derived from the ORIGINAL type, not the gated one. A 'now' post that the
    // gate turned into a draft still records the slot it asked for, so approving
    // it publishes at that moment rather than at some other one. A draft with no
    // date at all stays dateless — that is the undated-draft feature.
    const date =
      body.type === 'now'
        ? dayjs().format('YYYY-MM-DDTHH:mm:00')
        : body.date ?? null;

    const postList = [];
    for (const post of body.posts) {
      const provider = this._integrationManager.getSocialIntegration(
        (post.settings as any)?.__type
      );
      const removeLinks = !!provider?.stripLinks?.();

      const messages = (post.value || []).map((p) => p.content);
      // No point shortlinking links on platforms that strip them out anyway
      const updateContent =
        !body.shortLink || removeLinks
          ? messages
          : await this._shortLinkService.convertTextToShortLinks(
              orgId,
              messages
            );

      post.value = (post.value || []).map((p, i) => ({
        ...p,
        content: removeLinks ? stripLinks(updateContent[i]) : updateContent[i],
      }));

      const { posts } = await this._postRepository.createOrUpdatePost(
        type,
        orgId,
        date,
        post,
        body.tags,
        creationMethod,
        body.inter,
        requireApproval
      );

      if (!posts?.length) {
        return [] as any[];
      }

      if (body.type !== 'update') {
        this.startWorkflow(
          post.settings.__type.split('-')[0].toLowerCase(),
          posts[0].id,
          orgId,
          posts[0].state
        ).catch((err) => {});
      }

      Sentry.metrics.count('post_created', 1);
      postList.push({
        postId: posts[0].id,
        integration: post.integration.id,
      });
    }

    return postList;
  }

  async separatePosts(content: string, len: number) {
    return this._openaiService.separatePosts(content, len);
  }

  async changeState(id: string, state: State, err?: any, body?: any) {
    return this._postRepository.changeState(id, state, err, body);
  }

  /**
   * The approvals gate on the way into QUEUE. Every transition that results in a
   * queued post goes through here.
   *
   * Takes the actor's user id, not their role, so the role lookup only happens
   * when the gate is actually on. With the gate off — the default, and the
   * owner's single-operator setup — this costs one indexed read of the org flag
   * and nothing else, so dragging a card around the calendar does not pay for a
   * feature nobody switched on.
   *
   * The role is then read from the membership row rather than off
   * req.org.users[0], because that array is shaped differently depending on which
   * middleware filled it in: auth.middleware.ts:88-108 puts the real
   * UserOrganization there, while public.auth.middleware.ts:39,57 fabricates a
   * nested `{ users: { role } }` whose `.role` reads undefined. A null or
   * unknown role is not an approver, so machine callers (the public API,
   * pipelines, agent tools) cannot self-approve — they queue drafts and a human
   * releases them, which is the reason to turn the gate on at all.
   */
  private async assertMayEnterQueue(
    orgId: string,
    actorUserId?: string | null
  ) {
    const requireApproval =
      await this._organizationRepository.getRequireApproval(orgId);

    if (!requireApproval) {
      return;
    }

    const role = actorUserId
      ? await this._organizationRepository.getUserRoleInOrg(orgId, actorUserId)
      : null;

    if (!isApproverRole(role)) {
      throw new ForbiddenException(
        'This organization requires approval before a post can be scheduled. An admin has to approve it.'
      );
    }
  }

  /**
   * Nothing may be queued without a date. The publish workflow's first act is to
   * sleep until publishDate (post.workflow.v1.0.6.ts:132-138); handed a null it
   * would compute a NaN delay from an Invalid Date, so an undated post entering
   * the queue is not "published early", it is undefined behaviour. This is the
   * guard that makes an undated draft unpublishable by construction.
   */
  private assertHasPublishDate(post: { publishDate: Date | null }) {
    if (!post.publishDate) {
      throw new BadRequestException(
        'This draft has no date yet. Give it a date before scheduling it.'
      );
    }
  }

  async changePostStatus(
    orgId: string,
    id: string,
    status: 'draft' | 'schedule',
    actorUserId?: string | null
  ) {
    const getPostById = await this._postRepository.getPostById(id, orgId);
    if (!getPostById) {
      throw new BadRequestException('Post not found');
    }

    const state: State = status === 'draft' ? 'DRAFT' : 'QUEUE';

    // Both checks run before anything is written. Moving a post back to DRAFT is
    // never gated — un-scheduling is the safe direction, and blocking it would
    // trap a post nobody can pull back.
    if (state === State.QUEUE) {
      this.assertHasPublishDate(getPostById);
      await this.assertMayEnterQueue(orgId, actorUserId);
    }

    await this._postRepository.changeState(id, state);

    // Reaching QUEUE is what approval means, so the flag comes down with it.
    // Otherwise an approved post would sit in the approvals feed forever.
    if (state === State.QUEUE && getPostById.needsApproval) {
      await this._postRepository.clearNeedsApproval(orgId, id);
    }

    try {
      await this.startWorkflow(
        getPostById.integration.providerIdentifier.split('-')[0].toLowerCase(),
        getPostById.id,
        orgId,
        state
      );
    } catch (err) {}

    return { id, state };
  }

  async changeDate(
    orgId: string,
    id: string,
    date: string,
    action: 'schedule' | 'update' = 'schedule',
    actorUserId?: string | null
  ) {
    // Checked first, before any database work: this route takes its date from a
    // raw @Body('date') with no DTO behind it, and `dayjs(undefined)` is NOW, so
    // an absent one would schedule the post immediately instead of failing.
    if (!date || !dayjs(date).isValid()) {
      throw new BadRequestException('A valid date is required.');
    }

    const getPostById = await this._postRepository.getPostById(id, orgId);

    if (!getPostById) {
      throw new BadRequestException('Post not found');
    }

    // Verified rather than assumed: this route does NOT flip DRAFT to QUEUE. The
    // repository sets `state: isDraft ? 'DRAFT' : 'QUEUE'`, so a draft dragged
    // around the calendar stays a draft. What it does do is re-queue an ERROR or
    // PUBLISHED post, which is a transition into QUEUE and so is gated.
    const willEnterQueue =
      action === 'schedule' &&
      getPostById.state !== State.DRAFT &&
      getPostById.state !== State.QUEUE;

    if (willEnterQueue) {
      await this.assertMayEnterQueue(orgId, actorUserId);
    }

    // schedule: Set status to QUEUE and change date (reschedule the post)
    // update: Just change the date without changing the status
    const newDate = await this._postRepository.changeDate(
      orgId,
      id,
      date,
      getPostById.state === 'DRAFT',
      action
    );

    if (action === 'schedule') {
      try {
        await this.startWorkflow(
          getPostById.integration.providerIdentifier
            .split('-')[0]
            .toLowerCase(),
          getPostById.id,
          orgId,
          getPostById.state === 'DRAFT' ? 'DRAFT' : 'QUEUE'
        );
      } catch (err) {}
    }

    return newDate;
  }

  /**
   * The undated-drafts view: posts captured with no slot committed yet.
   *
   * Reuses getPostsList so the panel inherits paging, the customer/channel/tag
   * filters and the same minified wire shape as every other list, rather than
   * growing a second query that would drift from it.
   */
  async getUndatedDrafts(orgId: string, query: GetPostsListDto) {
    return this.getPostsList(orgId, {
      ...query,
      state: 'draft',
      undated: 'only',
    });
  }

  /**
   * Promotes an undated draft into a real slot.
   *
   * Separate from changeDate because changeDate derives the target state from
   * the current one, so a draft stays a draft — correct for dragging a card
   * around the calendar, useless for the one operation that has to end with the
   * post scheduled.
   *
   * When the approvals gate is on and the caller is not an approver, the date is
   * still pinned but the post stays a DRAFT. That is deliberate: proposing a slot
   * is not the same act as releasing the post, and refusing outright would leave
   * a contributor unable to do the half they are allowed to do. The response says
   * which of the two happened so the caller never has to guess.
   */
  async scheduleUndatedPost(
    orgId: string,
    id: string,
    date: string,
    target: 'queue' | 'draft' = 'queue',
    actorUserId?: string | null
  ) {
    if (!date || !dayjs(date).isValid()) {
      throw new BadRequestException('A valid date is required.');
    }

    const post = await this._postRepository.getPostById(id, orgId);

    if (!post) {
      throw new BadRequestException('Post not found');
    }

    if (post.publishDate) {
      // Refusing rather than silently rescheduling: this route is the promotion
      // path, and quietly moving an already-scheduled post would make a
      // mis-addressed call look like a success.
      throw new BadRequestException(
        'This post already has a date. Use the date route to move it.'
      );
    }

    if (post.state !== State.DRAFT) {
      // Cannot happen while the invariant holds (only a DRAFT may be dateless),
      // so this is the assertion that would catch it having been broken.
      throw new BadRequestException(
        'Only a draft can be scheduled from the undated list.'
      );
    }

    const requireApproval =
      await this._organizationRepository.getRequireApproval(orgId);

    // Same lazy shape as assertMayEnterQueue: no role lookup at all when the
    // gate is off.
    const isApprover =
      !requireApproval ||
      isApproverRole(
        actorUserId
          ? await this._organizationRepository.getUserRoleInOrg(
              orgId,
              actorUserId
            )
          : null
      );

    const mayQueue = target === 'queue' && isApprover;

    const state = mayQueue ? State.QUEUE : State.DRAFT;

    const updated = await this._postRepository.setDateAndState(
      orgId,
      id,
      date,
      state
    );

    try {
      await this.startWorkflow(
        post.integration.providerIdentifier.split('-')[0].toLowerCase(),
        post.id,
        orgId,
        state
      );
    } catch (err) {}

    return {
      id,
      state,
      publishDate: updated.publishDate,
      // False when the gate held the post back, so the UI can say "date saved,
      // still awaiting approval" instead of implying it is scheduled.
      scheduled: state === State.QUEUE,
      awaitingApproval: state === State.DRAFT && requireApproval,
    };
  }

  /** The org's approvals gate, for the settings UI. */
  async getApprovalsSettings(orgId: string) {
    return {
      requireApproval: await this._organizationRepository.getRequireApproval(
        orgId
      ),
    };
  }

  /**
   * Flips the org's approvals gate. Restricted to an approver: a USER who could
   * switch the gate off would be able to approve their own posts by removing the
   * requirement, which is the same hole by a longer route.
   */
  async updateApprovalsSettings(
    orgId: string,
    requireApproval: boolean,
    actorUserId?: string | null
  ) {
    // Unlike the queue guard, this lookup is unconditional: the authorization
    // question here is "may you change the gate", which does not depend on the
    // gate's current value.
    const role = actorUserId
      ? await this._organizationRepository.getUserRoleInOrg(orgId, actorUserId)
      : null;

    if (!isApproverRole(role)) {
      throw new ForbiddenException(
        'Only an organization admin can change the approvals setting.'
      );
    }

    if (requireApproval) {
      // Make sure the label the Approvals tab looks for exists before any post
      // can be gated, so the very first gated post is not the one that discovers
      // the tag is missing.
      await this._postRepository.ensureTagByName(
        orgId,
        APPROVAL_TAG_NAME,
        APPROVAL_TAG_COLOR
      );
    }

    const updated = await this._organizationRepository.updateRequireApproval(
      orgId,
      requireApproval
    );

    return { requireApproval: updated.requireApproval };
  }

  async generatePostsDraft(orgId: string, body: CreateGeneratedPostsDto) {
    const getAllIntegrations = (
      await this._integrationService.getIntegrationsList(orgId)
    ).filter((f) => !f.disabled && f.providerIdentifier !== 'reddit');

    // const posts = chunk(body.posts, getAllIntegrations.length);
    const allDates = dayjs()
      .isoWeek(body.week)
      .year(body.year)
      .startOf('isoWeek');

    const dates = [...new Array(7)].map((_, i) => {
      return allDates.add(i, 'day').format('YYYY-MM-DD');
    });

    const findTime = (): string => {
      const totalMinutes = Math.floor(Math.random() * 144) * 10;

      // Convert total minutes to hours and minutes
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      // Format hours and minutes to always be two digits
      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');
      const randomDate =
        shuffle(dates)[0] + 'T' + `${formattedHours}:${formattedMinutes}:00`;

      if (dayjs(randomDate).isBefore(dayjs())) {
        return findTime();
      }

      return randomDate;
    };

    for (const integration of getAllIntegrations) {
      for (const toPost of body.posts) {
        const group = makeId(10);
        const randomDate = findTime();

        await this.createPost(
          orgId,
          {
            type: 'draft',
            date: randomDate,
            order: '',
            shortLink: false,
            tags: [],
            posts: [
              {
                group,
                integration: {
                  id: integration.id,
                },
                settings: {
                  __type: integration.providerIdentifier as any,
                  title: '',
                  tags: [],
                  subreddit: [],
                },
                value: [
                  ...toPost.list.map((l) => ({
                    id: '',
                    content: l.post,
                    delay: 0,
                    image: [],
                  })),
                  {
                    id: '',
                    delay: 0,
                    content: `Check out the full story here:\n${
                      body.postId || body.url
                    }`,
                    image: [],
                  },
                ],
              },
            ],
          },
          'WEB'
        );
      }
    }
  }

  findAllExistingCategories() {
    return this._postRepository.findAllExistingCategories();
  }

  findAllExistingTopicsOfCategory(category: string) {
    return this._postRepository.findAllExistingTopicsOfCategory(category);
  }

  findPopularPosts(category: string, topic?: string) {
    return this._postRepository.findPopularPosts(category, topic);
  }

  async findFreeDateTime(orgId: string, integrationId?: string) {
    const findTimes = await this._integrationService.findFreeDateTime(
      orgId,
      integrationId
    );
    return this.findFreeDateTimeRecursive(
      orgId,
      findTimes,
      dayjs.utc().startOf('day')
    );
  }

  async createPopularPosts(post: {
    category: string;
    topic: string;
    content: string;
    hook: string;
  }) {
    return this._postRepository.createPopularPosts(post);
  }

  /**
   * Walks forward a day at a time looking for a configured posting time that is
   * still in the future and not already taken.
   *
   * TERMINATION, which this had none of. `getPostsCountsByDates` returns the
   * subset of `times` that is free on `date`, so an org with NO configured
   * posting times gets an empty array on every single day — and the old
   * `if (!list.length) return recurse(date.add(1, 'day'))` then walked forward
   * for ever. That is not merely slow: it is one database round trip per
   * simulated day, on a request that can never answer, holding its connection
   * while the returned-promise chain grows a link per level. Every caller of
   * `/posts/find-slot` (the composer's Create Another, the calendar's new-post
   * flow, the public API) was one unconfigured org away from that.
   *
   * So there are two guards, because there are two distinct dead ends: nothing
   * is configured (answerable immediately, and worth saying plainly because the
   * fix is a settings change), and everything configured is booked solid for
   * longer than anyone should search.
   */
  private async findFreeDateTimeRecursive(
    orgId: string,
    times: number[],
    date: dayjs.Dayjs,
    // days already walked; the caller starts at 0 and never passes this
    daysAhead = 0
  ): Promise<string> {
    if (!times.length) {
      throw new BadRequestException(
        'No posting times are configured for this organization, so there is no free slot to find. Add posting times in your settings first.'
      );
    }

    if (daysAhead >= MAX_FIND_SLOT_DAYS) {
      throw new BadRequestException(
        `Could not find a free posting slot in the next ${MAX_FIND_SLOT_DAYS} days. Pick a date manually or add more posting times.`
      );
    }

    const list = await this._postRepository.getPostsCountsByDates(
      orgId,
      times,
      date
    );

    if (!list.length) {
      return this.findFreeDateTimeRecursive(
        orgId,
        times,
        date.add(1, 'day'),
        daysAhead + 1
      );
    }

    const num = list.reduce<null | number>((prev, curr) => {
      if (prev === null || prev > curr) {
        return curr;
      }
      return prev;
    }, null) as number;

    return date.clone().add(num, 'minutes').format('YYYY-MM-DDTHH:mm:00');
  }

  getComments(postId: string) {
    return this._postRepository.getComments(postId);
  }

  getCommentsWithUser(orgId: string, postId: string) {
    return this._postRepository.getCommentsWithUser(orgId, postId);
  }

  getTags(orgId: string) {
    return this._postRepository.getTags(orgId);
  }

  createTag(orgId: string, body: CreateTagDto) {
    return this._postRepository.createTag(orgId, body);
  }

  editTag(id: string, orgId: string, body: CreateTagDto) {
    return this._postRepository.editTag(id, orgId, body);
  }

  deleteTag(id: string, orgId: string) {
    return this._postRepository.deleteTag(id, orgId);
  }

  createComment(
    orgId: string,
    userId: string,
    postId: string,
    comment: string
  ) {
    return this._postRepository.createComment(orgId, userId, postId, comment);
  }
}
