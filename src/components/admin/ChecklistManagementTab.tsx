import { Plus, Edit, Trash2, Upload, Download, Package, ListOrdered } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { exportChecklistsToExcel } from "@/lib/exportUtils";
import type { Database } from "@/integrations/supabase/types";

type ChecklistArea = Database["public"]["Enums"]["checklist_area"];
type ShiftType = Database["public"]["Enums"]["shift_type"];

interface Role {
  id: string;
  name: string;
  display_name: string;
  store_id: string;
}

interface ChecklistType {
  id: string;
  nome: string;
  area: ChecklistArea;
  turno: ShiftType;
  allowed_role_ids: string[];
  created_at: string;
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

interface ChecklistManagementTabProps {
  checklists: ChecklistType[];
  items: ChecklistItem[];
  roles: Role[];
  selectedItems: Set<string>;
  stagingCount: number;
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
  onSetSelectedChecklist: (checklist: ChecklistType | null) => void;
  onSetChecklistDialogOpen: (open: boolean) => void;
  onSetSelectedItem: (item: ChecklistItem | null) => void;
  onSetItemDialogOpen: (open: boolean) => void;
  onSetItemToDelete: (item: { id: string; type: 'checklist' | 'item' } | null) => void;
  onSetDeleteDialogOpen: (open: boolean) => void;
  onSetBulkDeleteDialogOpen: (open: boolean) => void;
  onSetImportDialogOpen: (open: boolean) => void;
  onSetStagingConfirmOpen: (open: boolean) => void;
  onToggleItemSelection: (itemId: string) => void;
  onToggleAllItems: (checklistId: string) => void;
  onFixAllOrder: () => void;
}

export const ChecklistManagementTab = ({
  checklists,
  items,
  roles,
  selectedItems,
  stagingCount,
  activeSubTab,
  onSubTabChange,
  onSetSelectedChecklist,
  onSetChecklistDialogOpen,
  onSetSelectedItem,
  onSetItemDialogOpen,
  onSetItemToDelete,
  onSetDeleteDialogOpen,
  onSetBulkDeleteDialogOpen,
  onSetImportDialogOpen,
  onSetStagingConfirmOpen,
  onToggleItemSelection,
  onToggleAllItems,
  onFixAllOrder,
}: ChecklistManagementTabProps) => {
  const { currentStore } = useStore();
  const { toast } = useToast();

  return (
    <Tabs value={activeSubTab} onValueChange={onSubTabChange} className="space-y-4">
      <TabsList>
        <TabsTrigger value="checklists">Checklists</TabsTrigger>
        <TabsTrigger value="items">Itens</TabsTrigger>
      </TabsList>

      <TabsContent value="checklists" className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Tipos de Checklist</h2>
          <Button onClick={() => {
            onSetSelectedChecklist(null);
            onSetChecklistDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Checklist
          </Button>
        </div>

        {checklists.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum checklist cadastrado ainda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checklists.map((checklist) => (
              <Card key={checklist.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{checklist.nome}</CardTitle>
                      <CardDescription>
                        {checklist.area} - {checklist.turno}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onSetSelectedChecklist(checklist);
                          onSetChecklistDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onSetItemToDelete({ id: checklist.id, type: 'checklist' });
                          onSetDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Funções: {(checklist.allowed_role_ids || [])
                      .map(roleId => roles.find(r => r.id === roleId)?.display_name || roleId)
                      .join(", ") || "Todas as funções"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {items.filter(i => i.checklist_type_id === checklist.id).length} itens
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="items" className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Itens de Checklist</h2>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={() => onSetBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Selecionados ({selectedItems.size})
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => {
                if (!currentStore) {
                  toast({
                    title: "Erro",
                    description: "Nenhuma loja selecionada",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  exportChecklistsToExcel(checklists, items, currentStore.nome);
                  toast({
                    title: "Sucesso",
                    description: `${items.length} itens de ${checklists.length} checklists exportados`,
                  });
                } catch (error: any) {
                  toast({
                    title: "Erro ao exportar",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
              disabled={items.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Checklists
            </Button>
            <Button 
              variant="outline"
              onClick={() => onSetImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
            {stagingCount > 0 && (
              <Button 
                variant="secondary"
                onClick={() => onSetStagingConfirmOpen(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                Revisar Importação ({stagingCount})
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => onFixAllOrder()}
              disabled={items.length === 0}
            >
              <ListOrdered className="h-4 w-4 mr-2" />
              Reorganizar Numeração
            </Button>
            <Button onClick={() => {
              onSetSelectedItem(null);
              onSetItemDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum item cadastrado ainda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion 
            type="multiple" 
            defaultValue={checklists.length > 0 ? [checklists[0].id] : []} 
            className="space-y-4"
          >
            {checklists.map((checklist) => {
              const checklistItems = items.filter(
                (item) => item.checklist_type_id === checklist.id
              );
              
              if (checklistItems.length === 0) return null;

              const allChecklistItemsSelected = checklistItems.every(item => selectedItems.has(item.id));
              const someChecklistItemsSelected = checklistItems.some(item => selectedItems.has(item.id));
              const selectedCount = checklistItems.filter(item => selectedItems.has(item.id)).length;

              return (
                <AccordionItem 
                  key={checklist.id} 
                  value={checklist.id}
                  className="border rounded-lg bg-card shadow-sm"
                >
                  <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={allChecklistItemsSelected}
                            onCheckedChange={() => onToggleAllItems(checklist.id)}
                            className="data-[state=indeterminate]:bg-primary"
                            data-state={someChecklistItemsSelected && !allChecklistItemsSelected ? "indeterminate" : undefined}
                          />
                          <span className="text-sm text-muted-foreground">Selecionar todos</span>
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-base">{checklist.nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            {checklist.area} - {checklist.turno}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {checklistItems.length} {checklistItems.length === 1 ? 'item' : 'itens'}
                        </Badge>
                        {selectedCount > 0 && (
                          <Badge variant="default">
                            {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <div className="space-y-2 pt-2">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 group transition-colors"
                        >
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => onToggleItemSelection(item.id)}
                          />
                          <span className="text-sm font-medium text-muted-foreground w-8">
                            {item.ordem}
                          </span>
                          <span className="text-sm flex-1">{item.nome}</span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                onSetSelectedItem(item);
                                onSetItemDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                onSetItemToDelete({ id: item.id, type: 'item' });
                                onSetDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </TabsContent>
    </Tabs>
  );
};
