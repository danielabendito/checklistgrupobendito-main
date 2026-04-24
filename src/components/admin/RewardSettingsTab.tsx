import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Gift, Camera, Save, Trash2, CheckCircle2 } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

interface RewardConfig {
  id?: string;
  store_id: string;
  type: 'streak_5' | 'total_15' | 'total_25';
  title: string;
  message: string;
  photo_url: string | null;
  is_active: boolean;
}

export const RewardSettingsTab = () => {
  const { currentStore } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, RewardConfig>>({
    streak_5: { store_id: currentStore?.id || '', type: 'streak_5', title: '', message: '', photo_url: null, is_active: false },
    total_15: { store_id: currentStore?.id || '', type: 'total_15', title: '', message: '', photo_url: null, is_active: false },
    total_25: { store_id: currentStore?.id || '', type: 'total_25', title: '', message: '', photo_url: null, is_active: false },
  });

  useEffect(() => {
    if (currentStore) {
      loadConfigs();
    }
  }, [currentStore]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_settings' as any)
        .select('*')
        .eq('store_id', currentStore?.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const newConfigs = { ...configs };
        data.forEach((item: any) => {
          newConfigs[item.type] = item;
        });
        setConfigs(newConfigs);
      }
    } catch (error: any) {
      console.error('Erro ao carregar prêmios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (type: string) => {
    try {
      setSaving(type);
      const config = configs[type];
      
      const { error } = await supabase
        .from('reward_settings' as any)
        .upsert({
          ...config,
          store_id: currentStore?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'store_id,type' } as any);

      if (error) throw error;

      toast({
        title: "Prêmio salvo!",
        description: `As configurações para ${type.replace('_', ' ')} foram atualizadas.`,
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

  const handlePhotoUpload = async (type: string, file: File) => {
    try {
      setSaving(`${type}_photo`);
      
      // Criar bucket se não existir (apenas para garantir, embora deva ser feito no SQL)
      const fileName = `${currentStore?.id}/${type}_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('rewards')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rewards')
        .getPublicUrl(fileName);

      setConfigs(prev => ({
        ...prev,
        [type]: { ...prev[type], photo_url: publicUrl }
      }));

      toast({
        title: "Foto enviada!",
        description: "A imagem do prêmio foi carregada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rewardSections = [
    { type: 'streak_5', label: 'Meta Bronze: 5 Dias Seguidos', icon: '🥉' },
    { type: 'total_15', label: 'Meta Prata: 15 Dias no Mês', icon: '🥈' },
    { type: 'total_25', label: 'Meta Ouro: 25 Dias no Mês', icon: '🥇' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-2">
        <Gift className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Campanhas de Recompensas Surpresa</h2>
      </div>
      <p className="text-muted-foreground -mt-4 mb-6">
        Configure prêmios que serão revelados automaticamente quando os colaboradores atingirem as metas. 
        As metas são individuais e começam a contar a partir de 24/04/2026.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rewardSections.map((section) => (
          <Card key={section.type} className="border-2 hover:border-primary/20 transition-colors shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <span className="text-3xl">{section.icon}</span>
                <div className={`h-3 w-3 rounded-full ${configs[section.type].is_active ? 'bg-success animate-pulse' : 'bg-slate-300'}`} />
              </div>
              <CardTitle className="text-lg mt-2">{section.label}</CardTitle>
              <CardDescription>Prêmio por fidelidade e disciplina.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Prêmio</Label>
                <Input 
                  placeholder="Ex: Café Especial e Pão na Chapa" 
                  value={configs[section.type].title}
                  onChange={(e) => setConfigs(prev => ({ ...prev, [section.type]: { ...prev[section.type], title: e.target.value } }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem Personalizada</Label>
                <Textarea 
                  placeholder="Ex: Parabéns! Sua dedicação é o que faz o Bendito ser incrível!" 
                  className="min-h-[100px] resize-none"
                  value={configs[section.type].message}
                  onChange={(e) => setConfigs(prev => ({ ...prev, [section.type]: { ...prev[section.type], message: e.target.value } }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Foto do Prêmio</Label>
                {configs[section.type].photo_url ? (
                  <div className="relative rounded-lg overflow-hidden border group">
                    <img src={configs[section.type].photo_url!} alt="Prêmio" className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                       <Button size="sm" variant="destructive" onClick={() => setConfigs(prev => ({ ...prev, [section.type]: { ...prev[section.type], photo_url: null } }))}>
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-slate-50 transition-colors">
                    <Camera className="h-8 w-8 text-slate-400 mb-2" />
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id={`photo-${section.type}`} 
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(section.type, e.target.files[0])}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={saving === `${section.type}_photo`}
                      onClick={() => document.getElementById(`photo-${section.type}`)?.click()}
                    >
                      {saving === `${section.type}_photo` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selecionar Foto"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  className="h-4 w-4 rounded border-slate-300"
                  checked={configs[section.type].is_active}
                  onChange={(e) => setConfigs(prev => ({ ...prev, [section.type]: { ...prev[section.type], is_active: e.target.checked } }))}
                />
                <Label className="text-sm cursor-pointer">Ativar esta recompensa</Label>
              </div>

              <Button 
                className="w-full mt-4" 
                onClick={() => handleSave(section.type)}
                disabled={saving === section.type}
              >
                {saving === section.type ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configuração
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
