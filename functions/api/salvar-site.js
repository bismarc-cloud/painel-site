import { callDriveBridge, jsonResponse } from '../_lib/gdrive.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true });
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const siteConfig = await request.json();
    const siteId = String(siteConfig.siteId || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!siteId) {
      return jsonResponse({ ok: false, error: 'siteId (slug) inválido.' }, 400);
    }

    siteConfig.siteId = siteId;
    siteConfig.atualizadoEm = new Date().toISOString();

    const entry = {
      siteId,
      titulo: siteConfig.titulo || siteId,
      dominio: siteConfig.dominio || '',
      atualizadoEm: siteConfig.atualizadoEm
    };

    // 1. Grava no Cloudflare KV (imediato)
    let kvSaved = false;
    if (env.SITES_KV) {
      await env.SITES_KV.put(`site:${siteId}`, JSON.stringify(siteConfig));
      const index = (await env.SITES_KV.get('sites_index', 'json')) || [];
      const pos = index.findIndex(s => s.siteId === siteId);
      if (pos >= 0) index[pos] = entry;
      else index.push(entry);
      await env.SITES_KV.put('sites_index', JSON.stringify(index));
      kvSaved = true;
    }

    // 2. Espelha no Google Drive via Apps Script (backup + organização em pastas)
    const driveRes = await callDriveBridge(env, {
      action: 'save_site',
      siteConfig
    });

    if (!kvSaved && !driveRes.ok) {
      return jsonResponse({
        ok: false,
        error: driveRes.error || 'Nem SITES_KV nem GDRIVE_SCRIPT_URL estão configurados.'
      }, 500);
    }

    return jsonResponse({
      ok: true,
      siteId,
      atualizadoEm: siteConfig.atualizadoEm,
      kvSaved,
      driveSynced: !!driveRes.ok,
      driveError: driveRes.ok ? null : driveRes.error
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
