import { callDriveBridge, jsonResponse } from '../_lib/gdrive.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true });

  try {
    if (env.SITES_KV) {
      const kvSites = await env.SITES_KV.get('sites_index', 'json');
      if (Array.isArray(kvSites) && kvSites.length > 0) {
        return jsonResponse({ ok: true, source: 'kv', sites: kvSites });
      }
    }

    const driveRes = await callDriveBridge(env, { action: 'get_sites' });
    if (driveRes.ok && Array.isArray(driveRes.sites)) {
      if (env.SITES_KV && driveRes.sites.length > 0) {
        await env.SITES_KV.put('sites_index', JSON.stringify(driveRes.sites));
      }
      return jsonResponse({ ok: true, source: 'drive', sites: driveRes.sites });
    }

    return jsonResponse({ ok: true, source: 'empty', sites: [] });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
