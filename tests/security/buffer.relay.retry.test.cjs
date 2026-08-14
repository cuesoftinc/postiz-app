const assert = require('node:assert/strict');
const test = require('node:test');
const { mayRetryBufferGraphql } = require('@gitroom/nestjs-libraries/integrations/social/buffer.relay.retry');

test('Buffer reads may retry but shareNow mutations never do', () => {
  assert.equal(mayRetryBufferGraphql('query'), true);
  assert.equal(mayRetryBufferGraphql('mutation'), false);
});
