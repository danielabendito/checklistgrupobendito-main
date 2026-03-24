import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Phone, AlertCircle, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function WhatsAppRecipientsCard() {
  const { currentStore } = useStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [originalRecipients, setOriginalRecipients] = useState("");

  useEffect(() => {
    if (currentStore) {
      loadRecipients();
    }
  }, [currentStore]);

  const loadRecipients = async () => {
    if (!currentStore) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('stores')
        .select('whatsapp_recipients')
        .eq('id', currentStore.id)
        .single();

      if (error) throw error;

      const recipientsStr = (data?.whatsapp_recipients || []).join('\n');
      setRecipients(recipientsStr);
      setOriginalRecipients(recipientsStr);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar destinatários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateRecipient = (recipient: string): boolean => {
    // Validação para número de telefone
    const isPhone = /^[0-9]{10,15}$/.test(recipient.replace(/\D/g, ''));
    // Validação para ID de grupo do WhatsApp (Z-API/WhatsApp)
    const isGroup = recipient.includes('@g.us');
    
    return isPhone || isGroup;
  };

  const handleSave = async () => {
    if (!currentStore) return;

    try {
      setSaving(true);

      const lines = recipients.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const invalidRecipients = lines.filter(l => !validateRecipient(l));

      if (invalidRecipients.length > 0) {
        toast({
          title: "Destinatários inválidos",
          description: `Os seguintes itens estão em formato inválido: ${invalidRecipients.slice(0, 3).join(', ')}${invalidRecipients.length > 3 ? '...' : ''}`,
          variant: "destructive",
        });
        return;
      }

      const processedRecipients = lines.map(l => {
        if (l.includes('@g.us')) return l; // Mantém ID de grupo intacto
        return l.replace(/\D/g, ''); // Limpa número de telefone
      });

      const { error } = await supabase
        .from('stores')
        .update({ whatsapp_recipients: processedRecipients })
        .eq('id', currentStore.id);

      if (error) throw error;

      setOriginalRecipients(recipients);

      toast({
        title: "Salvo",
        description: `${processedRecipients.length} destinatário(s) configurado(s)`,
      });

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

  const handleTest = async () => {
    if (!currentStore) return;

    const lines = originalRecipients.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length === 0) {
      toast({
        title: "Nenhum destinatário",
        description: "Salve pelo menos um número antes de testar",
        variant: "destructive",
      });
      return;
    }

    const rawRecipient = lines[0];
    const testRecipient = rawRecipient.includes('@g.us') ? rawRecipient : rawRecipient.replace(/\D/g, '');

    try {
      setTesting(true);

      const { data, error } = await supabase.functions.invoke('test-whatsapp-send', {
        body: {
          phone_number: testNumber,
          store_name: currentStore.nome,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Teste enviado!",
          description: `Mensagem enviada para ${testRecipient}`,
        });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }

    } catch (error: any) {
      toast({
        title: "Falha no teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const hasChanges = recipients !== originalRecipients;
  const recipientCount = recipients.split('\n').filter(l => l.trim().length > 0).length;
  const savedCount = originalRecipients.split('\n').filter(l => l.trim().length > 0).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          <CardTitle>Destinatários WhatsApp</CardTitle>
        </div>
        <CardDescription>
          Configure os números que receberão os relatórios do Inspetor Sanitário Virtual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Os relatórios de inspeção serão enviados automaticamente para estes números após cada checklist finalizado via Z-API.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="whatsapp-recipients">
            Números de WhatsApp (um por linha)
          </Label>
          <Textarea
            id="whatsapp-recipients"
            placeholder={"5548999999999\n5548988888888\n5511977777777"}
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            rows={5}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Formato: DDI + DDD + número sem espaços ou símbolos (ex: 5548999999999)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {recipientCount} destinatário{recipientCount !== 1 ? 's' : ''}
            </Badge>
            {hasChanges && (
              <Badge variant="secondary" className="text-primary">
                Alterações não salvas
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || savedCount === 0}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Testar Envio
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}