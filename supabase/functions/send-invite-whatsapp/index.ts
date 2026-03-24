// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteWhatsAppRequest {
  invite_id: string;
  email?: string | null;
  role: string;
  store_id: string;
  whatsapp_number: string;
  invite_type?: 'email' | 'phone';
}

// Mapa de roles para exibição amigável
const roleDisplayNames: { [key: string]: string } = {
  garcom: "Garçom",
  garconete: "Garçonete",
  atendente: "Atendente",
  lider: "Líder",
  cozinheiro: "Cozinheiro",
  cozinheiro_lider: "Cozinheiro Líder",
  auxiliar_cozinha: "Auxiliar de Cozinha",
  barman: "Barman",
  lider_bar: "Líder de Bar",
  admin: "Administrador",
  super_admin: "Super Administrador",
};

// Formatar número de telefone para exibição
const formatPhoneDisplay = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== SEND INVITE WHATSAPP ===");
    
    // Verificar credenciais Z-API
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      console.error("Z-API credentials not configured");
      return new Response(
        JSON.stringify({ error: "Z-API não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: InviteWhatsAppRequest = await req.json();
    const { invite_id, email, role, store_id, whatsapp_number, invite_type } = body;

    console.log("Request body:", { invite_id, email, role, store_id, whatsapp_number: whatsapp_number?.substring(0, 5) + "...", invite_type });

    if (!invite_id || !role || !store_id || !whatsapp_number) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inicializar Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar informações do convite para determinar o tipo e nome
    const { data: inviteData, error: inviteError } = await supabase
      .from("email_invites")
      .select("invite_type, email, whatsapp_number, invitee_name")
      .eq("id", invite_id)
      .single();

    if (inviteError) {
      console.error("Error fetching invite:", inviteError);
    }

    const actualInviteType = invite_type || inviteData?.invite_type || 'email';
    const inviteeName = inviteData?.invitee_name;

    // Buscar informações da loja
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("nome")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      console.error("Store not found:", storeError);
      return new Response(
        JSON.stringify({ error: "Loja não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar URL de convite
    const inviteUrl = `https://checklistgrupobendito.lovable.app/auth?invite=${invite_id}`;
    const roleDisplay = roleDisplayNames[role] || role;

    // Limpar número de WhatsApp (ou manter ID de grupo)
    const isGroup = whatsapp_number.includes('@g.us');
    const targetRecipient = isGroup ? whatsapp_number : whatsapp_number.replace(/\D/g, '');

    // Montar mensagem do WhatsApp baseada no tipo de convite
    let message: string;
    const greeting = inviteeName ? `Olá, *${inviteeName}*!` : 'Olá!';

    if (actualInviteType === 'phone') {
      // Convite de TELEFONE - usuário fará login com telefone
      message = `🎉 *Convite para o Sistema de Checklists*

${greeting} Você foi convidado(a) para fazer parte da equipe de *${store.nome}*.

📋 *Sua função será:* ${roleDisplay}

Para criar sua conta, acesse o link abaixo:
${inviteUrl}

📱 *Na tela de cadastro:*
O sistema já estará configurado para cadastro via telefone.
Use o número *${formatPhoneDisplay(targetRecipient)}* para criar sua conta.

Depois de criar sua senha, você poderá fazer login usando:
• Telefone: ${formatPhoneDisplay(targetRecipient)}
• Senha que você criar

Este convite é válido por 7 dias.

---
_Sistema de Checklists - Grupo Bendito_`;
    } else {
      // Convite de EMAIL - usuário fará login com email
      message = `🎉 *Convite para o Sistema de Checklists*

${greeting} Você foi convidado(a) para fazer parte da equipe de *${store.nome}*.

📋 *Sua função será:* ${roleDisplay}

Para criar sua conta, acesse o link abaixo:
${inviteUrl}

⚠️ *Importante:* Use o email *${email}* para se cadastrar.

Este convite é válido por 7 dias.

---
_Sistema de Checklists - Grupo Bendito_`;
    }
    
    console.log(`Sending WhatsApp invite to: ${targetRecipient} (type: ${actualInviteType})`);

    // Enviar via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

    const response = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": ZAPI_CLIENT_TOKEN || "",
      },
      body: JSON.stringify({
        phone: targetRecipient,
        message: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Z-API error:", data);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar WhatsApp", details: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp sent successfully:", data);

    // Atualizar registro do convite
    const { error: updateError } = await supabase
      .from("email_invites")
      .update({
        whatsapp_sent_at: new Date().toISOString(),
      })
      .eq("id", invite_id);

    if (updateError) {
      console.error("Error updating invite:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado via WhatsApp",
        invite_type: actualInviteType,
        zapi_response: data 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-invite-whatsapp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);