import * as XLSX from 'xlsx';
import { z } from 'zod';

export interface ImportRow {
  nome: string;
  checklist_nome: string;
  ordem?: number;
  requer_observacao?: boolean;
  observacao_obrigatoria?: boolean;
  requer_foto?: boolean;
}

export interface ValidationResult {
  row: number;
  data: ImportRow;
  status: 'valid' | 'error' | 'warning';
  message?: string;
}

const booleanSchema = z.union([
  z.boolean(),
  z.string().transform((val) => {
    const normalized = val.toLowerCase().trim();
    if (['sim', 'true', '1', 's', 'verdadeiro'].includes(normalized)) return true;
    if (['não', 'nao', 'false', '0', 'n', 'falso'].includes(normalized)) return false;
    throw new Error('Valor booleano inválido');
  }),
  z.number().transform((val) => val === 1)
]);

const rowSchema = z.object({
  nome: z.string().trim().min(1, 'Nome não pode estar vazio').max(200, 'Nome muito longo (máx 200 caracteres)'),
  checklist_nome: z.string().trim().min(1, 'Nome do checklist é obrigatório'),
  ordem: z.union([z.number().positive(), z.string().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const num = parseInt(val);
    if (isNaN(num) || num <= 0) throw new Error('Ordem deve ser um número positivo');
    return num;
  })]).optional(),
  requer_observacao: booleanSchema.optional().default(false),
  observacao_obrigatoria: booleanSchema.optional().default(false),
  requer_foto: booleanSchema.optional().default(false),
});

export const parseExcelFile = (file: File): Promise<ImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet) as any[];
        
        if (rows.length === 0) {
          reject(new Error('A planilha está vazia'));
          return;
        }
        
        resolve(rows);
      } catch (error) {
        reject(new Error('Erro ao ler o arquivo Excel'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    reader.readAsBinaryString(file);
  });
};

export const validateRow = (row: any, rowNumber: number): ValidationResult => {
  try {
    const validatedData = rowSchema.parse(row);
    
    // Warning if order is missing
    if (!validatedData.ordem) {
      return {
        row: rowNumber,
        data: validatedData as ImportRow,
        status: 'warning',
        message: 'Ordem não informada (será calculada automaticamente)'
      };
    }
    
    return {
      row: rowNumber,
      data: validatedData as ImportRow,
      status: 'valid'
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        row: rowNumber,
        data: row as ImportRow,
        status: 'error',
        message: firstError.message
      };
    }
    
    return {
      row: rowNumber,
      data: row as ImportRow,
      status: 'error',
      message: 'Erro de validação'
    };
  }
};

export const generateTemplate = (checklists: Array<{ nome: string }>) => {
  const wb = XLSX.utils.book_new();
  
  // Instructions sheet
  const instructions = [
    ['INSTRUÇÕES PARA IMPORTAÇÃO DE ITENS'],
    [''],
    ['COLUNAS OBRIGATÓRIAS:'],
    ['- nome: Nome do item (máx 200 caracteres)'],
    ['- checklist_nome: Nome exato do checklist (copie da lista abaixo)'],
    [''],
    ['COLUNAS OPCIONAIS:'],
    ['- ordem: Número inteiro positivo (se vazio, será calculado automaticamente)'],
    ['- requer_observacao: sim/não, true/false, 1/0'],
    ['- observacao_obrigatoria: sim/não, true/false, 1/0'],
    ['- requer_foto: sim/não, true/false, 1/0'],
    [''],
    ['IMPORTANTE:'],
    ['- Use o nome EXATO do checklist (copie da aba "Seus Checklists")'],
    ['- Itens duplicados no mesmo checklist serão bloqueados'],
    ['- Salve como .xlsx (Excel)'],
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');
  
  // Template sheet with examples
  const template = [
    ['nome', 'checklist_nome', 'ordem', 'requer_observacao', 'observacao_obrigatoria', 'requer_foto'],
    ['Verificar temperatura da geladeira', 'Abertura - Cozinha', 10, 'sim', 'não', 'sim'],
    ['Verificar validade dos alimentos', 'Abertura - Cozinha', 20, 'sim', 'sim', 'não'],
    ['Limpar equipamentos', 'Abertura - Cozinha', 30, 'não', 'não', 'não'],
  ];
  
  const wsTemplate = XLSX.utils.aoa_to_sheet(template);
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template');
  
  // Checklists list sheet
  const checklistsData = [
    ['SEUS CHECKLISTS DISPONÍVEIS'],
    ['Copie o nome exato para usar na planilha'],
    [''],
    ...checklists.map(c => [c.nome])
  ];
  
  const wsChecklists = XLSX.utils.aoa_to_sheet(checklistsData);
  XLSX.utils.book_append_sheet(wb, wsChecklists, 'Seus Checklists');
  
  return wb;
};

export const downloadTemplate = (checklists: Array<{ nome: string }>) => {
  const wb = generateTemplate(checklists);
  XLSX.writeFile(wb, 'template_importacao_itens.xlsx');
};

export const exportErrorReport = (errors: ValidationResult[]) => {
  const errorData = [
    ['Linha', 'Nome', 'Checklist', 'Status', 'Erro'],
    ...errors.map(e => [
      e.row,
      e.data.nome || '',
      e.data.checklist_nome || '',
      e.status === 'error' ? 'ERRO' : 'AVISO',
      e.message || ''
    ])
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(errorData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Erros');
  XLSX.writeFile(wb, 'relatorio_erros_importacao.xlsx');
};
