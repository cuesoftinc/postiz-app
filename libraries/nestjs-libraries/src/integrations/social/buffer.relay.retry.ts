/** Buffer queries are idempotent; createPost/shareNow mutations are not. */
export const mayRetryBufferGraphql = (
  operation: 'query' | 'mutation'
): boolean => operation === 'query';
