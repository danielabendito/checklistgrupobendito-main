import { Plus, Edit, Trash2, Upload, Download, Package, ListOrdered, GripVertical, Camera, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { exportChecklistsToExcel } from "@/lib/exportUtils";
import type { Database } from "@/integrations/supabase/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  ativo: boolean;
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
  onReorderItems: (checklistTypeId: string, orderedItemIds: string[]) => void;
  existingItems?: ChecklistItem[];
  onDataChanged?: () => void;
}

const SortableItemRow = ({
  item,
  selected,
  onToggleSelection,
  onEdit,
  onDelete,
}: {
  item: ChecklistItem;
  selected: boolean;
  onToggleSelection: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${
        isDragging ? "bg-muted shadow-md z-10" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={selected} onCheckedChange={onToggleSelection} />
      <span className="text-sm font-medium text-muted-foreground w-8">{item.ordem}</span>
      <span className="text-sm flex-1">{item.nome}</span>
      {item.requer_foto && (
        <Badge variant="outline" className="gap-1 text-xs font-normal">
          <Camera className="h-3 w-3" /> foto
        </Badge>
      )}
      {item.requer_observacao && (
        <Badge variant="outline" className="gap-1 text-xs font-normal">
          <MessageSquare className="h-3 w-3" /> obs
        </Badge>
      )}
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

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
  onReorderItems,
  onDataChanged,
}: ChecklistManagementTabProps) => {
  const { currentStore } = useStore();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggleActive = async (checklist: ChecklistType) => {
    const nextAtivo = !checklist.ativo;
    try {
      const { error } = await supabase
        .from("checklist_types")
        .update({ ativo: nextAtivo })
        .eq("id", checklist.id);

      if (error) throw error;

      toast({
        title: nextAtivo ? "Checklist reativado" : "Checklist pausado",
        description: nextAtivo
          ? `"${checklist.nome}" voltou a aparecer para os colaboradores.`
          : `"${checklist.nome}" não aparecerá mais para preenchimento até ser reativado.`,
      });

      onDataChanged?.();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status do checklist",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = (checklistId: string, checklistItems: ChecklistItem[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = checklistItems.findIndex((i) => i.id === active.id);
    const newIndex = checklistItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(checklistItems, oldIndex, newIndex);
    onReorderItems(checklistId, reordered.map((i) => i.id));
  };

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
              <Card key={checklist.id} className={checklist.ativo === false ? "opacity-70" : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>{checklist.nome}</CardTitle>
                        {checklist.ativo === false && (
                          <Badge variant="secondary">Pausado</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {checklist.area} - {checklist.turno}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={checklist.ativo !== false}
                        onCheckedChange={() => handleToggleActive(checklist)}
                        aria-label={checklist.ativo === false ? "Reativar checklist" : "Pausar checklist"}
                      />
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
              const checklistItems = items
                .filter((item) => item.checklist_type_id === checklist.id)
                .sort((a, b) => a.ordem - b.ordem);

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
                      <div className="flex items-center gap-3">
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
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd(checklist.id, checklistItems)}
                    >
                      <SortableContext
                        items={checklistItems.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1 pt-2">
                          {checklistItems.map((item) => (
                            <SortableItemRow
                              key={item.id}
                              item={item}
                              selected={selectedItems.has(item.id)}
                              onToggleSelection={() => onToggleItemSelection(item.id)}
                              onEdit={() => {
                                onSetSelectedItem(item);
                                onSetItemDialogOpen(true);
                              }}
                              onDelete={() => {
                                onSetItemToDelete({ id: item.id, type: 'item' });
                                onSetDeleteDialogOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
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
