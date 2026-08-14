const assert = require('node:assert/strict');
const test = require('node:test');
const { NotFoundException } = require('@nestjs/common');
const { PostsRepository } = require('@gitroom/nestjs-libraries/database/prisma/posts/posts.repository');

const body = (value, group) => ({
  integration: { id: 'integration-1' },
  value,
  settings: {},
  ...(group ? { group } : {}),
});

function repository(post) {
  const noop = async () => ({});
  return new PostsRepository(
    { model: { post } },
    {},
    {},
    { model: { tags: { findMany: async () => [] } } },
    { model: { tagsPosts: { deleteMany: noop } } },
    {}
  );
}

test('rejects a caller-supplied post id outside the organization', async () => {
  let writes = 0;
  const repo = repository({
    findFirst: async () => null,
    update: async () => {
      writes += 1;
    },
  });

  await assert.rejects(
    repo.createOrUpdatePost(
      'update',
      'org-a',
      '2026-09-01T10:00:00Z',
      body([{ id: 'post-in-org-b', content: 'changed', image: [] }]),
      [],
      'API',
      undefined,
      false
    ),
    NotFoundException
  );
  assert.equal(writes, 0);
});

test('an approval-gated edit pulls an owned queued post back to draft', async () => {
  let updateArgs;
  const repo = repository({
    findFirst: async () => ({ id: 'post-a', state: 'QUEUE' }),
    update: async (args) => {
      updateArgs = args;
      return { id: 'post-a', state: args.data.state };
    },
  });

  const result = await repo.createOrUpdatePost(
    'update',
    'org-a',
    '2026-09-01T10:00:00Z',
    body([{ id: 'post-a', content: 'new revision', image: [] }]),
    [],
    'API',
    undefined,
    true
  );

  assert.equal(updateArgs.where.organizationId, 'org-a');
  assert.equal(updateArgs.data.state, 'DRAFT');
  assert.equal(updateArgs.data.needsApproval, true);
  assert.equal(result.posts[0].state, 'DRAFT');
});

test('old-group cleanup is tenant scoped', async () => {
  let findWhere;
  let cleanupWhere;
  const repo = repository({
    create: async () => ({ id: 'new-post', state: 'DRAFT' }),
    findFirst: async (args) => {
      findWhere = args.where;
      return { id: 'old-post' };
    },
    updateMany: async (args) => {
      cleanupWhere = args.where;
      return { count: 1 };
    },
  });

  await repo.createOrUpdatePost(
    'draft',
    'org-a',
    null,
    body([{ content: 'replacement', image: [] }], 'old-group'),
    [],
    'API'
  );

  assert.equal(findWhere.organizationId, 'org-a');
  assert.equal(cleanupWhere.organizationId, 'org-a');
});
