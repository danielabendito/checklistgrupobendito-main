import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InspectionRequest {
  store_id: string;
  checklist_type_id: string;
  execution_date: string;
  user_id: string;
  user_name: string;
}

interface ItemAnalysis {
  item_id: string;
  item_name: string;
  verdict: 'approved' | 'rejected' | 'inconclusive';
  verdict_summary: string;
  observation: string;
  corrective_action: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  evidence_photo_url: string | null;
  employee_observation: string | null;
}

// Helper function to convert storage paths to public URLs
function getPublicUrl(bucket: string, path: string): string {
  // If path is already a full URL, return it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, construct the public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { store_id, checklist_type_id, execution_date, user_id, user_name } = await req.json() as InspectionRequest;
    
    console.log('🔍 Starting AI inspection:', { store_id, checklist_type_id, execution_date, user_id });

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch checklist type info
    const { data: checklistType, error: checklistError } = await supabase
      .from('checklist_types')
      .select('nome, turno, area')
      .eq('id', checklist_type_id)
      .single();

    if (checklistError) throw checklistError;
    console.log('📋 Checklist:', checklistType.nome);

    // 2. Fetch ALL checklist items (not just those requiring photos)
    const { data: items, error: itemsError } = await supabase
      .from('checklist_items')
      .select('id, nome, requer_foto')
      .eq('checklist_type_id', checklist_type_id)
      .eq('store_id', store_id)
      .order('ordem');

    if (itemsError) throw itemsError;
    console.log(`📋 Total checklist items: ${items?.length || 0}`);

    if (!items || items.length === 0) {
      console.log('⚠️ No checklist items found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No checklist items found',
        report_id: null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Separate items by type for logging
    const itemsWithPhoto = items.filter(i => i.requer_foto);
    const itemsWithoutPhoto = items.filter(i => !i.requer_foto);
    console.log(`📷 Items requiring photos: ${itemsWithPhoto.length}`);
    console.log(`📝 Items without photos: ${itemsWithoutPhoto.length}`);

    // 3. Fetch ALL checklist responses (with or without photos)
    const { data: responses, error: responsesError } = await supabase
      .from('checklist_responses')
      .select('checklist_item_id, photo_url, status, observacoes')
      .eq('checklist_type_id', checklist_type_id)
      .eq('store_id', store_id)
      .eq('data', execution_date)
      .eq('user_id', user_id)
      .in('checklist_item_id', items.map(i => i.id));

    if (responsesError) throw responsesError;
    console.log(`📝 Responses found: ${responses?.length || 0}`);

    // 4. Fetch ALL inspection standards (enabled and disabled) to differentiate
    const { data: standards, error: standardsError } = await supabase
      .from('inspection_standards')
      .select('checklist_item_id, criteria, severity, reference_photos, enabled')
      .eq('store_id', store_id)
      .in('checklist_item_id', items.map(i => i.id));

    if (standardsError) throw standardsError;
    console.log(`📐 Standards found: ${standards?.length || 0}`);

    // Create maps for quick lookup
    const standardsMap = new Map(standards?.map(s => [s.checklist_item_id, s]) || []);
    const responsesMap = new Map(responses?.map(r => [r.checklist_item_id, r]) || []);
    
    // Identify explicitly disabled items (standard exists but enabled = false)
    const disabledItemIds = new Set(
      standards?.filter(s => s.enabled === false).map(s => s.checklist_item_id) || []
    );

    // 5. Fetch store info for WhatsApp recipients
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('nome, whatsapp_recipients')
      .eq('id', store_id)
      .single();

    if (storeError) throw storeError;

    // 6. Analyze each item with AI
    const analysisResults: ItemAnalysis[] = [];
    let totalApproved = 0;
    let totalRejected = 0;
    let totalInconclusive = 0;

    for (const item of items) {
      const response = responsesMap.get(item.id);
      const standard = standardsMap.get(item.id);
      const employeeObs = response?.observacoes;

      // CASE 1: Item does NOT require photo
      if (!item.requer_foto) {
        // Only include if there's an observation from the employee
        if (employeeObs) {
          console.log(`💬 Item ${item.nome}: Text-only observation captured`);
          analysisResults.push({
            item_id: item.id,
            item_name: item.nome,
            verdict: 'inconclusive',
            verdict_summary: 'Observação registrada',
            observation: employeeObs,
            corrective_action: null,
            priority: null,
            evidence_photo_url: null,
            employee_observation: employeeObs,
          });
          totalInconclusive++;
        } else {
          console.log(`⏭️ Item ${item.nome}: No photo required and no observation - skipping`);
        }
        continue;
      }

      // CASE 2: Item requires photo but no photo provided
      if (!response?.photo_url) {
        console.log(`⚠️ Item ${item.nome}: Photo required but not provided (observation: ${employeeObs ? 'yes' : 'no'})`);
        analysisResults.push({
          item_id: item.id,
          item_name: item.nome,
          verdict: 'inconclusive',
          verdict_summary: employeeObs ? 'Foto não enviada (com observação)' : 'Foto não enviada',
          observation: employeeObs 
            ? `Observação do colaborador: ${employeeObs}` 
            : 'Não foi possível avaliar pois a foto de evidência não foi enviada.',
          corrective_action: employeeObs ? null : 'Reenviar foto de evidência para avaliação.',
          priority: employeeObs ? null : 'high',
          evidence_photo_url: null,
          employee_observation: employeeObs || null,
        });
        totalInconclusive++;
        continue;
      }

      // CASE 3: Item is explicitly DISABLED (standard exists but enabled = false)
      if (disabledItemIds.has(item.id)) {
        // Only include if there's an observation from the employee
        if (employeeObs) {
          console.log(`⏭️ Item ${item.nome}: Inspeção desativada, incluindo observação do colaborador`);
          analysisResults.push({
            item_id: item.id,
            item_name: item.nome,
            verdict: 'inconclusive',
            verdict_summary: 'Inspeção desativada (com observação)',
            observation: `Observação do colaborador: ${employeeObs}`,
            corrective_action: null,
            priority: null,
            evidence_photo_url: response.photo_url,
            employee_observation: employeeObs,
          });
          totalInconclusive++;
        } else {
          console.log(`⏭️ Item ${item.nome}: Inspeção desativada, pulando completamente`);
        }
        continue;
      }

      // CASE 4: Item requires photo, has photo, but no inspection standard configured
      if (!standard || !standard.criteria) {
        console.log(`⚠️ Item ${item.nome}: No inspection standard configured (observation: ${employeeObs ? 'yes' : 'no'})`);
        analysisResults.push({
          item_id: item.id,
          item_name: item.nome,
          verdict: 'inconclusive',
          verdict_summary: employeeObs 
            ? 'Padrão não configurado (com observação)' 
            : 'Padrão não configurado',
          observation: employeeObs 
            ? `Observação do colaborador: ${employeeObs}` 
            : 'Critério de inspeção não configurado para este item.',
          corrective_action: null,
          priority: null,
          evidence_photo_url: response.photo_url,
          employee_observation: employeeObs || null,
        });
        totalInconclusive++;
        continue;
      }

      // CASE 5: Item requires photo, has photo, and has ENABLED inspection standard -> AI Analysis

      // Convert paths to full public URLs
      const evidencePhotoUrl = getPublicUrl('checklist-photos', response.photo_url);
      const referencePhotoUrls = (standard.reference_photos || [])
        .slice(0, 2)
        .map((path: string) => getPublicUrl('inspection-references', path));

      console.log(`🔗 Evidence URL: ${evidencePhotoUrl}`);
      console.log(`🔗 Reference URLs: ${referencePhotoUrls.join(', ')}`);

      // Build AI prompt with images
      const messages: any[] = [
        {
          role: 'system',
          content: `Você é um inspetor sanitário responsável pela avaliação de checklists operacionais de restaurante.

Para cada item avaliado, gere uma análise seguindo estas regras:

- Avalie somente o que estiver visível nas fotos
- Compare a foto de evidência com as fotos de referência fornecidas
- Não presuma informações que não possam ser confirmadas visualmente
- Utilize linguagem técnica, clara e objetiva
- Seja rigoroso, como um fiscal da vigilância sanitária
- Se a foto não permitir avaliação clara, responda "inconclusive"

Responda APENAS em formato JSON válido com esta estrutura:
{
  "verdict": "approved" | "rejected" | "inconclusive",
  "verdict_summary": "Resumo curto do veredito (ex: 'Cozinha zerada e limpa')",
  "observation": "Observação técnica detalhada descrevendo apenas o visível na foto",
  "corrective_action": "Ação corretiva recomendada (null se approved)",
  "priority": "low" | "medium" | "high" | null
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Avalie o seguinte item:

📍 Local/Item: ${item.nome}
📋 Critério de inspeção: ${standard.criteria}
⚖️ Severidade configurada: ${standard.severity}
💬 Observação do colaborador: ${response.observacoes || 'Nenhuma'}

A primeira imagem é a foto de evidência enviada pelo colaborador.
${referencePhotoUrls.length > 0 ? 'As imagens seguintes são fotos de referência mostrando o padrão esperado.' : 'Não há fotos de referência cadastradas.'}

Analise criticamente se a foto de evidência atende ao critério especificado. Considere também a observação do colaborador no contexto da avaliação.`
            },
            {
              type: 'image_url',
              image_url: { url: evidencePhotoUrl }
            },
            ...referencePhotoUrls.map((url: string) => ({
              type: 'image_url',
              image_url: { url }
            }))
          ]
        }
      ];

      console.log(`🤖 Analyzing item: ${item.nome}`);

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages,
            max_tokens: 1000,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`❌ AI API error for ${item.nome}:`, errorText);
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        // Parse JSON response
        let analysis;
        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.error(`❌ Failed to parse AI response for ${item.nome}:`, content);
          analysis = {
            verdict: 'inconclusive',
            verdict_summary: 'Erro na análise',
            observation: 'Não foi possível processar a resposta da IA.',
            corrective_action: 'Tentar novamente ou verificar manualmente.',
            priority: 'medium'
          };
        }

        analysisResults.push({
          item_id: item.id,
          item_name: item.nome,
          verdict: analysis.verdict || 'inconclusive',
          verdict_summary: analysis.verdict_summary || '',
          observation: analysis.observation || '',
          corrective_action: analysis.corrective_action || null,
          priority: analysis.priority || (standard.severity as 'low' | 'medium' | 'high'),
          evidence_photo_url: response.photo_url,
          employee_observation: response?.observacoes || null,
        });

        if (analysis.verdict === 'approved') totalApproved++;
        else if (analysis.verdict === 'rejected') totalRejected++;
        else totalInconclusive++;

        console.log(`✅ Item ${item.nome}: ${analysis.verdict}`);

      } catch (aiError) {
        console.error(`❌ Error analyzing ${item.nome}:`, aiError);
        analysisResults.push({
          item_id: item.id,
          item_name: item.nome,
          verdict: 'inconclusive',
          verdict_summary: 'Erro na análise',
          observation: `Erro ao processar análise: ${aiError instanceof Error ? aiError.message : 'Erro desconhecido'}`,
          corrective_action: 'Verificar manualmente.',
          priority: 'medium',
          evidence_photo_url: response?.photo_url || null,
          employee_observation: response?.observacoes || null,
        });
        totalInconclusive++;
      }
    }

    // 7. Determine overall status
    let overallStatus: 'approved' | 'pending' | 'rejected' = 'approved';
    if (totalRejected > 0) {
      overallStatus = 'rejected';
    } else if (totalInconclusive > 0) {
      overallStatus = 'pending';
    }

    // 8. Generate priority actions
    const priorityActions = analysisResults
      .filter(r => r.verdict === 'rejected' && r.corrective_action)
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.priority || 'low'] || 2) - (priorityOrder[b.priority || 'low'] || 2);
      })
      .slice(0, 5)
      .map(r => r.corrective_action);

    // 9. Generate summary
    const summary = `Inspeção realizada com ${totalApproved} item(s) aprovado(s), ${totalRejected} reprovado(s) e ${totalInconclusive} inconclusivo(s). ${
      totalRejected > 0 
        ? 'Ações corretivas são necessárias antes do próximo turno.' 
        : 'Padrões de qualidade atendidos.'
    }`;

    // 10. Save report to database
    const { data: report, error: reportError } = await supabase
      .from('inspection_reports')
      .insert({
        store_id,
        checklist_type_id,
        execution_date,
        executed_by: user_id,
        executed_by_name: user_name,
        status: overallStatus,
        total_approved: totalApproved,
        total_rejected: totalRejected,
        total_inconclusive: totalInconclusive,
        summary,
        priority_actions: priorityActions,
        whatsapp_recipients: storeData.whatsapp_recipients || [],
      })
      .select()
      .single();

    if (reportError) throw reportError;
    console.log(`📊 Report saved: ${report.id}`);

    // 11. Save report items (including employee observation)
    const reportItems = analysisResults.map(r => ({
      report_id: report.id,
      checklist_item_id: r.item_id,
      item_name: r.item_name,
      verdict: r.verdict,
      verdict_summary: r.verdict_summary,
      observation: r.observation,
      corrective_action: r.corrective_action,
      priority: r.priority,
      evidence_photo_url: r.evidence_photo_url,
      employee_observation: r.employee_observation,
    }));

    const { error: itemsInsertError } = await supabase
      .from('inspection_report_items')
      .insert(reportItems);

    if (itemsInsertError) throw itemsInsertError;
    console.log(`📝 Report items saved: ${reportItems.length}`);

    // 12. Trigger WhatsApp notification if recipients exist
    if (storeData.whatsapp_recipients && storeData.whatsapp_recipients.length > 0) {
      console.log('📱 Triggering WhatsApp notification...');
      
      // Call send-whatsapp-report function
      const whatsappResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ report_id: report.id }),
      });

      if (!whatsappResponse.ok) {
        console.error('❌ Failed to send WhatsApp:', await whatsappResponse.text());
      } else {
        console.log('✅ WhatsApp notification sent');
      }
    } else {
      console.log('⚠️ No WhatsApp recipients configured');
    }

    return new Response(JSON.stringify({
      success: true,
      report_id: report.id,
      status: overallStatus,
      total_approved: totalApproved,
      total_rejected: totalRejected,
      total_inconclusive: totalInconclusive,
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ AI Inspection error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
