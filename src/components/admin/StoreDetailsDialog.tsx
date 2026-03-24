import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar, Phone, Mail, Building, MapPin, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface StoreDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: {
    id: string;
    nome: string;
    created_at: string;
    endereco: string | null;
    telefone: string | null;
    cnpj: string | null;
    email_contato: string | null;
    status: 'active' | 'inactive';
    user_count: number;
    checklist_count: number;
    response_count: number;
    ownership_status?: 'active' | 'pending' | 'no_admin';
    admin_email?: string;
  } | null;
}

export function StoreDetailsDialog({ open, onOpenChange, store }: StoreDetailsDialogProps) {
  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{store.nome}</DialogTitle>
            <Badge variant={store.status === 'active' ? 'default' : 'destructive'}>
              {store.status === 'active' ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status de Propriedade */}
          {store.ownership_status && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status de Propriedade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge 
                      variant={
                        store.ownership_status === 'active' ? 'default' : 
                        store.ownership_status === 'pending' ? 'warning' : 
                        'outline'
                      }
                    >
                      {store.ownership_status === 'active' && '✅ Proprietário Ativo'}
                      {store.ownership_status === 'pending' && '⏳ Aguardando Aceitação'}
                      {store.ownership_status === 'no_admin' && '👤 Sua Loja'}
                    </Badge>
                  </div>
                </div>
                
                {store.admin_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {store.ownership_status === 'active' ? 'Administrador' : 'Convite Pendente'}
                      </p>
                      <p className="text-sm text-muted-foreground">{store.admin_email}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Informações de Contato */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {store.endereco && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Endereço</p>
                    <p className="text-sm text-muted-foreground">{store.endereco}</p>
                  </div>
                </div>
              )}
              {store.telefone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">{store.telefone}</p>
                  </div>
                </div>
              )}
              {store.email_contato && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{store.email_contato}</p>
                  </div>
                </div>
              )}
              {store.cnpj && (
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">CNPJ</p>
                    <p className="text-sm text-muted-foreground">{store.cnpj}</p>
                  </div>
                </div>
              )}
              {!store.endereco && !store.telefone && !store.email_contato && !store.cnpj && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma informação de contato cadastrada
                </p>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Users className="h-8 w-8 text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{store.user_count}</p>
                  <p className="text-sm text-muted-foreground">
                    Usuário{store.user_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <FileText className="h-8 w-8 text-green-500 mb-2" />
                  <p className="text-2xl font-bold">{store.checklist_count}</p>
                  <p className="text-sm text-muted-foreground">
                    Checklist{store.checklist_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <TrendingUp className="h-8 w-8 text-purple-500 mb-2" />
                  <p className="text-2xl font-bold">{store.response_count}</p>
                  <p className="text-sm text-muted-foreground">
                    Resposta{store.response_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Informações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Data de Criação</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(store.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">ID do Estabelecimento</p>
                  <p className="text-sm text-muted-foreground font-mono">{store.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
