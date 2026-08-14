const assert = require('node:assert/strict');
const test = require('node:test');
const { mayPublishPost } = require('../../apps/orchestrator/src/workflows/post-workflows/post.workflow.guard');

test('a sleeping workflow cannot publish a revision awaiting approval', () => {
  assert.equal(mayPublishPost(false, { state: 'QUEUE', needsApproval: true }), false);
  assert.equal(mayPublishPost(false, { state: 'DRAFT', needsApproval: true }), false);
  assert.equal(mayPublishPost(false, { state: 'QUEUE', needsApproval: false }), true);
});

test('repeat-post workflows retain their explicit postNow behavior', () => {
  assert.equal(mayPublishPost(true, { state: 'PUBLISHED', needsApproval: false }), true);
});
