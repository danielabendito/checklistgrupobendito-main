import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  Users,
  ClipboardList,
  Bell,
  BarChart3,
  HelpCircle,
  Lightbulb,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Search,
  FileCheck,
  Camera,
  MessageSquare,
} from "lucide-react";

interface GettingStartedTabProps {
  onNavigateToTab: (tab: string) => void;
}

export function GettingStartedTab({ onNavigateToTab }: GettingStartedTabProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">📖 Manual do Administrador</h1>
          <Badge variant="secondary">v3.0</Badge>
        </div>
        <p className="text-muted-foreground">
          Guia completo - Tudo que você precisa saber para gerenciar seus checklists
        </p>
      </div>

      {/* Quick Navigation */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Navegação Rápida</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("dashboard")}>
            📊 Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("checklists")}>
            📝 Checklists
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("items")}>
            📋 Itens
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("users")}>
            👥 Usuários
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("reports")}>
            📈 Relatórios
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("inspection-standards")}>
            🔍 Padrões de Inspeção
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("inspection-reports")}>
            📋 Relatórios de Inspeção
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigateToTab("notifications")}>
            📱 Notificações
          </Button>
        </div>
      </div>

      {/* Main Content - Accordion */}
      <Accordion type="multiple" defaultValue={["quick-start"]} className="space-y-4">
        {/* 1. INÍCIO RÁPIDO */}
        <AccordionItem value="quick-start" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              🚀 Início Rápido (3 minutos)
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <p className="text-muted-foreground">
              Siga esses 3 passos para começar a usar o sistema:
            </p>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Crie seu Primeiro Checklist</h4>
                  <p className="text-sm text-muted-foreground">
                    Vá para a aba{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => onNavigateToTab("checklists")}
                    >
                      Checklists
                    </Button>
                    {" "}e clique em "Novo Checklist". Defina nome, área e turno.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Adicione Itens ao Checklist</h4>
                  <p className="text-sm text-muted-foreground">
                    Na aba{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => onNavigateToTab("items")}
                    >
                      Itens
                    </Button>
                    , adicione itens manualmente ou importe via Excel (veja seção abaixo).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Convide sua Equipe</h4>
                  <p className="text-sm text-muted-foreground">
                    Na aba{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => onNavigateToTab("users")}
                    >
                      Usuários
                    </Button>
                    {" "}ou{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => onNavigateToTab("invites")}
                    >
                      Convites
                    </Button>
                    , envie convites por email ou WhatsApp e atribua funções.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. GERENCIAMENTO DE CHECKLISTS */}
        <AccordionItem value="checklists" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              📋 Gerenciamento de Checklists
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Criar Novo Checklist</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse a aba Checklists</li>
                  <li>Clique em "Novo Checklist"</li>
                  <li>Preencha: Nome, Área (Cozinha, Caixa, etc.) e Turno (Abertura, Fechamento, etc.)</li>
                  <li>Selecione quais funções podem executar esse checklist</li>
                  <li>Clique em "Salvar"</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Editar/Excluir Checklist</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Clique no ícone de lápis para editar</li>
                  <li>Clique no ícone de lixeira para excluir (cuidado: remove todos os itens também)</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h5 className="font-semibold text-sm mb-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Dica
                </h5>
                <p className="text-sm text-muted-foreground">
                  Use nomes descritivos como "Abertura - Cozinha" ao invés de apenas "Abertura" para facilitar a identificação.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. IMPORTAÇÃO VIA EXCEL */}
        <AccordionItem value="excel-import" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              📊 Importação Via Excel - Guia Rápido
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importação em Massa de Itens
              </h4>
              <p className="text-sm text-muted-foreground">
                Importe dezenas de itens de uma só vez usando planilhas Excel.
              </p>
            </div>

            {/* Passo a passo visual */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h5 className="font-medium">Baixe o Template</h5>
                  <p className="text-sm text-muted-foreground">
                    Na aba Itens, clique em "Importar Planilha" → "Baixar Template Excel"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h5 className="font-medium mb-2">Preencha a Planilha</h5>
                  <p className="text-sm text-muted-foreground mb-2">
                    Colunas obrigatórias (*) e opcionais:
                  </p>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border-r px-3 py-2 text-left font-semibold">
                            nome*
                          </th>
                          <th className="border-r px-3 py-2 text-left font-semibold">
                            checklist_nome*
                          </th>
                          <th className="border-r px-3 py-2 text-left font-semibold">
                            ordem
                          </th>
                          <th className="border-r px-3 py-2 text-left font-semibold">
                            requer_foto
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            requer_observacao
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-card">
                          <td className="border-r border-t px-3 py-2">Verificar temperatura</td>
                          <td className="border-r border-t px-3 py-2">Abertura - Cozinha</td>
                          <td className="border-r border-t px-3 py-2">10</td>
                          <td className="border-r border-t px-3 py-2">sim</td>
                          <td className="border-t px-3 py-2">não</td>
                        </tr>
                        <tr className="bg-muted/30">
                          <td className="border-r border-t px-3 py-2">Conferir estoque</td>
                          <td className="border-r border-t px-3 py-2">Abertura - Cozinha</td>
                          <td className="border-r border-t px-3 py-2">20</td>
                          <td className="border-r border-t px-3 py-2">não</td>
                          <td className="border-t px-3 py-2">sim</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Colunas obrigatórias
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h5 className="font-medium">Importe e Valide</h5>
                  <p className="text-sm text-muted-foreground">
                    O sistema valida automaticamente:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>🟢 Itens válidos são marcados em verde</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span>🔴 Erros são marcados em vermelho com descrição</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div className="flex-1">
                  <h5 className="font-medium">Confirme a Importação</h5>
                  <p className="text-sm text-muted-foreground">
                    Revise os itens válidos e clique em "Confirmar Importação". Itens com erro não serão importados.
                  </p>
                </div>
              </div>
            </div>

            {/* Dicas */}
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                💡 Dicas Importantes
              </h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Use o nome exato do checklist (confira na aba Checklists)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Itens duplicados no mesmo checklist são bloqueados
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Campo "ordem" é calculado automaticamente se deixado vazio
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Tamanho máximo: 5MB | Formato: apenas .xlsx
                </li>
              </ul>
            </div>

            {/* Botão de ação */}
            <Button onClick={() => onNavigateToTab("items")} className="w-full" size="lg">
              <Upload className="mr-2 h-4 w-4" />
              Ir para Aba Itens e Importar Agora
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 4. GERENCIAMENTO DE EQUIPE */}
        <AccordionItem value="team" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              👥 Gerenciamento de Equipe
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Enviar Convites por Email</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse a aba "Convites por Email"</li>
                  <li>Digite o email do usuário</li>
                  <li>Selecione a função (gerente, supervisor, operador, etc.)</li>
                  <li>Clique em "Adicionar Convite"</li>
                  <li>Clique no botão "Email" para enviar o convite</li>
                  <li>O usuário receberá um email com link de cadastro</li>
                </ol>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  📲 Enviar Convite via WhatsApp (Opcional)
                  <Badge variant="secondary" className="ml-2">Novo</Badge>
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Na aba "Convites", preencha o email do usuário</li>
                  <li>Adicione o número de WhatsApp (opcional, formato: 5548999999999)</li>
                  <li>Clique em "Adicionar Convite"</li>
                  <li>Na lista, clique no botão "WhatsApp" para enviar o convite</li>
                  <li>O usuário receberá uma mensagem com o link de cadastro</li>
                </ol>
                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    <strong>Importante:</strong> O cadastro continua sendo realizado via email. O WhatsApp é apenas uma forma adicional de enviar o convite.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Gerenciar Usuários Existentes</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Na aba "Usuários", veja todos os usuários cadastrados</li>
                  <li>Edite a função de um usuário clicando no ícone de lápis</li>
                  <li>Remova usuários clicando no ícone de lixeira</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Funções e Permissões</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure funções na aba "Funções":
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>Super Admin:</strong> Acesso total ao sistema</li>
                  <li><strong>Gerente:</strong> Gerencia checklists e equipe da loja</li>
                  <li><strong>Supervisor:</strong> Executa e supervisiona checklists</li>
                  <li><strong>Operador:</strong> Executa checklists atribuídos</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. RELATÓRIOS */}
        <AccordionItem value="reports" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              📊 Relatórios e Análises
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Visualizar Estatísticas</h4>
                <p className="text-sm text-muted-foreground">
                  No Dashboard e na aba Insights, você encontra:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mt-2">
                  <li>Taxa de conclusão de checklists</li>
                  <li>Itens mais problemáticos (com mais "Não Conforme")</li>
                  <li>Performance por área e turno</li>
                  <li>Histórico de execuções</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Exportar Dados</h4>
                <p className="text-sm text-muted-foreground">
                  Na aba Relatórios:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mt-2">
                  <li>Filtre por data, checklist, área ou usuário</li>
                  <li>Exporte para Excel ou CSV</li>
                  <li>Gere relatórios de auditoria</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  📋 Relatórios de Inspeção
                  <Badge variant="secondary" className="ml-2">Novo</Badge>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Na aba "Relatórios de Inspeção":
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mt-2">
                  <li>Visualize análises do Inspetor Sanitário Virtual</li>
                  <li>Veja detalhes de cada item analisado pela IA</li>
                  <li>Envie relatórios completos via WhatsApp</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 6. INSPETOR SANITÁRIO VIRTUAL */}
        <AccordionItem value="inspector" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              🔍 Inspetor Sanitário Virtual
              <Badge variant="secondary" className="ml-2">IA</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Search className="h-5 w-5" />
                O que é o Inspetor Sanitário Virtual?
              </h4>
              <p className="text-sm text-muted-foreground">
                É uma funcionalidade de Inteligência Artificial que analisa automaticamente as fotos enviadas nos checklists e compara com os padrões definidos por você.
              </p>
            </div>

            {/* Padrões de Inspeção */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">📋 Padrões de Inspeção</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Configure critérios claros para itens que exigem foto:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h5 className="font-medium">Acesse os Padrões</h5>
                    <p className="text-sm text-muted-foreground">
                      Vá para a aba{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => onNavigateToTab("inspection-standards")}
                      >
                        Padrões de Inspeção
                      </Button>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h5 className="font-medium">Configure cada Item</h5>
                    <p className="text-sm text-muted-foreground">
                      Para cada item com foto obrigatória, defina:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
                      <li><strong>Critério de Inspeção:</strong> Descrição clara do padrão esperado (ex: "Bancada limpa, sem resíduos de alimentos")</li>
                      <li><strong>Nível de Severidade:</strong> Baixa, Média ou Alta</li>
                      <li><strong>Fotos de Referência:</strong> Até 3 fotos mostrando o padrão ideal</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h5 className="font-medium">Salve o Padrão</h5>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Salvar Padrão". A IA usará essas referências para analisar as fotos enviadas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Relatórios de Inspeção */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">📊 Relatórios de Inspeção</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Visualize os resultados das análises realizadas pela IA:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h5 className="font-medium">Acesse os Relatórios</h5>
                    <p className="text-sm text-muted-foreground">
                      Vá para a aba{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => onNavigateToTab("inspection-reports")}
                      >
                        Relatórios de Inspeção
                      </Button>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h5 className="font-medium">Visualize os Resultados</h5>
                    <p className="text-sm text-muted-foreground mb-2">
                      Cada item analisado terá um dos seguintes status:
                    </p>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <Badge className="bg-green-500 text-white">Aprovado</Badge>
                        <span className="text-muted-foreground">Item dentro do padrão</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge className="bg-red-500 text-white">Reprovado</Badge>
                        <span className="text-muted-foreground">Item fora do padrão</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge className="bg-yellow-500 text-white">Inconclusivo</Badge>
                        <span className="text-muted-foreground">IA não conseguiu determinar</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h5 className="font-medium">Ações Disponíveis</h5>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      <li>Clique em "Detalhes" para ver a análise completa de cada item</li>
                      <li>Use o botão "Enviar WhatsApp" para compartilhar o relatório</li>
                      <li>Exporte o relatório em PDF se necessário</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Dica */}
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                💡 Dicas para Melhores Resultados
              </h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Configure fotos de referência claras e bem iluminadas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Seja específico nos critérios de inspeção
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Oriente a equipe a tirar fotos com boa qualidade
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Revise regularmente os padrões conforme necessidade
                </li>
              </ul>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => onNavigateToTab("inspection-standards")} className="flex-1" size="lg">
                <Camera className="mr-2 h-4 w-4" />
                Configurar Padrões
              </Button>
              <Button onClick={() => onNavigateToTab("inspection-reports")} variant="outline" className="flex-1" size="lg">
                <FileCheck className="mr-2 h-4 w-4" />
                Ver Relatórios
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 7. NOTIFICAÇÕES */}
        <AccordionItem value="notifications" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              🔔 Configurações de Notificações
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Configurar Lembretes</h4>
                <p className="text-sm text-muted-foreground">
                  Na aba{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => onNavigateToTab("notifications")}
                  >
                    Notificações
                  </Button>
                  , você pode:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mt-2">
                  <li>Ativar/desativar notificações por checklist</li>
                  <li>Definir horários de envio por turno (Manhã, Tarde, Noite)</li>
                  <li>Escolher os canais de notificação</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  📲 Canais de Notificação
                  <Badge variant="secondary" className="ml-2">Novo</Badge>
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Escolha como receber notificações de checklists não realizados:
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <div>
                      <strong>Email:</strong> Receba notificações no email cadastrado
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <div>
                      <strong>WhatsApp:</strong> Receba notificações no número de WhatsApp cadastrado
                    </div>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Você pode ativar um ou ambos os canais simultaneamente.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Como Configurar</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse a aba "Notificações"</li>
                  <li>Marque os canais desejados (Email e/ou WhatsApp)</li>
                  <li>Preencha o email e/ou número de WhatsApp</li>
                  <li>Configure os horários de cada turno</li>
                  <li>Clique em "Salvar Configurações"</li>
                </ol>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 8. FAQ */}
        <AccordionItem value="faq" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              ❓ Perguntas Frequentes
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-4">
              {/* Perguntas sobre Checklists */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-primary">📋 Checklists e Importação</h4>
                
                <div>
                  <h5 className="font-semibold text-sm">Como faço para recuperar um checklist excluído?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não é possível recuperar checklists excluídos. Tenha cuidado ao excluir.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">Posso importar itens para vários checklists de uma vez?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sim! Basta incluir linhas com diferentes nomes de checklist na mesma planilha Excel.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">O que acontece se eu tentar importar um item duplicado?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    O sistema detecta duplicatas e marca como erro. O item não será importado.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">Como alterar a ordem dos itens após a importação?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Na aba Itens, clique em editar (ícone de lápis) e altere o campo "Ordem".
                  </p>
                </div>
              </div>

              {/* Perguntas sobre WhatsApp */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-primary">📱 WhatsApp</h4>
                
                <div>
                  <h5 className="font-semibold text-sm">Como ativo as notificações por WhatsApp?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Na aba "Notificações", marque a opção "WhatsApp" e informe o número que receberá as notificações (formato: 5548999999999).
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">O convite por WhatsApp substitui o email?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não. O WhatsApp é apenas um canal adicional para enviar o convite. O cadastro continua sendo realizado através do email informado.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">Qual formato devo usar para o número de WhatsApp?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use o formato internacional com código do país: 5548999999999 (55 = Brasil, 48 = DDD, seguido do número).
                  </p>
                </div>
              </div>

              {/* Perguntas sobre Inspeção */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-primary">🔍 Inspetor Sanitário Virtual</h4>
                
                <div>
                  <h5 className="font-semibold text-sm">Como funciona o Inspetor Sanitário Virtual?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    O inspetor analisa automaticamente as fotos enviadas nos checklists e compara com os padrões definidos na aba "Padrões de Inspeção". Configure critérios e fotos de referência para obter melhores resultados.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">Por que alguns itens aparecem como "inconclusivos"?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Isso pode acontecer quando a foto está com pouca qualidade, iluminação inadequada, ou quando não há padrão de inspeção configurado para o item.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">Preciso configurar padrões para todos os itens?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Apenas para itens que exigem foto. Itens sem foto obrigatória não são analisados pelo Inspetor Virtual.
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-sm">Como melhorar a precisão da análise?</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use fotos de referência claras e bem iluminadas, escreva critérios específicos e detalhados, e oriente sua equipe a tirar fotos com boa qualidade.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 9. MELHORES PRÁTICAS */}
        <AccordionItem value="best-practices" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              💡 Melhores Práticas
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Nomenclatura de Checklists</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Use padrão: [Turno] - [Área] (ex: "Abertura - Cozinha")</li>
                  <li>Evite abreviações que podem gerar confusão</li>
                  <li>Seja consistente em todas as lojas</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Organização de Itens</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Ordene itens por sequência lógica de execução</li>
                  <li>Agrupe itens relacionados (ex: todos os itens de limpeza juntos)</li>
                  <li>Use ordem com intervalos de 10 (10, 20, 30...) para facilitar inserções futuras</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Padrões de Inspeção</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Configure padrões para todos os itens com foto obrigatória</li>
                  <li>Use fotos de referência tiradas no próprio estabelecimento</li>
                  <li>Seja específico nos critérios (evite termos vagos como "limpo")</li>
                  <li>Revise os padrões periodicamente com base nos resultados</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Frequência de Verificação</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Revise relatórios semanalmente para identificar padrões</li>
                  <li>Analise os relatórios de inspeção para ações corretivas</li>
                  <li>Ajuste checklists baseado no feedback da equipe</li>
                  <li>Monitore itens com alta taxa de não conformidade ou reprovação</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Gestão de Equipe</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Treine a equipe antes de atribuir checklists</li>
                  <li>Oriente sobre como tirar fotos com qualidade</li>
                  <li>Defina funções claramente para evitar confusão de permissões</li>
                  <li>Use notificações para criar rotina de verificação</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 10. SUPORTE */}
        <AccordionItem value="support" className="border rounded-lg px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              📞 Suporte
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Em Caso de Dúvidas ou Problemas</h4>
                <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                  <div>
                    <h5 className="font-semibold text-sm mb-2">Contato com Suporte Técnico:</h5>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="font-medium">📧 E-mail:</span>
                        <a href="mailto:daniela.bendito@gmail.com" className="text-primary hover:underline">
                          daniela.bendito@gmail.com
                        </a>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="font-medium">📱 Telefone:</span>
                        <a href="tel:+5548996161451" className="text-primary hover:underline">
                          48-996161451
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Ao Entrar em Contato, Informe:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Nome da sua loja;</li>
                  <li>Seu e-mail de administrador;</li>
                  <li>Descrição detalhada do problema;</li>
                  <li>Prints de tela (se possível);</li>
                  <li>Data/hora em que o problema ocorreu.</li>
                </ol>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Tempo de Resposta
                </h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">Crítico</Badge>
                    <span className="text-muted-foreground">Problemas críticos: Até 6 horas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Normal</Badge>
                    <span className="text-muted-foreground">Dúvidas gerais: Até 24 horas</span>
                  </li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
