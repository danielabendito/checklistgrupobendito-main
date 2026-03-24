import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChecklistExecution {
  checklist_type_name: string;
  user_name: string;
  data: string;
  items_total: number;
  items_ok: number;
  items_nok: number;
  has_all_photos: boolean;
  items_with_required_photos: number;
  items_with_photos_uploaded: number;
  completed_at: string | null;
}

export const exportToExcel = (executions: ChecklistExecution[], date: Date) => {
  const exportData = executions.map(exec => ({
    "Checklist": exec.checklist_type_name,
    "Executado por": exec.user_name,
    "Data": format(new Date(exec.data), "dd/MM/yyyy", { locale: ptBR }),
    "Horário": exec.completed_at ? format(new Date(exec.completed_at), "HH:mm", { locale: ptBR }) : "-",
    "Total de Itens": exec.items_total,
    "Itens OK": exec.items_ok,
    "Itens NOK": exec.items_nok,
    "% Conformidade": Math.round((exec.items_ok / exec.items_total) * 100) + "%",
    "Fotos": exec.items_with_required_photos > 0 
      ? `${exec.items_with_photos_uploaded}/${exec.items_with_required_photos}`
      : "N/A"
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths
  const colWidths = [
    { wch: 30 }, // Checklist
    { wch: 25 }, // Executado por
    { wch: 12 }, // Data
    { wch: 10 }, // Horário
    { wch: 12 }, // Total de Itens
    { wch: 10 }, // Itens OK
    { wch: 12 }, // Itens NOK
    { wch: 15 }, // % Conformidade
    { wch: 15 }, // Todas as Fotos
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `relatorio-${format(date, "yyyy-MM-dd")}.xlsx`);
};

export const exportToPDF = (executions: ChecklistExecution[], date: Date) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text('Relatório de Checklists', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Data: ${format(date, "dd/MM/yyyy", { locale: ptBR })}`, 14, 28);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 34);

  // Table data
  const tableData = executions.map(exec => [
    exec.checklist_type_name,
    exec.user_name,
    exec.completed_at ? format(new Date(exec.completed_at), "HH:mm", { locale: ptBR }) : "-",
    exec.items_ok.toString(),
    exec.items_nok.toString(),
    Math.round((exec.items_ok / exec.items_total) * 100) + "%",
    exec.items_with_required_photos > 0 
      ? `${exec.items_with_photos_uploaded}/${exec.items_with_required_photos}`
      : "N/A"
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Checklist', 'Executado por', 'Horário', 'OK', 'NOK', '% Conf.', 'Fotos']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { cellWidth: 20 },
      3: { cellWidth: 15 },
      4: { cellWidth: 15 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
    }
  });

  doc.save(`relatorio-${format(date, "yyyy-MM-dd")}.pdf`);
};

export const exportToCSV = (executions: ChecklistExecution[], date: Date) => {
  const headers = [
    "Checklist",
    "Executado por",
    "Data",
    "Horário",
    "Total de Itens",
    "Itens OK",
    "Itens NOK",
    "% Conformidade",
    "Fotos"
  ];

  const rows = executions.map(exec => [
    exec.checklist_type_name,
    exec.user_name,
    format(new Date(exec.data), "dd/MM/yyyy", { locale: ptBR }),
    exec.completed_at ? format(new Date(exec.completed_at), "HH:mm", { locale: ptBR }) : "-",
    exec.items_total.toString(),
    exec.items_ok.toString(),
    exec.items_nok.toString(),
    Math.round((exec.items_ok / exec.items_total) * 100) + "%",
    exec.items_with_required_photos > 0 
      ? `${exec.items_with_photos_uploaded}/${exec.items_with_required_photos}`
      : "N/A"
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map(row => row.join(";"))
  ].join("\n");

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `relatorio-${format(date, "yyyy-MM-dd")}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface ChecklistType {
  id: string;
  nome: string;
  area: string;
  turno: string;
}

interface ChecklistItem {
  id: string;
  checklist_type_id: string;
  nome: string;
  ordem: number;
  requer_observacao: boolean;
  observacao_obrigatoria: boolean;
  requer_foto: boolean;
}

export const exportChecklistsToExcel = (
  checklists: ChecklistType[],
  items: ChecklistItem[],
  storeName: string
) => {
  const exportData: any[] = [];

  // Agrupar itens por checklist
  checklists.forEach(checklist => {
    const checklistItems = items
      .filter(item => item.checklist_type_id === checklist.id)
      .sort((a, b) => a.ordem - b.ordem);

    checklistItems.forEach(item => {
      exportData.push({
        'Nome do Item': item.nome,
        'Checklist': checklist.nome,
        'Ordem': item.ordem,
        'Requer Observação': item.requer_observacao ? 'Sim' : 'Não',
        'Observação Obrigatória': item.observacao_obrigatoria ? 'Sim' : 'Não',
        'Requer Foto': item.requer_foto ? 'Sim' : 'Não',
        'Área': checklist.area,
        'Turno': checklist.turno,
      });
    });
  });

  // Criar planilha com dados
  const ws = XLSX.utils.json_to_sheet(exportData);

  // Configurar largura das colunas
  ws['!cols'] = [
    { wch: 50 }, // Nome do Item
    { wch: 30 }, // Checklist
    { wch: 8 },  // Ordem
    { wch: 20 }, // Requer Observação
    { wch: 25 }, // Observação Obrigatória
    { wch: 15 }, // Requer Foto
    { wch: 15 }, // Área
    { wch: 15 }, // Turno
  ];

  // Criar workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checklists');

  // Adicionar sheet de instruções
  const instructionsData = [
    ['CHECKLISTS EXPORTADOS'],
    [''],
    ['Loja: ' + storeName],
    ['Data de Exportação: ' + format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })],
    [''],
    ['INSTRUÇÕES:'],
    ['- Esta planilha contém todos os checklists e itens cadastrados'],
    ['- Você pode editar os valores e reimportar usando o botão "Importar Planilha"'],
    ['- Mantenha as colunas: Nome do Item, Checklist, Ordem'],
    ['- Valores booleanos: Sim/Não, True/False, 1/0'],
    [''],
    ['Total de Checklists: ' + checklists.length],
    ['Total de Itens: ' + items.length],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');

  // Salvar arquivo
  const fileName = `checklists-${storeName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
