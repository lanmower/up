import { createRequire } from 'module';
import { createRequire } from 'module';

var require = createRequire(import.meta.url);
var module = { exports: {} };

const require = createRequire(import.meta.url);

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response('invalid json', { status: 400 })
    }

    const { path, content } = body
    if (!path || content === undefined) {
      return new Response('missing path or content', { status: 400 })
    }

    const token = env.GH_TOKEN
    if (!token) {
      return new Response('server misconfigured', { status: 500 })
    }

    const repo = 'AnEntrypoint/up'

    const getUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`
    const getRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'up-webhook-worker',
      },
    })

    let sha
    if (getRes.ok) {
      const existing = await getRes.json()
      sha = existing.sha
    } else if (getRes.status !== 404) {
      const err = await getRes.text()
      return new Response(`failed to check existing file: ${err}`, { status: 502 })
    }

    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'up-webhook-worker',
      },
      body: JSON.stringify({
        message: sha ? `update ${path}` : `add ${path}`,
        content: btoa(content),
        sha,
      }),
    })

    if (!putRes.ok) {
      const err = await putRes.text()
      return new Response(`github api error: ${err}`, { status: 502 })
    }

    const data = await putRes.json()
    return new Response(JSON.stringify({ path, sha: data.content.sha, commit: data.commit.sha }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
};
