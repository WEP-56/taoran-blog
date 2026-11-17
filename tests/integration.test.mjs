import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../scripts/test-server.mjs';

test('production HTTP security and empty-site lifecycle', { timeout: 120000 }, async () => {
  const server = await startTestServer();
  let cookie = '';
  const call = async (path, method = 'GET', body, authenticated = false, headers = {}) => fetch(server.origin + path, {
    method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    for (const path of ['/', '/archive', '/tags', '/moments', '/about', '/links', '/gallery', '/admin', '/rss.xml', '/sitemap.xml', '/robots.txt']) assert.equal((await call(path)).status, 200, path);
    assert.deepEqual(await (await call('/api/posts')).json(), []);
    for (const path of ['/api/posts?all=1', '/api/comments?all=1', '/api/telemetry']) assert.equal((await call(path)).status, 401, path);
    for (const name of ['posts', 'moments', 'friends', 'gallery', 'site', 'comments']) {
      if (name !== 'site') assert.equal((await call('/api/' + name + '/1', 'DELETE')).status, 401, name);
      if (name !== 'comments') assert.equal((await call('/api/' + name, name === 'site' ? 'PUT' : 'POST', {})).status, 401, name);
    }
    assert.equal((await call('/api/auth', 'POST', { passcode: 'air2026' })).status, 401);
    assert.equal((await call('/api/auth', 'POST', { passcode: 'test-password-only-2026' }, false, { Origin: 'https://evil.test' })).status, 403);
    const login = await call('/api/auth', 'POST', { passcode: 'test-password-only-2026' });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /Secure/i); assert.match(setCookie, /SameSite=strict/i);
    cookie = setCookie.split(';')[0];
    assert.equal((await call('/api/site', 'PUT', { siteName: 'Hijacked' }, true, { Origin: 'https://evil.test' })).status, 403);
    for (const [resource, body] of [
      ['moments', { id: null, content: '临时动态', tag: '日常', publishedAt: '' }],
      ['friends', { id: null, name: '测试友链', url: 'https://example.com', sortOrder: 1 }],
      ['gallery', { title: 'Test photo', caption: 'caption', imageUrl: 'https://example.com/photo.jpg', takenAt: '2026-11-17' }],
    ]) {
      const created = await call('/api/' + resource, 'POST', body, true);
      assert.equal(created.status, 201, resource);
      const row = await created.json();
      assert.equal((await call('/api/' + resource + '/' + row.id, 'DELETE', undefined, true)).status, 200);
    }
    const draftResponse = await call('/api/posts', 'POST', { title: 'Private draft', content: '# draft body', status: 'draft' }, true);
    assert.equal(draftResponse.status, 201);
    const draft = await draftResponse.json();
    assert.equal((await call('/api/posts/' + draft.id)).status, 404);
    assert.equal((await call('/posts/' + draft.slug)).status, 404);
    assert.equal((await call('/api/posts/' + draft.id, 'PUT', { action: 'like' })).status, 404);
    assert.equal((await call('/api/comments', 'POST', { postSlug: draft.slug, authorName: 'visitor', content: 'test' })).status, 404);
    assert.equal((await call('/api/posts/' + draft.id, 'PUT', { status: 'published' }, true)).status, 200);
    const submitted = await call('/api/comments', 'POST', { postSlug: draft.slug, authorName: 'visitor', authorEmail: 'private@example.com', content: 'hello', isAdmin: true, approved: true });
    assert.equal(submitted.status, 201);
    const comment = await submitted.json();
    assert.equal(comment.isAdmin, false); assert.equal(comment.approved, false); assert.equal(comment.authorEmail, '');
    assert.deepEqual(await (await call('/api/comments')).json(), []);
    assert.equal((await call('/api/comments/' + comment.id, 'PUT', { approved: true }, true)).status, 200);
    const publicComments = await (await call('/api/comments')).json();
    assert.equal(publicComments.length, 1); assert.equal(publicComments[0].authorEmail, '');
    const html = await (await call('/posts/' + draft.slug)).text();
    assert.ok(!html.includes('private@example.com'));
    assert.equal((await call('/api/posts/' + draft.id, 'PUT', { slug: 'changed-slug', status: 'draft' }, true)).status, 200);
    assert.deepEqual(await (await call('/api/comments')).json(), []);
    const privateComments = await (await call('/api/comments?all=1', 'GET', undefined, true)).json();
    assert.equal(privateComments[0].postSlug, 'changed-slug');
    assert.equal((await call('/api/friends', 'POST', { name: 'bad', url: 'javascript:alert(1)' }, true)).status, 400);
    assert.equal((await call('/api/posts/' + draft.id, 'PUT', { action: 'like', title: 'attack' })).status, 401);
    assert.equal((await call('/api/posts', 'POST', { content: 'x'.repeat(600000) }, true)).status, 413);
    assert.equal((await call('/api/posts/' + draft.id, 'DELETE', undefined, true)).status, 200);
    assert.deepEqual(await (await call('/api/comments?all=1', 'GET', undefined, true)).json(), []);
    assert.equal((await call('/api/auth', 'DELETE', undefined, true)).status, 200);
    assert.equal((await call('/api/posts?all=1', 'GET', undefined, true)).status, 401);
    const relogin = await call('/api/auth', 'POST', { passcode: 'test-password-only-2026' });
    cookie = relogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/site', 'PUT', { adminPasscode: 'changed-test-password-2026' }, true)).status, 200);
    assert.equal((await call('/api/posts?all=1', 'GET', undefined, true)).status, 401);
    assert.equal((await call('/api/auth', 'POST', { passcode: 'test-password-only-2026' })).status, 401);
    assert.equal((await call('/api/auth', 'POST', { passcode: 'changed-test-password-2026' })).status, 200);
    let limited;
    for (let i = 0; i < 12; i++) limited = await call('/api/auth', 'POST', { passcode: 'wrong' });
    assert.equal(limited.status, 429);
  } finally { await server.close(); }
});
