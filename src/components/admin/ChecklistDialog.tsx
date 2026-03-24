import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";
import { z } from "zod";

type ChecklistArea = Database["public"]["Enums"]["checklist_area"];
type ShiftType = Database["public"]["Enums"]["shift_type"];

interface Role {
  id: string;
  name: string;
  display_name: string;
  is_system: boolean;
}

interface ChecklistType {
  id: string;
  nome: string;
  area: ChecklistArea;
  turno: ShiftType;
  allowed_role_ids: string[];
}

interface ChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist?: ChecklistType | null;
  onSuccess: () => void;
}

const AREAS: ChecklistArea[] = ["loja", "cozinha", "bar"];
const TURNOS: ShiftType[] = ["manha", "tarde", "noite"];

// Validation schema
const checklistSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  area: z.string().min(1, "Área é obrigatória"),
  turno: z.string().min(1, "Turno é obrigatório"),
  selectedRoles: z.array(z.string()).min(1, "Selecione pelo menos uma função"),
});

export function ChecklistDialog({ open, onOpenChange, checklist, onSuccess }: ChecklistDialogProps) {
  const { toast } = useToast();
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [area, setArea] = useState<ChecklistArea | "">("");
  const [turno, setTurno] = useState<ShiftType | "">("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDisplayName, setNewRoleDisplayName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);

  useEffect(() => {
    if (currentStore && open) {
      loadRoles();
    }
  }, [currentStore, open]);

  useEffect(() => {
    if (checklist) {
      setNome(checklist.nome);
      setArea(checklist.area);
      setTurno(checklist.turno);
      setSelectedRoleIds(checklist.allowed_role_ids || []);
    } else {
      setNome("");
      setArea("");
      setTurno("");
      setSelectedRoleIds([]);
    }
    setShowAddRole(false);
    setNewRoleName("");
    setNewRoleDisplayName("");
  }, [checklist, open]);

  const loadRoles = async () => {
    if (!currentStore) return;

    try {
      setLoadingRoles(true);
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("is_system", { ascending: false })
        .order("display_name");

      if (error) throw error;
      setRoles(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar funções",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleCreateRole = async () => {
    if (!currentStore || !newRoleName.trim() || !newRoleDisplayName.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome e o nome de exibição",
        variant: "destructive",
      });
      return;
    }

    setCreatingRole(true);
    try {
      const { data, error } = await supabase
        .from("roles")
        .insert({
          store_id: currentStore.id,
          name: newRoleName.toLowerCase().trim(),
          display_name: newRoleDisplayName.trim(),
          is_system: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma função com este nome");
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Função criada com sucesso",
      });

      setNewRoleName("");
      setNewRoleDisplayName("");
      setShowAddRole(false);
      await loadRoles();
      
      // Selecionar automaticamente a nova role
      if (data) {
        setSelectedRoleIds(prev => [...prev, data.id]);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar função",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreatingRole(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input with zod
    const validation = checklistSchema.safeParse({
      nome,
      area,
      turno,
      selectedRoles: selectedRoleIds,
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
      if (checklist) {
        // Update existing checklist
        const { error } = await supabase
          .from("checklist_types")
          .update({
            nome,
            area: area as ChecklistArea,
            turno: turno as ShiftType,
            allowed_role_ids: selectedRoleIds,
            allowed_roles: [], // Empty legacy field
          })
          .eq("id", checklist.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Checklist atualizado com sucesso",
        });
      } else {
        // Create new checklist
        if (!currentStore) {
          toast({
            title: "Erro",
            description: "Nenhuma loja selecionada",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from("checklist_types")
          .insert({
            nome,
            area: area as ChecklistArea,
            turno: turno as ShiftType,
            allowed_role_ids: selectedRoleIds,
            allowed_roles: [], // Empty legacy field
            store_id: currentStore.id,
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Checklist criado com sucesso",
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

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {checklist ? "Editar Checklist" : "Novo Checklist"}
          </DialogTitle>
          <DialogDescription>
            {checklist 
              ? "Atualize as informações do checklist" 
              : "Crie um novo tipo de checklist"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Checklist *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Abertura Loja"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Área *</Label>
            <Select value={area} onValueChange={(value) => setArea(value as ChecklistArea)} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área" />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="turno">Turno *</Label>
            <Select value={turno} onValueChange={(value) => setTurno(value as ShiftType)} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o turno" />
              </SelectTrigger>
              <SelectContent>
                {TURNOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Funções Permitidas *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddRole(!showAddRole)}
                disabled={loadingRoles}
              >
                {showAddRole ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Função
                  </>
                )}
              </Button>
            </div>

            {showAddRole && (
              <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="new_role_name" className="text-xs">
                      Nome técnico
                    </Label>
                    <Input
                      id="new_role_name"
                      placeholder="ex: barista"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value.toLowerCase())}
                      disabled={creatingRole}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new_role_display" className="text-xs">
                      Nome de exibição
                    </Label>
                    <Input
                      id="new_role_display"
                      placeholder="ex: Barista"
                      value={newRoleDisplayName}
                      onChange={(e) => setNewRoleDisplayName(e.target.value)}
                      disabled={creatingRole}
                      className="h-8"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleCreateRole}
                  disabled={creatingRole || !newRoleName.trim() || !newRoleDisplayName.trim()}
                  size="sm"
                  className="w-full"
                >
                  {creatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Função
                </Button>
              </div>
            )}

            {loadingRoles ? (
              <div className="flex items-center justify-center py-8 border rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg max-h-64 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="col-span-2 text-center text-sm text-muted-foreground py-4">
                    Nenhuma função disponível. Crie uma nova função.
                  </p>
                ) : (
                  roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={role.id}
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                      />
                      <label
                        htmlFor={role.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {role.display_name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            )}
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
              {checklist ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}