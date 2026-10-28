/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Modelos de Cálculo de Tempo de Produção
export type TimeCalculationModel = 
  | 'MODELO_A' // Preparação + Velocidade (peças/hora)
  | 'MODELO_B' // Tempo por Lote
  | 'MODELO_C'; // Tempo por Unidade (segundos/peça)

export type TimeUnit = 'SEGUNDOS' | 'MINUTOS' | 'HORAS';

export type TaskSector = 
  | 'Pre-Impressao' 
  | 'Impressao' 
  | 'Acabamento' 
  | 'Montagem' 
  | 'Logistica';

export const SECTOR_LABELS: Record<TaskSector, string> = {
  'Pre-Impressao': 'Pré-Impressão',
  'Impressao': 'Impressão',
  'Acabamento': 'Acabamento & Corte',
  'Montagem': 'Montagem & Colagem',
  'Logistica': 'Logística & Expedição',
};

export type OperationStatus = 
  | 'NAO_INICIADA'
  | 'EM_ANDAMENTO'
  | 'PARCIALMENTE_REALIZADA'
  | 'CONCLUIDA';

export const OPERATION_STATUS_LABELS: Record<OperationStatus, string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  PARCIALMENTE_REALIZADA: 'Parcialmente realizada',
  CONCLUIDA: 'Concluída',
};

export type ProductStatus = 
  | 'RASCUNHO'
  | 'APROVADO'
  | 'EM_PRODUCAO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  RASCUNHO: 'Rascunho',
  APROVADO: 'Orçamento Aprovado',
  EM_PRODUCAO: 'Em Produção',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

// ==========================================
// UNIDADE DE COBRANÇA DE TAREFAS / MÁQUINAS
// ==========================================
export type BillingUnitType = 'HORA' | 'MILHEIRO';

export const BILLING_UNIT_LABELS: Record<BillingUnitType, string> = {
  HORA: 'Preço por Hora (R$/h)',
  MILHEIRO: 'Preço por Milheiro (R$/1.000 un)',
};

// ==========================================
// CADASTRO BÁSICO: MÁQUINAS
// ==========================================
export interface Machine {
  id: string;
  nome: string; // Ex: Guilhotina Polar 115, Heidelberg SM 74
  tipoCobranca?: BillingUnitType; // 'HORA' (padrão) ou 'MILHEIRO'
  custoHora: number; // Ex: 182.54 R$/hora
  custoMilheiro?: number; // Ex: 50.00 R$ a cada 1.000 unidades
  descricao?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// CADASTRO BÁSICO: MATÉRIAS-PRIMAS (INSUMOS)
// ==========================================
export interface RawMaterial {
  id: string;
  nome: string; // Ex: Papel Couché 150g, Tinta CMYK, Cola Hotmelt
  unidade: string; // Ex: kg, folha, unidade, m², litro, bobina
  custoUnitario: number; // Ex: R$ 0,42 / folha
  descricao?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Cadastro Central de Tarefa Padrão
export interface StandardTask {
  id: string;
  code: string; // Ex: IMP-01, CRT-01
  name: string;
  description?: string;
  sector: TaskSector;
  machineId?: string; // Vínculo com a máquina cadastrada
  machine?: string; // Nome da máquina (ex: Heidelberg Speedmaster, Polar 115)
  productionUnit: string; // Ex: Folha, Unidade, Milheiro, Caderno
  
  // Unidade de Cobrança da Tarefa
  billingUnit?: BillingUnitType; // 'HORA' ou 'MILHEIRO'
  costPerThousand?: number; // R$ cobrado a cada 1.000 unidades produzidas

  // Parâmetros de Tempo
  timeModel: TimeCalculationModel;
  setupTimeSeconds: number; // Tempo de preparação em segundos
  speedPerHour?: number; // Para MODELO_A: Peças processadas por hora
  batchSize?: number; // Para MODELO_B: Tamanho de cada lote
  batchTimeSeconds?: number; // Para MODELO_B: Tempo para cada lote em segundos
  unitTimeSeconds?: number; // Para MODELO_C: Tempo em segundos por unidade
  
  // Custos Padrão (armazenados em Reais)
  hourlyLaborRate: number; // Custo R$/hora de mão de obra
  hourlyMachineRate: number; // Custo R$/hora de máquina (buscado da máquina vinculada)
  
  // Materiais e Insumos Padrão
  materialName?: string;
  materialUnit?: string;
  materialCostPerUnit?: number; // Custo por unidade produzida ou por lote
  materialApplication: 'POR_UNIDADE' | 'POR_LOTE' | 'FIXO';
  
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Operação orçada dentro de um Produto
export interface ProductOperation {
  id: string; // Identificador único da operação no produto
  taskId: string; // Referência à tarefa padrão original
  order: number; // Ordem da sequência produtiva (1, 2, 3...)
  code: string;
  name: string;
  sector: TaskSector;
  machine?: string;
  productionUnit: string;

  // Unidade de Cobrança da Operação
  billingUnit?: BillingUnitType; // 'HORA' ou 'MILHEIRO'
  costPerThousand?: number; // R$ por milheiro
  
  // Parâmetros desta operação específica (podem ser ajustados no produto)
  timeModel: TimeCalculationModel;
  setupTimeSeconds: number;
  speedPerHour?: number;
  batchSize?: number;
  batchTimeSeconds?: number;
  unitTimeSeconds?: number;
  
  // Quantidade a ser processada nesta etapa (ex: 10.500 folhas para gerar 10.000 caixas)
  plannedQuantity: number;
  
  // Custos por hora e materiais específicos desta operação
  hourlyLaborRate: number;
  hourlyMachineRate: number;
  laborConcurrencyMultiplier: number;
  machineConcurrencyMultiplier: number;
  
  materialName?: string;
  materialUnit?: string;
  materialCostPerUnit?: number;
  materialApplication: 'POR_UNIDADE' | 'POR_LOTE' | 'FIXO';
  materialPlannedCost: number; // Custo total previsto de materiais
  
  // Tempos calculados previstos (armazenados para garantir congelamento histórico)
  plannedSetupSeconds: number;
  plannedProductionSeconds: number;
  plannedTotalSeconds: number;
  plannedLaborHours: number;
  plannedMachineHours: number;
  
  // Custos calculados previstos
  plannedLaborCost: number;
  plannedMachineCost: number;
  plannedTotalCost: number;
  plannedUnitCost: number; // Custo previsto desta operação dividido pela quantidade final do produto
  
  notes?: string;
}

// Histórico de Apontamentos Reais (Chão de fábrica)
export interface ProductionLog {
  id: string;
  productId: string;
  operationId: string; // ID da operação dentro do produto
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  shift?: string;
  operatorName?: string;
  
  quantityProcessed: number;
  quantityApproved: number;
  quantityScrapped: number;
  
  actualSetupSeconds: number;
  actualProductionSeconds: number;
  actualLaborHours: number;
  actualMachineHours: number;
  
  actualHourlyLaborRate: number;
  actualHourlyMachineRate: number;
  
  actualMaterialCost: number;
  materialNotes?: string;
  
  actualLaborCost: number;
  actualMachineCost: number;
  actualTotalCost: number;
  
  notes?: string;
  deviationReason?: string;
  
  cancelled: boolean;
  cancelledAt?: string;
  cancelledReason?: string;
  
  createdAt: string;
}

// ==========================================
// ESTRUTURA DO ORÇAMENTO: MATÉRIA-PRIMA (BLOCO A)
// ==========================================
export interface ProductMaterialItem {
  id: string;
  materialId?: string; // ID no catálogo de matérias-primas
  nome: string;
  unidade: string; // kg, folha, unidade, etc.
  quantidade: number;
  custoUnitario: number; // R$ por unidade
  totalCusto: number; // quantidade * custoUnitario

  // Realizado efetivo (para comparativo de consumo)
  quantidadeReal?: number;
  custoUnitarioReal?: number;
  totalCustoReal?: number;
}

// ==========================================
// ESTRUTURA DO ORÇAMENTO: PRECIFICAÇÃO (BLOCOS B E C)
// ==========================================
export interface ProductPricing {
  // Bloco B: Tributações e Encargos 'Por Dentro'
  profitMarginPercent: number; // % Margem de Lucro (ex: 20)
  commissionPercent: number; // % Comissão (ex: 5)
  taxPercent: number; // % Imposto (ex: 8.5)
  interestPercent: number; // % Juros (ex: 2.5)

  // Bloco C: Impostos Adicionais e Valor Final ('Por Fora')
  additionalExpenses: number; // Despesas Adicionais em R$ (ex: 150)
  ipiPercent: number; // % IPI (ex: 3.25)
  icmsStPercent: number; // % ICMS ST (ex: 0)
}

export const DEFAULT_PRODUCT_PRICING: ProductPricing = {
  profitMarginPercent: 20,
  commissionPercent: 5,
  taxPercent: 8.5,
  interestPercent: 2.0,
  additionalExpenses: 0,
  ipiPercent: 0,
  icmsStPercent: 0,
};

// Versão de Orçamento Congelada / Aprovada
export interface BudgetRevision {
  revisionNumber: number;
  approvedAt: string;
  approvedBy?: string;
  notes?: string;
  productQuantity: number;
  operations: ProductOperation[];
  materials?: ProductMaterialItem[]; // Insumos do Bloco A
  pricing?: ProductPricing; // Parâmetros dos Blocos B e C
  
  // Totais orçados consolidados
  totalSetupSeconds: number;
  totalProductionSeconds: number;
  totalTimeSeconds: number;
  totalLaborHours: number;
  totalMachineHours: number;
  totalLaborCost: number;
  totalMachineCost: number;
  totalMaterialCost: number; // Total de materiais (avulsos da operação ou do Bloco A)
  totalTasksCost: number; // Total das tarefas/processos
  totalCost: number; // CUSTO TOTAL (Matéria Prima + Tarefas)
  unitCost: number;

  // Bloco B & C calculados
  markupValue?: number; // Custo Total / (1 - Soma Índices)
  profitMarginValue?: number;
  commissionValue?: number;
  taxValue?: number;
  interestValue?: number;
  ipiValue?: number;
  icmsStValue?: number;
  finalTotal?: number; // Preço Final de Venda
  finalUnitCost?: number; // Preço Final por Peça
}

// Produto / Serviço Gráfico
export interface Product {
  id: string;
  code: string;
  name: string;
  client?: string;
  description?: string;
  quantity: number;
  productionUnit: string;
  budgetDate: string;
  deadlineDate?: string;
  notes?: string;
  status: ProductStatus;
  
  currentRevisionNumber: number;
  revisions: BudgetRevision[];
  
  draftOperations: ProductOperation[];
  materials?: ProductMaterialItem[]; // Matérias-Primas do Bloco A
  pricing?: ProductPricing; // Formação de Preço (Blocos B e C)
  activeRevision?: BudgetRevision;
  actualRecord?: ActualRecord; // Apontamento Realizado em Layout Espelho
  
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// APONTAMENTO REALIZADO (LAYOUT ESPELHO)
// ==========================================
export interface ActualMaterialItem {
  id: string; // ID da linha
  materialItemId?: string; // Vínculo com ProductMaterialItem
  nome: string;
  unidade: string;
  quantidadeOrçada: number;
  custoUnitarioOrçado: number;
  totalCustoOrçado: number;
  
  // Realizado
  quantidadeReal: number;
  custoUnitarioReal: number;
  totalCustoReal: number; // quantidadeReal * custoUnitarioReal
}

export interface ActualTaskItem {
  id: string;
  operationId: string;
  order: number;
  code: string;
  name: string;
  machine?: string;
  hourlyMachineRate: number; // Valor Hora da máquina
  hourlyLaborRate: number;
  
  // Orçado
  tempoAcertoOrçadoHoras: number;
  tempoProdutivoOrçadoHoras: number;
  tempoTotalOrçadoHoras: number;
  totalCostOrçado: number;
  
  // Realizado
  tempoAcertoRealHoras: number;
  tempoProdutivoRealHoras: number;
  tempoTotalRealHoras: number; // tempoAcertoRealHoras + tempoProdutivoRealHoras
  totalCostReal: number; // tempoTotalRealHoras * hourlyMachineRate
}

export interface ActualExtraItem {
  despesasAdicionaisOrçadas: number;
  despesasAdicionaisReal: number;
  transporteOrçado: number;
  transporteReal: number;
  totalExtrasOrçado: number;
  totalExtrasReal: number;
}

export interface ActualRecord {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  revisionNumber?: number;
  date: string; // Data do apontamento YYYY-MM-DD
  notes?: string;

  // Bloco A - Matérias-Primas Espelhadas
  materials: ActualMaterialItem[];
  totalMateriaisOrçado: number;
  totalMateriaisReal: number;

  // Bloco A - Tarefas Espelhadas
  tasks: ActualTaskItem[];
  totalTarefasOrçado: number;
  totalTarefasReal: number;

  // Custos Extras / Despesas Adicionais Espelhadas
  extras: ActualExtraItem;

  // Quantidade Orçada vs Quantidade Realmente Entregue ao Cliente (Pós-Cálculo de Volume)
  quantidadeOrçada?: number;
  quantidadeEntregue?: number;
  custoUnitarioOrçado?: number;
  custoUnitarioReal?: number;
  variacaoQuantidade?: number;
  variacaoQuantidadePercent?: number | null;

  // Totais Consolidados (Matérias-Primas + Tarefas + Extras)
  totalCustoOrçado: number;
  totalCustoReal: number;
  diferencaFinanceira: number; // totalCustoReal - totalCustoOrçado
  variacaoPercentual: number | null;

  // Comparativo de Margem de Lucro (Preço Faturado Fixo)
  markupValue: number;
  finalTotal: number;
  margemOrçadaValor: number;
  margemOrçadaPercent: number;
  margemRealValor: number;
  margemRealPercent: number;
  margemEncolheu: boolean;

  createdAt: string;
  updatedAt: string;
}

// Resultado Comparativo de uma Operação
export interface OperationComparison {
  operationId: string;
  code: string;
  name: string;
  sector: TaskSector;
  machine?: string;
  status: OperationStatus;
  isPending: boolean;
  
  plannedQuantity: number;
  actualQuantityProcessed: number;
  actualQuantityApproved: number;
  actualQuantityScrapped: number;
  quantityDifference: number;
  quantityDifferencePercent: number | null;
  
  plannedSetupSeconds: number;
  actualSetupSeconds: number;
  plannedProductionSeconds: number;
  actualProductionSeconds: number;
  plannedTotalSeconds: number;
  actualTotalSeconds: number;
  timeDifferenceSeconds: number;
  timeVariancePercent: number | null;
  
  plannedLaborHours: number;
  actualLaborHours: number;
  laborHoursDiff: number;
  
  plannedMachineHours: number;
  actualMachineHours: number;
  machineHoursDiff: number;
  
  plannedLaborCost: number;
  actualLaborCost: number;
  laborCostDiff: number;
  laborCostVariancePercent: number | null;
  
  plannedMachineCost: number;
  actualMachineCost: number;
  machineCostDiff: number;
  machineCostVariancePercent: number | null;
  
  plannedMaterialCost: number;
  actualMaterialCost: number;
  materialCostDiff: number;
  materialCostVariancePercent: number | null;
  
  plannedTotalCost: number;
  actualTotalCost: number;
  financialDifference: number;
  financialVariancePercent: number | null;
  
  plannedUnitCost: number;
  actualUnitCost: number | null;
  
  deviationReasons: string[];
  logsCount: number;
  logs: ProductionLog[];
}

// Resumo Comparativo Consolidado do Produto (incluindo Impacto na Margem)
export interface ProductComparisonSummary {
  productId: string;
  productCode: string;
  productName: string;
  client?: string;
  status: ProductStatus;
  
  plannedQuantity: number;
  deliveredQuantity: number; // Quantidade realmente entregue ao cliente (Pós-Cálculo de Volume)
  quantityVariance: number; // deliveredQuantity - plannedQuantity (ex: +500)
  quantityVariancePercent: number | null; // ex: +1.25%
  actualQuantityProcessed: number;
  actualQuantityApproved: number;
  actualQuantityScrapped: number;
  
  // Custos Bloco A
  plannedMaterialsCost: number;
  actualMaterialsCost: number;
  plannedTasksCost: number;
  actualTasksCost: number;

  plannedTotalCost: number; // Custo Total Orçado A
  actualTotalCost: number; // Custo Total Real A
  financialDifference: number;
  financialVariancePercent: number | null;
  
  plannedUnitCost: number; // Custo Total Orçado / Quantidade Orçada
  actualUnitCost: number | null; // Custo Total Real / Quantidade Entregue
  unitCostVariance: number; // actualUnitCost - plannedUnitCost
  unitCostVariancePercent: number | null;

  // Análise de Variação de Produção (Diluição / Concentração de Custos e Reflexo na Margem)
  productionVolumeAnalysis: {
    tipo: 'EXCEDENTE' | 'DEFASAGEM' | 'EXATO';
    titulo: string;
    descricao: string;
    diluicao: string;
    impactoMargem: string;
  };
  
  plannedTotalSeconds: number;
  actualTotalSeconds: number;
  timeDifferenceSeconds: number;
  timeVariancePercent: number | null;
  
  plannedLaborHours: number;
  actualLaborHours: number;
  
  plannedMachineHours: number;
  actualMachineHours: number;
  
  plannedLaborCost: number;
  actualLaborCost: number;
  plannedMachineCost: number;
  actualMachineCost: number;
  plannedMaterialCost: number;
  actualMaterialCost: number;
  
  totalCostOverruns: number;
  totalCostSavings: number;
  netVariance: number;
  
  // Zona de Impacto na Margem de Lucro (Requisito de Precificação)
  markupValue: number; // Faturado fixo
  plannedProfitMarginValue: number; // Margem Orçada em R$
  plannedProfitMarginPercent: number; // Margem Orçada em %
  actualProfitMarginValue: number; // Margem Real em R$ (Markup - Impostos Fixos - Comissões Fixas - Juros Fixos - Custo Real)
  actualProfitMarginPercent: number; // Margem Real em %
  profitMarginDiff: number; // Variação da margem em R$
  profitMarginPercentDiff: number; // Variação em pontos percentuais
  profitMarginShrunk: boolean; // True se a margem encolheu (Custo Real > Custo Orçado)
  finalTotal: number; // Valor Total Faturado

  operations: OperationComparison[];
  materials: ProductMaterialItem[];
  
  totalOperations: number;
  completedOperations: number;
  inProgressOperations: number;
  pendingOperations: number;
}
