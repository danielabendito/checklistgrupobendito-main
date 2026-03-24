import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Users, FileText, ClipboardList } from "lucide-react";

interface DeleteStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: {
    id: string;
    nome: string;
    user_count: number;
    checklist_count: number;
    response_count: number;
  } | null;
  onSuccess: () => void;
}

export function DeleteStoreDialog({ 
  open, 
  onOpenChange, 
  store, 
  onSuccess 
}: DeleteStoreDialogProps) {
  const { toast } = useToast();
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmationText === store?.nome;

  const handleDelete = async () => {
    if (!store || !isConfirmed) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc("delete_store_account", {
        target_store_id: store.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };

      if (!result.success) {
        throw new Error(result.message);
      }

      toast({
        title: "✅ Loja excluída",
        description: result.message,
      });

      setConfirmationText("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao excluir loja:", error);
      toast({
        title: "❌ Erro ao excluir loja",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmationText("");
    }
    onOpenChange(newOpen);
  };

  if (!store) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Loja "{store.nome}"?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ Esta ação é IRREVERSÍVEL!
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Todos os dados serão permanentemente excluídos.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Serão excluídos:</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{store.user_count} usuário{store.user_count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span>{store.checklist_count} checklist{store.checklist_count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{store.response_count} resposta{store.response_count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation" className="text-sm">
                  Digite <strong>"{store.nome}"</strong> para confirmar:
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Digite o nome da loja"
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Excluindo..." : "Excluir Permanentemente"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}