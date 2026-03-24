import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, validateRow, downloadTemplate, exportErrorReport, ValidationResult, ImportRow } from "@/lib/importUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onSuccess: () => void;
}

export function ImportItemsDialog({ open, onOpenChange, storeId, onSuccess }: ImportItemsDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [checklists, setChecklists] = useState<Array<{ id: string; nome: string }>>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadChecklists = useCallback(async () => {
    const { data } = await supabase
      .from('checklist_types')
      .select('id, nome')
      .eq('store_id', storeId);
    
    if (data) setChecklists(data);
  }, [storeId]);

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx)",
        variant: "destructive"
      });
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    setIsValidating(true);

    try {
      await loadChecklists();
      const rows = await parseExcelFile(selectedFile);
      
      // Validate each row
      const results: ValidationResult[] = [];
      const seenItems = new Map<string, Set<string>>(); // checklist_id -> Set of item names

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const validationResult = validateRow(row, i + 2); // +2 because Excel is 1-indexed and has header

        if (validationResult.status === 'error') {
          results.push(validationResult);
          continue;
        }

        // Check if checklist exists
        const checklist = checklists.find(
          c => c.nome.toLowerCase().trim() === row.checklist_nome.toLowerCase().trim()
        );

        if (!checklist) {
          results.push({
            ...validationResult,
            status: 'error',
            message: `Checklist "${row.checklist_nome}" não encontrado`
          });
          continue;
        }

        // Check for duplicates in database
        const { data: existingItem } = await supabase
          .from('checklist_items')
          .select('id')
          .eq('checklist_type_id', checklist.id)
          .ilike('nome', row.nome)
          .maybeSingle();

        if (existingItem) {
          results.push({
            ...validationResult,
            status: 'error',
            message: `Item "${row.nome}" já existe no checklist "${row.checklist_nome}"`
          });
          continue;
        }

        // Check for duplicates within import
        if (!seenItems.has(checklist.id)) {
          seenItems.set(checklist.id, new Set());
        }
        
        const itemsInChecklist = seenItems.get(checklist.id)!;
        const normalizedName = row.nome.toLowerCase().trim();
        
        if (itemsInChecklist.has(normalizedName)) {
          results.push({
            ...validationResult,
            status: 'error',
            message: `Item duplicado na importação: "${row.nome}" aparece mais de uma vez no checklist "${row.checklist_nome}"`
          });
          continue;
        }
        
        itemsInChecklist.add(normalizedName);

        // All validations passed
        results.push({
          ...validationResult,
          data: { ...validationResult.data, checklist_nome: checklist.nome }
        });
      }

      setValidationResults(results);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      setFile(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    const errorCount = validationResults.filter(r => r.status === 'error').length;
    if (errorCount > 0) {
      toast({
        title: "Não é possível importar",
        description: `Corrija os ${errorCount} erros antes de continuar`,
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const batchId = crypto.randomUUID();

      // Insert into staging
      const stagingItems = await Promise.all(
        validationResults
          .filter(r => r.status !== 'error')
          .map(async (result) => {
            const checklist = checklists.find(
              c => c.nome.toLowerCase() === result.data.checklist_nome.toLowerCase()
            );

            return {
              store_id: storeId,
              imported_by: user.id,
              nome: result.data.nome,
              checklist_nome: result.data.checklist_nome,
              checklist_type_id: checklist?.id,
              ordem: result.data.ordem || null,
              requer_observacao: result.data.requer_observacao || false,
              observacao_obrigatoria: result.data.observacao_obrigatoria || false,
              requer_foto: result.data.requer_foto || false,
              import_batch_id: batchId,
              validation_status: 'valid'
            };
          })
      );

      const { error } = await supabase
        .from('checklist_items_staging')
        .insert(stagingItems);

      if (error) throw error;

      toast({
        title: "Preview criado com sucesso",
        description: `${stagingItems.length} itens prontos para importação`
      });

      onSuccess();
      onOpenChange(false);
      resetDialog();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setValidationResults([]);
  };

  const validCount = validationResults.filter(r => r.status === 'valid').length;
  const warningCount = validationResults.filter(r => r.status === 'warning').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;
  const hasErrors = errorCount > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetDialog();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Itens de Checklist
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <Alert>
            <Download className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Baixe o template para ver o formato correto da planilha</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await loadChecklists();
                  downloadTemplate(checklists);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Template
              </Button>
            </AlertDescription>
          </Alert>

          {/* File upload */}
          {!file && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) handleFileSelect(droppedFile);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx';
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files?.[0]) handleFileSelect(target.files[0]);
                };
                input.click();
              }}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-2">Apenas arquivos .xlsx (máx 5MB)</p>
            </div>
          )}

          {/* Validation results */}
          {file && !isValidating && validationResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{validCount} válidos</span>
                  </div>
                  {warningCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{warningCount} avisos</span>
                    </div>
                  )}
                  {errorCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="font-medium">{errorCount} erros</span>
                    </div>
                  )}
                </div>
                {errorCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportErrorReport(validationResults.filter(r => r.status === 'error'))}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Relatório de Erros
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {validationResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.status === 'valid' ? 'bg-green-50 border-green-200' :
                        result.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {result.status === 'valid' && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
                        {result.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                        {result.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Linha {result.row}</Badge>
                            <span className="font-medium truncate">{result.data.nome}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Checklist: {result.data.checklist_nome}
                          </p>
                          {result.message && (
                            <p className={`text-sm mt-1 ${
                              result.status === 'error' ? 'text-destructive' : 'text-yellow-600'
                            }`}>
                              {result.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {isValidating && (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Validando planilha...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || hasErrors || isValidating || isImporting || validationResults.length === 0}
          >
            {isImporting ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
