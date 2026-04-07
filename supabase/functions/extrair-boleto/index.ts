import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download image and convert to base64
    const imgResponse = await fetch(imageUrl);
    const imgBuffer = await imgResponse.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

    // Call Gemini Vision API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: `Analise esta imagem de boleto/conta a pagar. Extraia as seguintes informações e retorne SOMENTE um JSON válido, sem markdown, sem \`\`\`:

{
  "codigo_barras": "string ou null - a linha digitável/código de barras completo do boleto (geralmente 47-48 dígitos)",
  "valor": "number ou null - valor do documento em reais (ex: 150.50)",
  "vencimento": "string ou null - data de vencimento no formato DD/MM/YYYY",
  "beneficiario": "string ou null - nome de quem vai receber o pagamento",
  "tipo": "string - 'boleto', 'conta_luz', 'conta_agua', 'nota_fiscal', 'recibo' ou 'outro'"
}

Se não conseguir identificar algum campo, retorne null para ele. Se não for um documento de pagamento, retorne todos os campos como null.`
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        },
      }),
    });

    const geminiData = await geminiResponse.json();
    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Parse the JSON response
    let extracted;
    try {
      // Remove possible markdown code blocks
      const cleaned = textContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      extracted = JSON.parse(cleaned);
    } catch {
      extracted = { codigo_barras: null, valor: null, vencimento: null, beneficiario: null, tipo: 'outro' };
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
