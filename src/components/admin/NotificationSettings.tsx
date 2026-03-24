import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, Clock, Sun, CloudSun, Moon, Send, MessageSquare, Plus, X } from "lucide-react";

// Função para converter horário de BRT (Brasília, UTC-3) para UTC
const convertBRTtoUTC = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  let utcHours = hours + 3;
  
  if (utcHours >= 24) {
    utcHours -= 24;
  }
  
  return `${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Função para converter horário de UTC para BRT (Brasília, UTC-3)
const convertUTCtoBRT = (timeStr: string): string => {
  const timePart = timeStr.split(':');
  const hours = Number(timePart[0]);
  const minutes = Number(timePart[1]);
  
  let brtHours = hours - 3;
  
  if (brtHours < 0) {
    brtHours += 24;
  }
  
  return `${String(brtHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Função para formatar número de WhatsApp
const formatWhatsAppNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
};

interface Settings {
  id?: string;
  notification_email: string;
  notification_time_manha: string;
  notification_time_tarde: string;
  notification_time_noite: string;
  notification_channel_email: boolean;
  notification_channel_whatsapp: boolean;
  notification_whatsapp_number: string;
  notification_whatsapp_numbers: string[];
}

interface ChecklistType {
  id: string;
  nome: string;
  area: string;
  turno: string;
  store_id?: string;
}

interface ChecklistNotification {
  checklist_type_id: string;
  turno: string;
}

export function NotificationSettings() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    notification_email: "",
    notification_time_manha: "09:00",
    notification_time_tarde: "14:00",
    notification_time_noite: "22:00",
    notification_channel_email: true,
    notification_channel_whatsapp: false,
    notification_whatsapp_number: "",
    notification_whatsapp_numbers: [],
  });
  const [newWhatsAppNumber, setNewWhatsAppNumber] = useState("");
  const [checklists, setChecklists] = useState<ChecklistType[]>([]);
  const [manhaChecklists, setManhaChecklists] = useState<Set<string>>(new Set());
  const [tardeChecklists, setTardeChecklists] = useState<Set<string>>(new Set());
  const [noiteChecklists, setNoiteChecklists] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log("=== NotificationSettings - Store Check ===");
    console.log("Current Store:", currentStore);
    
    // Sempre tentar carregar dados, mesmo sem store (para super_admin)
    loadData();
  }, [currentStore]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      console.log("🔍 [LOAD] Carregando dados...");
      console.log("🔍 [LOAD] Store ID:", currentStore?.id);

      // Se não houver loja selecionada, não carregar dados
      if (!currentStore?.id) {
        console.log("⚠️ [LOAD] No store selected - skipping data load");
        setLoading(false);
        return;
      }

      const [settingsResult, checklistsResult, notificationsResult] = await Promise.all([
        supabase.from("admin_settings").select("*").eq("store_id", currentStore.id).maybeSingle(),
        supabase.from("checklist_types").select("*").eq("store_id", currentStore.id).order("nome"),
        supabase
          .from("checklist_notifications")
          .select(`
            checklist_type_id,
            turno,
            checklist_types!inner(store_id)
          `)
          .eq("checklist_types.store_id", currentStore.id),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (checklistsResult.error) throw checklistsResult.error;
      if (notificationsResult.error) throw notificationsResult.error;

      if (settingsResult.data) {
        console.log("🔍 [LOAD] Settings do banco (UTC):", {
          manha: settingsResult.data.notification_time_manha,
          tarde: settingsResult.data.notification_time_tarde,
          noite: settingsResult.data.notification_time_noite,
        });
        
        // Build whatsapp numbers array from new column or fallback to old single field
        const rawNumbers: string[] = (settingsResult.data as any).notification_whatsapp_numbers || [];
        const whatsappNumbers = rawNumbers.length > 0 
          ? rawNumbers.map((n: string) => formatWhatsAppNumber(n))
          : settingsResult.data.notification_whatsapp_number 
            ? [formatWhatsAppNumber(settingsResult.data.notification_whatsapp_number)]
            : [];

        const convertedSettings = {
          id: settingsResult.data.id,
          notification_email: settingsResult.data.notification_email,
          notification_time_manha: convertUTCtoBRT(settingsResult.data.notification_time_manha.substring(0, 5)),
          notification_time_tarde: convertUTCtoBRT(settingsResult.data.notification_time_tarde.substring(0, 5)),
          notification_time_noite: convertUTCtoBRT(settingsResult.data.notification_time_noite.substring(0, 5)),
          notification_channel_email: settingsResult.data.notification_channel_email ?? true,
          notification_channel_whatsapp: settingsResult.data.notification_channel_whatsapp ?? false,
          notification_whatsapp_number: settingsResult.data.notification_whatsapp_number || "",
          notification_whatsapp_numbers: whatsappNumbers,
        };
        
        console.log("🔍 [LOAD] Settings convertidos (BRT):", convertedSettings);
        setSettings(convertedSettings);
      }

      setChecklists(checklistsResult.data || []);

      const manha = new Set<string>();
      const tarde = new Set<string>();
      const noite = new Set<string>();

      notificationsResult.data?.forEach((notif: ChecklistNotification) => {
        if (notif.turno === "manha") {
          manha.add(notif.checklist_type_id);
        } else if (notif.turno === "tarde") {
          tarde.add(notif.checklist_type_id);
        } else if (notif.turno === "noite") {
          noite.add(notif.checklist_type_id);
        }
      });

      setManhaChecklists(manha);
      setTardeChecklists(tarde);
      setNoiteChecklists(noite);
      
      console.log("✅ [LOAD] Carregamento concluído!");
    } catch (error: any) {
      console.error("❌ [LOAD] Erro:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistToggle = (checklistId: string, turno: "manha" | "tarde" | "noite", checked: boolean) => {
    if (turno === "manha") {
      const newSet = new Set(manhaChecklists);
      if (checked) {
        newSet.add(checklistId);
      } else {
        newSet.delete(checklistId);
      }
      setManhaChecklists(newSet);
    } else if (turno === "tarde") {
      const newSet = new Set(tardeChecklists);
      if (checked) {
        newSet.add(checklistId);
      } else {
        newSet.delete(checklistId);
      }
      setTardeChecklists(newSet);
    } else {
      const newSet = new Set(noiteChecklists);
      if (checked) {
        newSet.add(checklistId);
      } else {
        newSet.delete(checklistId);
      }
      setNoiteChecklists(newSet);
    }
  };

  const handleSave = async () => {
    // Capturar store no início
    const targetStore = currentStore;
    
    if (!targetStore) {
      toast({
        title: "Erro",
        description: "Selecione uma loja antes de salvar",
        variant: "destructive",
      });
      return;
    }

    // Validar que pelo menos um canal está ativo
    if (!settings.notification_channel_email && !settings.notification_channel_whatsapp) {
      toast({
        title: "Erro de validação",
        description: "Pelo menos um canal de notificação deve estar ativo (Email ou WhatsApp)",
        variant: "destructive",
      });
      return;
    }

    // Validar email se canal de email estiver ativo
    if (settings.notification_channel_email && !settings.notification_email) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, informe um email para notificações",
        variant: "destructive",
      });
      return;
    }

    // Validar WhatsApp se canal de WhatsApp estiver ativo
    if (settings.notification_channel_whatsapp && settings.notification_whatsapp_numbers.length === 0) {
      toast({
        title: "WhatsApp obrigatório",
        description: "Por favor, adicione pelo menos um número de WhatsApp para notificações",
        variant: "destructive",
      });
      return;
    }

    // Validar que os checklists pertencem à loja atual
    const invalidChecklists = checklists.filter(c => c.store_id && c.store_id !== targetStore.id);
    if (invalidChecklists.length > 0) {
      console.error("❌ Checklists de loja incorreta detectados:", invalidChecklists);
      toast({
        title: "Erro de Validação",
        description: "Alguns checklists não pertencem à loja selecionada",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      console.log("💾 [SAVE] Iniciando salvamento...");
      console.log("💾 [SAVE] Store ID:", targetStore.id);
      console.log("💾 [SAVE] Horários BRT:", {
        manha: settings.notification_time_manha,
        tarde: settings.notification_time_tarde,
        noite: settings.notification_time_noite,
      });

      // Converter horários para UTC
      const timesManha = convertBRTtoUTC(settings.notification_time_manha);
      const timesTarde = convertBRTtoUTC(settings.notification_time_tarde);
      const timesNoite = convertBRTtoUTC(settings.notification_time_noite);
      
      console.log("💾 [SAVE] Horários UTC convertidos:", {
        manha: timesManha,
        tarde: timesTarde,
        noite: timesNoite
      });

      // Clean all WhatsApp numbers to digits only
      const cleanNumbers = settings.notification_whatsapp_numbers
        .map(n => n.replace(/\D/g, ''))
        .filter(n => n.length >= 10);

      const settingsData = {
        notification_email: settings.notification_email,
        notification_time_manha: timesManha + ":00",
        notification_time_tarde: timesTarde + ":00",
        notification_time_noite: timesNoite + ":00",
        notification_channel_email: settings.notification_channel_email,
        notification_channel_whatsapp: settings.notification_channel_whatsapp,
        notification_whatsapp_number: cleanNumbers[0] || null,
        notification_whatsapp_numbers: cleanNumbers,
        store_id: targetStore.id,
      } as any;

      toast({
        title: "Salvando...",
        description: "Aplicando configurações de notificação",
      });

      let error;
      if (settings.id) {
        const result = await supabase
          .from("admin_settings")
          .update(settingsData)
          .eq("id", settings.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("admin_settings")
          .insert([settingsData])
          .select()
          .single();
        error = result.error;
        if (!error && result.data) {
          setSettings({ ...settings, id: result.data.id });
        }
      }

      if (error) throw error;

      // Deletar apenas notificações dos checklists da loja atual
      const checklistIds = checklists.map(c => c.id);
      if (checklistIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("checklist_notifications")
          .delete()
          .in("checklist_type_id", checklistIds);
        
        if (deleteError) throw deleteError;
      }

      // Insert new notifications
      const notifications: { checklist_type_id: string; turno: "manha" | "tarde" | "noite" }[] = [];

      manhaChecklists.forEach((checklistId) => {
        notifications.push({ checklist_type_id: checklistId, turno: "manha" as const });
      });

      tardeChecklists.forEach((checklistId) => {
        notifications.push({ checklist_type_id: checklistId, turno: "tarde" as const });
      });

      noiteChecklists.forEach((checklistId) => {
        notifications.push({ checklist_type_id: checklistId, turno: "noite" as const });
      });

      if (notifications.length > 0) {
        const { error: insertError } = await supabase
          .from("checklist_notifications")
          .insert(notifications);
        if (insertError) throw insertError;
      }

      toast({
        title: "✓ Salvo com sucesso",
        description: "Recarregando dados para confirmar...",
      });

      // FORÇAR reload completo
      setLoading(true);
      console.log("🔄 [SAVE] Iniciando reload...");
      await loadData();
      console.log("✅ [SAVE] Reload concluído!");
      
      toast({
        title: "✓ Configurações aplicadas",
        description: "As notificações foram atualizadas com sucesso",
      });
    } catch (error: any) {
      console.error("❌ [SAVE] Erro:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  const handleTestNotification = async (turno: "manha" | "tarde" | "noite") => {
    setSaving(true);
    try {
      console.log(`🧪 Testando notificação para turno: ${turno}`);
      
      const { data, error } = await supabase.functions.invoke("send-checklist-notifications", {
        body: { turno },
      });

      if (error) throw error;

      console.log("✅ Resposta do teste:", data);
      
      toast({
        title: "Notificação de teste enviada",
        description: `Verifique ${settings.notification_channel_email ? 'sua caixa de entrada' : ''}${settings.notification_channel_email && settings.notification_channel_whatsapp ? ' e ' : ''}${settings.notification_channel_whatsapp ? 'seu WhatsApp' : ''} para notificações de ${turno}`,
      });
    } catch (error: any) {
      console.error("❌ Erro no teste:", error);
      toast({
        title: "Erro ao enviar teste",
        description: error.message || "Falha ao enviar notificação de teste",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Notificações</CardTitle>
          <CardDescription>
            Configure os canais e horários para receber notificações sobre checklists não realizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Canais de Notificação */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Canais de Notificação</Label>
            <p className="text-sm text-muted-foreground">
              Selecione como deseja receber as notificações de checklists não realizados
            </p>
            
            {/* Email Channel */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="channel-email"
                  checked={settings.notification_channel_email}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notification_channel_email: checked as boolean })
                  }
                />
                <label
                  htmlFor="channel-email"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </label>
              </div>
              
              {settings.notification_channel_email && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="email">Email para Notificações</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={settings.notification_email}
                    onChange={(e) =>
                      setSettings({ ...settings, notification_email: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            {/* WhatsApp Channel */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="channel-whatsapp"
                  checked={settings.notification_channel_whatsapp}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notification_channel_whatsapp: checked as boolean })
                  }
                />
                <label
                  htmlFor="channel-whatsapp"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </label>
              </div>
              
              {settings.notification_channel_whatsapp && (
                <div className="ml-6 space-y-3">
                  <Label>Números do WhatsApp</Label>
                  
                  {/* Lista de números adicionados */}
                  {settings.notification_whatsapp_numbers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {settings.notification_whatsapp_numbers.map((number, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="flex items-center gap-1 py-1.5 px-3 text-sm"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {number}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = settings.notification_whatsapp_numbers.filter((_, i) => i !== index);
                              setSettings({ ...settings, notification_whatsapp_numbers: updated });
                            }}
                            className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Input para adicionar novo número */}
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder="+55 48 99999-9999"
                      value={newWhatsAppNumber}
                      onChange={(e) => setNewWhatsAppNumber(formatWhatsAppNumber(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const clean = newWhatsAppNumber.replace(/\D/g, '');
                          if (clean.length >= 10) {
                            setSettings({
                              ...settings,
                              notification_whatsapp_numbers: [...settings.notification_whatsapp_numbers, newWhatsAppNumber],
                            });
                            setNewWhatsAppNumber("");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const clean = newWhatsAppNumber.replace(/\D/g, '');
                        if (clean.length >= 10) {
                          setSettings({
                            ...settings,
                            notification_whatsapp_numbers: [...settings.notification_whatsapp_numbers, newWhatsAppNumber],
                          });
                          setNewWhatsAppNumber("");
                        } else {
                          toast({
                            title: "Número inválido",
                            description: "Informe um número com DDD válido (mínimo 10 dígitos)",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inclua o código do país (ex: 55 para Brasil) e DDD. Pressione Enter ou clique em + para adicionar.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time-manha">
                <Sun className="inline h-4 w-4 mr-2" />
                Horário - Manhã (Brasília)
              </Label>
              <Input
                id="time-manha"
                type="time"
                value={settings.notification_time_manha}
                onChange={(e) =>
                  setSettings({ ...settings, notification_time_manha: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                🕐 Horário de Brasília (BRT/UTC-3)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-tarde">
                <CloudSun className="inline h-4 w-4 mr-2" />
                Horário - Tarde (Brasília)
              </Label>
              <Input
                id="time-tarde"
                type="time"
                value={settings.notification_time_tarde}
                onChange={(e) =>
                  setSettings({ ...settings, notification_time_tarde: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                🕐 Horário de Brasília (BRT/UTC-3)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-noite">
                <Moon className="inline h-4 w-4 mr-2" />
                Horário - Noite (Brasília)
              </Label>
              <Input
                id="time-noite"
                type="time"
                value={settings.notification_time_noite}
                onChange={(e) =>
                  setSettings({ ...settings, notification_time_noite: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                🕐 Horário de Brasília (BRT/UTC-3)
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Checklists de Manhã
            </CardTitle>
            <CardDescription>
              Selecione quais checklists devem ser notificados no horário da manhã
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklists.map((checklist) => (
              <div key={checklist.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`manha-${checklist.id}`}
                  checked={manhaChecklists.has(checklist.id)}
                  onCheckedChange={(checked) =>
                    handleChecklistToggle(checklist.id, "manha", checked as boolean)
                  }
                />
                <label
                  htmlFor={`manha-${checklist.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {checklist.nome} ({checklist.area})
                </label>
              </div>
            ))}
            {checklists.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum checklist cadastrado</p>
            )}
            <Button
              onClick={() => handleTestNotification("manha")}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={saving}
            >
              <Send className="h-4 w-4 mr-2" />
              Testar Notificação
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5" />
              Checklists de Tarde
            </CardTitle>
            <CardDescription>
              Selecione quais checklists devem ser notificados no horário da tarde
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklists.map((checklist) => (
              <div key={checklist.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`tarde-${checklist.id}`}
                  checked={tardeChecklists.has(checklist.id)}
                  onCheckedChange={(checked) =>
                    handleChecklistToggle(checklist.id, "tarde", checked as boolean)
                  }
                />
                <label
                  htmlFor={`tarde-${checklist.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {checklist.nome} ({checklist.area})
                </label>
              </div>
            ))}
            {checklists.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum checklist cadastrado</p>
            )}
            <Button
              onClick={() => handleTestNotification("tarde")}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={saving}
            >
              <Send className="h-4 w-4 mr-2" />
              Testar Notificação
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Checklists de Noite
            </CardTitle>
            <CardDescription>
              Selecione quais checklists devem ser notificados no horário da noite
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklists.map((checklist) => (
              <div key={checklist.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`noite-${checklist.id}`}
                  checked={noiteChecklists.has(checklist.id)}
                  onCheckedChange={(checked) =>
                    handleChecklistToggle(checklist.id, "noite", checked as boolean)
                  }
                />
                <label
                  htmlFor={`noite-${checklist.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {checklist.nome} ({checklist.area})
                </label>
              </div>
            ))}
            {checklists.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum checklist cadastrado</p>
            )}
            <Button
              onClick={() => handleTestNotification("noite")}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={saving}
            >
              <Send className="h-4 w-4 mr-2" />
              Testar Notificação
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
