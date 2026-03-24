import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";
import { z } from "zod";

interface ChecklistItem {
  id: string;
  checklist_type_id: string;
  nome: string;
  ordem: number;
  requer_observacao: boolean;
  observacao_obrigatoria: boolean;
  requer_foto: boolean;
}

interface ChecklistType {
  id: string;
  nome: string;
}

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ChecklistItem | null;
  checklists: ChecklistType[];
  onSuccess: () => void;
}

// Validation schema
const itemSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  checklistTypeId: z.string().min(1, "Checklist é obrigatório"),
  ordem: z
    .number()
    .int("Ordem deve ser um número inteiro")
    .positive("Ordem deve ser um número positivo")
    .min(1, "Ordem deve ser no mínimo 1"),
});

export function ItemDialog({ open, onOpenChange, item, checklists, onSuccess }: ItemDialogProps) {
  const { toast } = useToast();
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [checklistTypeId, setChecklistTypeId] = useState("");
  const [ordem, setOrdem] = useState("");
  const [requerObservacao, setRequerObservacao] = useState(false);
  const [observacaoObrigatoria, setObservacaoObrigatoria] = useState(false);
  const [requerFoto, setRequerFoto] = useState(false);

  useEffect(() => {
    if (item) {
      setNome(item.nome);
      setChecklistTypeId(item.checklist_type_id);
      setOrdem(item.ordem.toString());
      setRequerObservacao(item.requer_observacao);
      setObservacaoObrigatoria(item.observacao_obrigatoria);
      setRequerFoto(item.requer_foto);
    } else {
      setNome("");
      setChecklistTypeId("");
      setOrdem("");
      setRequerObservacao(false);
      setObservacaoObrigatoria(false);
      setRequerFoto(false);
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ordemNum = parseInt(ordem);

    // Validate input with zod
    const validation = itemSchema.safeParse({
      nome,
      checklistTypeId,
      ordem: ordemNum,
    });

    if (!validation.success) {
      const error = validation.error.errors[0];
      toast({
        title: "Erro de validação",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (item) {
        // Update existing item
        const { error } = await supabase
          .from("checklist_items")
          .update({
            nome,
            checklist_type_id: checklistTypeId,
            ordem: ordemNum,
            requer_observacao: requerObservacao,
            observacao_obrigatoria: observacaoObrigatoria,
            requer_foto: requerFoto,
          })
          .eq("id", item.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Item atualizado com sucesso",
        });
      } else {
        // Create new item
        if (!currentStore) {
          toast({
            title: "Erro",
            description: "Nenhuma loja selecionada",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from("checklist_items")
          .insert({
            nome,
            checklist_type_id: checklistTypeId,
            ordem: ordemNum,
            store_id: currentStore.id,
            requer_observacao: requerObservacao,
            observacao_obrigatoria: observacaoObrigatoria,
            requer_foto: requerFoto,
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Item criado com sucesso",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar Item" : "Novo Item"}
          </DialogTitle>
          <DialogDescription>
            {item 
              ? "Atualize as informações do item" 
              : "Adicione um novo item ao checklist"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checklist">Checklist *</Label>
            <Select value={checklistTypeId} onValueChange={setChecklistTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o checklist" />
              </SelectTrigger>
              <SelectContent>
                {checklists.map((checklist) => (
                  <SelectItem key={checklist.id} value={checklist.id}>
                    {checklist.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ordem">Ordem *</Label>
            <Input
              id="ordem"
              type="number"
              min="1"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              placeholder="Ex: 1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Item *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Verificar limpeza das mesas"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requer_observacao"
                checked={requerObservacao}
                onCheckedChange={(checked) => {
                  setRequerObservacao(checked === true);
                  // Se desmarcar, também desmarcar obrigatória
                  if (!checked) setObservacaoObrigatoria(false);
                }}
              />
              <Label 
                htmlFor="requer_observacao"
                className="text-sm font-normal cursor-pointer"
              >
                Requer campo de observação
              </Label>
            </div>

            <div className="flex items-center space-x-2 ml-6">
              <Checkbox
                id="observacao_obrigatoria"
                checked={observacaoObrigatoria}
                disabled={!requerObservacao}
                onCheckedChange={(checked) => {
                  setObservacaoObrigatoria(checked === true);
                  // Se marcar obrigatória, marcar requer também
                  if (checked) setRequerObservacao(true);
                }}
              />
              <Label 
                htmlFor="observacao_obrigatoria"
                className={`text-sm font-normal cursor-pointer ${!requerObservacao ? 'text-muted-foreground' : ''}`}
              >
                Observação obrigatória <span className="text-destructive">*</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requer_foto"
                checked={requerFoto}
                onCheckedChange={(checked) => setRequerFoto(checked === true)}
              />
              <Label 
                htmlFor="requer_foto"
                className="text-sm font-normal cursor-pointer"
              >
                Requer foto de evidência
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {item ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}