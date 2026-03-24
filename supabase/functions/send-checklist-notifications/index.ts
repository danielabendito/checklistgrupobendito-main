import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Sistema de Checklists <onboarding@resend.dev>";

// Z-API Configuration
const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChecklistType {
  id: string;
  nome: string;
  area: string;
  turno: string;
}

// Função para obter data de Brasília (UTC-3)
function getBrasiliaDateString(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function getBrasiliaDateFormatted(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(new Date());
}

// Função para aguardar entre envios (evita rate limit)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para enviar WhatsApp via Z-API
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
    console.error("Z-API credentials not configured");
    return false;
  }

  const isGroup = phone.includes('@g.us');
  const targetRecipient = isGroup ? phone : phone.replace(/\D/g, '');
  const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  try {
    console.log(`Sending WhatsApp to: ${targetRecipient}`);
    
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
    
    if (response.ok) {
      console.log("WhatsApp sent successfully:", data);
      return true;
    } else {
      console.error("WhatsApp send failed:", data);
      return false;
    }
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { turno } = await req.json().catch(() => ({ turno: null }));
    const today = getBrasiliaDateString();
    const todayFormatted = getBrasiliaDateFormatted();
    
    console.log("=== CHECKLIST NOTIFICATIONS ===");
    console.log(`Brasília date: ${today}`);
    console.log(`UTC time: ${new Date().toISOString()}`);
    console.log(`Turno: ${turno || "all"}`);
    console.log("Email API Key configured:", !!RESEND_API_KEY);
    console.log("Z-API configured:", !!ZAPI_INSTANCE_ID && !!ZAPI_TOKEN);
    console.log("From email:", fromEmail);
    console.log("===============================");

    // Fetch all stores
    console.log("Fetching all stores...");
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id, nome");

    if (storesError || !stores || stores.length === 0) {
      console.error("Error fetching stores:", storesError);
      return new Response(
        JSON.stringify({ error: "No stores found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${stores.length} store(s) to process`);

    const processedStores = [];
    let totalEmailsSent = 0;
    let totalWhatsAppSent = 0;

    // Process each store independently
    for (const store of stores) {
      console.log(`\n=== Processing store: ${store.nome} (${store.id}) ===`);

      // Fetch admin settings for this store
      const { data: settings, error: settingsError } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("store_id", store.id)
        .maybeSingle();

      if (settingsError || !settings) {
        console.log(`No notification settings configured for store ${store.nome}, skipping...`);
        continue;
      }

      // Check if any notification channel is enabled
      const emailEnabled = settings.notification_channel_email ?? true;
      const whatsappEnabled = settings.notification_channel_whatsapp ?? false;

      if (!emailEnabled && !whatsappEnabled) {
        console.log(`No notification channels enabled for store ${store.nome}, skipping...`);
        continue;
      }

      // Fetch checklist types for this store
      const { data: checklists, error: checklistsError } = await supabase
        .from("checklist_types")
        .select("id, nome, area, turno, store_id")
        .eq("store_id", store.id);

      if (checklistsError || !checklists || checklists.length === 0) {
        console.log(`No checklists found for store ${store.nome}, skipping...`);
        continue;
      }

      const checklistIds = checklists.map(c => c.id);

      // Fetch checklist notifications for this store's checklists
      const { data: notifications, error: notificationsError } = await supabase
        .from("checklist_notifications")
        .select("checklist_type_id, turno")
        .in("checklist_type_id", checklistIds);

      if (notificationsError) {
        console.error(`Error fetching notifications for store ${store.nome}:`, notificationsError);
        continue;
      }

      // Filter by turno if provided
      const relevantNotifications = turno
        ? notifications?.filter((n) => n.turno === turno)
        : notifications;

      if (!relevantNotifications || relevantNotifications.length === 0) {
        console.log(`No notifications configured for store ${store.nome}`);
        continue;
      }

      const uncompletedByTurno: { [key: string]: ChecklistType[] } = {
        manha: [],
        tarde: [],
        noite: [],
      };

      // Check each notification configuration
      for (const notification of relevantNotifications) {
        const checklist = checklists.find(c => c.id === notification.checklist_type_id);
        
        if (!checklist) {
          console.error(`Checklist ${notification.checklist_type_id} not found in store ${store.nome}`);
          continue;
        }

        // Check if this checklist has been completed today for this store
        const { data: responses, error: responsesError } = await supabase
          .from("checklist_responses")
          .select("id")
          .eq("checklist_type_id", notification.checklist_type_id)
          .eq("store_id", store.id)
          .eq("data", today);

        if (responsesError) {
          console.error(`Error checking responses for checklist ${notification.checklist_type_id}:`, responsesError);
          continue;
        }

        if (!responses || responses.length === 0) {
          uncompletedByTurno[notification.turno].push(checklist);
          console.log(`Uncompleted checklist: ${checklist.nome} (${notification.turno})`);
        }
      }

      const totalUncompleted = uncompletedByTurno.manha.length + uncompletedByTurno.tarde.length + uncompletedByTurno.noite.length;

      if (totalUncompleted === 0) {
        console.log(`All configured checklists completed for store ${store.nome}`);
        continue;
      }

      console.log(`Store ${store.nome} has ${totalUncompleted} uncompleted checklists`);
      console.log(`Channels - Email: ${emailEnabled}, WhatsApp: ${whatsappEnabled}`);

      // Build email content
      let emailHtml = `<h1>Checklists Não Realizados - ${store.nome}</h1>`;
      emailHtml += `<p><strong>Data:</strong> ${todayFormatted}</p>`;

      // Build WhatsApp message
      let whatsappMessage = `⚠️ *Checklists Não Realizados*\n`;
      whatsappMessage += `📍 Loja: ${store.nome}\n`;
      whatsappMessage += `📅 Data: ${todayFormatted}\n\n`;

      if (uncompletedByTurno.manha.length > 0) {
        const manhaHtml = uncompletedByTurno.manha
          .map((cl) => `<li><strong>${cl.nome}</strong> - ${cl.area}</li>`)
          .join("");
        emailHtml += `
          <h2>☀️ Manhã (${settings.notification_time_manha.substring(0, 5)})</h2>
          <ul>${manhaHtml}</ul>
        `;
        
        whatsappMessage += `☀️ *Manhã:*\n`;
        uncompletedByTurno.manha.forEach(cl => {
          whatsappMessage += `• ${cl.nome} - ${cl.area}\n`;
        });
        whatsappMessage += `\n`;
      }

      if (uncompletedByTurno.tarde.length > 0) {
        const tardeHtml = uncompletedByTurno.tarde
          .map((cl) => `<li><strong>${cl.nome}</strong> - ${cl.area}</li>`)
          .join("");
        emailHtml += `
          <h2>🌤️ Tarde (${settings.notification_time_tarde.substring(0, 5)})</h2>
          <ul>${tardeHtml}</ul>
        `;
        
        whatsappMessage += `🌤️ *Tarde:*\n`;
        uncompletedByTurno.tarde.forEach(cl => {
          whatsappMessage += `• ${cl.nome} - ${cl.area}\n`;
        });
        whatsappMessage += `\n`;
      }

      if (uncompletedByTurno.noite.length > 0) {
        const noiteHtml = uncompletedByTurno.noite
          .map((cl) => `<li><strong>${cl.nome}</strong> - ${cl.area}</li>`)
          .join("");
        emailHtml += `
          <h2>🌙 Noite (${settings.notification_time_noite.substring(0, 5)})</h2>
          <ul>${noiteHtml}</ul>
        `;
        
        whatsappMessage += `🌙 *Noite:*\n`;
        uncompletedByTurno.noite.forEach(cl => {
          whatsappMessage += `• ${cl.nome} - ${cl.area}\n`;
        });
        whatsappMessage += `\n`;
      }

      emailHtml += `
        <p>Por favor, verifique e tome as medidas necessárias.</p>
        <br>
        <p><em>Esta é uma notificação automática do sistema de checklists.</em></p>
      `;
      
      whatsappMessage += `Por favor, verifique e tome as medidas necessárias.`;

      let emailSent = false;
      let whatsappSent = false;

      // Send Email if enabled
      if (emailEnabled && settings.notification_email && RESEND_API_KEY) {
        // Rate limit delay
        if (totalEmailsSent > 0) {
          console.log(`Waiting 600ms before sending next email...`);
          await delay(600);
        }

        console.log(`Sending email to: ${settings.notification_email}`);
        
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [settings.notification_email],
            subject: `⚠️ Checklists Não Realizados - ${store.nome} - ${todayFormatted}`,
            html: emailHtml,
          }),
        });

        const emailData = await emailResponse.json();
        
        if (emailResponse.ok) {
          console.log(`Email sent successfully for store ${store.nome}:`, emailData);
          totalEmailsSent++;
          emailSent = true;
        } else {
          console.error(`Failed to send email for store ${store.nome}:`, emailData);
        }
      }

      // Send WhatsApp if enabled - support multiple numbers
      if (whatsappEnabled) {
        const whatsappNumbers: string[] = (settings as any).notification_whatsapp_numbers || [];
        // Fallback to single number if array is empty
        if (whatsappNumbers.length === 0 && settings.notification_whatsapp_number) {
          whatsappNumbers.push(settings.notification_whatsapp_number);
        }

        for (const number of whatsappNumbers) {
          if (!number) continue;
          // Rate limit delay between sends
          if (totalWhatsAppSent > 0) {
            await delay(1000);
          }

          const success = await sendWhatsApp(number, whatsappMessage);
          if (success) {
            totalWhatsAppSent++;
            whatsappSent = true;
          }
        }
      }

      processedStores.push({
        store: store.nome,
        uncompleted: {
          manha: uncompletedByTurno.manha.length,
          tarde: uncompletedByTurno.tarde.length,
          noite: uncompletedByTurno.noite.length,
        },
        emailSent,
        whatsappSent,
      });
    }

    console.log(`\n=== Summary: Processed ${stores.length} stores, sent ${totalEmailsSent} emails, ${totalWhatsAppSent} WhatsApp messages ===`);

    return new Response(
      JSON.stringify({
        message: `Notifications processed for ${stores.length} store(s), ${totalEmailsSent} email(s) sent, ${totalWhatsAppSent} WhatsApp message(s) sent`,
        processedStores,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-checklist-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
