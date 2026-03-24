import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Mail, Phone } from "lucide-react";

type AuthMethod = 'email' | 'phone';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<'email' | 'phone'>('email');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Format phone number for display
  const formatPhoneDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  // Check for invite parameter and validate it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    
    if (invite) {
      console.log("🎫 [AUTH] Convite detectado:", invite);
      setInviteId(invite);
      setIsLogin(false); // Force signup mode
      
      // Validate invite and pre-fill email or phone
      supabase
        .from("email_invites")
        .select("email, used, expires_at, store_id, role, invite_type, whatsapp_number")
        .eq("id", invite)
        .maybeSingle()
        .then(async ({ data, error }) => {
          console.log("🔍 [AUTH] Validação de convite:", { data, error });
          
          if (error) {
            console.error("❌ [AUTH] Erro ao buscar convite:", error);
            toast({
              title: "Erro ao validar convite",
              description: "Não foi possível validar o convite. Tente novamente.",
              variant: "destructive",
            });
            setInviteId(null);
            return;
          }
          
          if (!data) {
            console.error("❌ [AUTH] Convite não encontrado");
            toast({
              title: "Convite não encontrado",
              description: "Este link de convite não existe ou foi removido.",
              variant: "destructive",
            });
            setInviteId(null);
            return;
          }
          
          // Verificar se já foi usado
          if (data.used) {
            toast({
              title: "Convite já utilizado",
              description: "Este convite já foi usado. Por favor, faça login com sua conta.",
              variant: "destructive",
            });
            setInviteId(null);
            setIsLogin(true);
            if (data.invite_type === 'phone' && data.whatsapp_number) {
              setAuthMethod('phone');
              setPhone(data.whatsapp_number);
            } else if (data.email) {
              setEmail(data.email);
            }
            return;
          }
          
          // Verificar se expirou
          if (data.expires_at && new Date(data.expires_at) < new Date()) {
            toast({
              title: "Convite expirado",
              description: "Este convite expirou. Solicite um novo convite ao administrador.",
              variant: "destructive",
            });
            setInviteId(null);
            return;
          }
          
          // Definir tipo de convite e método de autenticação
          const isPhoneInvite = data.invite_type === 'phone';
          setInviteType(isPhoneInvite ? 'phone' : 'email');
          setAuthMethod(isPhoneInvite ? 'phone' : 'email');
          
          if (isPhoneInvite && data.whatsapp_number) {
            // Convite de telefone - pré-preencher telefone
            setPhone(data.whatsapp_number);
            console.log("✅ [AUTH] Convite de telefone válido para:", data.whatsapp_number);
            toast({
              title: "✅ Convite válido!",
              description: `Crie sua conta usando o telefone: ${formatPhoneDisplay(data.whatsapp_number)}`,
            });
          } else if (data.email) {
            // VALIDAÇÃO: Verificar se o email já possui uma conta
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("email", data.email)
              .maybeSingle();

            if (existingProfile) {
              toast({
                title: "⚠️ Conta já existe",
                description: `O email ${data.email} já possui uma conta. Por favor, faça login.`,
                variant: "default",
              });
              setInviteId(null);
              setIsLogin(true);
              setEmail(data.email);
              return;
            }
            
            // Convite válido - pré-preencher email
            setEmail(data.email);
            console.log("✅ [AUTH] Convite de email válido para:", data.email);
            toast({
              title: "✅ Convite válido!",
              description: `Crie sua conta usando o email: ${data.email}`,
            });
          }
        });
    }
  }, [toast]);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔍 [AUTH] Verificando sessão existente:", session?.user?.id);
      if (session) {
        console.log("➡️ [AUTH] Sessão encontrada, redirecionando para dashboard");
        navigate("/");
      }
    });
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      
      setTimeout(() => {
        setIsForgotPassword(false);
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Converte telefone para email virtual para autenticação
  const phoneToVirtualEmail = (phoneNumber: string): string => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@phone.grupobenditopb.internal`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Limpar localStorage completamente antes de fazer login
        console.log("🧹 [AUTH] Limpando localStorage antes do login");
        localStorage.clear();
        
        let loginEmail = email;

        if (authMethod === 'phone') {
          // Login com telefone - converter para email virtual
          loginEmail = phoneToVirtualEmail(phone);
          console.log("📱 [AUTH] Tentando login com telefone (email virtual):", loginEmail);
        } else {
          console.log("📧 [AUTH] Tentando login com email:", loginEmail);
        }

        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) throw error;

        // Verificar status da loja após login
        if (authData.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('store_id, stores!inner(status)')
            .eq('id', authData.user.id)
            .single();

          if (profileData?.stores?.status === 'inactive') {
            await supabase.auth.signOut();
            toast({
              title: "Acesso Negado",
              description: "Este estabelecimento está temporariamente inativo. Entre em contato com o administrador.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }

        console.log("✅ [AUTH] Login bem-sucedido, redirecionando...");
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta.",
        });
        navigate("/");
      } else {
        // Cadastro
        if (!nome) {
          toast({
            title: "Erro",
            description: "Por favor, preencha todos os campos.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        let signupEmail = email;
        const cleanPhone = phone.replace(/\D/g, '');

        if (authMethod === 'phone') {
          // Cadastro com telefone - usar email virtual
          signupEmail = phoneToVirtualEmail(phone);
          console.log("📱 [AUTH] Tentando cadastro com telefone (email virtual):", signupEmail);
        } else {
          console.log("📧 [AUTH] Tentando cadastro com email:", signupEmail);
        }

        const { error } = await supabase.auth.signUp({
          email: signupEmail,
          password,
          options: {
            data: {
              nome,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast({
          title: "Cadastro realizado!",
          description: "Sua conta foi criada com sucesso.",
        });
        navigate("/");
      }
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.message.includes("Email não autorizado") || error.message.includes("Não autorizado")) {
        errorMessage = "Não autorizado. Entre em contato com o administrador para solicitar um convite.";
      } else if (error.message.includes("Invalid login credentials")) {
        errorMessage = authMethod === 'phone' 
          ? "Telefone ou senha incorretos."
          : "Email ou senha incorretos.";
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold">
            {isForgotPassword 
              ? "Recuperar Senha" 
              : isLogin 
                ? "Bem-vindo" 
                : "Criar Conta"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Digite seu email para receber o link de recuperação"
              : isLogin
                ? "Entre com suas credenciais para acessar"
                : "Preencha os dados para criar sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-primary hover:underline"
                >
                  ← Voltar para login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Toggle Email/Telefone */}
              {!inviteId && (
                <div className="flex justify-center gap-2 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('email')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      authMethod === 'email'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('phone')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      authMethod === 'phone'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                    Telefone
                  </button>
                </div>
              )}

              {/* Mostrar indicador de tipo de convite */}
              {inviteId && (
                <div className={`flex items-center justify-center gap-2 p-2 rounded-lg ${
                  inviteType === 'phone' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'
                }`}>
                  {inviteType === 'phone' ? (
                    <>
                      <Phone className="h-4 w-4" />
                      <span className="text-sm font-medium">Cadastro via Telefone</span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      <span className="text-sm font-medium">Cadastro via Email</span>
                    </>
                  )}
                </div>
              )}

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="Digite seu nome"
                  />
                </div>
              )}

              {authMethod === 'email' ? (
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                    disabled={!!inviteId && inviteType === 'email'}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formatPhoneDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="+55 48 99999-9999"
                    disabled={!!inviteId && inviteType === 'phone'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (ex: 5548999999999)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>

              {isLogin && authMethod === 'email' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar Conta"}
              </Button>

              {!inviteId && (
                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-primary hover:underline"
                  >
                    {isLogin
                      ? "Não tem uma conta? Cadastre-se"
                      : "Já tem uma conta? Entre"}
                  </button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;