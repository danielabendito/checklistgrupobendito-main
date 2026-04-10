import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, CheckCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StagingItem {
  id: string;
  nome: string;
  checklist_nome: string;
  checklist_type_id: string;
  import_batch_id: string;
  created_at: string;
}

interface StagingItemsConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onSuccess: () => void;
}

export function StagingItemsConfirmation({ open, onOpenChange, storeId, onSuccess }: StagingItemsConfirmationProps) {
  const { toast } = useToast();
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      loadStagingItems();
    }
  }, [open]);

  const loadStagingItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('checklist_items_staging')
        .select('*')
        .eq('store_id', storeId)
        .eq('validation_status', 'valid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStagingItems(data || []);
    } catch (error) {
      console.error('Error loading staging items:', error);
      toast({
        title: "Erro ao carregar itens",
        description: "Não foi possível carregar os itens para importação",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (stagingItems.length === 0) return;

    setIsConfirming(true);
    try {
      const batchId = stagingItems[0].import_batch_id;

      // Buscar todos os itens do batch com campos necessários
      const { data: batchItems, error: fetchError } = await supabase
        .from('checklist_items_staging')
        .select('nome, checklist_type_id, ordem, requer_observacao, observacao_obrigatoria, requer_foto, store_id')
        .eq('import_batch_id', batchId)
        .eq('validation_status', 'valid');

      if (fetchError) throw fetchError;
      if (!batchItems || batchItems.length === 0) throw new Error('Nenhum item encontrado para importar');

      // Calcular ordem máxima por checklist
      const checklistIds = [...new Set(batchItems.map(i => i.checklist_type_id).filter(Boolean))];
      const orderMap: Record<string, number> = {};

      for (const ctId of checklistIds) {
        const { data: maxData } = await supabase
          .from('checklist_items')
          .select('ordem')
          .eq('checklist_type_id', ctId)
          .order('ordem', { ascending: false })
          .limit(1)
          .maybeSingle();
        orderMap[ctId] = (maxData?.ordem ?? 0);
      }

      // Montar itens para inserção
      const itemsToInsert = batchItems.map(item => {
        const ctId = item.checklist_type_id;
        if (!item.ordem && ctId) {
          orderMap[ctId] = (orderMap[ctId] ?? 0) + 10;
        }
        return {
          checklist_type_id: ctId,
          nome: item.nome,
          ordem: item.ordem ?? (ctId ? orderMap[ctId] : 10),
          requer_observacao: item.requer_observacao ?? false,
          observacao_obrigatoria: item.observacao_obrigatoria ?? false,
          requer_foto: item.requer_foto ?? false,
          store_id: item.store_id,
        };
      });

      // Inserir em checklist_items
      const { error: insertError } = await supabase
        .from('checklist_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      // Limpar staging
      const { error: deleteError } = await supabase
        .from('checklist_items_staging')
        .delete()
        .eq('import_batch_id', batchId);

      if (deleteError) console.warn('Erro ao limpar staging (não crítico):', deleteError);

      toast({
        title: "Importação concluída!",
        description: `${itemsToInsert.length} itens importados com sucesso`
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Erro ao importar",
        description: error?.message || error?.details || JSON.stringify(error) || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (stagingItems.length === 0) return;

    try {
      const batchId = stagingItems[0].import_batch_id;

      const { error } = await supabase
        .from('checklist_items_staging')
        .delete()
        .eq('import_batch_id', batchId);

      if (error) throw error;

      toast({
        title: "Importação cancelada",
        description: "Os itens não foram importados"
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Cancel error:', error);
      toast({
        title: "Erro ao cancelar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  // Group items by checklist
  const itemsByChecklist = stagingItems.reduce((acc, item) => {
    const key = item.checklist_nome;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, StagingItem[]>);

  const batchId = stagingItems[0]?.import_batch_id?.substring(0, 8) || '';
  const batchDate = stagingItems[0]?.created_at 
    ? new Date(stagingItems[0].created_at).toLocaleString('pt-BR')
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Confirmar Importação
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando itens...</p>
          </div>
        ) : stagingItems.length === 0 ? (
          <Alert>
            <AlertDescription>
              Nenhum item aguardando importação
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Lote #{batchId}</p>
                  <p className="text-sm text-muted-foreground">{batchDate}</p>
                  <p className="text-sm mt-2">
                    <strong>{stagingItems.length} itens</strong> serão importados em{" "}
                    <strong>{Object.keys(itemsByChecklist).length} checklists</strong>
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 space-y-4">
                {Object.entries(itemsByChecklist).map(([checklistName, items]) => (
                  <div key={checklistName} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{checklistName}</h4>
                      <Badge variant="secondary">{items.length} itens</Badge>
                    </div>
                    <div className="pl-4 space-y-1">
                      {items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="text-muted-foreground">{index + 1}.</span>
                          <span>{item.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Alert variant="destructive">
              <AlertDescription className="text-sm">
                Esta ação não pode ser desfeita. Os itens serão adicionados aos checklists selecionados.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isConfirming || stagingItems.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Cancelar Importação
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming || stagingItems.length === 0}
          >
            {isConfirming ? "Confirmando..." : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
