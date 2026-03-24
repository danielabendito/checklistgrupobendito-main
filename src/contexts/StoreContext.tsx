import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Store {
  id: string;
  nome: string;
}

interface StoreContextType {
  currentStore: Store | null;
  stores: Store[];
  setCurrentStore: (store: Store) => void;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Não há sessão - não é erro, apenas não está logado
        setLoading(false);
        return;
      }
      
      const user = session.user;

      // Buscar profile e role em paralelo
      const [
        { data: profile, error: profileError },
        { data: userRoleData, error: roleError }
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("store_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      if (profileError || roleError || !profile || !userRoleData) {
        console.error("Erro ao buscar dados do usuário:", profileError || roleError);
        setError("Erro ao buscar perfil do usuário");
        setLoading(false);
        return;
      }

      const userRole = userRoleData.role;
      const userStoreId = profile.store_id;

      if (!userStoreId) {
        setError("Usuário não possui loja vinculada. Contate o administrador.");
        setLoading(false);
        return;
      }

      // Carregar stores conforme role
      let storesData;
      
      if (userRole === 'super_admin') {
        // Super_admin: buscar organization_id primeiro, depois todas as lojas da organização
        const { data: userStore, error: storeError } = await supabase
          .from("stores")
          .select("organization_id")
          .eq("id", userStoreId)
          .single();

        if (storeError || !userStore?.organization_id) {
          console.error("Erro ao buscar organização:", storeError);
          setError("Erro ao identificar organização");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("stores")
          .select("id, nome, organization_id, created_at")
          .eq("organization_id", userStore.organization_id)
          .order("nome");
        
        if (error) {
          console.error("Erro ao carregar lojas:", error);
          setError(`Erro ao carregar lojas: ${error.message}`);
          setLoading(false);
          return;
        }
        storesData = data;
      } else {
        // Usuários regulares: buscar apenas a própria loja
        const { data, error } = await supabase
          .from("stores")
          .select("id, nome")
          .eq("id", userStoreId)
          .maybeSingle();
        
        if (error) {
          console.error("Erro ao carregar loja:", error);
          setError(`Erro ao carregar loja: ${error.message}`);
          setLoading(false);
          return;
        }
        
        storesData = data ? [data] : [];
      }
      
      if (!storesData || storesData.length === 0) {
        setError("Nenhuma loja disponível. Verifique suas permissões.");
        setLoading(false);
        return;
      }

      setStores(storesData);

      // Verificar loja salva no localStorage
      const savedStoreId = localStorage.getItem("selectedStoreId");
      const savedStore = savedStoreId ? storesData.find((s) => s.id === savedStoreId) : null;
      
      if (savedStore) {
        setCurrentStoreState(savedStore);
      } else {
        // Priorizar a loja do usuário
        const userStore = storesData.find((s) => s.id === userStoreId);
        const defaultStore = userStore || storesData[0];
        setCurrentStoreState(defaultStore);
        localStorage.setItem("selectedStoreId", defaultStore.id);
      }
      
    } catch (error) {
      console.error("Erro crítico ao carregar lojas:", error);
      setError("Erro crítico ao carregar lojas. Tente fazer logout e login novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadStores();
      } else {
        setLoading(false);
      }
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Usar setTimeout(0) para evitar deadlock com Supabase
          setTimeout(() => {
            loadStores();
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setStores([]);
          setCurrentStoreState(null);
          setLoading(false);
          localStorage.removeItem("selectedStoreId");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadStores]);
  
  const retry = () => {
    loadStores();
  };

  const setCurrentStore = (store: Store) => {
    setCurrentStoreState(store);
    localStorage.setItem("selectedStoreId", store.id);
  };

  return (
    <StoreContext.Provider value={{ currentStore, stores, setCurrentStore, loading, error, retry }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
