import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const storeSchema = z.object({
  nome: z.string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .trim(),
  adminEmail: z.string()
    .email("Email inválido")
    .toLowerCase()
    .trim(),
  cloneChecklists: z.boolean().default(false),
  sourceStoreId: z.string().optional(),
  organizationType: z.enum(["own", "third-party"]).default("own"),
  thirdPartyOrgName: z.string().optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
  cnpj: z.string().optional(),
  email_contato: z.string().email("Email inválido").optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).default('active'),
}).superRefine((data, ctx) => {
  // Validação: sourceStoreId obrigatório quando cloneChecklists = true
  if (data.cloneChecklists && !data.sourceStoreId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecione a loja de origem para clonar os checklists",
      path: ["sourceStoreId"],
    });
  }
  
  // Validação condicional: thirdPartyOrgName obrigatório quando tipo = "third-party" E cloneChecklists = true
  if (data.organizationType === "third-party" && data.cloneChecklists) {
    if (!data.thirdPartyOrgName || data.thirdPartyOrgName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nome da organização é obrigatório para clonar checklists de terceiros",
        path: ["thirdPartyOrgName"],
      });
    }
  }
});

type StoreFormData = z.infer<typeof storeSchema>;

interface StoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentStoreId: string;
  mode?: "create" | "edit";
  storeData?: {
    id: string;
    nome: string;
    endereco?: string;
    telefone?: string;
    cnpj?: string;
    email_contato?: string;
    status?: 'active' | 'inactive';
  };
}

export function StoreDialog({
  open,
  onOpenChange,
  onSuccess,
  currentStoreId,
  mode = "create",
  storeData,
}: StoreDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableStores, setAvailableStores] = useState<Array<{
    id: string;
    nome: string;
    total_checklists: number;
    total_items: number;
  }>>([]);

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      nome: storeData?.nome || "",
      adminEmail: "",
      cloneChecklists: false,
      sourceStoreId: "",
      organizationType: "own",
      thirdPartyOrgName: "",
      endereco: storeData?.endereco || "",
      telefone: storeData?.telefone || "",
      cnpj: storeData?.cnpj || "",
      email_contato: storeData?.email_contato || "",
      status: storeData?.status || "active",
    },
  });

  const watchOrganizationType = form.watch("organizationType");
  const watchCloneChecklists = form.watch("cloneChecklists");

  // Carregar lojas disponíveis do super_admin
  useEffect(() => {
    async function loadUserStores() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar organização do super_admin
        const { data: userOrg } = await supabase
          .from("organizations")
          .select("id")
          .eq("owner_id", user.id)
          .single();
        
        if (!userOrg) return;

        // Buscar lojas da organização
        const { data: stores } = await supabase
          .from("stores")
          .select("id, nome")
          .eq("organization_id", userOrg.id)
          .order("nome");
        
        if (!stores) return;

        // Para cada loja, contar checklists e itens
        const storesWithCounts = await Promise.all(
          stores.map(async (store) => {
            const { count: checklistsCount } = await supabase
              .from("checklist_types")
              .select("*", { count: "exact", head: true })
              .eq("store_id", store.id);

            const { count: itemsCount } = await supabase
              .from("checklist_items")
              .select("*", { count: "exact", head: true })
              .eq("store_id", store.id);

            return {
              id: store.id,
              nome: store.nome,
              total_checklists: checklistsCount || 0,
              total_items: itemsCount || 0,
            };
          })
        );

        setAvailableStores(storesWithCounts);
      } catch (error) {
        console.error("Erro ao carregar lojas:", error);
      }
    }

    if (open && mode === "create") {
      loadUserStores();
    }
  }, [open, mode]);

  const onSubmit = async (data: StoreFormData) => {
    setIsSubmitting(true);
    try {
      if (mode === "edit") {
        // Validação: verificar se nome já existe (exceto o atual)
        const { data: existingStore } = await supabase
          .from("stores")
          .select("id")
          .eq("nome", data.nome)
          .neq("id", storeData!.id)
          .maybeSingle();

        if (existingStore) {
          toast({
            title: "❌ Nome duplicado",
            description: "Já existe um estabelecimento com este nome. Escolha outro nome.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Editar loja existente
        const { error: updateError } = await supabase
          .from("stores")
          .update({ 
            nome: data.nome,
            endereco: data.endereco || null,
            telefone: data.telefone || null,
            cnpj: data.cnpj || null,
            email_contato: data.email_contato || null,
            status: data.status,
          })
          .eq("id", storeData!.id);

        if (updateError) throw updateError;

        toast({
          title: "✅ Estabelecimento atualizado",
          description: `${data.nome} foi atualizado com sucesso.`,
        });
      } else {
        // 1️⃣ DETERMINAR OU CRIAR ORGANIZAÇÃO
        let targetOrganizationId: string;

        if (data.organizationType === "third-party") {
          // Para terceiros: SEMPRE criar nova organização
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");

          const { data: newOrg, error: orgError } = await supabase
            .from("organizations")
            .insert({
              nome: data.thirdPartyOrgName || data.nome + " - Organização",
              owner_id: user.id, // Temporário: super_admin é owner até admin aceitar convite
            })
            .select()
            .single();

          if (orgError) throw orgError;
          targetOrganizationId = newOrg.id;

        } else {
          // Para próprias lojas: usar organização existente do super_admin
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");

          const { data: userOrg } = await supabase
            .from("organizations")
            .select("id")
            .eq("owner_id", user.id)
            .single();

          if (!userOrg) throw new Error("Super_admin sem organização");
          targetOrganizationId = userOrg.id;
        }

        // 2️⃣ CRIAR LOJA ASSOCIADA À ORGANIZAÇÃO
        const { data: newStore, error: storeError } = await supabase
          .from("stores")
          .insert({ 
            nome: data.nome,
            organization_id: targetOrganizationId, // ✅ AGORA TEM ORGANIZAÇÃO
            endereco: data.endereco || null,
            telefone: data.telefone || null,
            cnpj: data.cnpj || null,
            email_contato: data.email_contato || null,
            status: data.status,
          })
          .select()
          .single();

        if (storeError) {
          // Tratamento específico de erros do Postgres
          if (storeError.code === "23505") {
            // Unique violation
            if (storeError.message.includes("stores_nome_organization_key")) {
              toast({
                title: "❌ Nome duplicado",
                description: `Já existe um estabelecimento chamado "${data.nome}" nesta organização.`,
                variant: "destructive",
              });
              setIsSubmitting(false);
              return;
            }
          }
          throw storeError;
        }

        // Criar configurações de notificação padrão para a nova loja
        const { error: settingsError } = await supabase
          .from("admin_settings")
          .insert({
            store_id: newStore.id,
            notification_email: data.adminEmail,
            notification_time_manha: "12:00:00", // 09:00 BRT = 12:00 UTC
            notification_time_tarde: "17:00:00", // 14:00 BRT = 17:00 UTC
            notification_time_noite: "01:00:00", // 22:00 BRT = 01:00 UTC (próximo dia)
          });

        if (settingsError) {
          console.error("Erro ao criar configurações padrão:", settingsError);
          // Não bloquear criação da loja, apenas avisar no console
        }

        // 3️⃣ CLONAR CHECKLISTS (se marcado)
        if (data.cloneChecklists) {
          const { data: cloneResult, error: cloneError } = await supabase
            .rpc("clone_checklists_to_store", {
              source_store_id: data.sourceStoreId!,
              target_store_id: newStore.id,
              create_new_organization: false, // ✅ Organização já foi criada
              new_org_name: null,
              new_org_owner_id: null,
            });

          if (cloneError) {
            console.error("Erro ao clonar checklists:", cloneError);
            toast({
              title: "⚠️ Loja criada com aviso",
              description: `${data.nome} foi criada, mas houve erro ao clonar checklists: ${cloneError.message}`,
              variant: "destructive",
            });
          } else if (cloneResult && typeof cloneResult === 'object') {
            const result = cloneResult as { types_copied: number; items_copied: number };
            toast({
              title: "✅ Estabelecimento criado com checklists!",
              description: `${data.nome} foi criado e ${result.types_copied} checklists (${result.items_copied} itens) foram copiados.`,
            });
          } else {
            toast({
              title: "✅ Estabelecimento criado",
              description: `${data.nome} foi criado com sucesso.`,
            });
          }
        } else {
          toast({
            title: "✅ Estabelecimento criado",
            description: `${data.nome} foi criado com sucesso.`,
          });
        }

        // VALIDAÇÃO: Verificar se o email já possui uma conta
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", data.adminEmail)
          .maybeSingle();

        if (existingProfile) {
          toast({
            title: "❌ Email já cadastrado",
            description: `O email ${data.adminEmail} já possui uma conta no sistema. Não é possível enviar convite. A pessoa deve fazer login e ser adicionada à loja manualmente.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Criar convite para o admin
        const { data: invite, error: inviteError } = await supabase
          .from("email_invites")
          .insert({
            email: data.adminEmail,
            role: "admin",
            store_id: newStore.id,
          })
          .select()
          .single();

        if (inviteError) {
          // Tratamento específico para erro de email duplicado
          if (inviteError.code === "23505" && inviteError.message.includes("email_invites_email_store_key")) {
            toast({
              title: "⚠️ Email já convidado",
              description: `O email ${data.adminEmail} já possui um convite para esta loja. Cancele o convite anterior ou use outro email.`,
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
          throw inviteError;
        }

        // 📧 ENVIAR EMAIL DE CONVITE AUTOMATICAMENTE
        console.log("📧 Enviando email de convite para admin:", data.adminEmail);
        const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
          body: {
            invite_id: invite.id,
            email: invite.email,
            role: invite.role,
            store_id: invite.store_id,
          }
        });

        if (emailError) {
          console.error('⚠️ Erro ao enviar email:', emailError);
          toast({
            title: "⚠️ Loja criada mas email não enviado",
            description: "A loja foi criada com sucesso, mas houve um erro ao enviar o email de convite. Use o botão 'Enviar Email' na aba Convites.",
            variant: "destructive",
          });
        } else {
          console.log("✅ Email de convite enviado com sucesso");
          toast({
            title: "✅ Estabelecimento criado e convite enviado",
            description: `${data.nome} foi criado e o email foi enviado para ${data.adminEmail}`,
          });
        }
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error("Erro ao processar estabelecimento:", error);
      
      // Tratamento específico de erros do Postgres
      let errorMessage = "Erro ao processar estabelecimento";
      
      if (error?.code === "23505") {
        // Unique constraint violation
        if (error.message.includes("stores_nome_organization_key")) {
          errorMessage = `Já existe um estabelecimento com o nome "${data.nome}" nesta organização.`;
        } else if (error.message.includes("email_invites_email_store_key")) {
          errorMessage = `O email ${data.adminEmail} já possui um convite para esta loja.`;
        } else {
          errorMessage = "Já existe um registro com estas informações.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "❌ Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar Estabelecimento" : "Novo Estabelecimento"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Altere as informações do estabelecimento."
              : "Preencha os dados para criar um novo estabelecimento."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Estabelecimento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Loja Centro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "create" && (
              <>
                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do Administrador</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@exemplo.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Um convite será enviado para este email
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="organizationType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de Organização</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="own" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Minha organização (você verá os dados)
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="third-party" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Terceiro (dados isolados)
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchOrganizationType === "third-party" && (
                  <>
                    <FormField
                      control={form.control}
                      name="thirdPartyOrgName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Nome da Organização
                            {watchCloneChecklists && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Empresa XYZ" {...field} />
                          </FormControl>
                          {watchCloneChecklists && (
                            <FormDescription className="text-xs">
                              Obrigatório para clonar checklists
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Ao criar loja para terceiro, você NÃO verá as respostas
                        dos checklists deles, apenas a estrutura das lojas.
                      </AlertDescription>
                    </Alert>
                  </>
                )}

                <FormField
                  control={form.control}
                  name="cloneChecklists"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Clonar checklists como template</FormLabel>
                        <FormDescription>
                          Copiar checklists de uma das suas lojas para o novo estabelecimento
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {watchCloneChecklists && (
                  <FormField
                    control={form.control}
                    name="sourceStoreId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loja de Origem (Template)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha qual loja clonar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableStores.map((store) => (
                              <SelectItem key={store.id} value={store.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{store.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {store.total_checklists} checklists • {store.total_items} itens
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Selecione de qual loja você quer copiar os checklists
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Novos campos adicionais */}
                <FormField
                  control={form.control}
                  name="endereco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro, cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 98765-4321" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email_contato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de Contato (opcional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contato@loja.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Email geral da loja para contato
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {mode !== "create" && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status do Estabelecimento</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="active" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Ativo (usuários podem fazer login)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="inactive" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Inativo (bloqueia acesso dos usuários)
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchCloneChecklists && watchOrganizationType === "third-party" && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Os checklists serão copiados como templates. O terceiro
                      poderá editá-los livremente na sua organização.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Atualizar" : "Criar Estabelecimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
