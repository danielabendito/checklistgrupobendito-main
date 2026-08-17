import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

interface KPIData {
  totalChecklists: number;
  completedChecklists: number;
  completionRate: number;
  avgOKRate: number;
  avgNOKRate: number;
  totalUsers: number;
  criticalNokCount: number;
}

interface AreaData {
  area: string;
  ok: number;
  nok: number;
  total: number;
}

interface UserPerformance {
  userName: string;
  completed: number;
  okRate: number;
}

interface TrendData {
  date: string;
  completed: number;
  okRate: number;
}

type TodayStatus = "ok" | "late" | "pending";

interface TodayCard {
  checklistTypeId: string;
  nome: string;
  turno: string;
  status: TodayStatus;
  statusLabel: string;
}

const TURNO_LABEL: Record<string, string> = {
  manha: "Turno manhã",
  tarde: "Turno tarde",
  noite: "Turno noite",
};

const DEFAULT_TIMES: Record<string, string> = {
  manha: "09:00:00",
  tarde: "14:00:00",
  noite: "22:00:00",
};

export function DashboardTab() {
  const { currentStore } = useStore();
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [todayCards, setTodayCards] = useState<TodayCard[]>([]);
  const [kpis, setKpis] = useState<KPIData>({
    totalChecklists: 0,
    completedChecklists: 0,
    completionRate: 0,
    avgOKRate: 0,
    avgNOKRate: 0,
    totalUsers: 0,
    criticalNokCount: 0,
  });
  const [areaData, setAreaData] = useState<AreaData[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    if (startDate && endDate && currentStore) {
      loadDashboardData();
      loadTodayStatus();
    }
  }, [startDate, endDate, currentStore]);

  const loadTodayStatus = async () => {
    if (!currentStore) return;

    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");

      const [checklistTypesRes, settingsRes, responsesRes] = await Promise.all([
        supabase
          .from("checklist_types")
          .select("id, nome, turno")
          .eq("store_id", currentStore.id)
          .eq("ativo", true),
        supabase
          .from("admin_settings")
          .select("notification_time_manha, notification_time_tarde, notification_time_noite")
          .eq("store_id", currentStore.id)
          .maybeSingle(),
        supabase
          .from("checklist_responses")
          .select("checklist_type_id, completed_at")
          .eq("store_id", currentStore.id)
          .eq("data", todayStr)
          .not("completed_at", "is", null),
      ]);

      if (checklistTypesRes.error) throw checklistTypesRes.error;

      const completedTypeIds = new Set(
        (responsesRes.data || []).map((r) => r.checklist_type_id)
      );

      const times: Record<string, string> = {
        manha: settingsRes.data?.notification_time_manha || DEFAULT_TIMES.manha,
        tarde: settingsRes.data?.notification_time_tarde || DEFAULT_TIMES.tarde,
        noite: settingsRes.data?.notification_time_noite || DEFAULT_TIMES.noite,
      };

      const now = new Date();

      const cards: TodayCard[] = (checklistTypesRes.data || []).map((ct) => {
        const isCompleted = completedTypeIds.has(ct.id);
        const thresholdStr = times[ct.turno] || "23:59:00";
        const [h, m] = thresholdStr.split(":").map(Number);
        const threshold = new Date();
        threshold.setHours(h, m, 0, 0);

        let status: TodayStatus;
        let statusLabel: string;

        if (isCompleted) {
          status = "ok";
          statusLabel = "Concluído";
        } else if (now > threshold) {
          status = "late";
          const diffMs = now.getTime() - threshold.getTime();
          const diffH = Math.max(1, Math.round(diffMs / 3600000));
          statusLabel = `Atrasado ${diffH}h`;
        } else {
          status = "pending";
          statusLabel = `Pendente às ${thresholdStr.slice(0, 5)}`;
        }

        return {
          checklistTypeId: ct.id,
          nome: ct.nome,
          turno: ct.turno,
          status,
          statusLabel,
        };
      });

      // Late and pending first — that's what needs attention.
      cards.sort((a, b) => {
        const rank = { late: 0, pending: 1, ok: 2 };
        return rank[a.status] - rank[b.status];
      });

      setTodayCards(cards);
    } catch (error: any) {
      console.error("Erro ao carregar status de hoje:", error);
    }
  };

  const loadDashboardData = async () => {
    if (!startDate || !endDate || !currentStore) return;

    try {
      setLoading(true);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Load all responses in date range
      const { data: responses, error } = await supabase
        .from("checklist_responses")
        .select(`
          id,
          checklist_type_id,
          user_id,
          data,
          status,
          completed_at,
          checklist_types!inner(nome, area),
          profiles!inner(nome)
        `)
        .eq("store_id", currentStore.id)
        .gte("data", startDateStr)
        .lte("data", endDateStr);

      if (error) throw error;

      // Calculate KPIs
      const totalResponses = responses?.length || 0;
      const okResponses = responses?.filter(r => r.status === "ok").length || 0;
      const nokResponses = responses?.filter(r => r.status === "nok").length || 0;

      // Get unique users
      const uniqueUsers = new Set(responses?.map(r => r.user_id) || []);

      // Get unique checklist executions (by checklist_type_id + user_id + data)
      const executionsMap = new Map<string, any>();
      responses?.forEach(r => {
        const key = `${r.checklist_type_id}-${r.user_id}-${r.data}`;
        if (!executionsMap.has(key)) {
          executionsMap.set(key, {
            checklistTypeId: r.checklist_type_id,
            userId: r.user_id,
            data: r.data,
            completed: !!r.completed_at,
          });
        }
      });

      const totalExecutions = executionsMap.size;
      const completedExecutions = Array.from(executionsMap.values()).filter(e => e.completed).length;

      setKpis({
        totalChecklists: totalExecutions,
        completedChecklists: completedExecutions,
        completionRate: totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0,
        avgOKRate: totalResponses > 0 ? (okResponses / totalResponses) * 100 : 0,
        avgNOKRate: totalResponses > 0 ? (nokResponses / totalResponses) * 100 : 0,
        totalUsers: uniqueUsers.size,
        criticalNokCount: nokResponses,
      });

      // Calculate by area
      const areasMap = new Map<string, { ok: number; nok: number; total: number }>();
      responses?.forEach((r: any) => {
        const area = r.checklist_types.area;
        if (!areasMap.has(area)) {
          areasMap.set(area, { ok: 0, nok: 0, total: 0 });
        }
        const areaStats = areasMap.get(area)!;
        areaStats.total++;
        if (r.status === "ok") areaStats.ok++;
        if (r.status === "nok") areaStats.nok++;
      });

      setAreaData(
        Array.from(areasMap.entries()).map(([area, stats]) => ({
          area,
          ok: stats.ok,
          nok: stats.nok,
          total: stats.total,
        }))
      );

      // Calculate user performance
      const usersMap = new Map<string, { name: string; completed: number; ok: number; total: number }>();
      responses?.forEach((r: any) => {
        const userId = r.user_id;
        if (!usersMap.has(userId)) {
          usersMap.set(userId, {
            name: r.profiles.nome,
            completed: 0,
            ok: 0,
            total: 0,
          });
        }
        const userStats = usersMap.get(userId)!;
        userStats.total++;
        if (r.status === "ok") userStats.ok++;
      });

      // Count completed checklists per user
      Array.from(executionsMap.values()).forEach(exec => {
        if (exec.completed && usersMap.has(exec.userId)) {
          usersMap.get(exec.userId)!.completed++;
        }
      });

      setUserPerformance(
        Array.from(usersMap.values())
          .map(u => ({
            userName: u.name,
            completed: u.completed,
            okRate: u.total > 0 ? (u.ok / u.total) * 100 : 0,
          }))
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 10)
      );

      // Calculate trend data (by day)
      const datesMap = new Map<string, { completed: number; ok: number; total: number }>();
      responses?.forEach((r: any) => {
        const date = r.data;
        if (!datesMap.has(date)) {
          datesMap.set(date, { completed: 0, ok: 0, total: 0 });
        }
        const dateStats = datesMap.get(date)!;
        dateStats.total++;
        if (r.status === "ok") dateStats.ok++;
      });

      // Count completed by date
      Array.from(executionsMap.values()).forEach(exec => {
        if (exec.completed && datesMap.has(exec.data)) {
          datesMap.get(exec.data)!.completed++;
        }
      });

      setTrendData(
        Array.from(datesMap.entries())
          .map(([date, stats]) => ({
            date: format(new Date(date), "dd/MM", { locale: ptBR }),
            completed: stats.completed,
            okRate: stats.total > 0 ? (stats.ok / stats.total) * 100 : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    } catch (error: any) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'OK', value: Math.round(kpis.avgOKRate), color: 'hsl(var(--success))' },
    { name: 'NOK', value: Math.round(kpis.avgNOKRate), color: 'hsl(var(--destructive))' },
    { name: 'Pendente', value: Math.round(100 - kpis.avgOKRate - kpis.avgNOKRate), color: 'hsl(var(--muted-foreground))' },
  ];

  const statusStyles: Record<TodayStatus, string> = {
    ok: "bg-success/10 text-success border-success/20",
    late: "bg-destructive/10 text-destructive border-destructive/20",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };

  const statusIcon: Record<TodayStatus, JSX.Element> = {
    ok: <CheckCircle2 className="h-3.5 w-3.5" />,
    late: <AlertTriangle className="h-3.5 w-3.5" />,
    pending: <Clock className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-6">
      {/* Agora — o que falta */}
      {todayCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Agora — o que falta
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayCards.map((card) => (
              <Card key={card.checklistTypeId} className="border">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{card.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{TURNO_LABEL[card.turno] || card.turno}</p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyles[card.status]}`}
                  >
                    {statusIcon[card.status]}
                    {card.statusLabel}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Date Range Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground mr-1">
          Resumo do período
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              initialFocus
              locale={ptBR}
            />
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
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <Button size="sm" onClick={() => { loadDashboardData(); loadTodayStatus(); }} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.completedChecklists} de {kpis.totalChecklists} checklists
                </p>
              </CardContent>
            </Card>

            <Card className={kpis.criticalNokCount > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Itens Críticos NOK</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${kpis.criticalNokCount > 0 ? "text-destructive" : ""}`}>
                  {kpis.criticalNokCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  no período selecionado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Taxa Média OK</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{kpis.avgOKRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  dos itens avaliados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  executaram checklists
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Análises detalhadas — collapsed by default so they don't compete with "Agora" */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Análises detalhadas
            </h3>
            <Accordion type="multiple" defaultValue={["area"]} className="space-y-3">
              <AccordionItem value="area" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="text-left">
                    <p className="text-sm font-semibold">Performance por Área</p>
                    <p className="text-xs text-muted-foreground font-normal">Distribuição de OK/NOK por área</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={areaData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                      <XAxis dataKey="area" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="ok" fill="hsl(var(--success))" name="OK" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="nok" fill="hsl(var(--destructive))" name="NOK" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="distribution" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="text-left">
                    <p className="text-sm font-semibold">Distribuição Geral</p>
                    <p className="text-xs text-muted-foreground font-normal">Proporção de itens avaliados</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => value > 0 ? `${name}: ${value}%` : ''}
                        outerRadius={90}
                        innerRadius={55}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </AccordionContent>
              </AccordionItem>

              {trendData.length > 0 && (
                <AccordionItem value="trend" className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="text-left">
                      <p className="text-sm font-semibold">Tendência de Execução</p>
                      <p className="text-xs text-muted-foreground font-normal">Checklists completados e taxa de OK ao longo do tempo</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis yAxisId="left" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="completed" stroke="hsl(var(--primary))" name="Completados" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" dataKey="okRate" stroke="hsl(var(--success))" name="Taxa OK (%)" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--success))' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </AccordionContent>
                </AccordionItem>
              )}

              {userPerformance.length > 0 && (
                <AccordionItem value="ranking" className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="text-left">
                      <p className="text-sm font-semibold">Top 10 Usuários</p>
                      <p className="text-xs text-muted-foreground font-normal">Performance por número de checklists completados</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={userPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                        <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis dataKey="userName" type="category" width={120} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="completed" fill="hsl(var(--primary))" name="Completados" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        </>
      )}
    </div>
  );
}
