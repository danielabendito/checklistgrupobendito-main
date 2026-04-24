import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChecklistDialog } from "@/components/admin/ChecklistDialog";
import { ItemDialog } from "@/components/admin/ItemDialog";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { NotificationSettings } from "@/components/admin/NotificationSettings";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { NotificationBell } from "@/components/NotificationBell";
import type { User } from "@supabase/supabase-js";
import { StoreSelector } from "@/components/StoreSelector";
import { useStore } from "@/contexts/StoreContext";

import { MyStoresManagementTab } from "@/components/admin/MyStoresManagementTab";
import { ImportItemsDialog } from "@/components/admin/ImportItemsDialog";
import { StagingItemsConfirmation } from "@/components/admin/StagingItemsConfirmation";
import { GettingStartedTab } from "@/components/admin/GettingStartedTab";
import { WhatsAppRecipientsCard } from "@/components/admin/WhatsAppRecipientsCard";
import { RewardSettingsTab } from "@/components/admin/RewardSettingsTab";

// New consolidated tab components
import { InspectionTab } from "@/components/admin/InspectionTab";
import { TeamManagementTab } from "@/components/admin/TeamManagementTab";
import { ChecklistManagementTab } from "@/components/admin/ChecklistManagementTab";

interface Profile {
  id: string;
  nome: string;
  email: string;
  role?: string;
}

type ChecklistArea = Database["public"]["Enums"]["checklist_area"];
type ShiftType = Database["public"]["Enums"]["shift_type"];

interface ChecklistType {
  id: string;
  nome: string;
  area: ChecklistArea;
  turno: ShiftType;
  allowed_role_ids: string[];
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  store_id: string;
}

interface ChecklistItem {
  id: string;
  checklist_type_id: string;
  nome: string;
  ordem: number;
  requer_observacao: boolean;
  observacao_obrigatoria: boolean;
  requer_foto: boolean;
}

const Admin = () => {
  const { currentStore, loading: storeLoading } = useStore();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checklists, setChecklists] = useState<ChecklistType[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistType | null>(null);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'checklist' | 'item' } | null>(null);
  const [activeTab, setActiveTab] = useState("getting-started");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [stagingConfirmOpen, setStagingConfirmOpen] = useState(false);
  const [stagingCount, setStagingCount] = useState(0);
  const [checklistSubTab, setChecklistSubTab] = useState("checklists");
  const navigate = useNavigate();
  const { toast } = useToast();

  const isLoading = loading || storeLoading;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate('/auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (!profile || storeLoading) return;

    console.log("=== DEBUG ADMIN ACCESS ===");
    console.log("Profile:", profile);
    console.log("Current Store:", currentStore);
    console.log("User Role:", profile.role);
    console.log("Store Loading:", storeLoading);

    if (profile.role === "super_admin") {
      console.log("✅ Super admin detected - granting full access");
      loadData();
    } else if (profile.role === "admin") {
      if (currentStore) {
        console.log("✅ Admin with store - granting access");
        loadData();
      } else {
        console.log("❌ Admin sem loja disponível");
        setLoading(false);
        toast({
          title: "Nenhuma loja disponível",
          description: "Entre em contato com o administrador para configurar sua loja.",
          variant: "destructive",
        });
      }
    } else {
      console.log("❌ Access denied - invalid role:", profile.role);
      setLoading(false);
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página. Entre em contato com o administrador.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [profile, currentStore, storeLoading]);

  useEffect(() => {
    if (currentStore && user && !storeLoading) {
      loadProfile();
      loadData();
      loadStagingCount();
    }
  }, [currentStore, user, storeLoading]);

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        navigate('/auth');
        return;
      }
      
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select(`
          role_id,
          role,
          roles:role_id (
            id,
            name,
            display_name
          )
        `)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (roleError) throw roleError;
      
      setProfile({
        ...profileData,
        role: roleData?.role || 'user'
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadData = async () => {
    if (!currentStore) return;
    
    try {
      setLoading(true);

      const [checklistsRes, itemsRes, profilesRes, rolesRes, storeRolesRes] = await Promise.all([
        supabase.from("checklist_types").select("*").eq("store_id", currentStore.id).order("created_at", { ascending: false }),
        supabase.from("checklist_items").select("*").eq("store_id", currentStore.id).order("ordem"),
        supabase.from("profiles").select("*").eq("store_id", currentStore.id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("roles").select("*").eq("store_id", currentStore.id),
      ]);

      if (checklistsRes.error) throw checklistsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (storeRolesRes.error) throw storeRolesRes.error;

      const rolesMap = new Map(rolesRes.data?.map(r => [r.user_id, r.role]) || []);
      const profilesWithRoles = profilesRes.data?.map(p => ({
        ...p,
        role: rolesMap.get(p.id) || 'user'
      })) || [];

      setChecklists((checklistsRes.data || []).map(c => ({
        ...c,
        allowed_role_ids: c.allowed_role_ids || []
      })));
      setItems(itemsRes.data || []);
      setProfiles(profilesWithRoles);
      setRoles(storeRolesRes.data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStagingCount = async () => {
    if (!currentStore) return;
    
    try {
      const { count, error } = await supabase
        .from('checklist_items_staging')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', currentStore.id)
        .eq('validation_status', 'valid');
      
      if (error) throw error;
      setStagingCount(count || 0);
    } catch (error) {
      console.error('Error loading staging count:', error);
    }
  };

  const handleDeleteChecklist = async () => {
    if (!itemToDelete || itemToDelete.type !== 'checklist' || !currentStore) return;

    try {
      const { error: itemsError } = await supabase
        .from("checklist_items")
        .delete()
        .eq("checklist_type_id", itemToDelete.id)
        .eq("store_id", currentStore.id);

      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from("checklist_types")
        .delete()
        .eq("id", itemToDelete.id)
        .eq("store_id", currentStore.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Checklist excluído com sucesso",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const renumberChecklistItems = async (checklistTypeId: string) => {
    if (!currentStore) return;
    try {
      const { data: remainingItems, error: fetchError } = await supabase
        .from("checklist_items")
        .select("id, ordem")
        .eq("checklist_type_id", checklistTypeId)
        .eq("store_id", currentStore.id)
        .order("ordem", { ascending: true });

      if (fetchError || !remainingItems) return;

      const updatePromises = remainingItems.map((item, index) => 
        supabase
          .from("checklist_items")
          .update({ ordem: index + 1 })
          .eq("id", item.id)
      );
      
      await Promise.all(updatePromises);
    } catch (e) {
      console.error("Erro ao renumerar itens:", e);
    }
  };

  const handleFixAllOrder = async () => {
    if (!currentStore || checklists.length === 0) return;
    setLoading(true);
    try {
      toast({
        title: "Reorganizando...",
        description: "Organizando numeração de todos os checklists.",
      });
      for (const checklist of checklists) {
        await renumberChecklistItems(checklist.id);
      }
      toast({
        title: "Sucesso",
        description: "Numeração reorganizada com sucesso!",
      });
      loadData();
    } catch (e: any) {
      toast({
        title: "Erro ao organizar",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || itemToDelete.type !== 'item' || !currentStore) return;

    try {
      const itemToDel = items.find(i => i.id === itemToDelete.id);
      const checklistTypeId = itemToDel?.checklist_type_id;

      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", itemToDelete.id)
        .eq("store_id", currentStore.id);

      if (error) throw error;

      if (checklistTypeId) {
        await renumberChecklistItems(checklistTypeId);
      }

      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDelete = () => {
    if (itemToDelete?.type === 'checklist') {
      handleDeleteChecklist();
    } else if (itemToDelete?.type === 'item') {
      handleDeleteItem();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0 || !currentStore) return;

    try {
      const itemsToDel = items.filter(i => selectedItems.has(i.id));
      const checklistTypeIds = [...new Set(itemsToDel.map(i => i.checklist_type_id))];

      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .in("id", Array.from(selectedItems))
        .eq("store_id", currentStore.id);

      if (error) throw error;

      for (const ctId of checklistTypeIds) {
        await renumberChecklistItems(ctId);
      }

      toast({
        title: "Sucesso",
        description: `${selectedItems.size} itens excluídos com sucesso`,
      });

      setSelectedItems(new Set());
      loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const toggleAllItems = (checklistId: string) => {
    const checklistItems = items.filter(item => item.checklist_type_id === checklistId);
    const allSelected = checklistItems.every(item => selectedItems.has(item.id));
    const newSelection = new Set(selectedItems);
    
    checklistItems.forEach(item => {
      if (allSelected) {
        newSelection.delete(item.id);
      } else {
        newSelection.add(item.id);
      }
    });
    
    setSelectedItems(newSelection);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Administração</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie checklists e usuários
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StoreSelector />
            <NotificationBell userId={user?.id} />
            <Button variant="ghost" onClick={async () => {
              await supabase.auth.signOut();
              navigate('/auth');
            }} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="getting-started">📖 Comece Aqui</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">📊 Análises</TabsTrigger>
            <TabsTrigger value="inspection">🔬 Inspeção</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="team">👥 Equipe</TabsTrigger>
            <TabsTrigger value="rewards">🎁 Prêmios</TabsTrigger>
            <TabsTrigger value="checklists-items">📝 Checklists/Itens</TabsTrigger>
            {profile?.role === 'super_admin' && (
              <TabsTrigger value="my-stores">🏪 Minhas Lojas</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="getting-started">
            <GettingStartedTab onNavigateToTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab currentStore={currentStore} userRole={profile?.role || null} />
          </TabsContent>

          <TabsContent value="inspection">
            <InspectionTab />
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <NotificationSettings />
              <WhatsAppRecipientsCard />
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <TeamManagementTab />
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <RewardSettingsTab />
          </TabsContent>

          <TabsContent value="checklists-items">
            <ChecklistManagementTab
              checklists={checklists}
              items={items}
              roles={roles}
              selectedItems={selectedItems}
              stagingCount={stagingCount}
              activeSubTab={checklistSubTab}
              onSubTabChange={setChecklistSubTab}
              onSetSelectedChecklist={setSelectedChecklist}
              onSetChecklistDialogOpen={setChecklistDialogOpen}
              onSetSelectedItem={setSelectedItem}
              onSetItemDialogOpen={setItemDialogOpen}
              onSetItemToDelete={setItemToDelete}
              onSetDeleteDialogOpen={setDeleteDialogOpen}
              onSetBulkDeleteDialogOpen={setBulkDeleteDialogOpen}
              onSetImportDialogOpen={setImportDialogOpen}
              onSetStagingConfirmOpen={setStagingConfirmOpen}
              onToggleItemSelection={toggleItemSelection}
              onToggleAllItems={toggleAllItems}
              onFixAllOrder={handleFixAllOrder}
            />
          </TabsContent>

          {profile?.role === 'super_admin' && (
            <TabsContent value="my-stores">
              <MyStoresManagementTab currentStoreId={currentStore?.id || ''} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <ChecklistDialog
        open={checklistDialogOpen}
        onOpenChange={setChecklistDialogOpen}
        checklist={selectedChecklist}
        onSuccess={loadData}
      />

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={selectedItem}
        checklists={checklists}
        onSuccess={loadData}
      />

      <ImportItemsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        storeId={currentStore?.id || ''}
        onSuccess={() => {
          loadStagingCount();
          setImportDialogOpen(false);
        }}
      />

      <StagingItemsConfirmation
        open={stagingConfirmOpen}
        onOpenChange={setStagingConfirmOpen}
        storeId={currentStore?.id || ''}
        onSuccess={() => {
          loadData();
          loadStagingCount();
          setStagingConfirmOpen(false);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'checklist'
                ? "Tem certeza que deseja excluir este checklist? Todos os itens associados também serão excluídos. Esta ação não pode ser desfeita."
                : "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedItems.size} itens selecionados? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir {selectedItems.size} itens
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
