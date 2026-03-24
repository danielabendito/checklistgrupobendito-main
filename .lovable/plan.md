
## Plano: Sincronizar Novos Itens de Checklist em Tempo Real

### Problema Identificado
Quando você cadastra novos itens de checklist na página de administrador, eles são salvos no banco de dados e aparecem imediatamente na sua tela. Porém, a página do colaborador só carrega os itens **uma única vez** quando a página é aberta. Se o colaborador já estiver com a página aberta, ele não verá os novos itens até recarregar a página.

### Solução Proposta: Supabase Realtime

Usar o recurso de **Realtime** do banco de dados para que a página do checklist se atualize automaticamente quando houver mudanças nos itens.

---

### Parte 1: Habilitar Realtime na Tabela `checklist_items`

**Migração SQL:**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;
```

Isso permite que o banco notifique o frontend quando houver INSERT, UPDATE ou DELETE na tabela.

---

### Parte 2: Adicionar Listener Realtime no `Checklist.tsx`

**Arquivo:** `src/pages/Checklist.tsx`

Adicionar um listener que escuta mudanças na tabela `checklist_items` filtrado pelo `checklist_type_id` atual:

```typescript
// Após o useEffect de loadChecklistData (linha ~109)
useEffect(() => {
  if (!id) return;

  // Inscrever para mudanças em tempo real
  const channel = supabase
    .channel(`checklist-items-${id}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'checklist_items',
        filter: `checklist_type_id=eq.${id}`,
      },
      (payload) => {
        console.log('🔄 [REALTIME] Mudança detectada:', payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          // Adicionar novo item mantendo ordem
          setItems(prev => 
            [...prev, payload.new as ChecklistItem].sort((a, b) => a.ordem - b.ordem)
          );
          toast({
            title: "Novo item adicionado",
            description: `"${(payload.new as any).nome}" foi adicionado ao checklist`,
          });
        } else if (payload.eventType === 'UPDATE') {
          // Atualizar item existente
          setItems(prev => 
            prev.map(item => 
              item.id === (payload.new as any).id 
                ? payload.new as ChecklistItem 
                : item
            ).sort((a, b) => a.ordem - b.ordem)
          );
        } else if (payload.eventType === 'DELETE') {
          // Remover item
          setItems(prev => 
            prev.filter(item => item.id !== (payload.old as any).id)
          );
          toast({
            title: "Item removido",
            description: "Um item foi removido deste checklist",
            variant: "destructive",
          });
        }
      }
    )
    .subscribe();

  // Cleanup ao desmontar
  return () => {
    supabase.removeChannel(channel);
  };
}, [id, toast]);
```

---

### Parte 3: Adicionar Listener no `Dashboard.tsx` (Opcional mas Recomendado)

Se um novo **checklist** for criado pelo admin, o colaborador também precisa ver. Adicionar listener semelhante:

**Arquivo:** `src/pages/Dashboard.tsx`

```typescript
// Após loadChecklists (linha ~313)
useEffect(() => {
  if (!currentStore) return;

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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentStore]);
```

---

### Resumo das Alterações

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| Migração SQL | Configuração | Habilitar realtime para `checklist_items` |
| `src/pages/Checklist.tsx` | Funcionalidade | Listener realtime para itens |
| `src/pages/Dashboard.tsx` | Funcionalidade | Listener realtime para checklists (opcional) |

### Resultado Esperado

1. Administrador cria novo item → Colaborador vê imediatamente (sem recarregar página)
2. Administrador edita item → Colaborador vê atualização em tempo real
3. Administrador remove item → Item some da lista do colaborador
4. Notificação toast avisa o colaborador sobre mudanças

### Benefícios

- **Experiência fluida**: Colaboradores sempre veem a versão mais atual
- **Economia de recursos**: Só atualiza quando há mudanças reais (não polling constante)
- **Feedback visual**: Toast informa o colaborador sobre novos itens

### Detalhes Técnicos

O Supabase Realtime usa WebSockets para manter uma conexão persistente. Quando há uma mudança no banco de dados que corresponde ao filtro (`checklist_type_id=eq.{id}`), o servidor envia uma notificação ao frontend, que então atualiza o estado local.

A conexão é limpa automaticamente quando o componente é desmontado (via `return () => supabase.removeChannel(channel)`), evitando memory leaks.
