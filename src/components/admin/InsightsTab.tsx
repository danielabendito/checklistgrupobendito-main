import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, TrendingDown, Store, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface InsightsTabProps {
  currentStore: { id: string; nome: string } | null;
  userRole: string | null;
}

interface ProblematicItem {
  item_name: string;
  nok_count: number;
  total_count: number;
  nok_percentage: number;
}

interface StoreComparison {
  store_name: string;
  ok_count: number;
  nok_count: number;
  total_count: number;
  ok_percentage: number;
}

interface WeeklyTrend {
  current_ok: number;
  current_total: number;
  previous_ok: number;
  previous_total: number;
  current_percentage: number;
  previous_percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export function InsightsTab({ currentStore, userRole }: InsightsTabProps) {
  const [problematicItems, setProblematicItems] = useState<ProblematicItem[]>([]);
  const [storeComparison, setStoreComparison] = useState<StoreComparison[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentStore) {
      loadInsights();
    }
  }, [currentStore]);

  const loadInsights = async () => {
    if (!currentStore) return;
    setLoading(true);

    // Load problematic items
    const { data: itemsData } = await supabase
      .from('checklist_responses')
      .select(`
        checklist_item_id,
        status,
        checklist_items (nome)
      `)
      .eq('store_id', currentStore.id)
      .gte('data', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (itemsData) {
      const itemStats = itemsData.reduce((acc: any, response: any) => {
        const itemName = response.checklist_items?.nome;
        if (!itemName) return acc;

        if (!acc[itemName]) {
          acc[itemName] = { ok: 0, nok: 0, total: 0 };
        }
        acc[itemName].total++;
        if (response.status === 'ok') acc[itemName].ok++;
        if (response.status === 'nok') acc[itemName].nok++;
        return acc;
      }, {});

      const problematic = Object.entries(itemStats)
        .map(([name, stats]: [string, any]) => ({
          item_name: name,
          nok_count: stats.nok,
          total_count: stats.total,
          nok_percentage: (stats.nok / stats.total) * 100,
        }))
        .filter(item => item.nok_percentage > 20)
        .sort((a, b) => b.nok_percentage - a.nok_percentage)
        .slice(0, 10);

      setProblematicItems(problematic);

      // Generate alerts
      const newAlerts = problematic
        .filter(item => item.nok_percentage > 30)
        .map(item => `${item.item_name} está com ${item.nok_percentage.toFixed(1)}% de NOK`);
      setAlerts(newAlerts);
    }

    // Load store comparison (super_admin only)
    if (userRole === 'super_admin') {
      const { data: storesData } = await supabase
        .from('checklist_responses')
        .select(`
          store_id,
          status,
          stores (nome)
        `)
        .gte('data', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (storesData) {
        const storeStats = storesData.reduce((acc: any, response: any) => {
          const storeName = response.stores?.nome;
          if (!storeName) return acc;

          if (!acc[storeName]) {
            acc[storeName] = { ok: 0, nok: 0, total: 0 };
          }
          acc[storeName].total++;
          if (response.status === 'ok') acc[storeName].ok++;
          if (response.status === 'nok') acc[storeName].nok++;
          return acc;
        }, {});

        const comparison = Object.entries(storeStats)
          .map(([name, stats]: [string, any]) => ({
            store_name: name,
            ok_count: stats.ok,
            nok_count: stats.nok,
            total_count: stats.total,
            ok_percentage: (stats.ok / stats.total) * 100,
          }))
          .sort((a, b) => b.ok_percentage - a.ok_percentage);

        setStoreComparison(comparison);
      }
    }

    // Load weekly trend
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    const previousWeekStart = new Date();
    previousWeekStart.setDate(previousWeekStart.getDate() - 14);

    const { data: currentWeekData } = await supabase
      .from('checklist_responses')
      .select('status')
      .eq('store_id', currentStore.id)
      .gte('data', currentWeekStart.toISOString().split('T')[0]);

    const { data: previousWeekData } = await supabase
      .from('checklist_responses')
      .select('status')
      .eq('store_id', currentStore.id)
      .gte('data', previousWeekStart.toISOString().split('T')[0])
      .lt('data', currentWeekStart.toISOString().split('T')[0]);

    if (currentWeekData && previousWeekData) {
      const currentOk = currentWeekData.filter(r => r.status === 'ok').length;
      const previousOk = previousWeekData.filter(r => r.status === 'ok').length;
      const currentPercentage = (currentOk / currentWeekData.length) * 100 || 0;
      const previousPercentage = (previousOk / previousWeekData.length) * 100 || 0;
      const diff = currentPercentage - previousPercentage;

      setWeeklyTrend({
        current_ok: currentOk,
        current_total: currentWeekData.length,
        previous_ok: previousOk,
        previous_total: previousWeekData.length,
        current_percentage: currentPercentage,
        previous_percentage: previousPercentage,
        trend: Math.abs(diff) < 2 ? 'stable' : diff > 0 ? 'up' : 'down',
      });
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando insights...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Weekly Trend */}
      {weeklyTrend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Tendência Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Semana Atual</p>
                  <p className="text-2xl font-bold">
                    {weeklyTrend.current_percentage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {weeklyTrend.current_ok} de {weeklyTrend.current_total} itens OK
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={weeklyTrend.trend === 'up' ? 'default' : weeklyTrend.trend === 'down' ? 'destructive' : 'secondary'}>
                    {weeklyTrend.trend === 'up' ? (
                      <><TrendingUp className="h-3 w-3 mr-1" /> Melhorando</>
                    ) : weeklyTrend.trend === 'down' ? (
                      <><TrendingDown className="h-3 w-3 mr-1" /> Piorando</>
                    ) : (
                      'Estável'
                    )}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    vs {weeklyTrend.previous_percentage.toFixed(1)}% (semana anterior)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Problematic Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Itens Problemáticos (Últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {problematicItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum item problemático identificado
            </p>
          ) : (
            <div className="space-y-4">
              {problematicItems.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.item_name}</span>
                    <Badge variant={item.nok_percentage > 50 ? 'destructive' : 'secondary'}>
                      {item.nok_percentage.toFixed(1)}% NOK
                    </Badge>
                  </div>
                  <Progress value={item.nok_percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {item.nok_count} NOK de {item.total_count} respostas
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Comparison (super_admin only) */}
      {userRole === 'super_admin' && storeComparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Comparativo de Lojas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {storeComparison.map((store, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{store.store_name}</span>
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      {index === 0 && '🏆 '}
                      {store.ok_percentage.toFixed(1)}% OK
                    </Badge>
                  </div>
                  <Progress value={store.ok_percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {store.ok_count} OK, {store.nok_count} NOK de {store.total_count} itens
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
