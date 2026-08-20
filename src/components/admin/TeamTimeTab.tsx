import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Store {
  id: string;
  nome: string;
}

interface TeamTimeTabProps {
  currentStore: Store | null;
}

interface Collaborator {
  id: string;
  nome: string;
}

interface Execution {
  checklistTypeId: string;
  checklistNome: string;
  data: string;
  startedAt: Date;
  finishedAt: Date;
  durationMinutes: number;
}

interface ChecklistAverage {
  checklistNome: string;
  avgMinutes: number;
  count: number;
}

// Always show times in São Paulo/Brazil time, regardless of the viewer's device timezone
// (same fix applied to DashboardTab's "Agora" section).
function formatTimeSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function TeamTimeTab({ currentStore }: TeamTimeTabProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);

  useEffect(() => {
    if (currentStore) {
      loadCollaborators();
    }
  }, [currentStore]);

  useEffect(() => {
    if (currentStore && selectedUserId && startDate && endDate) {
      loadExecutions();
    } else {
      setExecutions([]);
    }
  }, [currentStore, selectedUserId, startDate, endDate]);

  const loadCollaborators = async () => {
    if (!currentStore) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("store_id", currentStore.id)
      .order("nome");

    if (!error && data) {
      setCollaborators(data);
    }
  };

  const loadExecutions = async () => {
    if (!currentStore || !selectedUserId || !startDate || !endDate) return;

    try {
      setLoading(true);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const { data: responses, error } = await supabase
        .from("checklist_responses")
        .select(`
          checklist_type_id,
          data,
          created_at,
          completed_at,
          checklist_types!inner(nome)
        `)
        .eq("store_id", currentStore.id)
        .eq("user_id", selectedUserId)
        .gte("data", startDateStr)
        .lte("data", endDateStr)
        .not("completed_at", "is", null);

      if (error) throw error;

      // Group by (checklist_type_id, data) to find start (earliest item touched)
      // and finish (the shared completed_at written at Save time) per execution.
      const map = new Map<string, Execution>();
      (responses || []).forEach((r: any) => {
        const key = `${r.checklist_type_id}-${r.data}`;
        const createdAt = new Date(r.created_at);
        const completedAt = new Date(r.completed_at);
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            checklistTypeId: r.checklist_type_id,
            checklistNome: r.checklist_types.nome,
            data: r.data,
            startedAt: createdAt,
            finishedAt: completedAt,
            durationMinutes: 0,
          });
        } else if (createdAt < existing.startedAt) {
          existing.startedAt = createdAt;
        }
      });

      const withDuration = Array.from(map.values()).map((e) => ({
        ...e,
        durationMinutes: Math.max(0, (e.finishedAt.getTime() - e.startedAt.getTime()) / 60000),
      }));

      withDuration.sort((a, b) => b.data.localeCompare(a.data));

      setExecutions(withDuration);
    } catch (error) {
      console.error("Erro ao carregar tempos de preenchimento:", error);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const averagesByChecklist: ChecklistAverage[] = (() => {
    const map = new Map<string, { total: number; count: number }>();
    executions.forEach((e) => {
      const entry = map.get(e.checklistNome) || { total: 0, count: 0 };
      entry.total += e.durationMinutes;
      entry.count += 1;
      map.set(e.checklistNome, entry);
    });
    return Array.from(map.entries()).map(([checklistNome, { total, count }]) => ({
      checklistNome,
      avgMinutes: total / count,
      count,
    }));
  })();

  const chartData = [...executions]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((e) => ({
      data: format(new Date(e.data + "T00:00:00"), "dd/MM", { locale: ptBR }),
      minutos: Math.round(e.durationMinutes * 10) / 10,
      checklist: e.checklistNome,
    }));

  const selectedCollaboratorName = collaborators.find((c) => c.id === selectedUserId)?.nome;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Selecione um colaborador" />
          </SelectTrigger>
          <SelectContent>
            {collaborators.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={ptBR} />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground text-sm">até</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP", { locale: ptBR }) : "Data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={ptBR} />
          </PopoverContent>
        </Popover>
      </div>

      {!selectedUserId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Selecione um colaborador para ver o tempo de preenchimento.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum checklist concluído por {selectedCollaboratorName} nesse período.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 border rounded-lg p-3">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              A duração é o tempo entre o primeiro item respondido e o momento em que {selectedCollaboratorName} apertou
              "Salvar" — se houve uma pausa no meio do preenchimento, ela entra nesse tempo.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Média por checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {averagesByChecklist.map((a) => (
                <Card key={a.checklistNome}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{a.checklistNome}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {formatDuration(a.avgMinutes)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      média de {a.count} {a.count === 1 ? "execução" : "execuções"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Duração ao longo do tempo</CardTitle>
              <CardDescription>Cada ponto é uma execução de checklist concluída</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                  <XAxis dataKey="data" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "minutos", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, _name, item: any) => [`${value} min`, item?.payload?.checklist]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="minutos"
                    stroke="hsl(var(--primary))"
                    name="Duração (min)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Execuções no período
            </h3>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {executions.map((e) => (
                    <div key={`${e.checklistTypeId}-${e.data}`} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{e.checklistNome}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} ·{" "}
                          {formatTimeSaoPaulo(e.startedAt)} – {formatTimeSaoPaulo(e.finishedAt)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold flex items-center gap-1.5 shrink-0 ml-3">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDuration(e.durationMinutes)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
