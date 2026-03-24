import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistCard } from "@/components/ChecklistCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Settings, ChefHat } from "lucide-react";
import type { Session, User } from "@supabase/supabase-js";
import { StoreSelector } from "@/components/StoreSelector";
import { useStore } from "@/contexts/StoreContext";
import { NotificationBell } from "@/components/NotificationBell";
import { UserStatsCard } from "@/components/UserStatsCard";

interface Profile {
  id: string;
  nome: string;
  email: string;
  role?: string; // Display name of the role
  role_id?: string; // UUID of the role (for filtering)
  role_name?: string; // Technical name of the role (for comparisons)
}

interface ChecklistType {
  id: string;
  nome: string;
  area: string;
  turno: string;
  allowed_role_ids: string[]; // Changed to UUIDs
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checklists, setChecklists] = useState<ChecklistType[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [showForceLogout, setShowForceLogout] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: storeLoading, currentStore, error: storeError, retry: retryStore } = useStore();

  useEffect(() => {
    let isMounted = true;

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      console.log("🔐 [DASHBOARD] Verificando sessão inicial:", session?.user?.id ? "Ativa" : "Não encontrada");
      
      setSession(session);
      setUser(session?.user ?? null);
      setAuthChecked(true);
      
      if (!session) {
        console.log("⚠️ [DASHBOARD] Sem sessão, redirecionando para /auth");
        setLoading(false);
        navigate('/auth');
      } else {
        console.log("✅ [DASHBOARD] Sessão válida encontrada");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        
        console.log("🔄 [DASHBOARD] Auth state changed:", _event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        setAuthChecked(true);
        
        if (!session) {
          console.log("⚠️ [DASHBOARD] Sessão perdida, redirecionando para /auth");
          setLoading(false);
          navigate('/auth');
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    
    if (!user) {
      setLoading(false);
      navigate("/auth");
      return;
    }

    // Aumentar delay para garantir sincronização completa
    console.log("⏰ [AUTH] Aguardando 500ms para estabilizar sessão...");
    const timer = setTimeout(() => {
      loadProfile();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [user, navigate, authChecked]);

  // Timeout de segurança: forçar finalização após 10s
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading || storeLoading) {
        console.error("⏰ TIMEOUT: Loading travado após 10 segundos");
        setLoading(false);
        toast({
          title: "Erro ao carregar dados",
          description: "O carregamento demorou muito. Tente fazer logout e login novamente.",
          variant: "destructive",
        });
      }
    }, 10000); // 10 segundos

    return () => clearTimeout(timeout);
  }, [loading, storeLoading, toast]);

  // Mostrar botão "Forçar Logout" após 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading || storeLoading) {
        setShowForceLogout(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [loading, storeLoading]);

  useEffect(() => {
    if (profile?.role_id && currentStore) {
      console.log("🚀 [DASHBOARD] Carregando checklists com role_id:", profile.role_id);
      loadChecklists();
    } else {
      console.log("⏳ [DASHBOARD] Aguardando profile.role_id e currentStore...", {
        hasProfile: !!profile,
        hasRoleId: !!profile?.role_id,
        hasStore: !!currentStore
      });
    }
  }, [profile, currentStore]);

  // Realtime listener para sincronizar mudanças de checklists
  useEffect(() => {
    if (!currentStore || !profile?.role_id) return;

    console.log('🔌 [REALTIME] Inscrevendo para mudanças em checklist_types...');

    const channel = supabase
      .channel(`checklists-${currentStore.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checklist_types',
          filter: `store_id=eq.${currentStore.id}`,
        },
        () => {
          console.log('🔄 [REALTIME] Checklist alterado, recarregando...');
          loadChecklists();
        }
      )
      .subscribe((status) => {
        console.log('🔌 [REALTIME] Status da inscrição (checklists):', status);
      });

    return () => {
      console.log('🔌 [REALTIME] Removendo canal de checklists...');
      supabase.removeChannel(channel);
    };
  }, [currentStore, profile?.role_id]);

  const loadProfile = async (retryCount = 0) => {
    try {
      setLoading(true);
      
      // CRÍTICO: Verificar se a sessão está ativa no Supabase
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        console.error("❌ [PROFILE] Sessão não encontrada");
        
        if (retryCount < 1) {
          console.log("⏳ [PROFILE] Aguardando 1000ms para sessão estabilizar...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadProfile(retryCount + 1);
        }
        
        toast({
          title: "Erro de autenticação",
          description: "Sessão não encontrada. Por favor, faça login novamente.",
          variant: "destructive",
        });
        setLoading(false);
        navigate('/auth');
        return;
      }
      
      console.log("🔍 [PROFILE] Tentativa", retryCount + 1, "- User ID:", currentSession.user.id);
      console.log("🔑 [PROFILE] Sessão ativa confirmada");
      
      // Load profile data usando o user.id da sessão confirmada
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentSession.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("❌ [PROFILE] Erro ao carregar:", profileError);
        
        // Se for erro de permissão e ainda temos tentativas, retry
        if (profileError.code === 'PGRST116' && retryCount < 1) {
          console.log("⏳ [PROFILE] Aguardando 1000ms antes de retry...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadProfile(retryCount + 1);
        }
        
        throw profileError;
      }
      
      if (!profileData) {
        console.error("❌ [PROFILE] Perfil não retornado");
        console.log("🔍 [PROFILE] User ID usado na query:", currentSession.user.id);
        
        // Retry se ainda temos tentativas
        if (retryCount < 1) {
          console.log("⏳ [PROFILE] Aguardando 1000ms antes de retry...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadProfile(retryCount + 1);
        }
        
        toast({
          title: "Perfil não encontrado",
          description: "Por favor, entre em contato com o administrador.",
          variant: "destructive",
        });
        setLoading(false);
        await supabase.auth.signOut();
        navigate('/auth');
        return;
      }
      
      console.log("✅ [PROFILE] Perfil carregado:", profileData);
      
      // Load user role from user_roles table with JOIN to roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select(`
          role_id,
          roles:role_id (
            id,
            name,
            display_name
          )
        `)
        .eq("user_id", currentSession.user.id)
        .maybeSingle();

      if (roleError) {
        console.error("❌ [PROFILE] Erro ao carregar role:", roleError);
        throw roleError;
      }
      
      console.log("✅ [PROFILE] Role carregado:", roleData);
      
      const profileWithRole = {
        ...profileData,
        role: roleData?.roles?.display_name || 'Usuário',
        role_id: roleData?.role_id,
        role_name: roleData?.roles?.name
      };
      
      console.log("✅ [PROFILE] Profile final definido:", {
        role_id: profileWithRole.role_id,
        role_name: profileWithRole.role_name,
        store_id: profileWithRole.store_id
      });
      
      setProfile(profileWithRole);
    } catch (error: any) {
      console.error("❌ [PROFILE] Erro fatal:", error);
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const loadChecklists = async () => {
    if (!currentStore) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("checklist_types")
        .select("*")
        .eq("store_id", currentStore.id);

      if (error) throw error;

      console.log("📋 [CHECKLISTS] Dados recebidos:", {
        total: data?.length,
        storeId: currentStore.id,
        checklists: data?.map(c => ({ nome: c.nome, allowed_role_ids: c.allowed_role_ids }))
      });

      // Admins and super_admins can see all checklists, others see only their allowed ones
      const filteredChecklists = (profile!.role_name === 'admin' || profile!.role_name === 'super_admin')
        ? data 
        : data.filter((checklist) =>
            checklist.allowed_role_ids?.includes(profile!.role_id!)
          );

      console.log("🔍 [CHECKLISTS] Filtrando com role_id:", profile!.role_id);
      console.log("✅ [CHECKLISTS] Filtrados:", filteredChecklists.length, "de", data?.length);
      
      if (filteredChecklists.length === 0) {
        console.warn("⚠️ [CHECKLISTS] Nenhum checklist encontrado para:", {
          role_id: profile!.role_id,
          store_id: currentStore.id
        });
      }

      setChecklists(filteredChecklists);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar checklists",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };


  if (loading || storeLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Carregando seus dados...</p>
        {showForceLogout && (
          <Button variant="outline" onClick={handleLogout}>
            Forçar Logout
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Gestão de Checklists</h1>
              <p className="text-sm text-muted-foreground">
                Olá, {profile?.nome}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StoreSelector />
            {(profile?.role_name === "admin" || profile?.role_name === "super_admin") && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("/admin")}
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            <NotificationBell userId={user?.id} />
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {user && currentStore && (
            <UserStatsCard userId={user.id} storeId={currentStore.id} />
          )}
          
          <div>
            <h2 className="text-2xl font-bold mb-2">Seus Checklists</h2>
            <p className="text-muted-foreground">
              Selecione um checklist para preencher ou visualizar
            </p>
          </div>

          {storeError && (
            <div className="text-center py-12">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-destructive font-semibold mb-2">⚠️ Erro ao carregar loja</p>
                <p className="text-sm text-muted-foreground mb-4">{storeError}</p>
                <Button onClick={retryStore} variant="outline" size="sm">
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}

          {!storeError && checklists.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhum checklist disponível para sua função.
              </p>
              <div className="text-xs text-muted-foreground mt-4 p-4 bg-muted rounded-lg max-w-md mx-auto">
                <p className="font-semibold mb-2">Informações de Debug:</p>
                <div className="text-left space-y-1">
                  <p><strong>Role ID:</strong> {profile?.role_id || 'não definido'}</p>
                  <p><strong>Store ID:</strong> {currentStore?.id || 'não definido'}</p>
                  <p><strong>Role Name:</strong> {profile?.role_name || 'não definido'}</p>
                </div>
              </div>
            </div>
          ) : !storeError ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {checklists.map((checklist) => (
                <ChecklistCard
                  key={checklist.id}
                  id={checklist.id}
                  nome={checklist.nome}
                  area={checklist.area}
                  turno={checklist.turno}
                />
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
