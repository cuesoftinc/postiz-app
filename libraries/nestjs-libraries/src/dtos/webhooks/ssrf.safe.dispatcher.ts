import { Agent, buildConnector } from 'undici';
import dns from 'node:dns';
import net from 'node:net';
import { isBlockedIp } from './webhook.url.validator';

// Pins DNS resolution for HOSTNAME targets: every resolved address is checked
// with `isBlockedIp` and undici connects to that same set, closing the TOCTOU
// window `isSafePublicHttpsUrl` alone leaves open (see GHSA-f7jj-p389-4w45).
//
// This hook alone is NOT enough, and that gap was live in this file. `node:net`
// skips DNS resolution entirely when the host is already an IP literal, so
// `lookup` is never invoked for `http://169.254.169.254/` or for a redirect hop
// to one. Measured on Node 22 and 26: an IP-literal target reached a loopback
// listener and returned its body with ZERO calls into this function. Every
// `getSsrfSafeDispatcher()` call site inherited that hole, and the IP-literal
// form is the primary SSRF payload, not an edge case.
//
// So the real gate is the CONNECTOR below, which runs per connection and does
// see IP literals. `lookup` stays as the hostname leg (and as defence in depth
// if a future caller reaches it directly).
function pinnedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: any, family?: any) => void
) {
  if (net.isIP(hostname)) {
    const family = net.isIP(hostname);
    if (isBlockedIp(hostname)) {
      return callback(new Error('Blocked IP'), '', 0);
    }
    return options && (options as any).all
      ? callback(null, [{ address: hostname, family }] as any, family)
      : callback(null, hostname, family);
  }

  dns.lookup(hostname, options, (err, address: any, family: any) => {
    if (err) return callback(err, '', 0);
    if (Array.isArray(address)) {
      for (const entry of address) {
        if (isBlockedIp(entry.address)) {
          return callback(new Error('Blocked IP'), '', 0);
        }
      }
      return callback(null, address as any, 0);
    }
    if (isBlockedIp(address)) {
      return callback(new Error('Blocked IP'), '', 0);
    }
    callback(null, address, family);
  });
}

const baseConnector = buildConnector({ lookup: pinnedLookup as any });

// Runs on every connection, including each redirect hop, and unlike `lookup`
// it is reached for IP-literal hosts. IPv6 arrives bracketed (`[::1]`), which
// `net.isIP` rejects, so the brackets come off before the check.
const guardedConnector: buildConnector.connector = (options, callback) => {
  const raw = String((options as any).hostname || '');
  const hostname =
    raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;

  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    return callback(new Error('Blocked IP'), null);
  }

  return baseConnector(options, callback);
};

export const ssrfSafeDispatcher = new Agent({ connect: guardedConnector });

// Self-hosters legitimately connect Postiz to WordPress/Mastodon/Lemmy/Listmonk
// instances that live on a private network (e.g. the same Docker network or VPC).
// Setting DISABLE_SSRF_PROTECTION=true opts those deployments out of the IP
// guard. It stays ON by default so the hosted product is protected.
export function getSsrfSafeDispatcher(): Agent | undefined {
  return process.env.DISABLE_SSRF_PROTECTION === 'true'
    ? undefined
    : ssrfSafeDispatcher;
}
