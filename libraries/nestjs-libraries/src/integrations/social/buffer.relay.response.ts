/**
 * Reading Buffer's `createPost` answer.
 *
 * Split out of buffer.relay.provider.ts so it can be tested without importing
 * the provider, which drags in the whole NestJS graph — the same reason
 * buffer.relay.retry.ts is a module of its own.
 *
 * THE BUG THIS EXISTS TO PREVENT. Buffer refuses a post IN BAND: HTTP 200, no
 * top-level `errors` array, the refusal carried as a member of the `createPost`
 * union. Nothing throws, so a try/catch around the mutation cannot see it. On
 * 2026-08-18 a LinkedIn post was lost outright for exactly that reason — the
 * paid-plan retry was keyed on a thrown error and never ran — and the failure
 * reached the operator as "Buffer refused the post: unknown reason" because the
 * message was read only when `__typename` equalled 'MutationError'.
 *
 * 'MutationError' is the INTERFACE name and is never what comes back. Every
 * error member is a concrete type implementing it, so `__typename` reports
 * `InvalidInputError` and friends. Read `message`; never match the typename.
 */

/**
 * Buffer's wording for the free-plan limit on LinkedIn first comments. It
 * arrives prefixed ('Invalid post: …'), so only the distinctive tail is
 * matched, against both an in-band refusal and a thrown one.
 */
export const PAID_PLAN_FIRST_COMMENT = /first comment requires a paid plan/i;

export type BufferCreatePostSuccess = {
  __typename: 'PostActionSuccess';
  post: { id: string; dueAt: string };
};

/**
 * Anything that is not acceptance. `__typename` is deliberately `string`
 * because the concrete member name is not knowable here; only `message` is
 * dependable, and the `MutationError` interface guarantees it.
 */
export type BufferCreatePostFailure = { __typename: string; message: string };

export type BufferCreatePostResponse = {
  createPost?: BufferCreatePostSuccess | BufferCreatePostFailure | null;
};

/**
 * Acceptance is the ONE case named exactly, so it is the only thing worth
 * testing for. A predicate rather than an inline check because `__typename:
 * string` on the failure member cannot discriminate the union on its own.
 */
export const isCreatePostSuccess = (
  result: BufferCreatePostResponse['createPost']
): result is BufferCreatePostSuccess =>
  result?.__typename === 'PostActionSuccess';

/**
 * Why Buffer refused, or undefined when it accepted.
 *
 * Never returns an empty string: a refusal carrying no message still has to
 * read as a refusal to every caller that checks this for truthiness.
 */
export const createPostFailure = (
  result: BufferCreatePostResponse['createPost']
): string | undefined =>
  isCreatePostSuccess(result) ? undefined : result?.message || 'unknown reason';
