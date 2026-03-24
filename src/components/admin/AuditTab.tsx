import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Search, Download, FileText, Shield, User, Settings, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';

interface AuditLog {
  id: string;
  created_at: string;
  user_name: string;
  user_email: string;
  action_type: string;
  resource_type: string;
  resource_name: string | null;
  old_values: any;
  new_values: any;
  metadata: any;
}

export default function AuditTab() {
  const { currentStore } = useStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    if (currentStore) {
      loadAuditLogs();
    }
  }, [currentStore, actionFilter, resourceFilter, dateRange]);

  const loadAuditLogs = async () => {
    if (!currentStore) return;

    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }

      if (resourceFilter !== "all") {
        query = query.eq("resource_type", resourceFilter);
      }

      if (dateRange.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }

      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Erro ao carregar logs de auditoria:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredLogs.map(log => ({
      "Data/Hora": format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      "Usuário": log.user_name,
      "Email": log.user_email,
      "Ação": getActionLabel(log.action_type),
      "Recurso": getResourceLabel(log.resource_type),
      "Nome do Recurso": log.resource_name || "-",
      "Detalhes": JSON.stringify(log.new_values || {})
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `auditoria-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.user_name.toLowerCase().includes(searchLower) ||
      log.user_email.toLowerCase().includes(searchLower) ||
      log.action_type.toLowerCase().includes(searchLower) ||
      log.resource_type.toLowerCase().includes(searchLower) ||
      (log.resource_name && log.resource_name.toLowerCase().includes(searchLower))
    );
  });

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: "Criar",
      update: "Atualizar",
      delete: "Excluir",
      complete: "Completar",
      export: "Exportar",
    };
    return labels[action] || action;
  };

  const getResourceLabel = (resource: string) => {
    const labels: Record<string, string> = {
      checklist_type: "Checklist",
      checklist_item: "Item de Checklist",
      checklist_response: "Resposta",
      admin_settings: "Configurações",
      user: "Usuário",
      report: "Relatório",
    };
    return labels[resource] || resource;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-500/10 text-green-700 dark:text-green-400",
      update: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      delete: "bg-red-500/10 text-red-700 dark:text-red-400",
      complete: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
      export: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    };
    return colors[action] || "bg-gray-500/10 text-gray-700 dark:text-gray-400";
  };

  const getResourceIcon = (resource: string) => {
    const icons: Record<string, any> = {
      checklist_type: ClipboardList,
      checklist_item: FileText,
      checklist_response: Shield,
      admin_settings: Settings,
      user: User,
      report: Download,
    };
    const Icon = icons[resource] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Histórico de Auditoria
          </CardTitle>
          <CardDescription>
            Registro completo de todas as ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criar</SelectItem>
                <SelectItem value="update">Atualizar</SelectItem>
                <SelectItem value="delete">Excluir</SelectItem>
                <SelectItem value="complete">Completar</SelectItem>
                <SelectItem value="export">Exportar</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os recursos</SelectItem>
                <SelectItem value="checklist_type">Checklists</SelectItem>
                <SelectItem value="checklist_item">Itens</SelectItem>
                <SelectItem value="checklist_response">Respostas</SelectItem>
                <SelectItem value="admin_settings">Configurações</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
                <SelectItem value="report">Relatórios</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    <span>Período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) =>
                    setDateRange({ from: range?.from, to: range?.to })
                  }
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Botão de Exportar */}
          <div className="flex justify-end">
            <Button onClick={exportToExcel} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar para Excel
            </Button>
          </div>

          {/* Lista de Logs */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              filteredLogs.map((log) => (
                <Card key={log.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {getResourceIcon(log.resource_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getActionColor(log.action_type)}>
                              {getActionLabel(log.action_type)}
                            </Badge>
                            <Badge variant="outline">
                              {getResourceLabel(log.resource_type)}
                            </Badge>
                            {log.resource_name && (
                              <span className="font-medium text-sm truncate">
                                {log.resource_name}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span>{log.user_name}</span>
                              <span className="text-xs">({log.user_email})</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        <br />
                        {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
