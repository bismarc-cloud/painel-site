import { getAccessToken, ensureFolder, readJsonFile, writeJsonFile, jsonResponse } from '../_lib/gdrive.js';

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

    const token = await getAccessToken(env);
    const rootId = env.GDRIVE_ROOT_FOLDER_ID;

    const siteFolderId = await ensureFolder(token, siteId, rootId);
    await writeJsonFile(token, 'config.json', siteFolderId, siteConfig);

    const index = (await readJsonFile(token, 'sites_index.json', rootId)) || [];
    const entry = {
      siteId,
      titulo: siteConfig.titulo || siteId,
      dominio: siteConfig.dominio || '',
      atualizadoEm: siteConfig.atualizadoEm
    };

    const pos = index.findIndex(s => s.siteId === siteId);
    if (pos >= 0) index[pos] = entry;
    else index.push(entry);

    await writeJsonFile(token, 'sites_index.json', rootId, index);

    return jsonResponse({ ok: true, siteId, atualizadoEm: siteConfig.atualizadoEm });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
