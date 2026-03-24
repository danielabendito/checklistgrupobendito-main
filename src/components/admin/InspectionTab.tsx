import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InspectionStandardsTab } from "./InspectionStandardsTab";
import { InspectionReportsTab } from "./InspectionReportsTab";

export const InspectionTab = () => {
  return (
    <Tabs defaultValue="standards" className="space-y-4">
      <TabsList>
        <TabsTrigger value="standards">Padrões de Inspeção</TabsTrigger>
        <TabsTrigger value="reports">Relatórios de Inspeção</TabsTrigger>
      </TabsList>

      <TabsContent value="standards">
        <InspectionStandardsTab />
      </TabsContent>

      <TabsContent value="reports">
        <InspectionReportsTab />
      </TabsContent>
    </Tabs>
  );
};
