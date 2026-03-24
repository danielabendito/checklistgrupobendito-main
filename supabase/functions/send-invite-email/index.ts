import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  // Buscar email do secret (domínio verificado no Resend)
  const configuredEmail = Deno.env.get("RESEND_FROM_EMAIL");
  
  // Validação e sanitização do formato
  let fromEmail: string;
  if (configuredEmail) {
    const cleanEmail = configuredEmail.trim();
    // Se já tem formato "Nome <email>", usa direto
    fromEmail = cleanEmail.includes('<') 
      ? cleanEmail 
      : `Sistema de Checklists <${cleanEmail}>`;
  } else {
    // Fallback para email de teste
    fromEmail = 'Grupo Bendito <onboarding@resend.dev>';
  }
  
  console.log('📧 Enviando email de:', fromEmail);
  console.log('📧 Secret RESEND_FROM_EMAIL configurado?', !!configuredEmail);
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await res.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  invite_id: string;
  email: string;
  role: string;
  store_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔵 === INÍCIO DO PROCESSAMENTO DE CONVITE ===");
  const startTime = Date.now();

  try {
    const { invite_id, email, role, store_id }: InviteEmailRequest = await req.json();

    console.log("📧 [CONVITE] Dados recebidos:", {
      invite_id,
      email,
      role,
      store_id,
      timestamp: new Date().toISOString()
    });

    // Create Supabase client to fetch store name
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    console.log("🔑 [SUPABASE] URL configurada:", !!supabaseUrl);
    console.log("🔑 [SUPABASE] Service role key configurada:", !!supabaseKey);
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se o convite existe
    console.log("🔍 [DATABASE] Buscando convite:", invite_id);
    const { data: inviteData, error: inviteCheckError } = await supabase
      .from("email_invites")
      .select("id, email, role, used, expires_at, invitee_name")
      .eq("id", invite_id)
      .single();

    if (inviteCheckError) {
      console.error("❌ [DATABASE] Erro ao buscar convite:", inviteCheckError);
      throw new Error(`Convite não encontrado: ${inviteCheckError.message}`);
    }

    const inviteeName = inviteData.invitee_name;

    console.log("✅ [DATABASE] Convite encontrado:", {
      id: inviteData.id,
      email: inviteData.email,
      role: inviteData.role,
      used: inviteData.used,
      expires_at: inviteData.expires_at,
      invitee_name: inviteData.invitee_name
    });

    // Fetch store name
    console.log("🏪 [DATABASE] Buscando informações da loja:", store_id);
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("nome")
      .eq("id", store_id)
      .single();

    if (storeError) {
      console.error("❌ [DATABASE] Erro ao buscar loja:", storeError);
      throw new Error("Erro ao buscar informações da loja");
    }

    console.log("✅ [DATABASE] Loja encontrada:", store.nome);
    const storeName = store?.nome || "Sistema de Checklists";
    const signupUrl = `https://checklistgrupobendito.lovable.app/auth?invite=${invite_id}`;

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .info-box {
              background: white;
              border-left: 4px solid #667eea;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">🎉 Você foi convidado!</h1>
          </div>
          
          <div class="content">
            <p><strong>${inviteeName ? `Olá, ${inviteeName}!` : 'Olá!'}</strong></p>
            
            <p>Você foi convidado(a) para fazer parte da equipe de <strong>${storeName}</strong> no Sistema de Checklists do Grupo Bendito.</p>
            
            <div class="info-box">
              <p style="margin: 0;"><strong>📋 Sua função será:</strong> ${role}</p>
            </div>
            
            <p>Para aceitar o convite e criar sua conta, clique no botão abaixo:</p>
            
            <div style="text-align: center;">
              <a href="${signupUrl}" class="button">✨ Criar Minha Conta</a>
            </div>
            
            <div class="info-box">
              <p style="margin: 0; font-size: 14px;"><strong>📝 Instruções:</strong></p>
              <ol style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                <li>Clique no botão acima</li>
                <li>Preencha seus dados para criar sua conta</li>
                <li><strong>Use o mesmo email deste convite: ${email}</strong></li>
              </ol>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Este convite é válido apenas para: <strong>${email}</strong>
            </p>
            
            <div class="footer">
              <p style="margin: 0;">
                Atenciosamente,<br>
                <strong>Sistema de Checklists - Grupo Bendito</strong>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log("📨 [RESEND] Preparando envio de email...");
    console.log("📨 [RESEND] Destinatário:", email);
    console.log("📨 [RESEND] Assunto:", `Convite para ${storeName} - Sistema de Checklists`);
    
    const emailResponse = await sendEmail(
      email,
      `Convite para ${storeName} - Sistema de Checklists`,
      emailHtml
    );

    console.log("✅ [RESEND] Email enviado com sucesso!");
    console.log("✅ [RESEND] Response:", JSON.stringify(emailResponse));

    // Update sent_at, last_sent_at in email_invites
    console.log("🔄 [DATABASE] Atualizando timestamps do convite...");
    const { error: updateError } = await supabase
      .from("email_invites")
      .update({ 
        sent_at: new Date().toISOString(),
        last_sent_at: new Date().toISOString(),
      })
      .eq("id", invite_id);

    if (updateError) {
      console.error("⚠️ [DATABASE] Erro ao atualizar timestamps:", updateError);
      // Not throwing error as email was sent successfully
    } else {
      console.log("✅ [DATABASE] Timestamps atualizados com sucesso");
    }

    const duration = Date.now() - startTime;
    console.log(`🟢 === FIM DO PROCESSAMENTO (${duration}ms) ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email enviado com sucesso",
        emailResponse,
        duration_ms: duration
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("❌ [ERRO] Falha no processamento do convite");
    console.error("❌ [ERRO] Mensagem:", error.message);
    console.error("❌ [ERRO] Stack:", error.stack);
    console.error(`🔴 === FIM COM ERRO (${duration}ms) ===`);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erro ao enviar email",
        duration_ms: duration
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
