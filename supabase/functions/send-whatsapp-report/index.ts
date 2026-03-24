import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Z-API has no strict message length limit like Twilio, but keep it reasonable
const MAX_MESSAGE_LENGTH = 4000;

interface ReportItem {
  item_name: string;
  verdict: "approved" | "rejected" | "inconclusive";
  verdict_summary: string;
  observation: string;
  corrective_action: string | null;
  priority: "low" | "medium" | "high" | null;
  employee_observation: string | null;
}

function formatPriority(priority: string | null): string {
  switch (priority) {
    case "high":
      return "🔴 Alta";
    case "medium":
      return "🟡 Média";
    case "low":
      return "🟢 Baixa";
    default:
      return "";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { report_id } = await req.json();

    console.log("📱 Sending WhatsApp report via Z-API:", report_id);

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      throw new Error("Credenciais Z-API não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch report with store info
    const { data: report, error: reportError } = await supabase
      .from("inspection_reports")
      .select(
        `
        *,
        stores:store_id (nome, whatsapp_recipients),
        checklist_types:checklist_type_id (nome)
      `,
      )
      .eq("id", report_id)
      .single();

    if (reportError) throw reportError;
    if (!report) throw new Error("Report not found");

    // Deduplication guard: if already sent, skip
    if (report.whatsapp_sent_at) {
      console.log("⚠️ Report already sent via WhatsApp at:", report.whatsapp_sent_at);
      return new Response(
        JSON.stringify({
          success: true,
          already_sent: true,
          message: "Report already sent",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("📋 Report loaded:", report.id);

    // 2. Fetch report items
    const { data: items, error: itemsError } = await supabase
      .from("inspection_report_items")
      .select("*")
      .eq("report_id", report_id)
      .order("created_at");

    if (itemsError) throw itemsError;
    console.log(`📝 Report items: ${items?.length || 0}`);

    // 3. Get recipients
    const recipients = report.stores?.whatsapp_recipients || report.whatsapp_recipients || [];

    if (recipients.length === 0) {
      console.log("⚠️ No WhatsApp recipients configured");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No recipients configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Build message (Z-API allows longer messages)
    const storeName = report.stores?.nome || "Loja";
    const checklistName = report.checklist_types?.nome || "Checklist";
    const executedBy = report.executed_by_name || "Colaborador";
    const executionDate = formatDate(report.execution_date);

    // Separate items by verdict and type
    const rejectedItems = (items || []).filter((i: ReportItem) => i.verdict === "rejected");
    const approvedItems = (items || []).filter((i: ReportItem) => i.verdict === "approved");
    const inconclusiveItems = (items || []).filter((i: ReportItem) => i.verdict === "inconclusive");
    
    // Filter out items that are only "padrão não configurado" without observation
    // These should not appear in the WhatsApp report
    const filteredInconclusiveItems = inconclusiveItems.filter(
      (i: ReportItem) => 
        i.employee_observation || // Has employee observation
        (i.verdict_summary && !i.verdict_summary.includes('Padrão não configurado')) // Or is not "unconfigured standard"
    );

    // Further separate into "text observations" vs "inspection issues"
    const textObservations = filteredInconclusiveItems.filter(
      (i: ReportItem) => i.verdict_summary === 'Observação registrada'
    );
    const inspectionIssues = filteredInconclusiveItems.filter(
      (i: ReportItem) => i.verdict_summary !== 'Observação registrada'
    );

    // Build message parts
    let message = `📋 *INSPEÇÃO - ${checklistName}*\n`;
    message += `🏬 ${storeName}\n`;
    message += `👤 ${executedBy} | 📅 ${executionDate}\n\n`;

    // Summary first
    message += `📊 *RESUMO:* `;
    message += `✅${report.total_approved} `;
    message += `❌${report.total_rejected} `;
    if (inspectionIssues.length > 0) {
      message += `⚠️${inspectionIssues.length}`;
    }
    if (textObservations.length > 0) {
      message += ` 💬${textObservations.length}`;
    }
    message += `\n\n`;

    // Rejected items with details (priority)
    if (rejectedItems.length > 0) {
      message += `❌ *REPROVADOS:*\n`;
      for (const item of rejectedItems as ReportItem[]) {
        message += `• ${truncateText(item.item_name, 50)}\n`;
        if (item.employee_observation) {
          message += `  💬 Colaborador: _${truncateText(item.employee_observation, 80)}_\n`;
        }
        if (item.verdict_summary) {
          message += `  🤖 _${truncateText(item.verdict_summary, 80)}_\n`;
        }
        if (item.corrective_action) {
          message += `  🔧 ${truncateText(item.corrective_action, 100)}\n`;
        }
        if (item.priority) {
          message += `  ${formatPriority(item.priority)}\n`;
        }
      }
      message += `\n`;
    }

    // Inspection issues (inconclusive with problems - not text-only observations)
    if (inspectionIssues.length > 0) {
      message += `⚠️ *INCONCLUSIVOS:*\n`;
      for (const item of inspectionIssues as ReportItem[]) {
        message += `• ${truncateText(item.item_name, 50)}\n`;
        if (item.employee_observation) {
          message += `  💬 Colaborador: _${truncateText(item.employee_observation, 80)}_\n`;
        }
        if (item.verdict_summary && !item.verdict_summary.includes('observação')) {
          message += `  ℹ️ _${truncateText(item.verdict_summary, 60)}_\n`;
        }
      }
      message += `\n`;
    }

    // Text-only observations (new section)
    if (textObservations.length > 0) {
      message += `💬 *OBSERVAÇÕES DOS COLABORADORES:*\n`;
      for (const item of textObservations as ReportItem[]) {
        message += `• *${truncateText(item.item_name, 40)}:* _${truncateText(item.observation || '', 100)}_\n`;
      }
      message += `\n`;
    }

    // Approved items
    if (approvedItems.length > 0) {
      message += `✅ *APROVADOS:* `;
      const approvedNames = (approvedItems as ReportItem[]).map((i) => truncateText(i.item_name, 30)).join(", ");
      message += truncateText(approvedNames, 300);
      message += `\n\n`;
    }

    // Priority actions
    const priorityActions = report.priority_actions || [];
    if (priorityActions.length > 0) {
      message += `⚡ *AÇÕES URGENTES:*\n`;
      priorityActions.slice(0, 5).forEach((action: string, index: number) => {
        message += `${index + 1}. ${truncateText(action, 100)}\n`;
      });
      message += `\n`;
    }

    message += `📲 _Inspetor Sanitário Virtual_`;

    // Truncate if still too long
    if (message.length > MAX_MESSAGE_LENGTH) {
      message = message.substring(0, MAX_MESSAGE_LENGTH - 50) + `\n\n... (truncado)\n📲 _Inspetor Virtual_`;
    }

    console.log("📝 Message formatted, length:", message.length);

    // 5. Mark as sent BEFORE sending (prevents concurrent duplicates)
    const { error: updateError } = await supabase
      .from("inspection_reports")
      .update({ whatsapp_sent_at: new Date().toISOString() })
      .eq("id", report_id);

    if (updateError) {
      console.error("❌ Failed to update whatsapp_sent_at:", updateError);
    }

    // 6. Send to each recipient via Z-API
    const results: { recipient: string; success: boolean; error?: string }[] = [];
    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

    for (const recipient of recipients) {
      // Z-API uses format: DDI + DDD + Number (e.g., 5548999999999) or Group ID (e.g., 120363023940183020@g.us)
      const isGroup = recipient.includes('@g.us');
      const targetRecipient = isGroup ? recipient : recipient.replace(/\D/g, "");

      console.log(`📤 Sending to: ${targetRecipient} via Z-API`);

      try {
        const zapiResponse = await fetch(zapiUrl, {
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

        const responseData = await zapiResponse.json();

        if (!zapiResponse.ok || responseData.error) {
          console.error(`❌ Z-API error for ${recipient}:`, responseData);
          results.push({
            recipient,
            success: false,
            error: responseData.error || responseData.message || "Z-API error",
          });
        } else {
          console.log(`✅ Message sent to ${recipient}:`, responseData.messageId || responseData.zapiMessageId);
          results.push({ recipient, success: true });
        }

        // Rate limiting: wait 1 second between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (sendError) {
        console.error(`❌ Error sending to ${recipient}:`, sendError);
        results.push({
          recipient,
          success: false,
          error: sendError instanceof Error ? sendError.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    console.log(`📊 WhatsApp results: ${successCount}/${recipients.length} sent`);

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        total_recipients: recipients.length,
        successful_sends: successCount,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ WhatsApp Report error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
