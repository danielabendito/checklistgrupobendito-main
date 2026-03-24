import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, TrendingUp, Target, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserStats {
  totalChecklists: number;
  completedChecklists: number;
  itemsOk: number;
  itemsNok: number;
  okRate: number;
}

interface UserStatsCardProps {
  userId: string;
  storeId: string;
}

export const UserStatsCard = ({ userId, storeId }: UserStatsCardProps) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [userId, storeId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Get first and last day of current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const firstDayStr = firstDay.toISOString().split('T')[0];
      const lastDayStr = lastDay.toISOString().split('T')[0];

      // Get all responses from current month
      const { data: responses, error } = await supabase
        .from("checklist_responses")
        .select("checklist_type_id, data, status, completed_at")
        .eq("user_id", userId)
        .eq("store_id", storeId)
        .gte("data", firstDayStr)
        .lte("data", lastDayStr)
        .not("completed_at", "is", null);

      if (error) throw error;

      // Group by checklist_type_id + data to count unique checklists
      const checklistMap = new Map<string, { ok: number; nok: number }>();
      
      responses?.forEach((response) => {
        const key = `${response.checklist_type_id}-${response.data}`;
        const current = checklistMap.get(key) || { ok: 0, nok: 0 };
        
        if (response.status === 'ok') {
          current.ok++;
        } else if (response.status === 'nok') {
          current.nok++;
        }
        
        checklistMap.set(key, current);
      });

      // Calculate stats
      const totalChecklists = checklistMap.size;
      let totalItemsOk = 0;
      let totalItemsNok = 0;
      let completedChecklists = 0;

      checklistMap.forEach((counts) => {
        totalItemsOk += counts.ok;
        totalItemsNok += counts.nok;
        if (counts.nok === 0) {
          completedChecklists++;
        }
      });

      const totalItems = totalItemsOk + totalItemsNok;
      const okRate = totalItems > 0 ? (totalItemsOk / totalItems) * 100 : 0;

      setStats({
        totalChecklists,
        completedChecklists,
        itemsOk: totalItemsOk,
        itemsNok: totalItemsNok,
        okRate: Math.round(okRate),
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-card to-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Seu Desempenho - {currentMonth}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-primary/10 border border-primary/20">
            <CheckCircle2 className="w-8 h-8 text-primary mb-2" />
            <div className="text-3xl font-bold text-primary">{stats?.totalChecklists || 0}</div>
            <div className="text-sm text-muted-foreground text-center">Checklists Realizados</div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <Target className="w-8 h-8 text-green-600 mb-2" />
            <div className="text-3xl font-bold text-green-600">{stats?.completedChecklists || 0}</div>
            <div className="text-sm text-muted-foreground text-center">100% OK</div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-3xl font-bold text-blue-600">{stats?.okRate || 0}%</div>
            <div className="text-sm text-muted-foreground text-center">Taxa OK</div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertCircle className="w-8 h-8 text-orange-600 mb-2" />
            <div className="text-3xl font-bold text-orange-600">{stats?.itemsNok || 0}</div>
            <div className="text-sm text-muted-foreground text-center">Itens NOK</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
