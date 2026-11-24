import { callDriveBridge, jsonResponse } from '../_lib/gdrive.js';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true });
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const contentType = request.headers.get('content-type') || '';
    let siteId = 'geral';
    let fileName = `img_${Date.now()}.png`;
    let mimeType = 'image/png';
    let base64 = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      siteId = String(form.get('siteId') || form.get('slug') || 'geral').replace(/[^a-z0-9-]/gi, '-');

      // Procura o arquivo em qualquer campo enviado no FormData (file, imagem, foto, arquivo, etc.)
      let file = form.get('file') || form.get('imagem') || form.get('foto') || form.get('arquivo');
      if (!file || typeof file === 'string') {
        for (const value of form.values()) {
          if (value && typeof value === 'object' && typeof value.arrayBuffer === 'function') {
            file = value;
            break;
          }
        }
      }

      if (!file || typeof file === 'string') {
        return jsonResponse({ ok: false, error: 'Nenhum arquivo de imagem encontrado no envio.' }, 400);
      }

      fileName = `${Date.now()}_${file.name || 'imagem.png'}`;
      mimeType = file.type || 'image/png';
      base64 = arrayBufferToBase64(await file.arrayBuffer());
    } else {
      const body = await request.json();
      siteId = String(body.siteId || body.slug || 'geral').replace(/[^a-z0-9-]/gi, '-');
      const rawData = body.base64 || body.dataUrl || body.imagem || body.image || body.file || '';

      if (!rawData) {
        return jsonResponse({ ok: false, error: 'Conteúdo base64 da imagem não enviado.' }, 400);
      }

      const mimeMatch = String(rawData).match(/^data:([^;]+);base64,/);
      mimeType = body.mimeType || (mimeMatch ? mimeMatch[1] : 'image/png');
      fileName = `${Date.now()}_${body.fileName || body.name || 'imagem.png'}`;
      base64 = String(rawData).replace(/^data:[^;]+;base64,/, '');
    }

    const driveRes = await callDriveBridge(env, {
      action: 'upload',
      siteId,
      fileName,
      mimeType,
      base64
    });

    if (!driveRes.ok) {
      return jsonResponse({ ok: false, error: driveRes.error || 'Falha no upload para o Google Drive.' }, 500);
    }

    return jsonResponse({
      ok: true,
      id: driveRes.id,
      url: driveRes.url
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
