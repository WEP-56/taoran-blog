import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../scripts/test-server.mjs';
import sharp from 'sharp';

test('production HTTP security and empty-site lifecycle', { timeout: 120000 }, async () => {
  const server = await startTestServer();
  let cookie = '';
  const call = async (path, method = 'GET', body, authenticated = false, headers = {}) => fetch(server.origin + path, {
    method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    for (const path of ['/', '/archive', '/tags', '/moments', '/about', '/links', '/gallery', '/support', '/admin', '/rss.xml', '/sitemap.xml', '/robots.txt']) assert.equal((await call(path)).status, 200, path);
    const initialSupport = await (await call('/api/support')).json();
    assert.deepEqual(initialSupport, { reason: '', declaration: '', thanks: '', channels: [], supporters: [], revision: 0 });
    assert.equal((await call('/api/support', 'PUT', initialSupport)).status, 401);
    assert.equal((await call('/api/support?all=1')).status, 401);
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
    const image = await sharp({ create: { width: 12, height: 9, channels: 3, background: '#abcdef' } }).png().toBuffer();
    const upload = (body, authenticated = true, headers = {}) => fetch(server.origin + '/api/uploads', {
      method: 'POST', headers: { 'Content-Type': 'image/png', ...(authenticated ? { Cookie: cookie } : {}), ...headers }, body,
    });
    assert.equal((await upload(image, false)).status, 401);
    assert.equal((await upload(image, true, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).status, 400);
    assert.equal((await upload(image, true, { 'Content-Type': 'image/svg+xml' })).status, 415);
    const oversized = await upload(Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.equal(oversized.status, 413);
    const uploaded = await upload(image);
    assert.equal(uploaded.status, 201);
    const { url: imageUrl } = await uploaded.json();
    const served = await call(imageUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/webp');
    assert.equal((await sharp(Buffer.from(await served.arrayBuffer())).metadata()).width, 12);
    assert.equal((await call('/uploads/not-a-real-file.webp')).status, 404);
    const qrResponse = await fetch(server.origin + '/api/uploads?purpose=qr', {
      method: 'POST', headers: { 'Content-Type': 'image/png', Cookie: cookie }, body: image,
    });
    assert.equal(qrResponse.status, 201);
    const { url: qrUrl } = await qrResponse.json();
    const qrBytes = Buffer.from(await (await call(qrUrl)).arrayBuffer());
    assert.deepEqual(await sharp(qrBytes).raw().toBuffer(), await sharp(image).raw().toBuffer(), 'QR upload preserves source pixels');
    const supportDraft = {
      ...initialSupport, reason: '## 支持独立写作\n\n把有用的经验继续分享。', declaration: '完全自愿，感谢陪伴。', thanks: '感谢以下朋友！',
      channels: [{ id: 'kofi', name: 'Ko-fi', url: 'https://ko-fi.com/example', qrUrl: '', description: '一杯咖啡' }, { id: 'qr', name: '扫码支持', url: '', qrUrl, description: '' }],
      supporters: [{ id: 'reader', name: '测试读者', url: '', date: '2026-11-17', amount: '一杯咖啡', message: '谢谢你的鼓励' }],
    };
    assert.equal((await call('/api/support', 'PUT', supportDraft, true, { Origin: 'https://evil.test' })).status, 403);
    for (const bad of [
      { channels: [{ ...supportDraft.channels[0], url: 'javascript:alert(1)' }] },
      { channels: [{ ...supportDraft.channels[0], url: '', qrUrl: '' }] },
      { channels: [{ ...supportDraft.channels[0], qrUrl: '//evil.test/code.svg' }] },
      { channels: [supportDraft.channels[0], supportDraft.channels[0]] },
      { supporters: [{ ...supportDraft.supporters[0], date: '2026-02-30' }] },
      { supporters: [{ ...supportDraft.supporters[0], url: 'data:text/html,hi' }] },
      { supporters: [{ ...supportDraft.supporters[0], name: '' }] },
      { reason: 'x'.repeat(20001) }, { unexpected: true },
    ]) assert.equal((await call('/api/support', 'PUT', { ...supportDraft, ...bad }, true)).status, 400);
    const supportSaved = await call('/api/support', 'PUT', supportDraft, true);
    assert.equal(supportSaved.status, 200);
    assert.equal((await supportSaved.json()).revision, 1);
    assert.deepEqual(await (await call('/api/support')).json(), { ...supportDraft, revision: 1 });
    const supportHtml = await (await call('/support')).text();
    for (const text of ['支持独立写作', 'Ko-fi', '测试读者', qrUrl, '谢谢你的鼓励']) assert.ok(supportHtml.includes(text), text);
    assert.ok((await (await call('/sitemap.xml')).text()).includes('/support'));
    assert.equal((await call('/api/support', 'PUT', supportDraft, true)).status, 409, 'stale writes must not overwrite newer content');
    assert.equal((await call('/api/support', 'PUT', { ...initialSupport, revision: 1 }, true)).status, 200);
    assert.deepEqual(await (await call('/api/support')).json(), { ...initialSupport, revision: 2 }, 'removals persist');
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
