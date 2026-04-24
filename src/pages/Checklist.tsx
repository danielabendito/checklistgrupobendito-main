import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, CheckCircle2, XCircle, Clock, Camera, X, Loader2, AlertCircle, Cloud } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useStore } from "@/contexts/StoreContext";
import { getBrasiliaDateString, getBrasiliaTimestampISO, getOperationalDateString } from "@/lib/utils";
import { z } from "zod";
import { SecurityWatermark } from "@/components/SecurityWatermark";
import { useImageCompression } from "@/hooks/useImageCompression";
import { CameraCapture } from "@/components/CameraCapture";

interface ChecklistType {
  id: string;
  nome: string;
  area: string;
  turno: string;
  allowed_role_ids: string[];
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

interface ChecklistResponse {
  id: string;
  checklist_item_id: string;
  status: 'ok' | 'nok' | 'pendente';
  observacoes: string | null;
  photo_url: string | null;
}

// Validation schema for observations
const observationSchema = z.object({
  observacoes: z.string().max(2000, "Observações devem ter no máximo 2000 caracteres").optional(),
});

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const Checklist = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentStore } = useStore();
  const { compress } = useImageCompression();
  const [user, setUser] = useState<User | null>(null);
  const [checklist, setChecklist] = useState<ChecklistType | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [responses, setResponses] = useState<Record<string, ChecklistResponse>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});
  const [cameraOpenFor, setCameraOpenFor] = useState<string | null>(null);
  const [checklistDate, setChecklistDate] = useState<string>(getBrasiliaDateString());
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{
    ok: number;
    nok: number;
    total: number;
    photos: number;
  } | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  
  // Ref to track pending saves
  const pendingSaveRef = useRef<Set<string>>(new Set());
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === SessionStorage backup para proteger progresso ===
  const sessionKey = `checklist-progress-${id}-${checklistDate}`;

  const saveProgressToSession = useCallback(() => {
    try {
      const data = Object.entries(responses).map(([itemId, r]) => ({
        itemId,
        status: r.status,
        observacoes: r.observacoes,
        photo_url: r.photo_url,
      }));
      sessionStorage.setItem(sessionKey, JSON.stringify(data));
      console.log('💾 [SESSION] Progresso salvo em sessionStorage');
    } catch (e) {
      // sessionStorage pode estar cheio ou indisponível
      console.warn('💾 [SESSION] Falha ao salvar:', e);
    }
  }, [responses, sessionKey]);

  const restoreProgressFromSession = useCallback(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (!saved) return null;
      const data = JSON.parse(saved) as Array<{
        itemId: string;
        status: 'ok' | 'nok' | 'pendente';
        observacoes: string | null;
        photo_url: string | null;
      }>;
      console.log('💾 [SESSION] Restaurando progresso do sessionStorage');
      return data;
    } catch {
      return null;
    }
  }, [sessionKey]);

  const clearSessionProgress = useCallback(() => {
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {}
  }, [sessionKey]);

  // Auth state listener - prevents unexpected redirects
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          navigate('/auth');
        } else if (session) {
          setUser(session.user);
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user && id) {
      loadChecklistData();
    }
  }, [user, id]);

  // Realtime listener para sincronizar mudanças de itens do checklist
  useEffect(() => {
    if (!id) return;

    console.log('🔌 [REALTIME] Inscrevendo para mudanças em checklist_items...');

    const channel = supabase
      .channel(`checklist-items-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checklist_items',
          filter: `checklist_type_id=eq.${id}`,
        },
        (payload) => {
          console.log('🔄 [REALTIME] Mudança detectada:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              const newItem = payload.new as ChecklistItem;
              // Evitar duplicatas
              if (prev.some(item => item.id === newItem.id)) {
                return prev;
              }
              return [...prev, newItem].sort((a, b) => a.ordem - b.ordem);
            });
            toast({
              title: "Novo item adicionado",
              description: `"${(payload.new as any).nome}" foi adicionado ao checklist`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev
                .map(item =>
                  item.id === (payload.new as any).id
                    ? (payload.new as ChecklistItem)
                    : item
                )
                .sort((a, b) => a.ordem - b.ordem)
            );
          } else if (payload.eventType === 'DELETE') {
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
      .subscribe((status) => {
        console.log('🔌 [REALTIME] Status da inscrição:', status);
      });

    return () => {
      console.log('🔌 [REALTIME] Removendo canal...');
      supabase.removeChannel(channel);
    };
  }, [id, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const loadChecklistData = async () => {
    try {
      setLoading(true);

      // Load checklist type
      const { data: checklistData, error: checklistError } = await supabase
        .from("checklist_types")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (checklistError) throw checklistError;
      if (!checklistData) {
        toast({
          title: "Checklist não encontrado",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setChecklist(checklistData);

      // Calcular data operacional baseada no turno
      const operationalDate = getOperationalDateString(checklistData.turno);
      setChecklistDate(operationalDate);
      
      console.log('📅 [DATE] Turno:', checklistData.turno);
      console.log('📅 [DATE] Data Brasília:', getBrasiliaDateString());
      console.log('📅 [DATE] Data Operacional:', operationalDate);

      // Load checklist items
      const { data: itemsData, error: itemsError } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("checklist_type_id", id)
        .order("ordem");

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Load today's responses using frozen date (collaborative, all users for this store)
      const { data: responsesData, error: responsesError } = await supabase
        .from("checklist_responses")
        .select("*")
        .eq("checklist_type_id", id)
        .eq("store_id", currentStore.id)
        .eq("data", operationalDate)
        .order("created_at", { ascending: true });

      if (responsesError) throw responsesError;

      // Convert responses array to object keyed by item id
      const responsesMap: Record<string, ChecklistResponse> = {};
      responsesData?.forEach(response => {
        responsesMap[response.checklist_item_id] = response;
      });

      // Se não houver respostas do banco, tentar restaurar do sessionStorage
      if (Object.keys(responsesMap).length === 0) {
        const savedProgress = restoreProgressFromSession();
        if (savedProgress && savedProgress.length > 0) {
          console.log('💾 [SESSION] Restaurando progresso salvo localmente');
          savedProgress.forEach(item => {
            responsesMap[item.itemId] = {
              id: '',
              checklist_item_id: item.itemId,
              status: item.status,
              observacoes: item.observacoes,
              photo_url: item.photo_url,
            };
          });
          toast({
            title: "Progresso restaurado",
            description: "Seu progresso anterior foi recuperado automaticamente.",
          });
        }
      }

      setResponses(responsesMap);

      // Generate signed URLs for existing photos (30 days validity)
      const urlsMap: Record<string, string> = {};
      for (const response of responsesData || []) {
        if (response.photo_url) {
          try {
            const { data: signedUrl } = await supabase.storage
              .from('checklist-photos')
              .createSignedUrl(response.photo_url, 2592000);
            
            if (signedUrl) {
              urlsMap[response.checklist_item_id] = signedUrl.signedUrl;
            }
          } catch (error) {
            console.error("Error generating signed URL:", error);
          }
        }
      }
      setSignedPhotoUrls(urlsMap);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar checklist",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-save individual item to database
  const autoSaveItem = useCallback(async (
    itemId: string, 
    status?: 'ok' | 'nok' | 'pendente', 
    observacoes?: string | null,
    photoUrl?: string | null
  ) => {
    if (!user || !currentStore || !id) return;

    try {
      setAutoSaving(true);
      pendingSaveRef.current.add(itemId);

      const currentResponse = responses[itemId];
      
      const dataToSave = {
        checklist_type_id: id,
        checklist_item_id: itemId,
        user_id: user.id,
        data: checklistDate,
        status: status ?? currentResponse?.status ?? 'pendente',
        observacoes: observacoes !== undefined ? observacoes : (currentResponse?.observacoes ?? null),
        photo_url: photoUrl !== undefined ? photoUrl : (currentResponse?.photo_url ?? null),
        store_id: currentStore.id,
        completed_at: null, // Only set on final save
      };

      console.log('💾 [AUTO-SAVE] Salvando item:', itemId, dataToSave);

      const { error } = await supabase
        .from("checklist_responses")
        .upsert(dataToSave, {
          onConflict: 'user_id,checklist_item_id,data',
        });

      if (error) {
        console.error('❌ [AUTO-SAVE] Erro:', error);
        throw error;
      }

      console.log('✅ [AUTO-SAVE] Item salvo com sucesso:', itemId);
      
    } catch (error: any) {
      console.error('❌ [AUTO-SAVE] Falha ao salvar:', error);
      // Don't show toast for auto-save errors to avoid spam
    } finally {
      pendingSaveRef.current.delete(itemId);
      
      // Only set autoSaving to false when all pending saves are done
      if (pendingSaveRef.current.size === 0) {
        // Small delay to show the indicator
        setTimeout(() => setAutoSaving(false), 500);
      }
    }
  }, [user, currentStore, id, checklistDate, responses]);

  // Debounced auto-save for observations
  const debouncedAutoSaveObservation = useMemo(
    () => debounce((itemId: string, observacoes: string) => {
      autoSaveItem(itemId, undefined, observacoes, undefined);
    }, 1500),
    [autoSaveItem]
  );

  const handleStatusChange = async (itemId: string, status: 'ok' | 'nok' | 'pendente') => {
    // Update local state immediately for responsive UI
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        id: prev[itemId]?.id || '',
        checklist_item_id: itemId,
        status,
        observacoes: prev[itemId]?.observacoes || null,
        photo_url: prev[itemId]?.photo_url || null,
      }
    }));

    // Auto-save to database
    await autoSaveItem(itemId, status, undefined, undefined);
  };

  const handleObservacaoChange = (itemId: string, observacoes: string) => {
    // Validate input length
    const validation = observationSchema.safeParse({ observacoes });
    
    if (!validation.success) {
      toast({
        title: "Erro de validação",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    // Update local state immediately
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        id: prev[itemId]?.id || '',
        checklist_item_id: itemId,
        status: prev[itemId]?.status || 'pendente',
        observacoes: observacoes || null,
        photo_url: prev[itemId]?.photo_url || null,
      }
    }));

    // Debounced auto-save
    debouncedAutoSaveObservation(itemId, observacoes);
  };

  const handlePhotoUpload = async (itemId: string, file: File) => {
    try {
      setUploadingPhoto(itemId);

      // Salvar progresso atual em sessionStorage antes do upload
      saveProgressToSession();

      let fileToUpload: File;

      // Comprimir imagem com fallback defensivo
      try {
        console.log('📸 [PHOTO] Comprimindo imagem...');
        fileToUpload = await compress(file);
        console.log(`📸 [PHOTO] Comprimido: ${(fileToUpload.size / 1024).toFixed(0)}KB`);
      } catch (compressionError) {
        console.warn('📸 [PHOTO] Compressão falhou:', compressionError);
        
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Foto muito grande",
            description: "A foto excede 5MB. Tente tirar novamente com a câmera mais próxima do objeto.",
            variant: "destructive",
          });
          return;
        }
        
        fileToUpload = file;
        console.log('📸 [PHOTO] Usando arquivo original como fallback');
      }

      const fileName = `${user!.id}/${Date.now()}.jpg`;
      
      // Upload com 1 retry automático
      let uploadError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase.storage
          .from('checklist-photos')
          .upload(fileName, fileToUpload);

        if (!error) {
          uploadError = null;
          break;
        }
        
        uploadError = error;
        console.warn(`📸 [UPLOAD] Tentativa ${attempt + 1} falhou:`, error.message);
        
        if (attempt === 0) {
          // Esperar 2s antes do retry
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (uploadError) throw uploadError;

      // Generate signed URL for immediate display (30 days validity)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('checklist-photos')
        .createSignedUrl(fileName, 2592000);

      if (signedUrlError) throw signedUrlError;

      // Update local state
      const currentResponse = responses[itemId];
      setResponses(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          id: prev[itemId]?.id || '',
          checklist_item_id: itemId,
          status: prev[itemId]?.status || 'pendente',
          observacoes: prev[itemId]?.observacoes || null,
          photo_url: fileName,
        }
      }));

      // Store signed URL for immediate display
      setSignedPhotoUrls(prev => ({
        ...prev,
        [itemId]: signedUrlData.signedUrl,
      }));

      // Auto-save immediately after photo upload
      console.log('📸 [PHOTO] Salvando foto imediatamente no banco...');
      await autoSaveItem(
        itemId, 
        currentResponse?.status || 'pendente',
        currentResponse?.observacoes || null,
        fileName
      );

      toast({
        title: "Foto enviada e salva",
        description: "A foto foi anexada e seu progresso foi salvo automaticamente",
      });
    } catch (error: any) {
      console.error('📸 [PHOTO] Erro completo:', error);
      toast({
        title: "Erro ao enviar foto",
        description: "Não foi possível enviar a foto. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleRemovePhoto = async (itemId: string) => {
    const filePath = responses[itemId]?.photo_url;
    if (!filePath) return;

    try {
      // Delete from storage using file path
      const { error } = await supabase.storage
        .from('checklist-photos')
        .remove([filePath]);

      if (error) throw error;

      // Update response to remove photo
      setResponses(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          photo_url: null,
        }
      }));

      // Remove from signed URLs
      setSignedPhotoUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[itemId];
        return newUrls;
      });

      // Auto-save the removal
      await autoSaveItem(itemId, undefined, undefined, null);

      toast({
        title: "Foto removida",
        description: "A foto foi removida com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover foto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateStreak = async (): Promise<number> => {
    if (!user || !currentStore) return 1;
    try {
      const { data } = await supabase
        .from("checklist_responses")
        .select("data")
        .eq("user_id", user.id)
        .eq("store_id", currentStore.id)
        .not("completed_at", "is", null)
        .order("data", { ascending: false });

      if (!data || data.length === 0) return 1;

      const uniqueDates = [...new Set(data.map(r => r.data as string))].sort((a, b) => b.localeCompare(a));
      let streak = 0;
      let checkDate = getBrasiliaDateString();

      for (const date of uniqueDates) {
        if (date === checkDate) {
          streak++;
          const [y, m, d] = checkDate.split('-').map(Number);
          const prev = new Date(y, m - 1, d - 1);
          const py = prev.getFullYear();
          const pm = String(prev.getMonth() + 1).padStart(2, '0');
          const pd = String(prev.getDate()).padStart(2, '0');
          checkDate = `${py}-${pm}-${pd}`;
        } else {
          break;
        }
      }
      return Math.max(streak, 1);
    } catch {
      return 1;
    }
  };

  const handleSave = async () => {
    try {
      // Validate that items requiring photos have them
      const itemsWithoutPhotos = items.filter(item => {
        const response = responses[item.id];
        return item.requer_foto && !response?.photo_url;
      });

      if (itemsWithoutPhotos.length > 0) {
        toast({
          title: "Checklist não realizado",
          description: `Há ${itemsWithoutPhotos.length} ${itemsWithoutPhotos.length === 1 ? 'item com envio' : 'itens com envios'} de foto pendente. Confira novamente para então finalizar a tarefa.`,
          variant: "destructive",
        });
        return;
      }

      // Validar observações obrigatórias
      const itemsWithoutObservations = items.filter(item => {
        const response = responses[item.id];
        return item.observacao_obrigatoria && (!response?.observacoes || response.observacoes.trim() === '');
      });

      if (itemsWithoutObservations.length > 0) {
        toast({
          title: "Checklist não realizado",
          description: `Há ${itemsWithoutObservations.length} ${itemsWithoutObservations.length === 1 ? 'item com observação obrigatória' : 'itens com observações obrigatórias'} pendente.`,
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      if (!currentStore) {
        toast({
          title: "Erro",
          description: "Nenhuma loja selecionada",
          variant: "destructive",
        });
        return;
      }

      // Prepare data for upsert using frozen date
      const completedAt = getBrasiliaTimestampISO();
      console.log('🕐 [SAVE] Data Brasília:', checklistDate);
      console.log('🕐 [SAVE] Hora Brasília:', completedAt);

      const dataToSave = Object.entries(responses).map(([itemId, response]) => ({
        checklist_type_id: id!,
        checklist_item_id: itemId,
        user_id: user!.id,
        data: checklistDate,
        status: response.status,
        observacoes: response.observacoes,
        photo_url: response.photo_url,
        store_id: currentStore.id,
        completed_at: completedAt,
      }));

      const { error } = await supabase
        .from("checklist_responses")
        .upsert(dataToSave, {
          onConflict: 'user_id,checklist_item_id,data',
        });

      if (error) throw error;

      // Limpar backup de sessão ao salvar com sucesso
      clearSessionProgress();

      toast({
        title: "Salvo com sucesso!",
        description: "Suas respostas foram registradas.",
      });

      // Trigger AI inspection
      try {
        setInspecting(true);
        toast({
          title: "Analisando com Inspetor Virtual...",
          description: "Aguarde a análise das fotos de evidência.",
        });

        // Get user name for report
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", user!.id)
          .single();

        const response = await supabase.functions.invoke('ai-inspection', {
          body: {
            store_id: currentStore.id,
            checklist_type_id: id,
            execution_date: checklistDate,
            user_id: user!.id,
            user_name: profileData?.nome || 'Colaborador',
          },
        });

        if (response.error) {
          console.error('AI Inspection error:', response.error);
        } else if (response.data?.success) {
          toast({
            title: "✅ Checklist enviado",
            description: "Relatório enviado aos responsáveis.",
          });
        } else {
          console.log('AI Inspection result:', response.data);
        }
      } catch (inspectionError) {
        console.error('Inspection error:', inspectionError);
        // Don't show error to user - inspection is non-blocking
      } finally {
        setInspecting(false);
      }

      // Calcular streak e mostrar tela de conclusão
      const streak = await calculateStreak();
      setStreakDays(streak);
      const finalOk = Object.values(responses).filter(r => r.status === 'ok').length;
      const finalNok = Object.values(responses).filter(r => r.status === 'nok').length;
      const finalPhotos = Object.values(responses).filter(r => r.photo_url !== null).length;
      setCompletionSummary({
        ok: finalOk,
        nok: finalNok,
        total: items.length,
        photos: finalPhotos,
      });
      setShowCompletionScreen(true);

    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!checklist) {
    return null;
  }

  // Tela de conclusão após finalizar
  if (showCompletionScreen && completionSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-success/10 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-28 h-28 rounded-full bg-success/10 border-4 border-success flex items-center justify-center mb-8 animate-pulse">
          <CheckCircle2 className="h-14 w-14 text-success" />
        </div>
        <h1 className="text-3xl font-bold mb-2">🎉 Checklist Concluído!</h1>
        <p className="text-muted-foreground text-lg mb-8">{checklist.nome}</p>

        <Card className="w-full max-w-sm mb-6 border-success/20 bg-success/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-success font-medium">
                <CheckCircle2 className="h-4 w-4" /> Itens OK
              </span>
              <span className="font-bold text-xl">{completionSummary.ok}/{completionSummary.total}</span>
            </div>
            {completionSummary.nok > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-destructive font-medium">
                  <XCircle className="h-4 w-4" /> Itens NOK
                </span>
                <span className="font-bold text-xl text-destructive">{completionSummary.nok}</span>
              </div>
            )}
            {completionSummary.photos > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-primary font-medium">
                  <Camera className="h-4 w-4" /> Fotos enviadas
                </span>
                <span className="font-bold text-xl">{completionSummary.photos}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {streakDays >= 2 ? (
          <div className="mb-8 px-6 py-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 w-full max-w-sm">
            <p className="text-orange-500 font-bold text-xl">🔥 {streakDays} dias seguidos!</p>
            <p className="text-sm text-muted-foreground mt-1">Continue assim, você está arrasando!</p>
          </div>
        ) : (
          <div className="mb-8 px-6 py-4 bg-primary/10 rounded-2xl border border-primary/20 w-full max-w-sm">
            <p className="text-primary font-semibold text-lg">🌟 Excelente trabalho!</p>
            <p className="text-sm text-muted-foreground mt-1">Volte amanhã para iniciar uma sequência!</p>
          </div>
        )}

        <Button
          size="lg"
          className="w-full max-w-sm h-14 text-base"
          onClick={() => navigate('/')}
        >
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const stats = {
    total: items.length,
    ok: Object.values(responses).filter(r => r.status === 'ok').length,
    nok: Object.values(responses).filter(r => r.status === 'nok').length,
    pendente: items.length - Object.keys(responses).length + Object.values(responses).filter(r => r.status === 'pendente').length,
  };

  const itemsWithoutPhotos = items.filter(item => item.requer_foto && !responses[item.id]?.photo_url).length;
  const canSave = itemsWithoutPhotos === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <SecurityWatermark 
        checklistId={checklist.id} 
        checklistName={checklist.nome}
      />
      
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{checklist.nome}</h1>
              <div className="flex gap-2 mt-1 flex-wrap items-center">
                <Badge>{checklist.area}</Badge>
                <Badge variant="outline">{checklist.turno}</Badge>
                {/* Auto-save indicator */}
                {autoSaving && (
                  <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary">
                    <Cloud className="h-3 w-3 mr-1" />
                    Salvando...
                  </Badge>
                )}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving || inspecting || !canSave}>
              {inspecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Finalizar
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-2xl font-bold">{stats.ok}</p>
                  <p className="text-xs text-muted-foreground">OK</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{stats.nok}</p>
                  <p className="text-xs text-muted-foreground">NOK</p>
                </div>
              </CardContent>
            </Card>
            {items.some(item => item.requer_foto) ? (
              <Card>
                <CardContent className="pt-4 flex items-center gap-2">
                  <Camera className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{itemsWithoutPhotos}</p>
                    <p className="text-xs text-muted-foreground">Sem Foto</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.pendente}</p>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Barra de progresso */}
          {stats.total > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{stats.ok + stats.nok} de {stats.total} itens respondidos</span>
                <span className="font-semibold">{Math.round(((stats.ok + stats.nok) / stats.total) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${((stats.ok + stats.nok) / stats.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {itemsWithoutPhotos > 0 && (stats.ok + stats.nok) > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Checklist não realizado</AlertTitle>
              <AlertDescription>
                Há {itemsWithoutPhotos} {itemsWithoutPhotos === 1 ? 'item com envio' : 'itens com envios'} de foto pendente. 
                Confira novamente e envie todas as fotos obrigatórias para finalizar a tarefa.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Alert className="mb-6 border-primary bg-primary/5">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">Instruções Importantes</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="font-medium">
              Por favor, leia atentamente antes de iniciar:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Execute cada item do checklist com atenção e cuidado.</li>
              <li>Adicione fotos de evidência nos itens que exigem.</li>
              <li>Tire fotos claras que mostrem claramente o item verificado.</li>
              <li>Adicione observações quando necessário para complementar a informação.</li>
              <li className="text-primary font-medium">Seu progresso é salvo automaticamente após cada ação.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {items.map((item) => {
            const response = responses[item.id];
            const status = response?.status || 'pendente';

            return (
              <Card key={item.id} className={`transition-all duration-300 ${
                  status === 'ok' ? 'border-l-4 border-l-success bg-success/5' :
                  status === 'nok' ? 'border-l-4 border-l-destructive bg-destructive/5' : ''
                }`}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="shrink-0">
                      {item.ordem}
                    </Badge>
                    <CardTitle className="text-base flex-1">{item.nome}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={status === 'ok' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(item.id, 'ok')}
                      className={`h-14 text-base font-semibold transition-all duration-200 ${
                        status === 'ok'
                          ? 'bg-success hover:bg-success/90 text-white shadow-md shadow-success/20'
                          : 'hover:bg-success/10 hover:text-success hover:border-success/50'
                      }`}
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      OK
                    </Button>
                    <Button
                      variant={status === 'nok' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(item.id, 'nok')}
                      className={`h-14 text-base font-semibold transition-all duration-200 ${
                        status === 'nok'
                          ? 'bg-destructive hover:bg-destructive/90 text-white shadow-md shadow-destructive/20'
                          : 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50'
                      }`}
                    >
                      <XCircle className="h-5 w-5 mr-2" />
                      NOK
                    </Button>
                  </div>

                  {item.requer_observacao && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        Observações
                        {item.observacao_obrigatoria && <span className="text-destructive">*</span>}
                      </label>
                      <Textarea
                        placeholder={
                          item.observacao_obrigatoria 
                            ? "Campo obrigatório - adicione observações..." 
                            : "Adicione observações (opcional)..."
                        }
                        value={response?.observacoes || ''}
                        onChange={(e) => handleObservacaoChange(item.id, e.target.value)}
                        className="min-h-[80px]"
                        maxLength={2000}
                        required={item.observacao_obrigatoria}
                      />
                    </div>
                  )}

                  {item.requer_foto && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        Foto de Evidência <span className="text-destructive">*</span>
                      </Label>
                      {signedPhotoUrls[item.id] ? (
                        <div className="relative">
                          <img 
                            src={signedPhotoUrls[item.id]} 
                            alt="Evidência" 
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={() => handleRemovePhoto(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CameraCapture
                            open={cameraOpenFor === item.id}
                            onClose={() => setCameraOpenFor(null)}
                            onCapture={(file) => {
                              saveProgressToSession();
                              handlePhotoUpload(item.id, file);
                            }}
                            disabled={uploadingPhoto === item.id}
                          />
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setCameraOpenFor(item.id)}
                            disabled={uploadingPhoto === item.id}
                          >
                            {uploadingPhoto === item.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Camera className="h-4 w-4 mr-2" />
                                Tirar Foto
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button onClick={handleSave} disabled={saving || !canSave} size="lg">
            <Save className="h-5 w-5 mr-2" />
            {saving ? "Salvando..." : canSave ? "Salvar Checklist" : `Faltam ${itemsWithoutPhotos} ${itemsWithoutPhotos === 1 ? 'foto' : 'fotos'}`}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Checklist;
