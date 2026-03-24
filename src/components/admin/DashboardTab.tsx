import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, TrendingUp, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

interface KPIData {
  totalChecklists: number;
  completedChecklists: number;
  completionRate: number;
  avgOKRate: number;
  avgNOKRate: number;
  totalUsers: number;
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

export function DashboardTab() {
  const { currentStore } = useStore();
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<KPIData>({
    totalChecklists: 0,
    completedChecklists: 0,
    completionRate: 0,
    avgOKRate: 0,
    avgNOKRate: 0,
    totalUsers: 0,
  });
  const [areaData, setAreaData] = useState<AreaData[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    if (startDate && endDate && currentStore) {
      loadDashboardData();
    }
  }, [startDate, endDate, currentStore]);

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
      const completedResponses = responses?.filter(r => r.completed_at) || [];
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

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
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

        <span className="text-muted-foreground">até</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
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

        <Button onClick={loadDashboardData} disabled={loading}>
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
            <Card className="bg-gradient-to-br from-card to-primary/10 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Checklists</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{kpis.totalChecklists}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.completedChecklists} completados ({kpis.completionRate.toFixed(0)}%)
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-secondary/10 border-secondary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-secondary">{kpis.completionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  dos checklists iniciados
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-success/10 border-success/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa Média OK</CardTitle>
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{kpis.avgOKRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  dos itens avaliados
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-accent/10 border-accent/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Users className="h-5 w-5 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-accent">{kpis.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  executaram checklists
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Area Performance */}
            <Card className="bg-gradient-to-br from-card via-card to-success/5">
              <CardHeader>
                <CardTitle>Performance por Área</CardTitle>
                <CardDescription>Distribuição de OK/NOK por área</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={areaData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                    <XAxis 
                      dataKey="area" 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-lg)'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="ok" fill="hsl(var(--success))" name="OK" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="nok" fill="hsl(var(--destructive))" name="NOK" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* OK/NOK Distribution */}
            <Card className="bg-gradient-to-br from-card via-card to-muted/20">
              <CardHeader>
                <CardTitle>Distribuição Geral</CardTitle>
                <CardDescription>Proporção de itens avaliados</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => value > 0 ? `${name}: ${value}%` : ''}
                      outerRadius={100}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Trend Line */}
            {trendData.length > 0 && (
              <Card className="lg:col-span-2 bg-gradient-to-br from-card via-card to-primary/5">
                <CardHeader>
                  <CardTitle>Tendência de Execução</CardTitle>
                  <CardDescription>Checklists completados e taxa de OK ao longo do tempo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        yAxisId="left" 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-lg)'
                        }} 
                      />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="completed" 
                        stroke="hsl(var(--primary))" 
                        name="Completados"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="okRate" 
                        stroke="hsl(var(--success))" 
                        name="Taxa OK (%)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--success))' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* User Performance */}
            {userPerformance.length > 0 && (
              <Card className="lg:col-span-2 bg-gradient-to-br from-card via-card to-secondary/5">
                <CardHeader>
                  <CardTitle>Top 10 Usuários</CardTitle>
                  <CardDescription>Performance por número de checklists completados</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={userPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                      <XAxis 
                        type="number" 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        dataKey="userName" 
                        type="category" 
                        width={120} 
                        className="text-xs" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-lg)'
                        }} 
                      />
                      <Legend />
                      <Bar 
                        dataKey="completed" 
                        fill="hsl(var(--primary))" 
                        name="Completados" 
                        radius={[0, 8, 8, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
