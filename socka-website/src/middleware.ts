import { defineMiddleware } from 'astro:middleware';

const canonicalOrigin = 'https://socka.hr';
const publicHosts = new Set(['socka.hr', 'www.socka.hr']);

function firstForwardedValue(value: string | null) {
  return value?.split(',', 1)[0]?.trim().toLowerCase();
}

export const onRequest = defineMiddleware((context, next) => {
  if (context.isPrerendered) {
    return next();
  }

  const forwardedHost = firstForwardedValue(context.request.headers.get('x-forwarded-host'));
  const requestHost = forwardedHost || firstForwardedValue(context.request.headers.get('host')) || context.url.hostname;
  const hostname = requestHost.replace(/:\d+$/, '');

  if (!publicHosts.has(hostname)) {
    return next();
  }

  const forwardedProtocol = firstForwardedValue(context.request.headers.get('x-forwarded-proto'));
  const protocol = forwardedProtocol || context.url.protocol.replace(':', '').toLowerCase();

  if (hostname === 'socka.hr' && protocol === 'https') {
    return next();
  }

  const destination = new URL(`${context.url.pathname}${context.url.search}`, canonicalOrigin);
  return context.redirect(destination.toString(), 308);
});
