import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Plus, Edit2, Trash2, Loader2, AlertTriangle, Shield } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

interface Role {
  id: string;
  store_id: string;
  name: string;
  display_name: string;
  is_system: boolean;
  created_at: string;
}

const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .regex(/^[a-z0-9_-]+$/, "Use apenas letras minúsculas, números, - e _"),
  display_name: z
    .string()
    .trim()
    .min(1, "Nome de exibição é obrigatório")
    .max(100, "Nome de exibição deve ter no máximo 100 caracteres"),
});

export function RolesManagementTab() {
  const { currentStore } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [roleUsageCount, setRoleUsageCount] = useState<number>(0);

  useEffect(() => {
    if (currentStore) {
      loadRoles();
    }
  }, [currentStore]);

  const loadRoles = async () => {
    if (!currentStore) return;

    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const checkRoleUsage = async (roleId: string) => {
    if (!currentStore) return 0;

    try {
      // Check in user_roles
      const { count: userCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role_id", roleId);

      // Check in checklist_types
      const { data: checklistData } = await supabase
        .from("checklist_types")
        .select("allowed_role_ids")
        .eq("store_id", currentStore.id);

      const checklistCount = checklistData?.filter(
        (cl) => cl.allowed_role_ids?.includes(roleId)
      ).length || 0;

      return (userCount || 0) + checklistCount;
    } catch (error) {
      console.error("Error checking role usage:", error);
      return 0;
    }
  };

  const handleCreateEdit = async () => {
    if (!currentStore) return;

    const validation = roleSchema.safeParse({ name, display_name: displayName });

    if (!validation.success) {
      const error = validation.error.errors[0];
      toast({
        title: "Erro de validação",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (selectedRole) {
        // Update
        const { error } = await supabase
          .from("roles")
          .update({
            name: name.toLowerCase(),
            display_name: displayName,
          })
          .eq("id", selectedRole.id)
          .eq("store_id", currentStore.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Função atualizada com sucesso",
        });
      } else {
        // Create
        const { error } = await supabase
          .from("roles")
          .insert({
            store_id: currentStore.id,
            name: name.toLowerCase(),
            display_name: displayName,
            is_system: false,
          });

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
      }

      setDialogOpen(false);
      resetForm();
      loadRoles();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!roleToDelete || !currentStore) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("roles")
        .delete()
        .eq("id", roleToDelete.id)
        .eq("store_id", currentStore.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Função excluída com sucesso",
      });

      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      loadRoles();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setName(role.name);
    setDisplayName(role.display_name);
    setDialogOpen(true);
  };

  const openDeleteDialog = async (role: Role) => {
    const count = await checkRoleUsage(role.id);
    setRoleUsageCount(count);
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedRole(null);
    setName("");
    setDisplayName("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Funções</h2>
          <p className="text-muted-foreground">
            Crie funções personalizadas para seu estabelecimento
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Função
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <Card key={role.id} className={role.is_system ? "border-primary/20" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{role.display_name}</CardTitle>
                    {role.is_system && (
                      <Badge variant="outline" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Sistema
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs font-mono">
                    {role.name}
                  </CardDescription>
                </div>
                {!role.is_system && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(role)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(role)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRole ? "Editar Função" : "Nova Função"}
            </DialogTitle>
            <DialogDescription>
              {selectedRole
                ? "Atualize as informações da função"
                : "Crie uma nova função personalizada"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Técnico (slug) *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                placeholder="ex: barista"
                disabled={selectedRole?.is_system}
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números, - e _
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Nome de Exibição *</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex: Barista"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedRole ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Função
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a função{" "}
              <strong>{roleToDelete?.display_name}</strong>?
              {roleUsageCount > 0 && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-destructive font-medium">
                    ⚠️ Esta função está em uso em {roleUsageCount}{" "}
                    {roleUsageCount === 1 ? "local" : "locais"}.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Excluir esta função pode afetar usuários e checklists.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
