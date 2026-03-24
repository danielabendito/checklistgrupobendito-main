import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Camera, Trash2, Save, Loader2, Image, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ChecklistType {
  id: string;
  nome: string;
  area: string;
  turno: string;
}

interface ChecklistItem {
  id: string;
  checklist_type_id: string;
  nome: string;
  ordem: number;
  requer_foto: boolean;
}

interface InspectionStandard {
  id: string;
  store_id: string;
  checklist_item_id: string;
  criteria: string;
  severity: string;
  reference_photos: string[];
  enabled: boolean;
}

export function InspectionStandardsTab() {
  const { currentStore } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<ChecklistType[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [standards, setStandards] = useState<Record<string, InspectionStandard>>({});
  const [localStandards, setLocalStandards] = useState<Record<string, Partial<InspectionStandard>>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (currentStore) {
      loadData();
    }
  }, [currentStore]);

  const loadData = async () => {
    if (!currentStore) return;
    
    try {
      setLoading(true);

      // Load checklists and items
      const [checklistsRes, itemsRes, standardsRes] = await Promise.all([
        supabase.from('checklist_types')
          .select('id, nome, area, turno')
          .eq('store_id', currentStore.id)
          .order('nome'),
        supabase.from('checklist_items')
          .select('id, checklist_type_id, nome, ordem, requer_foto')
          .eq('store_id', currentStore.id)
          .eq('requer_foto', true)
          .order('ordem'),
        supabase.from('inspection_standards')
          .select('*')
          .eq('store_id', currentStore.id),
      ]);

      if (checklistsRes.error) throw checklistsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (standardsRes.error) throw standardsRes.error;

      setChecklists(checklistsRes.data || []);
      setItems(itemsRes.data || []);

      // Create map of standards by item_id
      const standardsMap: Record<string, InspectionStandard> = {};
      (standardsRes.data || []).forEach((s: InspectionStandard) => {
        standardsMap[s.checklist_item_id] = s;
      });
      setStandards(standardsMap);
      setLocalStandards({});

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

  const getLocalValue = (itemId: string, field: keyof InspectionStandard) => {
    if (localStandards[itemId]?.[field] !== undefined) {
      return localStandards[itemId][field];
    }
    if (field === 'enabled') {
      return standards[itemId]?.enabled ?? true;
    }
    return standards[itemId]?.[field] ?? (field === 'reference_photos' ? [] : field === 'severity' ? 'medium' : '');
  };

  const setLocalValue = (itemId: string, field: keyof InspectionStandard, value: any) => {
    setLocalStandards(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      }
    }));
  };

  const handleSave = async (itemId: string) => {
    if (!currentStore) return;

    const enabled = getLocalValue(itemId, 'enabled') as boolean;
    const criteria = getLocalValue(itemId, 'criteria') as string;
    
    // Só exigir critério se a inspeção estiver ativada
    if (enabled && !criteria?.trim()) {
      toast({
        title: "Erro",
        description: "O critério de inspeção é obrigatório para itens ativos",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(itemId);

      const data = {
        store_id: currentStore.id,
        checklist_item_id: itemId,
        criteria: criteria.trim(),
        severity: getLocalValue(itemId, 'severity') as string,
        reference_photos: getLocalValue(itemId, 'reference_photos') as string[],
        enabled: getLocalValue(itemId, 'enabled') as boolean,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('inspection_standards')
        .upsert(data, { onConflict: 'store_id,checklist_item_id' });

      if (error) throw error;

      toast({
        title: "Salvo",
        description: "Padrão de inspeção atualizado",
      });

      // Update local state
      setStandards(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], ...data, id: prev[itemId]?.id || '' } as InspectionStandard,
      }));
      
      // Clear local changes for this item
      setLocalStandards(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handlePhotoUpload = async (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentStore) return;

    try {
      setUploadingPhoto(itemId);

      const fileExt = file.name.split('.').pop();
      const fileName = `${currentStore.id}/${itemId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('inspection-references')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('inspection-references')
        .getPublicUrl(fileName);

      const currentPhotos = getLocalValue(itemId, 'reference_photos') as string[];
      setLocalValue(itemId, 'reference_photos', [...currentPhotos, urlData.publicUrl]);

      toast({
        title: "Foto adicionada",
        description: "Clique em Salvar para confirmar",
      });

    } catch (error: any) {
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleRemovePhoto = async (itemId: string, photoUrl: string) => {
    const currentPhotos = getLocalValue(itemId, 'reference_photos') as string[];
    setLocalValue(itemId, 'reference_photos', currentPhotos.filter(p => p !== photoUrl));

    // Try to delete from storage
    try {
      const path = photoUrl.split('/inspection-references/')[1];
      if (path) {
        await supabase.storage.from('inspection-references').remove([path]);
      }
    } catch (error) {
      console.error('Error removing photo from storage:', error);
    }
  };

  const hasChanges = (itemId: string) => {
    return Object.keys(localStandards[itemId] || {}).length > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const itemsWithPhotoRequirement = items.filter(i => i.requer_foto);

  if (itemsWithPhotoRequirement.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum item de checklist requer foto de evidência.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Configure itens com "Requer Foto" na aba Itens para usar o Inspetor Sanitário Virtual.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Padrões de Inspeção</h2>
        <p className="text-muted-foreground">
          Configure os critérios e fotos de referência para cada item que requer foto
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          O Inspetor Sanitário Virtual compara as fotos enviadas pelos colaboradores com as fotos de referência cadastradas aqui.
          Configure critérios claros e objetivos para cada item.
        </AlertDescription>
      </Alert>

      <Accordion type="multiple" className="space-y-4">
        {checklists.map(checklist => {
          const checklistItems = itemsWithPhotoRequirement.filter(
            i => i.checklist_type_id === checklist.id
          );

          if (checklistItems.length === 0) return null;

          return (
            <AccordionItem 
              key={checklist.id} 
              value={checklist.id}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{checklist.nome}</span>
                  <Badge variant="outline">{checklist.area}</Badge>
                  <Badge variant="secondary">{checklist.turno}</Badge>
                  <Badge>{checklistItems.length} itens com foto</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {checklistItems.map(item => {
                    const photos = getLocalValue(item.id, 'reference_photos') as string[];
                    const isModified = hasChanges(item.id);
                    const isSaving = saving === item.id;
                    const isUploading = uploadingPhoto === item.id;

                    const isEnabled = getLocalValue(item.id, 'enabled') as boolean;

                    return (
                      <Card key={item.id} className={`${isModified ? 'ring-2 ring-primary' : ''} ${!isEnabled ? 'opacity-60' : ''}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => setLocalValue(item.id, 'enabled', checked)}
                              />
                              <CardTitle className={`text-lg ${!isEnabled ? 'text-muted-foreground' : ''}`}>
                                {item.nome}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isEnabled && (
                                <Badge variant="secondary">Inspeção desativada</Badge>
                              )}
                              {isModified && (
                                <Badge variant="outline" className="text-primary">
                                  Alterações não salvas
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardDescription>Item #{item.ordem}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`criteria-${item.id}`}>
                              Critério de Inspeção *
                            </Label>
                            <Textarea
                              id={`criteria-${item.id}`}
                              placeholder="Ex: Bancada limpa, sem resíduos, sem utensílios sujos aparentes"
                              value={getLocalValue(item.id, 'criteria') as string}
                              onChange={(e) => setLocalValue(item.id, 'criteria', e.target.value)}
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`severity-${item.id}`}>
                              Nível de Severidade
                            </Label>
                            <Select
                              value={getLocalValue(item.id, 'severity') as string}
                              onValueChange={(value) => setLocalValue(item.id, 'severity', value)}
                            >
                              <SelectTrigger id={`severity-${item.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">🟢 Baixa</SelectItem>
                                <SelectItem value="medium">🟡 Média</SelectItem>
                                <SelectItem value="high">🔴 Alta</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Fotos de Referência (máx. 3)</Label>
                            <div className="flex flex-wrap gap-4">
                              {photos.map((url, index) => (
                                <div key={index} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Referência ${index + 1}`}
                                    className="w-24 h-24 object-cover rounded-lg border"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleRemovePhoto(item.id, url)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              
                              {photos.length < 3 && (
                                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                  {isUploading ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  ) : (
                                    <>
                                      <Camera className="h-6 w-6 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                                    </>
                                  )}
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handlePhotoUpload(item.id, e)}
                                    disabled={isUploading}
                                  />
                                </label>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Adicione fotos mostrando o padrão ideal de como o item deve estar
                            </p>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              onClick={() => handleSave(item.id)}
                              disabled={isSaving || (isEnabled && !getLocalValue(item.id, 'criteria'))}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Salvar Padrão
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
