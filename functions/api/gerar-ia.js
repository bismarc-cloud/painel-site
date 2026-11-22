import { jsonResponse } from '../_lib/gdrive.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true });
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const body = await request.json();
    const apiKey = (body.apiKey || env.GEMINI_API_KEY || '').trim();
    const model = (body.model || 'gemini-2.5-flash').trim();
    const promptUsuario = (body.prompt || '').trim();
    const instrucoesGlobais = (body.instrucoesGlobais || '').trim();

    if (!apiKey) {
      return jsonResponse({ ok: false, error: 'Chave da Gemini API não configurada.' }, 400);
    }
    if (!promptUsuario) {
      return jsonResponse({ ok: false, error: 'Descreva o site que deseja gerar.' }, 400);
    }

    const systemPrompt = `Você é um Web Designer especialista em sites institucionais e landing pages.
Responda APENAS com um JSON válido (sem markdown, sem \`\`\`json) seguindo exatamente esta estrutura:
{
  "siteId": "slug-sem-acentos",
  "titulo": "Nome da Marca ou Profissional",
  "subtitulo": "Slogan curto",
  "whatsapp": "5522999999999",
  "instagram": "@perfil",
  "paleta": {
    "primaria": "#1E293B",
    "secundaria": "#E2E8F0",
    "fundo": "#F8FAFC",
    "destaque": "#2563EB",
    "texto": "#0F172A"
  },
  "secoes": [
    {
      "id": "hero",
      "tipo": "hero",
      "menu": "Início",
      "titulo": "Frase de impacto principal",
      "descricao": "Subtítulo persuasivo explicando o serviço.",
      "textoBotao": "Falar no WhatsApp",
      "usarImagem": true,
      "fonteImagem": "padrao"
    },
    {
      "id": "servicos",
      "tipo": "cards",
      "menu": "Serviços",
      "titulo": "Nossos Serviços",
      "subtitulo": "Conheça como podemos ajudar você",
      "colunas": 3,
      "itens": [
        { "titulo": "Serviço 1", "descricao": "Descrição objetiva.", "textoBotao": "Solicitar", "usarImagem": true, "fonteImagem": "padrao" },
        { "titulo": "Serviço 2", "descricao": "Descrição objetiva.", "textoBotao": "Solicitar", "usarImagem": true, "fonteImagem": "padrao" },
        { "titulo": "Serviço 3", "descricao": "Descrição objetiva.", "textoBotao": "Solicitar", "usarImagem": true, "fonteImagem": "padrao" }
      ]
    },
    {
      "id": "sobre",
      "tipo": "sobre",
      "menu": "Sobre",
      "titulo": "Quem Somos",
      "descricao": "História e diferenciais da empresa ou profissional.",
      "usarImagem": true,
      "fonteImagem": "padrao"
    }
  ],
  "rodape": {
    "endereco": "Cidade / Estado",
    "copyright": "© 2026 Todos os direitos reservados."
  }
}
${instrucoesGlobais ? 'Regras adicionais: ' + instrucoesGlobais : ''}`;

    const isVertexKey = apiKey.startsWith('AQ.');
    const endpoint = isVertexKey
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nPedido do cliente:\n${promptUsuario}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ ok: false, error: data.error?.message || 'Erro ao chamar Gemini API', details: data }, res.status);
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const site = JSON.parse(cleanJson);

    return jsonResponse({ ok: true, site });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
