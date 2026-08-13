import { PostActivity } from '@gitroom/orchestrator/activities/post.activity';
import {
  ActivityFailure,
  ApplicationFailure,
  startChild,
  proxyActivities,
  sleep,
  defineSignal,
  setHandler,
} from '@temporalio/workflow';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { capitalize, sortBy } from 'lodash';
import { PostResponse } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { TimeoutFailure, TypedSearchAttributes } from '@temporalio/common';
import { postId as postIdSearchParam } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';

const proxyTaskQueue = (taskQueue: string) => {
  return proxyActivities<PostActivity>({
    startToCloseTimeout: '10 minute',
    taskQueue,
    retry: {
      maximumAttempts: 3,
      backoffCoefficient: 1,
      initialInterval: '2 minutes',
    },
  });
};

// checkPostStatus is a single read-only status call, so it gets a short timeout
// and fast retries - retrying it can never duplicate a post.
const proxyCheckTaskQueue = (taskQueue: string) => {
  return proxyActivities<PostActivity>({
    startToCloseTimeout: '2 minute',
    taskQueue,
    retry: {
      maximumAttempts: 3,
      backoffCoefficient: 1,
      initialInterval: '10 seconds',
    },
  });
};

// postSocialPending / finalizePost run irreversible publishing mutations, so no
// automatic retries - a retried activity whose previous (timed-out) attempt
// still completed in the background would publish twice. The workflow retries
// deliberately, and treats timeouts as "outcome unknown".
const proxyMutationTaskQueue = (taskQueue: string) => {
  return proxyActivities<PostActivity>({
    startToCloseTimeout: '10 minute',
    taskQueue,
    retry: {
      maximumAttempts: 1,
    },
  });
};

const {
  getPostsList,
  getPost,
  inAppNotification,
  changeState,
  updatePost,
  sendWebhooks,
  isCommentable,
} = proxyActivities<PostActivity>({
  startToCloseTimeout: '10 minute',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 1,
    initialInterval: '2 minutes',
  },
});

const poke = defineSignal('poke');

const iterate = Array.from({ length: 5 });

// ~30 minutes at 20s interval (longer than the old in-activity loop, timers are
// free). Multi-item flows (stories, chunked uploads) consume several checks per
// item, so the budget must cover the largest realistic post, not one poll cycle.
const maxPendingChecks = 90;

export async function postWorkflowV106({
  taskQueue,
  postId,
  organizationId,
  postNow = false,
}: {
  taskQueue: string;
  postId: string;
  organizationId: string;
  postNow?: boolean;
}) {
  // Dynamic task queue, for concurrency
  const {
    postComment,
    getIntegrationById,
    refreshTokenWithCause,
    internalPlugs,
    globalPlugs,
    processInternalPlug,
    processPlug,
  } = proxyTaskQueue(taskQueue);

  const { checkPostStatus } = proxyCheckTaskQueue(taskQueue);

  const { postSocialPending, finalizePost } = proxyMutationTaskQueue(taskQueue);

  let poked = false;
  setHandler(poke, () => {
    poked = true;
  });

  const startTime = new Date();
  // get all the posts and comments to post
  const firstPost = await getPost(organizationId, postId);

  // in case doesn't exists for some reason, fail it
  if (!firstPost) {
    await changeState(postId, 'ERROR', 'No Post');
    return;
  }

  if (!postNow && firstPost.state !== 'QUEUE') {
    await changeState(firstPost.id, 'ERROR', 'Already posted', [firstPost]);
    return;
  }

  // Undated drafts (publishDate is nullable now) must never reach the sleep
  // below. Unreachable while the invariant holds, since the check above requires
  // QUEUE and nothing can enter QUEUE without a date (PostsService
  // .assertHasPublishDate, PostsRepository.stateFor, and the DTO). Stated anyway
  // because the failure mode is silent and total: dayjs(null) is an Invalid
  // Date, so `.isBefore()` is false, `.diff()` is NaN, and sleep(NaN) resolves
  // IMMEDIATELY. A post with no date would therefore publish the instant its
  // workflow was armed, which is the opposite of what a missing date means.
  // Gated on !postNow like the sleep it guards: the postNow path (the
  // repeat-post child below) skips the sleep entirely and operates on an
  // already-published post, so failing it here would mark a live post ERROR.
  if (!postNow && !firstPost.publishDate) {
    await changeState(firstPost.id, 'ERROR', 'Missing publish date', [
      firstPost,
    ]);
    return;
  }

  // if it's a repeatable post, we should ignore this.
  if (!postNow) {
    await sleep(
      dayjs(firstPost.publishDate).isBefore(dayjs())
        ? 0
        : dayjs(firstPost.publishDate).diff(dayjs(), 'millisecond')
    );
  }

  const postsListBefore = await getPostsList(organizationId, postId);
  const [post] = postsListBefore;

  if (!post) {
    await changeState(postId, 'ERROR', 'No Post');
    return;
  }

  // if refresh is needed from last time, let's inform the user
  if (post.integration?.refreshNeeded) {
    await inAppNotification(
      post.organizationId,
      `We couldn't post to ${post.integration?.providerIdentifier} for ${post?.integration?.name}`,
      `We couldn't post to ${post.integration?.providerIdentifier} for ${post?.integration?.name} because you need to reconnect it. Please enable it and try again.`,
      true,
      false,
      'info'
    );

    await changeState(
      postsListBefore[0].id,
      'ERROR',
      'Refresh channel needed',
      postsListBefore
    );
    return;
  }

  // if it's disabled, inform the user
  if (post.integration?.disabled) {
    await inAppNotification(
      post.organizationId,
      `We couldn't post to ${post.integration?.providerIdentifier} for ${post?.integration?.name}`,
      `We couldn't post to ${post.integration?.providerIdentifier} for ${post?.integration?.name} because it's disabled. Please enable it and try again.`,
      true,
      false,
      'info'
    );

    await changeState(
      postsListBefore[0].id,
      'ERROR',
      'Channel disabled',
      postsListBefore
    );
    return;
  }

  // Do we need to post comment for this social?
  const toComment: boolean =
    postsListBefore.length === 1
      ? false
      : await isCommentable(post.integration);

  const postsList = toComment ? postsListBefore : [postsListBefore[0]];

  // list of all the saved results
  const postsResults: PostResponse[] = [];

  // Set the moment the PARENT post is recorded as published. From then on it is
  // live, and no later failure may mark it otherwise.
  let parentPublished = false;

  // Every catch block below used to repeat the same failure classification, so
  // it is centralized here: detect the failure type, refresh the token when
  // needed, and tell the caller what to do.
  // 'retry' - the token was refreshed, run the action again
  // 'stop' - the token could not be refreshed
  // 'bad-body' - the platform rejected the action
  // 'timeout' - the activity timed out, its outcome is unknown
  // 'unknown' - anything else (transient errors)
  const handleActivityError = async (
    err: unknown,
    getIntegration?: () => Promise<any>
  ): Promise<{
    type: 'retry' | 'stop' | 'bad-body' | 'timeout' | 'unknown';
    message: string;
  }> => {
    if (
      err instanceof ActivityFailure &&
      err.cause instanceof TimeoutFailure
    ) {
      return { type: 'timeout', message: '' };
    }

    const cause =
      err instanceof ActivityFailure && err.cause instanceof ApplicationFailure
        ? err.cause
        : undefined;

    if (cause?.type === 'refresh_token') {
      const refresh = await refreshTokenWithCause(
        getIntegration ? await getIntegration() : post.integration,
        cause.message || ''
      );
      if (!refresh || !refresh.accessToken) {
        return { type: 'stop', message: cause.message || '' };
      }

      if (!getIntegration) {
        post.integration.token = refresh.accessToken;
      }

      return { type: 'retry', message: cause.message || '' };
    }

    if (cause?.type === 'bad_body') {
      return { type: 'bad-body', message: cause.message || '' };
    }

    return { type: 'unknown', message: '' };
  };

  /**
   * A failure that happened AFTER the parent post is already live.
   *
   * The parent stays PUBLISHED. Marking it ERROR was the old behaviour and it
   * was wrong twice over: it labelled a post that had actually published as
   * failed, and ERROR is exactly what draws the Retry button, so it offered to
   * publish the post a second time while its own error text said not to. A
   * provider that cannot post a follow-up at all (the Buffer relay has no
   * comment API) hit this on every multi-segment post.
   *
   * The failing SEGMENT takes the error state instead. changeState updates one
   * row by id, so the parent is untouched, and a child post is invisible to the
   * missing-posts sweep, which filters on parentPostId: null, so nothing will
   * try to republish it either.
   */
  const markPartialPublish = async (err: unknown, index: number) => {
    const platform = capitalize(post.integration?.providerIdentifier);
    try {
      await changeState(postsList[index].id, 'ERROR', err, [postsList[index]]);
    } catch (e) {
      /**empty**/
    }
    // 'info', not 'fail': the post published. This is a warning about what did
    // not follow it, and the one instruction that matters is "do not retry".
    await inAppNotification(
      post.organizationId,
      `Published on ${platform}, but a follow-up did not`,
      `Your post published on ${platform} for ${post?.integration?.name}, but part ${
        index + 1
      } of it could not be posted. The published post is live and must NOT be retried, because retrying would publish it a second time. Add the remaining part by hand.`,
      true,
      false,
      'info'
    );
  };

  // The platform may have accepted the post but we can't confirm it was
  // published - mark the error with a distinct message so the user checks the
  // account before reposting manually and duplicating it.
  const markUnconfirmed = async (err: any, index = 0) => {
    // Never drag a live parent into an error state over a later segment.
    if (parentPublished && index > 0) {
      await markPartialPublish(err, index);
      return;
    }

    await changeState(postsList[0].id, 'ERROR', err, postsList);
    await inAppNotification(
      post.organizationId,
      `We couldn't confirm your post on ${capitalize(
        post.integration?.providerIdentifier
      )}`,
      `Your post was sent to ${capitalize(
        post.integration?.providerIdentifier
      )}, but we couldn't confirm it was published. Please check your ${
        post?.integration?.name
      } account before posting again to avoid duplicates.`,
      true,
      false,
      'fail'
    );
  };

  // The post/comment was already accepted by the platform but returned as
  // "pending": poll the read-only status check with durable timers until it
  // completes. Errors are fully handled here (never rethrown), otherwise they
  // would bubble to the posting retry loop and re-run the publish.
  const resolvePending = async (
    pending: PostResponse,
    // which segment is being resolved, so a failure lands on the right row
    index: number
  ): Promise<PostResponse | false> => {
    let pendingData = pending.pendingData;
    let errorAttempts = 0;

    for (let check = 0; check < maxPendingChecks; check++) {
      try {
        let result = await checkPostStatus(post.integration, pendingData);

        // commit the check's state BEFORE finalizePost runs: if finalize dies
        // mid-mutation, the next check must see what it had already authorized,
        // so providers can detect the interrupted attempt instead of running
        // the mutation again
        if (result.status !== 'completed') {
          pendingData = result.pendingData;
        }

        // polling is done, run the remaining provider mutations
        if (result.status === 'ready') {
          result = await finalizePost(post.integration, result.pendingData);
        }

        if (result.status === 'completed') {
          return {
            id: pending.id,
            postId: result.postId,
            releaseURL: result.releaseURL,
            status: 'success',
          };
        }

        pendingData = result.pendingData;

        // a fully successful iteration proves the platform is reachable: the
        // error budget bounds consecutive failures, not blips accumulated over
        // a long upload
        errorAttempts = 0;
      } catch (err) {
        const handle = await handleActivityError(err);

        // token refreshed, check again right away
        if (handle.type === 'retry') {
          continue;
        }

        // the token could not be refreshed while checking, but the platform
        // already accepted the post - warn about a possible live post
        if (handle.type === 'stop') {
          await markUnconfirmed(err, index);
          return false;
        }

        // the platform explicitly failed the post, it was not published
        if (handle.type === 'bad-body') {
          // ...unless the parent already went out, in which case only this
          // segment failed and the parent must keep its published state
          if (parentPublished && index > 0) {
            await markPartialPublish(err, index);
            return false;
          }

          await changeState(postsList[0].id, 'ERROR', err, postsList);
          await inAppNotification(
            post.organizationId,
            `Error posting on ${post.integration?.providerIdentifier} for ${post?.integration?.name}`,
            `An error occurred while posting on ${
              post.integration?.providerIdentifier
            }${handle.message ? `: ${handle.message}` : ``}`,
            true,
            false,
            'fail'
          );
          return false;
        }

        // unknown error on a read-only check, retry a few more times
        errorAttempts++;
        if (errorAttempts >= iterate.length) {
          break;
        }
      }

      // the platform is still processing, wait before the next check
      await sleep('20 seconds');
    }

    // no verdict from the platform after all the checks
    await markUnconfirmed('Could not confirm the post status', index);
    return false;
  };

  // iterate over the posts
  for (let i = 0; i < postsList.length; i++) {
    const before = postsResults.length;
    // once the platform accepted the post, the catch below must never retry
    // the publish - retrying after updatePost / notification errors would
    // duplicate the post
    let posted = false;
    let updated = false;
    // this is a small trick to repeat an action in case of token refresh
    for (const _ of iterate) {
      try {
        // first post the main post
        if (i === 0) {
          postsResults.push(
            ...(await postSocialPending(post.integration as Integration, [
              postsList[i],
            ]))
          );

          // then post the comments if any
        } else {
          if (postsList[i].delay) {
            await sleep(60000 * Math.max(0, Number(postsList[i].delay ?? 0)));
          }

          postsResults.push(
            ...(await postComment(
              postsResults[0].postId,
              postsResults.length === 1
                ? undefined
                : postsResults[i - 1].postId,
              post.integration,
              [postsList[i]]
            ))
          );
        }

        posted = true;

        // the platform accepted the post but is still processing it: resolve
        // it here before marking anything, resolvePending handles its own
        // errors so a failed status check can never re-run the publish above
        if (postsResults[i].status === 'pending') {
          let resolved: PostResponse | false = false;
          try {
            resolved = await resolvePending(postsResults[i], i);
          } catch (err) {
            // never let a pending-resolution error reach the outer catch, it
            // would retry the post and duplicate it. Best-effort error state,
            // otherwise the post stays in QUEUE and the missing-posts sweep
            // would re-publish it.
            try {
              await markUnconfirmed(err, i);
            } catch (e) {
              /**empty**/
            }
            resolved = false;
          }
          if (!resolved) {
            return false;
          }
          postsResults[i] = resolved;
        }

        // mark post as successful
        await updatePost(
          postsList[i].id,
          postsResults[i].postId,
          postsResults[i].releaseURL
        );
        updated = true;
        if (i === 0) {
          // the parent is now recorded as published: from here on, a failure in
          // a later segment must never take this state away from it
          parentPublished = true;
        }

        if (i === 0) {
          // send notification on a sucessful post
          await inAppNotification(
            post.integration.organizationId,
            `Your post has been published on ${capitalize(
              post.integration.providerIdentifier
            )}`,
            `Your post has been published on ${capitalize(
              post.integration.providerIdentifier
            )} at ${postsResults[0].releaseURL}`,
            true,
            true
          );
        }

        // break the current while to move to the next post
        break;
      } catch (err) {
        // the post is already live: never re-run the publish
        if (posted) {
          if (!updated) {
            // still marked QUEUE, record the error so the missing-posts sweep
            // doesn't re-publish it
            try {
              await markUnconfirmed(err, i);
            } catch (e) {
              /**empty**/
            }
            return false;
          }

          // already marked published, a failed notification shouldn't abort
          // the rest of the flow
          break;
        }

        const handle = await handleActivityError(err);

        // token refreshed, repeat the action
        if (handle.type === 'retry') {
          continue;
        }

        // the activity timed out: the platform may still complete the publish
        // in the background, so never retry it
        if (handle.type === 'timeout') {
          try {
            await markUnconfirmed(err, i);
          } catch (e) {
            /**empty**/
          }
          return false;
        }

        // The parent is already live and this is a later segment: the parent
        // keeps its published state, the segment carries the error, and the
        // user gets a warning instead of a Retry button on a post that went
        // out. This is the seam the whole partial-publish case turns on, so it
        // sits BEFORE the changeState below rather than trying to undo it.
        if (parentPublished && i > 0) {
          try {
            await markPartialPublish(err, i);
          } catch (e) {
            /**empty**/
          }
          return false;
        }

        // for other errors, change state and inform the user if needed
        await changeState(postsList[0].id, 'ERROR', err, postsList);

        if (handle.type === 'stop') {
          return false;
        }

        // specific case for bad body errors
        if (handle.type === 'bad-body') {
          await inAppNotification(
            post.organizationId,
            `Error posting${i === 0 ? ' ' : ' comments '}on ${
              post.integration?.providerIdentifier
            } for ${post?.integration?.name}`,
            `An error occurred while posting${i === 0 ? ' ' : ' comments '}on ${
              post.integration?.providerIdentifier
            }${handle.message ? `: ${handle.message}` : ``}`,
            true,
            false,
            'fail'
          );
          return false;
        }
      }
    }

    if (postsResults.length === before) {
      // all retries exhausted without success
      return false;
    }
  }

  // send webhooks for the post
  await sendWebhooks(
    postsResults[0].postId,
    post.organizationId,
    post.integration.id
  );

  // load internal plugs like repost by other users
  const internalPlugsList = await internalPlugs(
    post.integration,
    JSON.parse(post.settings)
  );

  // load global plugs, like repost a post if it gets to a certain number of likes
  const globalPlugsList = (await globalPlugs(post.integration)).reduce(
    (all, current) => {
      for (let i = 1; i <= current.totalRuns; i++) {
        all.push({
          ...current,
          delay: current.delay * i,
        });
      }

      return all;
    },
    []
  );

  // Check if the post is repeatable
  const repeatPost = !post.intervalInDays
    ? []
    : [
        {
          type: 'repeat-post',
          delay:
            post.intervalInDays * 24 * 60 * 60 * 1000 -
            (new Date().getTime() - startTime.getTime()),
        },
      ];

  // Sort all the actions by delay, so we can process them in order
  const list = sortBy(
    [...internalPlugsList, ...globalPlugsList, ...repeatPost],
    'delay'
  );

  // process all the plugs in order, we are using while because in some cases we need to remove items from the list
  while (list.length > 0) {
    // get the next to process
    const todo = list.shift();

    // wait for the delay
    await sleep(Math.max(0, Number(todo.delay ?? 0)));

    // process internal plug
    if (todo.type === 'internal-plug') {
      for (const _ of iterate) {
        try {
          await processInternalPlug({ ...todo, post: postsResults[0].postId });
        } catch (err) {
          const handle = await handleActivityError(err, () =>
            getIntegrationById(organizationId, todo.integration)
          );

          if (handle.type === 'stop' || handle.type === 'bad-body') {
            break;
          }

          continue;
        }
        break;
      }
    }

    // process global plug
    if (todo.type === 'global') {
      for (const _ of iterate) {
        try {
          const process = await processPlug({
            ...todo,
            postId: postsResults[0].postId,
          });
          if (process) {
            const toDelete = list
              .reduce((all, current, index) => {
                if (current.plugId === todo.plugId) {
                  all.push(index);
                }

                return all;
              }, [])
              .reverse();

            for (const index of toDelete) {
              list.splice(index, 1);
            }
          }
        } catch (err) {
          const handle = await handleActivityError(err);

          if (handle.type === 'stop' || handle.type === 'bad-body') {
            break;
          }

          continue;
        }

        break;
      }
    }

    // process repeat post in a new workflow, this is important so the other plugs can keep running
    if (todo.type === 'repeat-post') {
      await startChild(postWorkflowV106, {
        parentClosePolicy: 'ABANDON',
        args: [
          {
            taskQueue,
            postId,
            organizationId,
            postNow: true,
          },
        ],
        workflowId: `post_${post.id}_${makeId(10)}`,
        typedSearchAttributes: new TypedSearchAttributes([
          {
            key: postIdSearchParam,
            value: postId,
          },
        ]),
      });
    }
  }
}
