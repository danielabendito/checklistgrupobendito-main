import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightsTab } from "@/components/admin/InsightsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import AuditTab from "@/components/admin/AuditTab";
import { TeamTimeTab } from "@/components/admin/TeamTimeTab";
import type { Database } from "@/integrations/supabase/types";

interface Store {
  id: string;
  nome: string;
}

interface AnalyticsTabProps {
  currentStore: Store | null;
  userRole: string | null;
}

export function AnalyticsTab({ currentStore, userRole }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="time">Tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-6">
          <InsightsTab currentStore={currentStore} userRole={userRole} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ReportsTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditTab />
        </TabsContent>

        <TabsContent value="time" className="mt-6">
          <TeamTimeTab currentStore={currentStore} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
