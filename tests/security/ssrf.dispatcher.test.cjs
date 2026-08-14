const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const {
  ssrfSafeDispatcher,
} = require('@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher');

// REGRESSION. The IP guard used to live only in the Agent's `connect.lookup`
// hook, and `node:net` skips DNS resolution when the host is already an IP
// literal, so the hook never fired for `http://127.0.0.1/` or for a redirect
// hop to one. Measured before the fix: the request REACHED a loopback listener
// and returned its body with zero calls into the hook, which meant every
// getSsrfSafeDispatcher() call site was open to the primary SSRF payload.
//
// These tests connect to a real loopback server, because that hole was invisible
// to every form of reasoning about the code and only showed up when something
// actually dialled out.

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: server.address().port })
    );
  });
}

const reach = async (url) => {
  try {
    const response = await fetch(url, { dispatcher: ssrfSafeDispatcher });
    await response.text();
    return 'REACHED';
  } catch (e) {
    return (e.cause && e.cause.message) || e.message;
  }
};

test('an IP-literal target cannot reach a private address', async () => {
  const { server, port } = await listen((_req, res) => {
    res.writeHead(200);
    res.end('INTERNAL');
  });
  try {
    assert.equal(await reach(`http://127.0.0.1:${port}/`), 'Blocked IP');
    assert.equal(await reach(`http://[::1]:${port}/`), 'Blocked IP');
  } finally {
    server.close();
  }
});

test('a hostname resolving to a private address is still blocked', async () => {
  const { server, port } = await listen((_req, res) => {
    res.writeHead(200);
    res.end('INTERNAL');
  });
  try {
    assert.equal(await reach(`http://localhost:${port}/`), 'Blocked IP');
  } finally {
    server.close();
  }
});

test('a redirect hop to an IP literal is blocked, not just the first request', async () => {
  const { server: target, port: targetPort } = await listen((_req, res) => {
    res.writeHead(200);
    res.end('INTERNAL');
  });
  const { server: redirector, port: redirectPort } = await listen((_req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/` });
    res.end();
  });
  try {
    assert.equal(await reach(`http://localhost:${redirectPort}/`), 'Blocked IP');
  } finally {
    target.close();
    redirector.close();
  }
});
