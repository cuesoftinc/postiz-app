const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createPostFailure,
  isCreatePostSuccess,
  PAID_PLAN_FIRST_COMMENT,
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
