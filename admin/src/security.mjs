const encoder = new TextEncoder();
export const COOKIE = '__Host-pl-admin';
export const random = () => crypto.randomUUID();
export function b64(bytes) { return btoa(String.fromCharCode(...bytes)); }
export function unb64(value) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export function base64url(bytes) { return b64(bytes).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function unurl(value) { return unb64(value.replaceAll('-','+').replaceAll('_','/') + '='.repeat((4-value.length%4)%4)); }
async function key(secret) {
  if (typeof secret !== 'string' || encoder.encode(secret).length < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
export async function sign(payload, secret) {
  const body=base64url(encoder.encode(JSON.stringify(payload)));
  return body+'.'+base64url(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body))));
}
export async function verify(value, secret) {
  try {
    if (!value || value.length>4096) return null;
    const [body,signature,...extra]=value.split('.');
    if (extra.length || !await crypto.subtle.verify('HMAC',await key(secret),unurl(signature),encoder.encode(body))) return null;
    const payload=JSON.parse(new TextDecoder().decode(unurl(body)));
    return payload.exp>Date.now() ? payload : null;
  } catch { return null; }
}
export function local(env, url) { return !!env.LOCAL_STORE && ['127.0.0.1','localhost','[::1]'].includes(url.hostname); }
export function cookieName(env,url) { return local(env,url)?'pl-admin-local':COOKIE; }
export function cookies(request) { return Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>x.trim().split(/=(.*)/s)).filter(x=>x.length>1).map(x=>[x[0],x[1]])); }
export function cookie(name,value,{secure=true,maxAge=7200,sameSite='Strict'}={}) {
  return `${name}=${value}; Path=/; HttpOnly; ${secure?'Secure; ':''}SameSite=${sameSite}; Max-Age=${maxAge}`;
}
export function origin(env,url) {
  const expected=new URL(env.PUBLIC_ORIGIN);
  if (expected.origin!==url.origin || (!local(env,url)&&expected.protocol!=='https:')) throw new Error('PUBLIC_ORIGIN mismatch');
  return expected.origin;
}
export function authorized(session,env,url) {
  if (!session) return false;
  if (local(env,url) && session.local===true) return true;
  return !session.local && String(env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(String(session.id));
}
export function securityHeaders() {
  return {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
}
