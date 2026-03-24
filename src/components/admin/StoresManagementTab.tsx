import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreDialog } from "./StoreDialog";
import { Store, Calendar, Plus, Pencil, Trash2 } from "lucide-react";
import { DeleteStoreDialog } from "./DeleteStoreDialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface StoreWithStats {
  id: string;
  nome: string;
  created_at: string;
  organization_id: string;
  user_count: number;
  checklist_count: number;
  response_count: number;
  endereco: string | null;
  telefone: string | null;
  cnpj: string | null;
  email_contato: string | null;
  status: 'active' | 'inactive';
}

interface StoresManagementTabProps {
  currentStoreId: string;
}

export function StoresManagementTab({ currentStoreId }: StoresManagementTabProps) {
  const { toast } = useToast();
  const [stores, setStores] = useState<StoreWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedStore, setSelectedStore] = useState<StoreWithStats | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<StoreWithStats | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);

      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar lojas de CLIENTES (organization.owner_id != auth.uid())
      const { data, error } = await supabase
        .from("stores")
        .select(`
          id,
          nome,
          created_at,
          organization_id,
          endereco,
          telefone,
          cnpj,
          email_contato,
          status,
          organizations!inner(owner_id)
        `)
        .neq("organizations.owner_id", user.id)
        .order("nome");

      if (error) throw error;

      // Buscar estatísticas para cada loja
      const storesWithStats = await Promise.all(
        (data || []).map(async (store) => {
          // Contar usuários
          const { count: userCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          // Contar checklists
          const { count: checklistCount } = await supabase
            .from("checklist_types")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          // Contar respostas
          const { count: responseCount } = await supabase
            .from("checklist_responses")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          return {
            ...store,
            user_count: userCount || 0,
            checklist_count: checklistCount || 0,
            response_count: responseCount || 0,
            status: (store.status || 'active') as 'active' | 'inactive',
          };
        })
      );

      setStores(storesWithStats);
    } catch (error) {
      console.error("Erro ao carregar estabelecimentos:", error);
      toast({
        title: "❌ Erro ao carregar estabelecimentos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = () => {
    setDialogMode("create");
    setSelectedStore(null);
    setDialogOpen(true);
  };

  const handleEditStore = (store: StoreWithStats) => {
    setDialogMode("edit");
    setSelectedStore(store);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (storeId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
      const { error } = await supabase
        .from("stores")
        .update({ status: newStatus })
        .eq("id", storeId);

      if (error) throw error;

      toast({
        title: newStatus === 'active' ? "✅ Cliente ativado" : "🔒 Cliente bloqueado",
        description: newStatus === 'active' 
          ? "Estabelecimento pode operar novamente" 
          : "Estabelecimento foi bloqueado",
      });

      loadStores();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast({
        title: "❌ Erro ao alterar status",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estabelecimentos de Clientes</h2>
          <p className="text-muted-foreground">
            Lojas que você vendeu • Total: {stores.length}
          </p>
        </div>
        <Button onClick={handleCreateStore}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button 
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
        >
          Todos ({stores.length})
        </Button>
        <Button 
          variant={filterStatus === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('active')}
        >
          Ativos ({stores.filter(s => s.status === 'active').length})
        </Button>
        <Button 
          variant={filterStatus === 'inactive' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('inactive')}
        >
          Bloqueados ({stores.filter(s => s.status === 'inactive').length})
        </Button>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum cliente cadastrado</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Clique em "Novo Cliente" para cadastrar estabelecimentos de terceiros
            </p>
            <Button onClick={handleCreateStore}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Primeiro Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stores
            .filter(store => {
              if (filterStatus === 'all') return true;
              return store.status === filterStatus;
            })
            .map((store) => (
            <Card 
              key={store.id} 
              className={`${
                store.status === 'inactive' 
                  ? 'opacity-60 border-destructive' 
                  : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    {store.nome}
                  </CardTitle>
                  <Badge variant={store.status === 'active' ? 'default' : 'destructive'}>
                    {store.status === 'active' ? '🟢 Ativo' : '🔴 Bloqueado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <Label htmlFor={`status-${store.id}`} className="text-sm cursor-pointer">
                    {store.status === 'active' ? 'Cliente ativo' : 'Cliente bloqueado'}
                  </Label>
                  <Switch
                    id={`status-${store.id}`}
                    checked={store.status === 'active'}
                    onCheckedChange={() => handleToggleStatus(store.id, store.status)}
                  />
                </div>
                
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <p>📊 Estatísticas básicas do cliente</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Criado em {format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditStore(store)}
                  className="flex-1"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setStoreToDelete(store);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <StoreDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadStores}
        currentStoreId={currentStoreId}
        mode={dialogMode}
        storeData={selectedStore ? {
          id: selectedStore.id,
          nome: selectedStore.nome,
          endereco: selectedStore.endereco || undefined,
          telefone: selectedStore.telefone || undefined,
          cnpj: selectedStore.cnpj || undefined,
          email_contato: selectedStore.email_contato || undefined,
          status: selectedStore.status,
        } : undefined}
      />

      <DeleteStoreDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        store={storeToDelete ? {
          id: storeToDelete.id,
          nome: storeToDelete.nome,
          user_count: storeToDelete.user_count,
          checklist_count: storeToDelete.checklist_count,
          response_count: storeToDelete.response_count,
        } : null}
        onSuccess={loadStores}
      />
    </div>
  );
}
