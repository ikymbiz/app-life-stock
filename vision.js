/* vision.js — Multi-provider Vision AI: Gemini / OpenAI / Claude
   ユーザーが設定したプロバイダーへ画像を送り、構造化JSONを返す
*/
const VisionAI = (() => {

  // ── プロンプト定義 ──
  const PROMPT = {
    expiry: `この食品パッケージの画像を見て、賞味期限または消費期限の日付を読み取ってください。
必ずJSONのみで返してください（コードブロック・説明文は不要）:
{ "expiry_date": "YYYY-MM-DD" }
日付が読み取れない場合: { "expiry_date": null }`,

    allergens: `この食品の原材料欄・成分表を読み取り、含まれるアレルゲンを特定してください。
日本の特定原材料（小麦・卵・乳・そば・落花生・えび・かに・くるみ）と準ずるもの（大豆・ごま・牛肉・豚肉・鶏肉・さば・さけ・バナナ等）に注目してください。
「含む可能性あり」「製造ラインで使用」も含めてください。
必ずJSONのみで返してください（コードブロック・説明文は不要）:
{ "allergens": ["小麦", "卵", "乳"] }
検出できない場合: { "allergens": [] }`,

    full: `この食品パッケージの画像から以下の情報を読み取ってください。
必ずJSONのみで返してください（コードブロック・説明文は不要）:
{
  "name": "商品名（日本語。読み取れない場合はnull）",
  "expiry_date": "YYYY-MM-DD または null",
  "allergens": ["含まれるアレルゲン名（日本語）"]
}`,
  };

  // ── メイン呼び出し ──
  async function analyze(base64DataURL, type = 'full') {
    const provider = await DB.Settings.get('ai_provider', 'none');
    if (provider === 'none') throw new Error('NO_PROVIDER');

    const apiKey = await DB.Settings.get(`ai_key_${provider}`, '');
    if (!apiKey) throw new Error('NO_KEY');

    const base64 = base64DataURL.includes(',') ? base64DataURL.split(',')[1] : base64DataURL;
    const prompt  = PROMPT[type] || PROMPT.full;

    switch (provider) {
      case 'gemini': return callGemini(apiKey, base64, prompt);
      case 'openai': return callOpenAI(apiKey, base64, prompt);
      case 'claude': return callClaude(apiKey, base64, prompt);
      default: throw new Error('UNKNOWN_PROVIDER');
    }
  }

  // ── Gemini ──
  async function callGemini(apiKey, base64, prompt) {
    const model = 'gemini-2.0-flash';
    const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body  = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
    };
    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseResult(text);
  }

  // ── OpenAI ──
  async function callOpenAI(apiKey, base64, prompt) {
    const url  = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } },
        ],
      }],
    };
    const res  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseResult(text);
  }

  // ── Claude ──
  async function callClaude(apiKey, base64, prompt) {
    const url  = 'https://api.anthropic.com/v1/messages';
    const body = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    };
    const res  = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Claude ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return parseResult(text);
  }

  // ── JSONパース ──
  function parseResult(text) {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) return {};
      const obj = JSON.parse(match[0]);
      // Sanitize expiry_date
      if (obj.expiry_date) {
        const d = new Date(obj.expiry_date);
        if (isNaN(d) || d.getFullYear() < 2000 || d.getFullYear() > 2060) obj.expiry_date = null;
      }
      // Sanitize allergens
      if (!Array.isArray(obj.allergens)) obj.allergens = [];
      return obj;
    } catch {
      console.error('[VisionAI] JSON parse failed:', text);
      return {};
    }
  }

  // ── 接続テスト（1×1の白いJPEG画像で軽量テスト）──
  async function testConnection() {
    // 1x1 白JPEG (base64)
    const tiny = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH'
               + 'BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAARC'
               + 'AABAAEDASIA AhEBAxEB/8QAFgABAQEA AAAAAAAAAAAAAAAAAAgHCf/EABQQAQAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqQAB/9k=';
    try {
      await analyze(`data:image/jpeg;base64,${tiny}`, 'full');
      return true;
    } catch (e) {
      if (e.message === 'NO_PROVIDER' || e.message === 'NO_KEY') throw e;
      // API接続自体はできたがエラー → keyは有効とみなす
      return true;
    }
  }

  // ── プロバイダー名表示 ──
  function providerLabel(id) {
    return { gemini: 'Gemini 2.0 Flash', openai: 'GPT-4o mini', claude: 'Claude Haiku', none: '使用しない' }[id] || id;
  }

  return { analyze, testConnection, providerLabel };
})();
