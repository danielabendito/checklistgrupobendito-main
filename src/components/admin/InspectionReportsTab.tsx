import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, RefreshCw, Eye, Send, CheckCircle2, XCircle, AlertCircle, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectionReport {
  id: string;
  store_id: string;
  checklist_type_id: string;
  execution_date: string;
  executed_by_name: string | null;
  status: string;
  total_approved: number | null;
  total_rejected: number | null;
  total_inconclusive: number | null;
  summary: string | null;
  priority_actions: unknown;
  whatsapp_sent_at: string | null;
  created_at: string;
  checklist_types?: { nome: string } | null;
}

interface ReportItem {
  id: string;
  item_name: string;
  verdict: string;
  verdict_summary: string | null;
  observation: string;
  corrective_action: string | null;
  priority: string | null;
  evidence_photo_url: string | null;
  employee_observation: string | null;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-500">✅ Aprovado</Badge>;
    case 'rejected':
      return <Badge className="bg-red-500">❌ Reprovado</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500">⚠️ Pendente</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function VerdictIcon({ verdict }: { verdict: string }) {
  switch (verdict) {
    case 'approved':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'inconclusive':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return null;
  }
}

export function InspectionReportsTab() {
  const { currentStore } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedReport, setSelectedReport] = useState<InspectionReport | null>(null);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (currentStore) {
      loadReports();
    }
  }, [currentStore, selectedDate]);

  const loadReports = async () => {
    if (!currentStore) return;

    try {
      setLoading(true);

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('inspection_reports')
        .select(`
          *,
          checklist_types:checklist_type_id (nome)
        `)
        .eq('store_id', currentStore.id)
        .eq('execution_date', dateStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports((data || []) as InspectionReport[]);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar relatórios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async (report: InspectionReport) => {
    try {
      setDetailsLoading(true);
      setSelectedReport(report);

      const { data, error } = await supabase
        .from('inspection_report_items')
        .select('*')
        .eq('report_id', report.id)
        .order('created_at');

      if (error) throw error;
      setReportItems((data || []) as ReportItem[]);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar detalhes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleResendWhatsApp = async (reportId: string) => {
    try {
      setResending(reportId);

      const response = await supabase.functions.invoke('send-whatsapp-report', {
        body: { report_id: reportId },
      });

      if (response.error) throw response.error;

      const data = response.data;
      
      if (data.success) {
        toast({
          title: "WhatsApp enviado",
          description: `Relatório enviado para ${data.successful_sends}/${data.total_recipients} destinatários`,
        });
        loadReports();
      } else {
        throw new Error(data.message || 'Falha ao enviar');
      }

    } catch (error: any) {
      toast({
        title: "Erro ao enviar WhatsApp",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatórios de Inspeção</h2>
          <p className="text-muted-foreground">
            Histórico de análises do Inspetor Sanitário Virtual
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={loadReports}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum relatório de inspeção para esta data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {report.checklist_types?.nome}
                      <StatusBadge status={report.status} />
                    </CardTitle>
                    <CardDescription>
                      Executado por {report.executed_by_name} às {format(new Date(report.created_at), "HH:mm", { locale: ptBR })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadReportDetails(report)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendWhatsApp(report.id)}
                      disabled={resending === report.id}
                    >
                      {resending === report.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          {report.whatsapp_sent_at ? 'Reenviar' : 'Enviar'} WhatsApp
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{report.total_approved} aprovados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">{report.total_rejected} reprovados</span>
                  </div>
                  {report.total_inconclusive > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{report.total_inconclusive} inconclusivos</span>
                    </div>
                  )}
                  {report.whatsapp_sent_at && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Send className="h-4 w-4" />
                      <span className="text-sm">
                        Enviado às {format(new Date(report.whatsapp_sent_at), "HH:mm")}
                      </span>
                    </div>
                  )}
                </div>
                {report.summary && (
                  <p className="text-sm text-muted-foreground mt-3">
                    {report.summary}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Relatório de Inspeção - {selectedReport?.checklist_types?.nome}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Summary */}
                {selectedReport && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Resumo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-6 mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span>{selectedReport.total_approved} aprovados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span>{selectedReport.total_rejected} reprovados</span>
                        </div>
                        {selectedReport.total_inconclusive > 0 && (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                            <span>{selectedReport.total_inconclusive} inconclusivos</span>
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground">{selectedReport.summary}</p>
                      
                      {Array.isArray(selectedReport.priority_actions) && selectedReport.priority_actions.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-semibold mb-2">⚠️ Ações Prioritárias:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {(selectedReport.priority_actions as string[]).map((action, i) => (
                              <li key={i} className="text-sm">{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Items */}
                {reportItems.map((item) => (
                  <Card key={item.id} className={cn(
                    item.verdict === 'rejected' && 'border-red-200 bg-red-50/50',
                    item.verdict === 'approved' && 'border-green-200 bg-green-50/50',
                    item.verdict === 'inconclusive' && 'border-yellow-200 bg-yellow-50/50'
                  )}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <VerdictIcon verdict={item.verdict} />
                        <CardTitle className="text-base">{item.item_name}</CardTitle>
                      </div>
                      {item.verdict_summary && (
                        <CardDescription>{item.verdict_summary}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.employee_observation && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                            💬 Observação do Colaborador:
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{item.employee_observation}</p>
                        </div>
                      )}

                      {item.observation && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">🤖 Análise da IA:</h4>
                          <p className="text-sm text-muted-foreground">{item.observation}</p>
                        </div>
                      )}
                      
                      {item.corrective_action && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Ação Corretiva:</h4>
                          <p className="text-sm text-muted-foreground">{item.corrective_action}</p>
                          {item.priority && (
                            <Badge variant="outline" className="mt-2">
                              Prioridade: {item.priority === 'high' ? '🔴 Alta' : item.priority === 'medium' ? '🟡 Média' : '🟢 Baixa'}
                            </Badge>
                          )}
                        </div>
                      )}

                      {item.evidence_photo_url && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Foto de Evidência:</h4>
                          <img
                            src={item.evidence_photo_url}
                            alt="Evidência"
                            className="w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setSelectedPhoto(item.evidence_photo_url);
                              setPhotoViewerOpen(true);
                            }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Dialog */}
      <Dialog open={photoViewerOpen} onOpenChange={setPhotoViewerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Foto de Evidência</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Evidência ampliada"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
