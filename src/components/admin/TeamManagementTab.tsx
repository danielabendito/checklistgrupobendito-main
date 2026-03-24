import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailInvitesTab } from "./EmailInvitesTab";
import { RolesManagementTab } from "./RolesManagementTab";
import { UsersManagementTab } from "./UsersManagementTab";

export const TeamManagementTab = () => {
  return (
    <Tabs defaultValue="invites" className="space-y-4">
      <TabsList>
        <TabsTrigger value="invites">Convites</TabsTrigger>
        <TabsTrigger value="roles">Funções</TabsTrigger>
        <TabsTrigger value="users">Usuários</TabsTrigger>
      </TabsList>

      <TabsContent value="invites">
        <EmailInvitesTab />
      </TabsContent>

      <TabsContent value="roles">
        <RolesManagementTab />
      </TabsContent>

      <TabsContent value="users">
        <UsersManagementTab />
      </TabsContent>
    </Tabs>
  );
};
