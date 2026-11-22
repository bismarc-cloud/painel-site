import { getAccessToken, ensureFolder, uploadBinaryFile, jsonResponse } from '../_lib/gdrive.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true });
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const token = await getAccessToken(env);
    const rootId = env.GDRIVE_ROOT_FOLDER_ID;
    const contentType = request.headers.get('content-type') || '';

    let siteId = 'geral';
    let fileName = `img_${Date.now()}.png`;
    let mimeType = 'image/png';
    let arrayBuffer;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      siteId = String(form.get('siteId') || 'geral').replace(/[^a-z0-9-]/gi, '-');
      if (!file || typeof file === 'string') {
        return jsonResponse({ ok: false, error: 'Arquivo não enviado.' }, 400);
      }
      fileName = `${Date.now()}_${file.name}`;
      mimeType = file.type || 'image/png';
      arrayBuffer = await file.arrayBuffer();
    } else {
      const body = await request.json();
      siteId = String(body.siteId || 'geral').replace(/[^a-z0-9-]/gi, '-');
      fileName = `${Date.now()}_${body.fileName || 'imagem.png'}`;
      mimeType = body.mimeType || 'image/png';
      const base64Clean = String(body.base64 || '').replace(/^data:[^;]+;base64,/, '');
      const binary = atob(base64Clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      arrayBuffer = bytes.buffer;
    }

    const siteFolderId = await ensureFolder(token, siteId, rootId);
    const assetsFolderId = await ensureFolder(token, 'assets', siteFolderId);
    const fileId = await uploadBinaryFile(token, fileName, mimeType, arrayBuffer, assetsFolderId);

    return jsonResponse({
      ok: true,
      id: fileId,
      url: `/api/img/${fileId}`
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
