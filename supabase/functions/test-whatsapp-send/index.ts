import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, store_name } = await req.json();

    if (!phone_number) {
      throw new Error('phone_number é obrigatório');
    }

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      throw new Error('Credenciais Z-API não configuradas');
    }

    // Z-API usa formato: DDI + DDD + Número (ex: 5548999999999)
    const cleanedNumber = phone_number.replace(/\D/g, '');
    
    const message = `📋 *Teste de Configuração WhatsApp*

✅ Conexão validada com sucesso!

🏪 Loja: ${store_name || 'Não informada'}
⏰ Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

_Esta é uma mensagem de teste do Inspetor Sanitário Virtual._`;

    console.log(`📤 Enviando teste para ${targetRecipient} via Z-API`);

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN || '',
      },
      body: JSON.stringify({
        phone: targetRecipient,
        message: message,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error('❌ Erro Z-API:', result);
      throw new Error(result.error || result.message || `Erro ${response.status}`);
    }

    console.log('✅ Mensagem de teste enviada:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.messageId || result.zapiMessageId,
        to: targetRecipient 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
