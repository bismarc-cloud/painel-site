import { getAccessToken, readJsonFile, jsonResponse } from '../_lib/gdrive.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true });

  try {
    const token = await getAccessToken(env);
    const rootId = env.GDRIVE_ROOT_FOLDER_ID;
    const sites = (await readJsonFile(token, 'sites_index.json', rootId)) || [];
    return jsonResponse({ ok: true, sites });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
