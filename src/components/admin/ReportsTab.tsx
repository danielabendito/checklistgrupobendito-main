import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Eye, Image as ImageIcon, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF, exportToCSV } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

interface ChecklistExecution {
  id: string;
  checklist_type_id: string;
  checklist_type_name: string;
  user_id: string;
  user_name: string;
  data: string;
  items_total: number;
  items_ok: number;
  items_nok: number;
  has_all_photos: boolean;
  items_with_required_photos: number;
  items_with_photos_uploaded: number;
  completed_at: string | null;
}

interface ExecutionDetail {
  item_nome: string;
  item_ordem: number;
  status: string;
  observacoes: string | null;
  photo_url: string | null;
}

export function ReportsTab() {
  const { currentStore, loading: storeLoading } = useStore();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetail[]>([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    console.log("📊 [REPORTS] useEffect triggered", { 
      date: date ? format(date, "yyyy-MM-dd") : null, 
      currentStore: currentStore?.id, 
      storeLoading,
      hasStore: !!currentStore 
    });
    
    if (date && currentStore) {
      console.log("✅ [REPORTS] Condições satisfeitas, carregando execuções...");
      loadExecutions();
    } else {
      console.warn("⚠️ [REPORTS] Aguardando requisitos:", {
        hasDate: !!date,
        hasStore: !!currentStore,
        storeLoading
      });
    }
  }, [date, currentStore]);

  const loadExecutions = async () => {
    if (!date || !currentStore) {
      console.error("❌ [REPORTS] Missing requirements:", { date, currentStore });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const dateStr = format(date, "yyyy-MM-dd");

      console.log("🔍 [REPORTS] Starting query with:", {
        date: dateStr,
        store_id: currentStore.id
      });

      // Get all responses for the selected date
    const { data: responses, error } = await supabase
      .from("checklist_responses")
      .select(`
        id,
        checklist_type_id,
        user_id,
        user_name,
        user_email,
        data,
        status,
        photo_url,
        completed_at,
        checklist_types!inner(nome),
        checklist_items!checklist_item_id(nome, ordem, requer_foto)
      `)
      .eq("data", dateStr)
      .eq("store_id", currentStore.id);

      if (error) {
        console.error("❌ [REPORTS] Query error:", error);
        toast({
          title: "Erro ao carregar relatórios",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      console.log(`✅ [REPORTS] Loaded ${responses?.length || 0} responses`);

      // Group by checklist_type_id and user_id
      const executionsMap = new Map<string, ChecklistExecution>();

      responses?.forEach((response: any) => {
        const key = `${response.checklist_type_id}-${response.user_id}`;
        
        if (!executionsMap.has(key)) {
          executionsMap.set(key, {
            id: key,
            checklist_type_id: response.checklist_type_id,
            checklist_type_name: response.checklist_types.nome,
            user_id: response.user_id,
            user_name: response.user_name || 'Usuário removido',
            data: response.data,
            items_total: 0,
            items_ok: 0,
            items_nok: 0,
            has_all_photos: true,
            items_with_required_photos: 0,
            items_with_photos_uploaded: 0,
            completed_at: response.completed_at,
          });
        }

        const execution = executionsMap.get(key)!;
        execution.items_total++;
        if (response.status === "ok") execution.items_ok++;
        if (response.status === "nok") execution.items_nok++;
        
        // Contar fotos obrigatórias
        if (response.checklist_items.requer_foto) {
          execution.items_with_required_photos++;
          if (response.photo_url) {
            execution.items_with_photos_uploaded++;
          } else {
            execution.has_all_photos = false;
          }
        }
      });

      const executionsList = Array.from(executionsMap.values());
      console.log(`📋 [REPORTS] Processed ${executionsList.length} unique executions`);
      setExecutions(executionsList);
    } catch (error: any) {
      console.error("❌ [REPORTS] Exception:", error);
      setError(error.message || "Erro ao carregar relatórios");
      toast({
        title: "Erro inesperado",
        description: "Não foi possível carregar os relatórios. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionDetails = async (execution: ChecklistExecution) => {
    if (!currentStore) return;
    
    try {
      const { data: responses, error } = await supabase
        .from("checklist_responses")
        .select(`
          status,
          observacoes,
          photo_url,
          checklist_items!inner(nome, ordem)
        `)
        .eq("checklist_type_id", execution.checklist_type_id)
        .eq("user_id", execution.user_id)
        .eq("data", execution.data)
        .eq("store_id", currentStore.id)
        .order("checklist_items(ordem)");

      if (error) throw error;

      // Generate signed URLs for photos (30 days validity)
      const detailsWithSignedUrls = await Promise.all(
        responses?.map(async (r: any) => {
          let signedPhotoUrl = r.photo_url;
          
          if (r.photo_url) {
            try {
              // Verificar se é uma URL completa (fotos antigas) ou caminho (fotos novas)
              if (r.photo_url.startsWith('http')) {
                // URL completa assinada - usar diretamente
                signedPhotoUrl = r.photo_url;
                console.log('📸 [REPORTS] Foto antiga (URL completa):', r.photo_url.substring(0, 50) + '...');
              } else {
                // Caminho de arquivo - gerar signed URL
                console.log('📸 [REPORTS] Gerando signed URL para:', r.photo_url);
                const { data: signedData, error: signedError } = await supabase.storage
                  .from('checklist-photos')
                  .createSignedUrl(r.photo_url, 2592000); // 30 days

                if (signedError) {
                  console.error('❌ [REPORTS] Erro ao gerar signed URL:', signedError);
                  signedPhotoUrl = `[ERRO: ${signedError.message}]`;
                } else if (signedData) {
                  console.log('✅ [REPORTS] Signed URL gerada com sucesso');
                  signedPhotoUrl = signedData.signedUrl;
                }
              }
            } catch (err) {
              console.error('❌ [REPORTS] Exceção ao processar foto:', err);
              signedPhotoUrl = '[ERRO: Não foi possível carregar a foto]';
            }
          }

          return {
            item_nome: r.checklist_items.nome,
            item_ordem: r.checklist_items.ordem,
            status: r.status,
            observacoes: r.observacoes,
            photo_url: signedPhotoUrl,
          };
        }) || []
      );

      setExecutionDetails(detailsWithSignedUrls);
      setSelectedExecution(execution.id);
      setDetailsDialogOpen(true);
    } catch (error: any) {
      console.error("Erro ao carregar detalhes:", error);
    }
  };

  const handleExport = async (exportFormat: 'excel' | 'pdf' | 'csv') => {
    if (!date || executions.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há execuções para a data selecionada.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Log audit event
      const dateStr = format(date, "dd/MM/yyyy", { locale: ptBR });
      await supabase.rpc('log_audit_event', {
        p_action_type: 'export',
        p_resource_type: 'report',
        p_resource_name: `Relatório ${dateStr}`,
        p_metadata: { format: exportFormat, executions_count: executions.length }
      });

      if (exportFormat === 'excel') {
        exportToExcel(executions, date);
      } else if (exportFormat === 'pdf') {
        exportToPDF(executions, date);
      } else {
        exportToCSV(executions, date);
      }

      toast({
        title: "Exportação concluída",
        description: `Relatório exportado em ${exportFormat.toUpperCase()} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar o relatório.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: ptBR }) : "Selecione uma data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {executions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar para Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar para PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar para CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {storeLoading || (!currentStore && !error) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              Carregando informações da loja...
            </p>
          </CardContent>
        </Card>
      ) : !currentStore ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              Não foi possível carregar a loja. Verifique sua conexão.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              Carregando relatórios...
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              Erro ao carregar relatórios: {error}
            </p>
            <Button variant="outline" onClick={() => loadExecutions()}>
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              Nenhum checklist executado em {date && format(date, "dd/MM/yyyy", { locale: ptBR })}.
            </p>
            <Button variant="outline" onClick={() => loadExecutions()}>
              Recarregar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {executions.map((execution) => (
            <Card key={execution.id}>
              <CardHeader>
                <CardTitle className="text-base">{execution.checklist_type_name}</CardTitle>
                <CardDescription className="space-y-1">
                  <div>Por: {execution.user_name}</div>
                  {execution.completed_at && (
                    <div className="text-xs text-muted-foreground">
                      Realizado às {format(new Date(execution.completed_at), "HH:mm")}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-success/10">
                    {execution.items_ok} OK
                  </Badge>
                  <Badge variant="outline" className="bg-destructive/10">
                    {execution.items_nok} NOK
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  {execution.has_all_photos ? (
                    <Badge className="bg-success">
                      ✓ Todas as fotos
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      ⚠ Faltam fotos
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => loadExecutionDetails(execution)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Detalhes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Execução</DialogTitle>
            <DialogDescription>
              Itens executados e suas evidências
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {executionDetails.map((detail, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{detail.item_ordem}</Badge>
                          <CardTitle className="text-sm">{detail.item_nome}</CardTitle>
                        </div>
                      </div>
                      <Badge
                        variant={detail.status === "ok" ? "default" : "destructive"}
                        className={detail.status === "ok" ? "bg-success" : ""}
                      >
                        {detail.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detail.observacoes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Observações:
                        </p>
                        <p className="text-sm">{detail.observacoes}</p>
                      </div>
                    )}
                    
                    {detail.photo_url ? (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Foto de Evidência:
                        </p>
                        {detail.photo_url.startsWith('[ERRO') ? (
                          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive font-medium">
                              {detail.photo_url}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Entre em contato com o suporte se o problema persistir.
                            </p>
                          </div>
                        ) : (
                          <div className="relative">
                            <img
                              src={detail.photo_url}
                              alt="Evidência"
                              className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => {
                                setSelectedPhoto(detail.photo_url);
                                setPhotoDialogOpen(true);
                              }}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute bottom-2 right-2"
                              onClick={() => {
                                setSelectedPhoto(detail.photo_url);
                                setPhotoDialogOpen(true);
                              }}
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Ampliar
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-warning/10 rounded-lg text-center">
                        <p className="text-sm text-warning-foreground">
                          ⚠ Sem foto de evidência
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Foto de Evidência</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Evidência ampliada"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}