export type PublishablePost = {
  state: string;
  needsApproval?: boolean | null;
};

/**
 * Re-check mutable publication state after the workflow's sleep. An edit can
 * pull a queued post back to draft or raise a fresh approval requirement while
 * this workflow is waiting, and that revision must not inherit the old slot's
 * authorization.
 */
export const mayPublishPost = (
  postNow: boolean,
  post: PublishablePost
): boolean => postNow || (post.state === 'QUEUE' && !post.needsApproval);
