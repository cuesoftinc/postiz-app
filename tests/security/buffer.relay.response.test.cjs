const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createPostFailure,
  isCreatePostSuccess,
  PAID_PLAN_FIRST_COMMENT,
  withFirstCommentFallback,
} = require('@gitroom/nestjs-libraries/integrations/social/buffer.relay.response');

// The 2026-08-18 regression, verbatim. Buffer answered HTTP 200 with no
// top-level `errors` array and the refusal carried as a union member, so
// nothing threw; the paid-plan retry was keyed on a thrown error and never
// ran, and the LinkedIn post was lost. The response must read as a failure.
const PAID_PLAN_REFUSAL = {
  __typename: 'InvalidInputError',
  message:
    'Invalid post: LinkedIn first comment requires a paid plan. Please upgrade to use this feature.',
};

test('an in-band refusal is a failure even though nothing threw', () => {
  assert.equal(isCreatePostSuccess(PAID_PLAN_REFUSAL), false);
  assert.equal(createPostFailure(PAID_PLAN_REFUSAL), PAID_PLAN_REFUSAL.message);
});

test('the paid-plan refusal reaches the retry, prefix and all', () => {
  // Matching must survive Buffer's 'Invalid post: ' prefix, or the fallback
  // silently stops firing and every first-comment post dies again.
  assert.ok(PAID_PLAN_FIRST_COMMENT.test(createPostFailure(PAID_PLAN_REFUSAL)));
});

test('the concrete typename is never the MutationError interface name', () => {
  // The original bug: `__typename === 'MutationError'` gated the message, so a
  // real reason degraded to "unknown reason". Any concrete member must report
  // its own message, whatever it is called.
  for (const name of ['InvalidInputError', 'NotFoundError', 'MutationError']) {
    assert.equal(
      createPostFailure({ __typename: name, message: 'because reasons' }),
      'because reasons',
      `${name} must surface its message`
    );
  }
});

test('acceptance is the only case that is not a failure', () => {
  const ok = {
    __typename: 'PostActionSuccess',
    post: { id: 'p1', dueAt: '2026-08-18T08:59:39Z' },
  };
  assert.equal(isCreatePostSuccess(ok), true);
  assert.equal(createPostFailure(ok), undefined);
});

test('a refusal with nothing to say still reads as a refusal', () => {
  // Callers branch on truthiness, so an empty or absent message must not
  // return '' and be mistaken for success.
  assert.equal(createPostFailure({ __typename: 'WeirdError' }), 'unknown reason');
  assert.equal(createPostFailure({ __typename: 'WeirdError', message: '' }), 'unknown reason');
  assert.equal(createPostFailure(undefined), 'unknown reason');
  assert.equal(createPostFailure(null), 'unknown reason');
});

// --- the orchestration, which is what actually lost the post -----------------
//
// The message bug above is the visible half. The half that cost a post was the
// retry living in a `catch` an in-band refusal never reached, so these drive the
// fallback directly with a fake `create` and assert it fires without anything
// being thrown.

/** A create() that refuses `refusals` times, then succeeds. */
const fakeCreate = (refusals, message = 'Invalid post: LinkedIn first comment requires a paid plan.') => {
  const calls = [];
  const fn = async () => {
    calls.push(true);
    return calls.length <= refusals
      ? { data: undefined, failure: message }
      : { data: { createPost: { __typename: 'PostActionSuccess', post: { id: 'p1', dueAt: 'x' } } }, failure: undefined };
  };
  fn.calls = calls;
  return fn;
};

test('an in-band refusal triggers the fallback without anything being thrown', async () => {
  const create = fakeCreate(1);
  let dropped = false;
  const out = await withFirstCommentFallback({
    create,
    hasFirstComment: () => true,
    dropFirstComment: () => { dropped = true; },
  });
  assert.equal(create.calls.length, 2, 'must retry after an in-band refusal');
  assert.equal(dropped, true, 'must drop the first comment before retrying');
  assert.equal(out.failure, undefined, 'the post must end up published');
  assert.ok(out.droppedFirstCommentAfter, 'the operator must be told to hand-post the comment');
});

test('the fallback is not gated on Buffer wording', async () => {
  // The old code only retried on /first comment requires a paid plan/. If Buffer
  // rewords, that reproduces the incident, so any refusal must be enough.
  const create = fakeCreate(1, 'Some entirely new refusal Buffer invented today');
  const out = await withFirstCommentFallback({
    create,
    hasFirstComment: () => true,
    dropFirstComment: () => {},
  });
  assert.equal(create.calls.length, 2);
  assert.equal(out.failure, undefined);
});

test('no first comment means no retry, since there is nothing to drop', async () => {
  const create = fakeCreate(1);
  let dropped = false;
  const out = await withFirstCommentFallback({
    create,
    hasFirstComment: () => false,
    dropFirstComment: () => { dropped = true; },
  });
  assert.equal(create.calls.length, 1);
  assert.equal(dropped, false);
  assert.ok(out.failure, 'the refusal must surface rather than being swallowed');
});

test('an accepted post is created exactly once', async () => {
  const create = fakeCreate(0);
  const out = await withFirstCommentFallback({
    create,
    hasFirstComment: () => true,
    dropFirstComment: () => assert.fail('must not drop a comment on success'),
  });
  assert.equal(create.calls.length, 1, 'no duplicate post');
  assert.equal(out.droppedFirstCommentAfter, undefined);
});

test('a retry that also fails does not claim a comment needs hand-posting', async () => {
  // Otherwise the operator is told to comment on a post that does not exist.
  const create = fakeCreate(2);
  const out = await withFirstCommentFallback({
    create,
    hasFirstComment: () => true,
    dropFirstComment: () => {},
  });
  assert.equal(create.calls.length, 2, 'exactly one retry, never a loop');
  assert.ok(out.failure);
  assert.equal(out.droppedFirstCommentAfter, undefined);
});
