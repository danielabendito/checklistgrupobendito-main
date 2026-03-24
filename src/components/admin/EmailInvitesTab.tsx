import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Mail, CheckCircle, XCircle, Send, AlertTriangle, Copy, MessageSquare, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
import { useStore } from "@/contexts/StoreContext";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

type UserRole = Database["public"]["Enums"]["user_role"];
type InviteType = 'email' | 'phone';

interface EmailInvite {
  id: string;
  email: string | null;
  role: UserRole;
  used: boolean;
  created_at: string;
  resend_count: number;
  last_sent_at: string | null;
  expires_at: string;
  isExpired?: boolean;
  whatsapp_number?: string | null;
  whatsapp_sent_at?: string | null;
  invite_type?: InviteType;
  invitee_name?: string | null;
}

const BASE_ROLES: UserRole[] = [
  "garcom",
  "garconete",
  "atendente",
  "lider",
  "cozinheiro",
  "cozinheiro_lider",
  "auxiliar_cozinha",
  "barman",
  "lider_bar",
  "admin",
];

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  garcom: "Garçom",
  garconete: "Garçonete",
  atendente: "Atendente",
  lider: "Líder",
  cozinheiro: "Cozinheiro",
  cozinheiro_lider: "Cozinheiro Líder",
  auxiliar_cozinha: "Auxiliar de Cozinha",
  barman: "Barman",
  lider_bar: "Líder de Bar",
  admin: "Administrador",
  super_admin: "Super Admin",
};

// Validation schema for email invites
const emailInviteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "Email é obrigatório")
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  role: z.string().min(1, "Função é obrigatória"),
});

// Validation schema for phone invites
const phoneInviteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  phone: z
    .string()
    .trim()
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .max(15, "Telefone deve ter no máximo 15 dígitos"),
  role: z.string().min(1, "Função é obrigatória"),
});

// Função para formatar número de WhatsApp
const formatWhatsAppNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
};

export function EmailInvitesTab() {
  const { currentStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collaboratorInvites, setCollaboratorInvites] = useState<EmailInvite[]>([]);
  const [adminInvites, setAdminInvites] = useState<(EmailInvite & { store_name?: string })[]>([]);
  const [inviteType, setInviteType] = useState<InviteType>('email');
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<UserRole | "">("");
  const [newWhatsApp, setNewWhatsApp] = useState("");
  const [resending, setResending] = useState<string | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const [forceInvite, setForceInvite] = useState(false);
  const [showForceWarning, setShowForceWarning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'used' | 'expired'>('all');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Calcular roles disponíveis dinamicamente
  const availableRoles = useMemo(() => {
    if (isSuperAdmin) {
      return [...BASE_ROLES, "super_admin" as UserRole];
    }
    return BASE_ROLES;
  }, [isSuperAdmin]);

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    loadInvites();
  }, [currentStore, isSuperAdmin]);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setIsSuperAdmin(roleData?.role === 'super_admin');
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const loadInvites = async () => {
    try {
      setLoading(true);
      
      // Buscar convites de COLABORADORES apenas se houver loja selecionada
      if (currentStore) {
        const { data: collabData, error: collabError } = await supabase
          .from("email_invites")
          .select("*")
          .eq("store_id", currentStore.id)
          .neq("role", "admin")
          .order("created_at", { ascending: false });

        if (collabError) throw collabError;
        
        const now = new Date();
        const collabInvitesWithExpiry = (collabData || []).map(invite => ({
          ...invite,
          invite_type: (invite.invite_type as InviteType) || 'email',
          isExpired: invite.expires_at && new Date(invite.expires_at) < now && !invite.used
        }));
        
        setCollaboratorInvites(collabInvitesWithExpiry as EmailInvite[]);
      } else {
        setCollaboratorInvites([]);
      }

      // Se for super_admin, buscar convites de ADMINISTRADORES de TODAS as lojas
      if (isSuperAdmin) {
        const { data: adminData, error: adminError } = await supabase
          .from("email_invites")
          .select(`
            *,
            stores (
              nome
            )
          `)
          .eq("role", "admin")
          .order("created_at", { ascending: false });

        if (adminError) throw adminError;
        
        const now = new Date();
        const adminInvitesWithExpiry = (adminData || []).map(invite => ({
          ...invite,
          invite_type: (invite.invite_type as InviteType) || 'email',
          store_name: invite.stores?.nome,
          isExpired: invite.expires_at && new Date(invite.expires_at) < now && !invite.used
        }));
        
        setAdminInvites(adminInvitesWithExpiry as (EmailInvite & { store_name?: string })[]);
      } else {
        setAdminInvites([]);
      }
    } catch (error: any) {
      console.error("Error loading invites:", error);
      toast({
        title: "Erro ao carregar convites",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddInvite = async () => {
    if (!currentStore) {
      toast({
        title: "Erro",
        description: "Nenhuma loja selecionada",
        variant: "destructive",
      });
      return;
    }

    // Validate input based on invite type
    if (inviteType === 'email') {
      const validation = emailInviteSchema.safeParse({ 
        name: newName,
        email: newEmail, 
        role: newRole 
      });

      if (!validation.success) {
        const error = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    } else {
      const cleanPhone = newPhone.replace(/\D/g, '');
      const validation = phoneInviteSchema.safeParse({ 
        name: newName,
        phone: cleanPhone, 
        role: newRole 
      });

      if (!validation.success) {
        const error = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const cleanPhone = newPhone.replace(/\D/g, '');
      const normalizedEmail = inviteType === 'email' ? newEmail.toLowerCase() : null;
      const cleanWhatsApp = inviteType === 'email' ? newWhatsApp.replace(/\D/g, '') : cleanPhone;

      // VALIDAÇÃO: Para convites de email, verificar se já possui uma conta
      if (inviteType === 'email' && normalizedEmail) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, email, store_id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (existingProfile && !forceInvite) {
          setShowForceWarning(true);
          toast({
            title: "⚠️ Email já cadastrado",
            description: `Este email já está em uso. Marque a opção "Forçar convite" para mover o usuário para esta loja.`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        // Se é um convite forçado para email existente, mover o usuário imediatamente
        if (existingProfile && forceInvite) {
          // Atualizar store_id no profiles
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ store_id: currentStore.id })
            .eq("id", existingProfile.id);

          if (profileError) throw profileError;

          // Atualizar role no user_roles
          const { error: roleError } = await supabase
            .from("user_roles")
            .update({ role: newRole as UserRole })
            .eq("user_id", existingProfile.id);

          if (roleError) throw roleError;

          // Criar convite marcado como usado
          const { error: inviteError } = await supabase
            .from("email_invites")
            .insert({ 
              email: normalizedEmail,
              role: newRole as UserRole,
              store_id: currentStore.id,
              invited_by: (await supabase.auth.getUser()).data.user?.id,
              whatsapp_number: cleanWhatsApp || null,
              invite_type: 'email',
              invitee_name: newName.trim() || null,
              used: true, 
              used_at: new Date().toISOString() 
            });

          if (inviteError && inviteError.code !== '23505') throw inviteError;

          toast({
            title: "✅ Usuário movido com sucesso",
            description: `${normalizedEmail} foi transferido para esta loja com a função ${newRole}`,
          });

          resetForm();
          loadInvites();
          return;
        }
      }

      // Para convites de telefone, verificar se já existe convite com mesmo número
      if (inviteType === 'phone') {
        const { data: existingInvite } = await supabase
          .from("email_invites")
          .select("id")
          .eq("whatsapp_number", cleanPhone)
          .eq("used", false)
          .maybeSingle();

        if (existingInvite) {
          toast({
            title: "⚠️ Convite já existe",
            description: `Já existe um convite pendente para este número de telefone.`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      // Criar convite normal
      const inviteData = {
        email: normalizedEmail,
        role: newRole as UserRole,
        store_id: currentStore.id,
        invited_by: (await supabase.auth.getUser()).data.user?.id,
        whatsapp_number: cleanWhatsApp || null,
        invite_type: inviteType,
        invitee_name: newName.trim() || null,
      };

      const { error } = await supabase
        .from("email_invites")
        .insert(inviteData);

      if (error) {
        if (error.code === '23505') {
          throw new Error(inviteType === 'email' 
            ? 'Este email já possui um convite' 
            : 'Este telefone já possui um convite');
        }
        throw error;
      }

      const identifier = inviteType === 'email' ? newEmail : formatWhatsAppNumber(cleanPhone);
      toast({
        title: "✅ Convite criado",
        description: `${identifier} pode agora se cadastrar como ${newRole}`,
      });

      resetForm();
      loadInvites();
    } catch (error: any) {
      toast({
        title: "Erro ao criar convite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewRole("");
    setNewWhatsApp("");
    setForceInvite(false);
    setShowForceWarning(false);
  };

  const handleResendInvite = async (invite: EmailInvite) => {
    try {
      setResending(invite.id);
      
      const neverSent = !invite.last_sent_at;
      
      // Atualizar contador e data de envio, renovar expiração
      const { error: updateError } = await supabase
        .from("email_invites")
        .update({ 
          resend_count: neverSent ? 0 : (invite.resend_count || 0) + 1,
          last_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Renovar por mais 7 dias
        })
        .eq("id", invite.id);
        
      if (updateError) throw updateError;
      
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          invite_id: invite.id,
          email: invite.email,
          role: invite.role,
          store_id: currentStore!.id,
        }
      });

      if (error) throw error;

      const totalSent = neverSent ? 1 : (invite.resend_count || 0) + 2;
      
      toast({
        title: neverSent ? "📧 Email enviado" : "✅ Email reenviado",
        description: `Email enviado para ${invite.email}${totalSent > 1 ? ` (${totalSent}ª vez)` : ''}`,
      });
      
      loadInvites();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(null);
    }
  };

  const handleSendWhatsApp = async (invite: EmailInvite) => {
    if (!invite.whatsapp_number) {
      toast({
        title: "WhatsApp não configurado",
        description: "Este convite não possui número de WhatsApp cadastrado",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingWhatsApp(invite.id);
      
      const { error } = await supabase.functions.invoke('send-invite-whatsapp', {
        body: {
          invite_id: invite.id,
          email: invite.email,
          role: invite.role,
          store_id: currentStore!.id,
          whatsapp_number: invite.whatsapp_number,
        }
      });

      if (error) throw error;

      // Atualizar data de envio do WhatsApp
      await supabase
        .from("email_invites")
        .update({ 
          whatsapp_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq("id", invite.id);
      
      toast({
        title: "📱 WhatsApp enviado",
        description: `Convite enviado via WhatsApp para ${invite.whatsapp_number}`,
      });
      
      loadInvites();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao enviar WhatsApp",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingWhatsApp(null);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("email_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;

      toast({
        title: "Convite removido",
        description: "O convite foi removido com sucesso",
      });

      loadInvites();
    } catch (error: any) {
      toast({
        title: "Erro ao remover convite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderInvitesList = (invites: any[], title: string, description: string, showStoreName: boolean = false) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button 
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            Todos ({invites.length})
          </Button>
          <Button 
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('pending')}
          >
            Pendentes ({invites.filter(i => !i.used && !i.isExpired).length})
          </Button>
          <Button 
            variant={filterStatus === 'used' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('used')}
          >
            Usados ({invites.filter(i => i.used).length})
          </Button>
          <Button 
            variant={filterStatus === 'expired' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('expired')}
          >
            Expirados ({invites.filter(i => i.isExpired).length})
          </Button>
        </div>
        
        {invites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum convite cadastrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invites
              .filter(invite => {
                if (filterStatus === 'all') return true;
                if (filterStatus === 'pending') return !invite.used && !invite.isExpired;
                if (filterStatus === 'used') return invite.used;
                if (filterStatus === 'expired') return invite.isExpired;
                return true;
              })
              .map((invite) => (
              <div
                key={invite.id}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  invite.isExpired ? 'bg-destructive/5 border-destructive' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {invite.used ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : invite.isExpired ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : !invite.last_sent_at ? (
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Mail className="h-5 w-5 text-blue-500" />
                  )}
                  <div>
                    {/* Nome do convidado em destaque */}
                    <p className="font-medium">
                      {invite.invitee_name || (invite.invite_type === 'phone' ? formatWhatsAppNumber(invite.whatsapp_number || '') : invite.email)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invite.invite_type === 'phone' 
                        ? `${formatWhatsAppNumber(invite.whatsapp_number || '')} • ${invite.role}` 
                        : `${invite.email} • ${invite.role}`}
                      {showStoreName && invite.store_name && ` • ${invite.store_name}`}
                    </p>
                    
                    {/* WhatsApp info */}
                    {invite.whatsapp_number && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {formatWhatsAppNumber(invite.whatsapp_number)}
                        {invite.whatsapp_sent_at && (
                          <span className="text-green-600">
                            • Enviado {format(new Date(invite.whatsapp_sent_at), "dd/MM", { locale: ptBR })}
                          </span>
                        )}
                      </p>
                    )}
                    
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 mt-1">
                      {invite.used ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          Utilizado
                        </span>
                      ) : invite.isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          <XCircle className="h-3 w-3" />
                          Expirado
                        </span>
                      ) : invite.invite_type === 'phone' ? (
                        // Convite por telefone/WhatsApp
                        invite.whatsapp_sent_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                            <Phone className="h-3 w-3" />
                            WhatsApp Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-3 w-3" />
                            WhatsApp Não Enviado
                          </span>
                        )
                      ) : (
                        // Convite por email
                        !invite.last_sent_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-3 w-3" />
                            Email Nunca Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Mail className="h-3 w-3" />
                            Aguardando Cadastro
                          </span>
                        )
                      )}
                    </div>
                    
                    {invite.last_sent_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Último envio email: {format(new Date(invite.last_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    {invite.resend_count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Reenviado {invite.resend_count}x
                      </p>
                    )}
                    {!invite.used && invite.expires_at && (
                      <p className={`text-xs ${invite.isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {invite.isExpired 
                          ? 'Expirado' 
                          : `Expira em ${format(new Date(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}`
                        }
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const inviteLink = `${window.location.origin}/auth?invite=${invite.id}`;
                      navigator.clipboard.writeText(inviteLink);
                      toast({
                        title: "📋 Link copiado",
                        description: "Link do convite copiado para área de transferência",
                      });
                    }}
                    title="Copiar link do convite"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  
                  {(!invite.used || invite.isExpired) && (
                    <>
                      <Button
                        variant={!invite.last_sent_at ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleResendInvite(invite)}
                        disabled={resending === invite.id}
                      >
                        {resending === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-1" />
                            {!invite.last_sent_at ? 'Email' : 'Reenviar'}
                          </>
                        )}
                      </Button>
                      
                      {invite.whatsapp_number && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendWhatsApp(invite)}
                          disabled={sendingWhatsApp === invite.id}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          {sendingWhatsApp === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              WhatsApp
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteInvite(invite.id)}
                    title={invite.used ? "Remover convite aceito" : "Remover convite"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Convidar Novo Colaborador</CardTitle>
          <CardDescription>
            Adicione colaboradores que poderão criar contas nesta loja
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* Toggle Email/Telefone */}
            <div className="flex justify-start gap-2 p-1 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setInviteType('email')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inviteType === 'email'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setInviteType('phone')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  inviteType === 'phone'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Phone className="h-4 w-4" />
                Telefone
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Campo Nome - comum para ambos os tipos */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="João Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              {inviteType === 'email' ? (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colaborador@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Função *</Label>
                    <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_DISPLAY_NAMES[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      placeholder="+55 48 99999-9999"
                      value={newWhatsApp}
                      onChange={(e) => setNewWhatsApp(formatWhatsAppNumber(e.target.value))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="phone">Telefone para Login *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+55 48 99999-9999"
                      value={formatWhatsAppNumber(newPhone)}
                      onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este número será usado para cadastro E login
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="role">Função *</Label>
                    <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_DISPLAY_NAMES[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            
            {showForceWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">⚠️ Este email já possui cadastro</p>
                    <p className="text-sm">
                      Ao forçar o convite, o usuário será <strong>movido da loja atual</strong> para esta loja quando aceitar o convite. 
                      Ele perderá acesso à loja anterior.
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox 
                        id="force" 
                        checked={forceInvite}
                        onCheckedChange={(checked) => setForceInvite(checked as boolean)}
                      />
                      <Label htmlFor="force" className="text-sm cursor-pointer">
                        Forçar convite e mover usuário para esta loja
                      </Label>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <Button onClick={handleAddInvite} disabled={saving} className="w-full md:w-auto">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Adicionar Convite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção de Convites de Colaboradores */}
      {renderInvitesList(
        collaboratorInvites,
        "Convites de Colaboradores",
        "Emails autorizados a criar contas nesta loja",
        false
      )}

      {/* Seção de Convites de Administradores (apenas para super_admin) */}
      {isSuperAdmin && renderInvitesList(
        adminInvites,
        "Convites de Administradores (Novos Estabelecimentos)",
        "Administradores convidados para gerenciar estabelecimentos",
        true
      )}
    </div>
  );
}
