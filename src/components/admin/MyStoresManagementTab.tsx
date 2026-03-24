import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreDialog } from "./StoreDialog";
import { Store, Users, FileText, Calendar, Plus, Pencil, Eye, Mail, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StoreDetailsDialog } from "./StoreDetailsDialog";
import { DeleteStoreDialog } from "./DeleteStoreDialog";
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
  ownership_status: 'active' | 'pending' | 'no_admin';
  admin_email?: string;
  admin_invite_date?: string;
}

interface MyStoresManagementTabProps {
  currentStoreId: string;
}

export function MyStoresManagementTab({ currentStoreId }: MyStoresManagementTabProps) {
  const { toast } = useToast();
  const [stores, setStores] = useState<StoreWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedStore, setSelectedStore] = useState<StoreWithStats | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedStoreDetails, setSelectedStoreDetails] = useState<StoreWithStats | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStoreToDelete, setSelectedStoreToDelete] = useState<StoreWithStats | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);

      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar profile para obter store_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Buscar organização da loja do usuário
      const { data: userStore, error: storeError } = await supabase
        .from("stores")
        .select("organization_id")
        .eq("id", profileData.store_id)
        .single();

      if (storeError) throw storeError;

      // Buscar TODAS as lojas da mesma organização
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
          status
        `)
        .eq("organization_id", userStore.organization_id)
        .order("nome");

      if (error) throw error;

      // Buscar estatísticas para cada loja
      const storesWithStats = await Promise.all(
        (data || []).map(async (store) => {
          const { count: userCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          const { count: checklistCount } = await supabase
            .from("checklist_types")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          const { count: responseCount } = await supabase
            .from("checklist_responses")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

          // Buscar convite de admin para determinar ownership status
          const { data: adminInvite } = await supabase
            .from("email_invites")
            .select("id, email, used, created_at")
            .eq("store_id", store.id)
            .eq("role", "admin")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Calcular ownership status
          let ownershipStatus: 'active' | 'pending' | 'no_admin';
          let adminEmail: string | undefined;
          let adminInviteDate: string | undefined;

          if (!adminInvite) {
            ownershipStatus = 'no_admin';
          } else if (adminInvite.used) {
            ownershipStatus = 'active';
            adminEmail = adminInvite.email;
          } else {
            ownershipStatus = 'pending';
            adminEmail = adminInvite.email;
            adminInviteDate = adminInvite.created_at;
          }

          return {
            ...store,
            user_count: userCount || 0,
            checklist_count: checklistCount || 0,
            response_count: responseCount || 0,
            status: (store.status || 'active') as 'active' | 'inactive',
            ownership_status: ownershipStatus,
            admin_email: adminEmail,
            admin_invite_date: adminInviteDate,
          };
        })
      );

      setStores(storesWithStats);
    } catch (error) {
      console.error("Erro ao carregar suas lojas:", error);
      toast({
        title: "❌ Erro ao carregar lojas",
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
        title: newStatus === 'active' ? "✅ Loja ativada" : "🔒 Loja bloqueada",
        description: newStatus === 'active' 
          ? "Usuários podem fazer login novamente" 
          : "Usuários não poderão fazer login",
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
          <h2 className="text-2xl font-bold">Minhas Lojas</h2>
          <p className="text-muted-foreground">
            Lojas que você gerencia • Total: {stores.length}
          </p>
        </div>
        <Button onClick={handleCreateStore}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Loja
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button 
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
        >
          Todas ({stores.length})
        </Button>
        <Button 
          variant={filterStatus === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('active')}
        >
          Ativas ({stores.filter(s => s.status === 'active').length})
        </Button>
        <Button 
          variant={filterStatus === 'inactive' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('inactive')}
        >
          Bloqueadas ({stores.filter(s => s.status === 'inactive').length})
        </Button>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma loja cadastrada</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Clique em "Nova Loja" para começar
            </p>
            <Button onClick={handleCreateStore}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeira Loja
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
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant={store.status === 'active' ? 'default' : 'destructive'}>
                      {store.status === 'active' ? '🟢 Ativa' : '🔴 Bloqueada'}
                    </Badge>
                    <Badge 
                      variant={
                        store.ownership_status === 'active' ? 'default' : 
                        store.ownership_status === 'pending' ? 'secondary' : 
                        'outline'
                      }
                      className="text-xs"
                    >
                      {store.ownership_status === 'active' && '✅ Proprietário Ativo'}
                      {store.ownership_status === 'pending' && '⏳ Aguardando Aceitação'}
                      {store.ownership_status === 'no_admin' && '👤 Sua Loja'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <Label htmlFor={`status-${store.id}`} className="text-sm cursor-pointer">
                    {store.status === 'active' ? 'Loja ativa' : 'Loja bloqueada'}
                  </Label>
                  <Switch
                    id={`status-${store.id}`}
                    checked={store.status === 'active'}
                    onCheckedChange={() => handleToggleStatus(store.id, store.status)}
                  />
                </div>

                {store.admin_email && (
                  <div className="flex items-center gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-700 dark:text-blue-400">
                        {store.ownership_status === 'active' ? 'Admin atual:' : 'Convite enviado para:'}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-500">{store.admin_email}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{store.user_count} usuário{store.user_count !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{store.checklist_count} checklist{store.checklist_count !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{store.response_count} resposta{store.response_count !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Criado em {format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedStoreDetails(store);
                    setDetailsDialogOpen(true);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Detalhes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditStore(store)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedStoreToDelete(store);
                    setDeleteDialogOpen(true);
                  }}
                  disabled={store.id === currentStoreId}
                  title={store.id === currentStoreId ? "Você não pode excluir a loja onde está logado" : "Excluir loja"}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
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

      <StoreDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        store={selectedStoreDetails}
      />

      <DeleteStoreDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        store={selectedStoreToDelete}
        onSuccess={loadStores}
      />
    </div>
  );
}
