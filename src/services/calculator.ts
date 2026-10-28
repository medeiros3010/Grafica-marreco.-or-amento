/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProductOperation,
  ProductionLog,
  StandardTask,
  TimeCalculationModel,
  TimeUnit,
  OperationComparison,
  ProductComparisonSummary,
  Product,
  OperationStatus,
  ProductPricing,
  DEFAULT_PRODUCT_PRICING,
  ProductMaterialItem,
} from '../types';

// ==========================================
// CONVERSÕES E FORMATAÇÃO DE TEMPO
// ==========================================

export function timeUnitToSeconds(value: number, unit: TimeUnit): number {
  if (!value || isNaN(value)) return 0;
  switch (unit) {
    case 'SEGUNDOS':
      return Math.round(value);
    case 'MINUTOS':
      return Math.round(value * 60);
    case 'HORAS':
      return Math.round(value * 3600);
  }
}

export function secondsToHours(seconds: number): number {
  if (!seconds || isNaN(seconds)) return 0;
  return Number((seconds / 3600).toFixed(4));
}

/**
 * Formata segundos no formato legível brasileiro "Xh Ym Zs" ou "Xh Ym"
 */
export function formatSecondsToTime(totalSeconds: number): string {
  if (totalSeconds === 0) return '0 min';
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.round(Math.abs(totalSeconds));

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || (hours > 0 && seconds > 0)) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  const formatted = parts.join(' ');
  return isNegative ? `-${formatted}` : formatted;
}

// ==========================================
// FORMATAÇÃO MONETÁRIA E NUMÉRICA (pt-BR)
// ==========================================

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBRLUnit(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,0000';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, showPlus = true): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const sign = showPlus && value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatNumberBR(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ==========================================
// CÁLCULO DE TEMPOS DA TAREFA / OPERAÇÃO
// ==========================================

export interface CalculatedTimes {
  setupSeconds: number;
  productionSeconds: number;
  totalSeconds: number;
  laborHours: number;
  machineHours: number;
}

export function calculateOperationTimes(params: {
  timeModel: TimeCalculationModel;
  quantity: number;
  setupTimeSeconds: number;
  speedPerHour?: number;
  batchSize?: number;
  batchTimeSeconds?: number;
  unitTimeSeconds?: number;
  laborMultiplier?: number;
  machineMultiplier?: number;
}): CalculatedTimes {
  const {
    timeModel,
    quantity,
    setupTimeSeconds = 0,
    speedPerHour,
    batchSize,
    batchTimeSeconds,
    unitTimeSeconds,
    laborMultiplier = 1,
    machineMultiplier = 1,
  } = params;

  let productionSeconds = 0;
  const validQty = Math.max(0, quantity);

  switch (timeModel) {
    case 'MODELO_A': {
      // Modelo A: Tempo de produção = quantidade / velocidade por hora * 3600
      if (speedPerHour && speedPerHour > 0) {
        productionSeconds = Math.round((validQty / speedPerHour) * 3600);
      }
      break;
    }
    case 'MODELO_B': {
      // Modelo B: Lotes necessários * tempo por lote
      if (batchSize && batchSize > 0 && batchTimeSeconds && batchTimeSeconds > 0) {
        const batches = Math.ceil(validQty / batchSize);
        productionSeconds = Math.round(batches * batchTimeSeconds);
      }
      break;
    }
    case 'MODELO_C': {
      // Modelo C: Quantidade * tempo por unidade
      if (unitTimeSeconds && unitTimeSeconds > 0) {
        productionSeconds = Math.round(validQty * unitTimeSeconds);
      }
      break;
    }
  }

  const setupSeconds = Math.max(0, Math.round(setupTimeSeconds));
  const totalSeconds = setupSeconds + productionSeconds;

  const baseHours = secondsToHours(totalSeconds);
  const laborHours = Number((baseHours * Math.max(0, laborMultiplier)).toFixed(4));
  const machineHours = Number((baseHours * Math.max(0, machineMultiplier)).toFixed(4));

  return {
    setupSeconds,
    productionSeconds,
    totalSeconds,
    laborHours,
    machineHours,
  };
}

// ==========================================
// CÁLCULO DE CUSTOS DA OPERAÇÃO
// ==========================================

export interface CalculatedCosts {
  laborCost: number;
  machineCost: number;
  materialCost: number;
  totalCost: number;
  unitCost: number;
}

export function calculateOperationCosts(params: {
  laborHours: number;
  hourlyLaborRate: number;
  machineHours: number;
  hourlyMachineRate: number;
  quantity: number;
  finalProductQuantity: number;
  materialApplication: 'POR_UNIDADE' | 'POR_LOTE' | 'FIXO';
  materialCostPerUnit?: number;
  batchSize?: number;
}): CalculatedCosts {
  const {
    laborHours,
    hourlyLaborRate,
    machineHours,
    hourlyMachineRate,
    quantity,
    finalProductQuantity,
    materialApplication,
    materialCostPerUnit = 0,
    batchSize = 1,
  } = params;

  // Custo Mão de Obra
  const laborCost = Number((laborHours * (hourlyLaborRate || 0)).toFixed(2));

  // Custo Máquina
  const machineCost = Number((machineHours * (hourlyMachineRate || 0)).toFixed(2));

  // Custo Materiais / Insumos
  let materialCost = 0;
  if (materialCostPerUnit && materialCostPerUnit > 0) {
    if (materialApplication === 'POR_UNIDADE') {
      materialCost = Number((quantity * materialCostPerUnit).toFixed(2));
    } else if (materialApplication === 'POR_LOTE') {
      const batches = Math.ceil(quantity / Math.max(1, batchSize));
      materialCost = Number((batches * materialCostPerUnit).toFixed(2));
    } else {
      materialCost = Number(materialCostPerUnit.toFixed(2));
    }
  }

  const totalCost = Number((laborCost + machineCost + materialCost).toFixed(2));
  const validProductQty = Math.max(1, finalProductQuantity || quantity || 1);
  const unitCost = Number((totalCost / validProductQty).toFixed(4));

  return {
    laborCost,
    machineCost,
    materialCost,
    totalCost,
    unitCost,
  };
}

// ==========================================
// FORMAÇÃO DE PREÇO (BLOCOS B E C): MARKUP POR DENTRO E IMPOSTOS POR FORA
// ==========================================

export interface CalculatedPricing {
  somaIndices: number; // (% Margem + % Comissão + % Imposto + % Juros) / 100
  somaIndicesPercent: number; // soma direta em %
  markupDivisor: number; // 1 - somaIndices
  markupValue: number; // Custo Total / (1 - somaIndices)
  profitMarginPercent: number;
  profitMarginValue: number; // markupValue * (% Margem / 100)
  commissionPercent: number;
  commissionValue: number; // markupValue * (% Comissão / 100)
  taxPercent: number;
  taxValue: number; // markupValue * (% Imposto / 100)
  interestPercent: number;
  interestValue: number; // markupValue * (% Juros / 100)
  additionalExpenses: number;
  ipiPercent: number;
  ipiValue: number; // markupValue * (% IPI / 100)
  icmsStPercent: number;
  icmsStValue: number; // markupValue * (% ICMS ST / 100)
  finalTotal: number; // markupValue + additionalExpenses + ipiValue + icmsStValue
  finalUnitCost: number; // finalTotal / productQuantity
  warning?: string;
}

export function calculateMarkupAndPricing(
  totalCost: number,
  pricing: ProductPricing = DEFAULT_PRODUCT_PRICING,
  productQuantity: number = 1
): CalculatedPricing {
  const profitMarginPercent = Number(pricing.profitMarginPercent) || 0;
  const commissionPercent = Number(pricing.commissionPercent) || 0;
  const taxPercent = Number(pricing.taxPercent) || 0;
  const interestPercent = Number(pricing.interestPercent) || 0;

  const additionalExpenses = Number(pricing.additionalExpenses) || 0;
  const ipiPercent = Number(pricing.ipiPercent) || 0;
  const icmsStPercent = Number(pricing.icmsStPercent) || 0;

  // Soma Índices = (% Margem + % Comissão + % Imposto + % Juros) / 100
  const somaIndicesPercent = profitMarginPercent + commissionPercent + taxPercent + interestPercent;
  const somaIndices = somaIndicesPercent / 100;

  let warning: string | undefined;
  let markupDivisor = 1 - somaIndices;
  if (markupDivisor <= 0.01) {
    markupDivisor = 0.01;
    warning = 'A soma das alíquotas por dentro atinge ou supera 100%. O markup foi ajustado para evitar cálculo infinito.';
  }

  // Valor Markup = Custo Total / (1 - Soma Índices)
  const markupValue = totalCost > 0 ? Number((totalCost / markupDivisor).toFixed(2)) : 0;

  // Linhas calculadas em Reais (R$)
  const profitMarginValue = Number((markupValue * (profitMarginPercent / 100)).toFixed(2));
  const commissionValue = Number((markupValue * (commissionPercent / 100)).toFixed(2));
  const taxValue = Number((markupValue * (taxPercent / 100)).toFixed(2));
  const interestValue = Number((markupValue * (interestPercent / 100)).toFixed(2));

  // Bloco C: Impostos Adicionais ('Por Fora')
  const ipiValue = Number((markupValue * (ipiPercent / 100)).toFixed(2));
  const icmsStValue = Number((markupValue * (icmsStPercent / 100)).toFixed(2));

  // Total Final = Valor Markup + Despesas Adicionais + Valor IPI + Valor ICMS ST
  const finalTotal = Number((markupValue + additionalExpenses + ipiValue + icmsStValue).toFixed(2));
  const validQty = Math.max(1, productQuantity);
  const finalUnitCost = Number((finalTotal / validQty).toFixed(4));

  return {
    somaIndices,
    somaIndicesPercent,
    markupDivisor,
    markupValue,
    profitMarginPercent,
    profitMarginValue,
    commissionPercent,
    commissionValue,
    taxPercent,
    taxValue,
    interestPercent,
    interestValue,
    additionalExpenses,
    ipiPercent,
    ipiValue,
    icmsStPercent,
    icmsStValue,
    finalTotal,
    finalUnitCost,
    warning,
  };
}

// ==========================================
// CLONAGEM DE TAREFA PADRÃO PARA OPERAÇÃO
// ==========================================

export function createOperationFromStandardTask(
  task: StandardTask,
  productQuantity: number,
  order: number,
  customPlannedQuantity?: number
): ProductOperation {
  const plannedQuantity = customPlannedQuantity ?? productQuantity;

  const times = calculateOperationTimes({
    timeModel: task.timeModel,
    quantity: plannedQuantity,
    setupTimeSeconds: task.setupTimeSeconds,
    speedPerHour: task.speedPerHour,
    batchSize: task.batchSize,
    batchTimeSeconds: task.batchTimeSeconds,
    unitTimeSeconds: task.unitTimeSeconds,
    laborMultiplier: 1,
    machineMultiplier: 1,
  });

  const costs = calculateOperationCosts({
    laborHours: times.laborHours,
    hourlyLaborRate: task.hourlyLaborRate,
    machineHours: times.machineHours,
    hourlyMachineRate: task.hourlyMachineRate,
    quantity: plannedQuantity,
    finalProductQuantity: productQuantity,
    materialApplication: task.materialApplication,
    materialCostPerUnit: task.materialCostPerUnit,
    batchSize: task.batchSize,
  });

  return {
    id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    taskId: task.id,
    order,
    code: task.code,
    name: task.name,
    sector: task.sector,
    machine: task.machine,
    productionUnit: task.productionUnit,
    timeModel: task.timeModel,
    setupTimeSeconds: task.setupTimeSeconds,
    speedPerHour: task.speedPerHour,
    batchSize: task.batchSize,
    batchTimeSeconds: task.batchTimeSeconds,
    unitTimeSeconds: task.unitTimeSeconds,
    plannedQuantity,
    hourlyLaborRate: task.hourlyLaborRate,
    hourlyMachineRate: task.hourlyMachineRate,
    laborConcurrencyMultiplier: 1,
    machineConcurrencyMultiplier: 1,
    materialName: task.materialName,
    materialUnit: task.materialUnit,
    materialCostPerUnit: task.materialCostPerUnit,
    materialApplication: task.materialApplication,
    materialPlannedCost: costs.materialCost,
    plannedSetupSeconds: times.setupSeconds,
    plannedProductionSeconds: times.productionSeconds,
    plannedTotalSeconds: times.totalSeconds,
    plannedLaborHours: times.laborHours,
    plannedMachineHours: times.machineHours,
    plannedLaborCost: costs.laborCost,
    plannedMachineCost: costs.machineCost,
    plannedTotalCost: costs.totalCost,
    plannedUnitCost: costs.unitCost,
  };
}

export function recalculateOperation(
  op: ProductOperation,
  productQuantity: number
): ProductOperation {
  const times = calculateOperationTimes({
    timeModel: op.timeModel,
    quantity: op.plannedQuantity,
    setupTimeSeconds: op.setupTimeSeconds,
    speedPerHour: op.speedPerHour,
    batchSize: op.batchSize,
    batchTimeSeconds: op.batchTimeSeconds,
    unitTimeSeconds: op.unitTimeSeconds,
    laborMultiplier: op.laborConcurrencyMultiplier,
    machineMultiplier: op.machineConcurrencyMultiplier,
  });

  const costs = calculateOperationCosts({
    laborHours: times.laborHours,
    hourlyLaborRate: op.hourlyLaborRate,
    machineHours: times.machineHours,
    hourlyMachineRate: op.hourlyMachineRate,
    quantity: op.plannedQuantity,
    finalProductQuantity: productQuantity,
    materialApplication: op.materialApplication,
    materialCostPerUnit: op.materialCostPerUnit,
    batchSize: op.batchSize,
  });

  return {
    ...op,
    materialPlannedCost: costs.materialCost,
    plannedSetupSeconds: times.setupSeconds,
    plannedProductionSeconds: times.productionSeconds,
    plannedTotalSeconds: times.totalSeconds,
    plannedLaborHours: times.laborHours,
    plannedMachineHours: times.machineHours,
    plannedLaborCost: costs.laborCost,
    plannedMachineCost: costs.machineCost,
    plannedTotalCost: costs.totalCost,
    plannedUnitCost: costs.unitCost,
  };
}

// ==========================================
// CÁLCULO DE APONTAMENTOS ACUMULADOS
// ==========================================

export interface OperationAccumulatedActuals {
  logs: ProductionLog[];
  logsCount: number;
  isPending: boolean;
  status: OperationStatus;
  
  actualQuantityProcessed: number;
  actualQuantityApproved: number;
  actualQuantityScrapped: number;
  
  actualSetupSeconds: number;
  actualProductionSeconds: number;
  actualTotalSeconds: number;
  actualLaborHours: number;
  actualMachineHours: number;
  
  actualLaborCost: number;
  actualMachineCost: number;
  actualMaterialCost: number;
  actualTotalCost: number;
  
  deviationReasons: string[];
}

export function computeOperationActuals(
  operationId: string,
  allLogs: ProductionLog[],
  plannedQuantity: number
): OperationAccumulatedActuals {
  // Apenas logs ativos e não cancelados desta operação
  const activeLogs = allLogs.filter(
    (l) => l.operationId === operationId && !l.cancelled
  );

  if (activeLogs.length === 0) {
    return {
      logs: [],
      logsCount: 0,
      isPending: true,
      status: 'NAO_INICIADA',
      actualQuantityProcessed: 0,
      actualQuantityApproved: 0,
      actualQuantityScrapped: 0,
      actualSetupSeconds: 0,
      actualProductionSeconds: 0,
      actualTotalSeconds: 0,
      actualLaborHours: 0,
      actualMachineHours: 0,
      actualLaborCost: 0,
      actualMachineCost: 0,
      actualMaterialCost: 0,
      actualTotalCost: 0,
      deviationReasons: [],
    };
  }

  let actualQuantityProcessed = 0;
  let actualQuantityApproved = 0;
  let actualQuantityScrapped = 0;
  let actualSetupSeconds = 0;
  let actualProductionSeconds = 0;
  let actualLaborHours = 0;
  let actualMachineHours = 0;
  let actualLaborCost = 0;
  let actualMachineCost = 0;
  let actualMaterialCost = 0;
  let actualTotalCost = 0;
  const deviationReasons: string[] = [];

  for (const log of activeLogs) {
    actualQuantityProcessed += log.quantityProcessed || 0;
    actualQuantityApproved += log.quantityApproved || 0;
    actualQuantityScrapped += log.quantityScrapped || 0;

    actualSetupSeconds += log.actualSetupSeconds || 0;
    actualProductionSeconds += log.actualProductionSeconds || 0;

    actualLaborHours += log.actualLaborHours || 0;
    actualMachineHours += log.actualMachineHours || 0;

    actualLaborCost += log.actualLaborCost || 0;
    actualMachineCost += log.actualMachineCost || 0;
    actualMaterialCost += log.actualMaterialCost || 0;
    actualTotalCost += log.actualTotalCost || 0;

    if (log.deviationReason && log.deviationReason.trim().length > 0) {
      if (!deviationReasons.includes(log.deviationReason.trim())) {
        deviationReasons.push(log.deviationReason.trim());
      }
    }
  }

  // Determinar status dinâmico
  let status: OperationStatus = 'EM_ANDAMENTO';
  if (actualQuantityProcessed >= plannedQuantity && plannedQuantity > 0) {
    status = 'CONCLUIDA';
  } else if (actualQuantityProcessed > 0 && actualQuantityProcessed < plannedQuantity) {
    status = 'PARCIALMENTE_REALIZADA';
  }

  const actualTotalSeconds = actualSetupSeconds + actualProductionSeconds;

  return {
    logs: activeLogs,
    logsCount: activeLogs.length,
    isPending: false,
    status,
    actualQuantityProcessed,
    actualQuantityApproved,
    actualQuantityScrapped,
    actualSetupSeconds,
    actualProductionSeconds,
    actualTotalSeconds,
    actualLaborHours: Number(actualLaborHours.toFixed(4)),
    actualMachineHours: Number(actualMachineHours.toFixed(4)),
    actualLaborCost: Number(actualLaborCost.toFixed(2)),
    actualMachineCost: Number(actualMachineCost.toFixed(2)),
    actualMaterialCost: Number(actualMaterialCost.toFixed(2)),
    actualTotalCost: Number(actualTotalCost.toFixed(2)),
    deviationReasons,
  };
}

// ==========================================
// CÁLCULO COMPARATIVO DETALHADO POR OPERAÇÃO
// ==========================================

export function compareOperation(
  op: ProductOperation,
  allLogs: ProductionLog[]
): OperationComparison {
  const actuals = computeOperationActuals(op.id, allLogs, op.plannedQuantity);

  // Diferenças de Quantidade
  const quantityDifference = actuals.actualQuantityProcessed - op.plannedQuantity;
  const quantityDifferencePercent =
    op.plannedQuantity > 0
      ? Number(((quantityDifference / op.plannedQuantity) * 100).toFixed(2))
      : null;

  // Diferenças de Tempo
  const timeDifferenceSeconds = actuals.actualTotalSeconds - op.plannedTotalSeconds;
  const timeVariancePercent =
    op.plannedTotalSeconds > 0
      ? Number(((timeDifferenceSeconds / op.plannedTotalSeconds) * 100).toFixed(2))
      : null;

  const laborHoursDiff = Number((actuals.actualLaborHours - op.plannedLaborHours).toFixed(4));
  const machineHoursDiff = Number((actuals.actualMachineHours - op.plannedMachineHours).toFixed(4));

  // Diferenças Financeiras
  const laborCostDiff = Number((actuals.actualLaborCost - op.plannedLaborCost).toFixed(2));
  const laborCostVariancePercent =
    op.plannedLaborCost > 0
      ? Number(((laborCostDiff / op.plannedLaborCost) * 100).toFixed(2))
      : null;

  const machineCostDiff = Number((actuals.actualMachineCost - op.plannedMachineCost).toFixed(2));
  const machineCostVariancePercent =
    op.plannedMachineCost > 0
      ? Number(((machineCostDiff / op.plannedMachineCost) * 100).toFixed(2))
      : null;

  const materialCostDiff = Number((actuals.actualMaterialCost - op.materialPlannedCost).toFixed(2));
  const materialCostVariancePercent =
    op.materialPlannedCost > 0
      ? Number(((materialCostDiff / op.materialPlannedCost) * 100).toFixed(2))
      : null;

  // Financeiro Total: custo realizado - custo orçado
  // Atenção: se pendente, a diferença financeira é tecnicamente -plannedTotalCost (ainda não gastou)
  const financialDifference = Number(
    (actuals.actualTotalCost - op.plannedTotalCost).toFixed(2)
  );

  const financialVariancePercent =
    op.plannedTotalCost > 0
      ? Number(((financialDifference / op.plannedTotalCost) * 100).toFixed(2))
      : null;

  // Custo Unitário
  const actualUnitCost =
    actuals.actualQuantityProcessed > 0
      ? Number((actuals.actualTotalCost / actuals.actualQuantityProcessed).toFixed(4))
      : null;

  return {
    operationId: op.id,
    code: op.code,
    name: op.name,
    sector: op.sector,
    machine: op.machine,
    status: actuals.status,
    isPending: actuals.isPending,
    plannedQuantity: op.plannedQuantity,
    actualQuantityProcessed: actuals.actualQuantityProcessed,
    actualQuantityApproved: actuals.actualQuantityApproved,
    actualQuantityScrapped: actuals.actualQuantityScrapped,
    quantityDifference,
    quantityDifferencePercent,
    plannedSetupSeconds: op.plannedSetupSeconds,
    actualSetupSeconds: actuals.actualSetupSeconds,
    plannedProductionSeconds: op.plannedProductionSeconds,
    actualProductionSeconds: actuals.actualProductionSeconds,
    plannedTotalSeconds: op.plannedTotalSeconds,
    actualTotalSeconds: actuals.actualTotalSeconds,
    timeDifferenceSeconds,
    timeVariancePercent,
    plannedLaborHours: op.plannedLaborHours,
    actualLaborHours: actuals.actualLaborHours,
    laborHoursDiff,
    plannedMachineHours: op.plannedMachineHours,
    actualMachineHours: actuals.actualMachineHours,
    machineHoursDiff,
    plannedLaborCost: op.plannedLaborCost,
    actualLaborCost: actuals.actualLaborCost,
    laborCostDiff,
    laborCostVariancePercent,
    plannedMachineCost: op.plannedMachineCost,
    actualMachineCost: actuals.actualMachineCost,
    machineCostDiff,
    machineCostVariancePercent,
    plannedMaterialCost: op.materialPlannedCost,
    actualMaterialCost: actuals.actualMaterialCost,
    materialCostDiff,
    materialCostVariancePercent,
    plannedTotalCost: op.plannedTotalCost,
    actualTotalCost: actuals.actualTotalCost,
    financialDifference,
    financialVariancePercent,
    plannedUnitCost: op.plannedUnitCost,
    actualUnitCost,
    deviationReasons: actuals.deviationReasons,
    logsCount: actuals.logsCount,
    logs: actuals.logs,
  };
}

// ==========================================
// CÁLCULO DO RESUMO COMPARATIVO DO PRODUTO
// ==========================================

export function computeProductComparisonSummary(
  product: Product,
  allLogs: ProductionLog[]
): ProductComparisonSummary {
  // Utiliza as operações da revisão ativa aprovada, ou se for rascunho, do draft
  const operationsSource = product.activeRevision?.operations || product.draftOperations || [];
  const actualRecord = product.actualRecord;

  const comparedOps = operationsSource.map((op) => {
    const baseComp = compareOperation(op, allLogs);
    if (actualRecord) {
      const matchTask = actualRecord.tasks.find((t) => t.operationId === op.id || t.code === op.code);
      if (matchTask) {
        const setupSec = Math.round(matchTask.tempoAcertoRealHoras * 3600);
        const prodSec = Math.round(matchTask.tempoProdutivoRealHoras * 3600);
        const totalSec = setupSec + prodSec;
        const taskActualCost = matchTask.totalCostReal;
        const finDiff = Number((taskActualCost - op.plannedTotalCost).toFixed(2));
        const finPct = op.plannedTotalCost > 0 ? Number(((finDiff / op.plannedTotalCost) * 100).toFixed(2)) : null;
        const timeDiff = totalSec - op.plannedTotalSeconds;
        const timePct = op.plannedTotalSeconds > 0 ? Number(((timeDiff / op.plannedTotalSeconds) * 100).toFixed(2)) : null;

        return {
          ...baseComp,
          isPending: false,
          status: 'CONCLUIDA' as const,
          actualSetupSeconds: setupSec,
          actualProductionSeconds: prodSec,
          actualTotalSeconds: totalSec,
          timeDifferenceSeconds: timeDiff,
          timeVariancePercent: timePct,
          actualMachineHours: matchTask.tempoTotalRealHoras,
          actualMachineCost: taskActualCost,
          actualTotalCost: taskActualCost,
          financialDifference: finDiff,
          financialVariancePercent: finPct,
        };
      }
    }
    return baseComp;
  });

  let plannedTotalCost = 0;
  let actualTotalCost = 0;
  let plannedTotalSeconds = 0;
  let actualTotalSeconds = 0;
  let plannedLaborHours = 0;
  let actualLaborHours = 0;
  let plannedMachineHours = 0;
  let actualMachineHours = 0;

  let plannedLaborCost = 0;
  let actualLaborCost = 0;
  let plannedMachineCost = 0;
  let actualMachineCost = 0;
  let plannedMaterialCost = 0;
  let actualMaterialCost = 0;

  let totalCostOverruns = 0;
  let totalCostSavings = 0;

  let completedOperations = 0;
  let inProgressOperations = 0;
  let pendingOperations = 0;

  let actualQuantityProcessed = 0;
  let actualQuantityApproved = 0;
  let actualQuantityScrapped = 0;

  for (const opComp of comparedOps) {
    plannedTotalCost += opComp.plannedTotalCost;
    actualTotalCost += opComp.actualTotalCost;

    plannedTotalSeconds += opComp.plannedTotalSeconds;
    actualTotalSeconds += opComp.actualTotalSeconds;

    plannedLaborHours += opComp.plannedLaborHours;
    actualLaborHours += opComp.actualLaborHours;

    plannedMachineHours += opComp.plannedMachineHours;
    actualMachineHours += opComp.actualMachineHours;

    plannedLaborCost += opComp.plannedLaborCost;
    actualLaborCost += opComp.actualLaborCost;

    plannedMachineCost += opComp.plannedMachineCost;
    actualMachineCost += opComp.actualMachineCost;

    plannedMaterialCost += opComp.plannedMaterialCost;
    actualMaterialCost += opComp.actualMaterialCost;

    // Desvios separados para não esconder nada
    if (!opComp.isPending) {
      if (opComp.financialDifference > 0) {
        totalCostOverruns += opComp.financialDifference;
      } else if (opComp.financialDifference < 0) {
        totalCostSavings += Math.abs(opComp.financialDifference);
      }
    }

    if (opComp.isPending) {
      pendingOperations++;
    } else if (opComp.status === 'CONCLUIDA') {
      completedOperations++;
    } else {
      inProgressOperations++;
    }

    // Acompanhar o maior volume processado (geralmente na última operação ou na principal)
    if (opComp.actualQuantityProcessed > actualQuantityProcessed) {
      actualQuantityProcessed = opComp.actualQuantityProcessed;
      actualQuantityApproved = opComp.actualQuantityApproved;
      actualQuantityScrapped = opComp.actualQuantityScrapped;
    }
  }

  // ==========================================
  // BLOCO A: MATÉRIAS-PRIMAS DO PRODUTO
  // ==========================================
  const productMaterials: ProductMaterialItem[] =
    product.activeRevision?.materials || product.materials || [];

  let blockAMaterialsPlannedCost = 0;
  let blockAMaterialsActualCost = 0;

  for (const mat of productMaterials) {
    blockAMaterialsPlannedCost += mat.totalCusto || 0;
    let matActual = mat.totalCusto;
    if (actualRecord) {
      const matchMat = actualRecord.materials.find(
        (m) => m.materialItemId === mat.id || m.nome.toLowerCase() === mat.nome.toLowerCase()
      );
      if (matchMat) {
        matActual = matchMat.totalCustoReal;
      } else if (mat.totalCustoReal !== undefined) {
        matActual = mat.totalCustoReal;
      }
    } else if (mat.totalCustoReal !== undefined) {
      matActual = mat.totalCustoReal;
    } else if (mat.quantidadeReal !== undefined) {
      matActual = mat.quantidadeReal * (mat.custoUnitarioReal ?? mat.custoUnitario);
    }
    blockAMaterialsActualCost += matActual || 0;
  }

  // Se houver matérias-primas cadastradas no Bloco A, elas somam com os materiais das operações
  const totalPlannedMaterials = Number((plannedMaterialCost + blockAMaterialsPlannedCost).toFixed(2));
  const totalActualMaterials = Number((actualMaterialCost + (blockAMaterialsPlannedCost > 0 ? blockAMaterialsActualCost : 0)).toFixed(2));

  const plannedTasksCost = Number((plannedLaborCost + plannedMachineCost).toFixed(2));
  const actualTasksCost = Number((actualLaborCost + actualMachineCost).toFixed(2));

  // Custo Total Orçado e Realizado considerando Matéria Prima + Tarefas (Bloco A)
  const finalPlannedTotalCost = Number((totalPlannedMaterials + plannedTasksCost).toFixed(2));
  const finalActualTotalCost = Number((totalActualMaterials + actualTasksCost).toFixed(2));

  // Diferença financeira e percentual
  const financialDifference = Number((finalActualTotalCost - finalPlannedTotalCost).toFixed(2));
  const financialVariancePercent =
    finalPlannedTotalCost > 0
      ? Number(((financialDifference / finalPlannedTotalCost) * 100).toFixed(2))
      : null;

  // Diferença de tempo = tempo realizado - tempo previsto
  const timeDifferenceSeconds = actualTotalSeconds - plannedTotalSeconds;
  const timeVariancePercent =
    plannedTotalSeconds > 0
      ? Number(((timeDifferenceSeconds / plannedTotalSeconds) * 100).toFixed(2))
      : null;

  // ==========================================
  // DETERMINAÇÃO DA QUANTIDADE ENTREGUE E CUSTO UNITÁRIO (PÓS-CÁLCULO)
  // ==========================================
  let deliveredQuantity = product.quantity;
  if (actualRecord?.quantidadeEntregue !== undefined && actualRecord.quantidadeEntregue > 0) {
    deliveredQuantity = actualRecord.quantidadeEntregue;
  } else if (actualQuantityApproved > 0) {
    deliveredQuantity = actualQuantityApproved;
  } else if (actualQuantityProcessed > 0) {
    deliveredQuantity = actualQuantityProcessed;
  }

  const quantityVariance = deliveredQuantity - product.quantity;
  const quantityVariancePercent =
    product.quantity > 0
      ? Number(((quantityVariance / product.quantity) * 100).toFixed(2))
      : null;

  const plannedUnitCost =
    product.quantity > 0
      ? Number((finalPlannedTotalCost / product.quantity).toFixed(4))
      : 0;

  // Custo unitário realizado considerando as peças efetivamente entregues ao cliente
  const actualUnitCost =
    deliveredQuantity > 0
      ? Number((finalActualTotalCost / deliveredQuantity).toFixed(4))
      : null;

  const unitCostVariance =
    actualUnitCost !== null ? Number((actualUnitCost - plannedUnitCost).toFixed(4)) : 0;
  const unitCostVariancePercent =
    plannedUnitCost > 0 && actualUnitCost !== null
      ? Number(((unitCostVariance / plannedUnitCost) * 100).toFixed(2))
      : null;

  // ==========================================
  // BLOCOS B E C: PRECIFICAÇÃO E IMPACTO NA MARGEM
  // ==========================================
  const pricingConfig =
    product.activeRevision?.pricing || product.pricing || DEFAULT_PRODUCT_PRICING;

  const plannedPricing = calculateMarkupAndPricing(
    finalPlannedTotalCost,
    pricingConfig,
    product.quantity
  );

  const markupValue = plannedPricing.markupValue;
  const plannedProfitMarginValue = plannedPricing.profitMarginValue;
  const plannedProfitMarginPercent = plannedPricing.profitMarginPercent;

  // Como o produto já foi vendido/faturado pelo Valor Final, os encargos proporcionais (impostos, comissão, juros) são fixos sobre o faturamento faturado
  const fixedTaxesAndCharges = plannedPricing.taxValue + plannedPricing.commissionValue + plannedPricing.interestValue;
  const actualProfitMarginValue = Number((markupValue - fixedTaxesAndCharges - finalActualTotalCost).toFixed(2));
  const actualProfitMarginPercent = markupValue > 0
    ? Number(((actualProfitMarginValue / markupValue) * 100).toFixed(2))
    : 0;

  const profitMarginDiff = Number((actualProfitMarginValue - plannedProfitMarginValue).toFixed(2));
  const profitMarginPercentDiff = Number((actualProfitMarginPercent - plannedProfitMarginPercent).toFixed(2));
  const profitMarginShrunk = actualProfitMarginValue < plannedProfitMarginValue;

  // Diagnóstico de Variação de Produção (Diluição / Concentração de Custos e Reflexo na Margem)
  let productionVolumeAnalysis: ProductComparisonSummary['productionVolumeAnalysis'];
  if (quantityVariance > 0) {
    productionVolumeAnalysis = {
      tipo: 'EXCEDENTE',
      titulo: `Produção Excedente (+${quantityVariance.toLocaleString('pt-BR')} un / +${quantityVariancePercent}%)`,
      descricao: `Foram entregues ${deliveredQuantity.toLocaleString('pt-BR')} unidades ao cliente, superando a tiragem orçada de ${product.quantity.toLocaleString('pt-BR')} unidades.`,
      diluicao: `Houve consumo adicional de matérias-primas e tempo de máquina para produzir as peças sobressalentes. Custo unitário real apurado: ${formatBRLUnit(actualUnitCost || 0)}.`,
      impactoMargem: `Como o valor faturado da OS (${formatBRL(plannedPricing.finalTotal)}) é contratualmente fixo, a gráfica absorveu os custos extras das ${quantityVariance.toLocaleString('pt-BR')} peças excedentes, reduzindo a margem de lucro de ${plannedProfitMarginPercent.toFixed(2)}% para ${actualProfitMarginPercent.toFixed(2)}%.`,
    };
  } else if (quantityVariance < 0) {
    productionVolumeAnalysis = {
      tipo: 'DEFASAGEM',
      titulo: `Produção Abaixo do Orçado (${quantityVariance.toLocaleString('pt-BR')} un / ${quantityVariancePercent}%)`,
      descricao: `A quantidade entregue ao cliente (${deliveredQuantity.toLocaleString('pt-BR')} un) foi inferior à tiragem contratada (${product.quantity.toLocaleString('pt-BR')} un), indicando quebras de tiragem, perdas de acerto ou refugo no chão de fábrica.`,
      diluicao: `Os custos fixos de acerto (setup) e processos foram distribuídos em menos peças boas entregues, concentrando os custos e elevando o custo unitário real para ${formatBRLUnit(actualUnitCost || 0)} (${(unitCostVariancePercent || 0) > 0 ? '+' : ''}${unitCostVariancePercent}% em relação ao orçado).`,
      impactoMargem: `A concentração de custos encareceu cada unidade produzida e corrói a rentabilidade da gráfica caso o cliente não seja faturado pela tiragem integral.`,
    };
  } else {
    productionVolumeAnalysis = {
      tipo: 'EXATO',
      titulo: `Volume Entregue Conforme Orçado (${deliveredQuantity.toLocaleString('pt-BR')} un)`,
      descricao: `A tiragem produzida e entregue foi exatamente de 100% da quantidade orçada pelo cliente.`,
      diluicao: `Não houve diluição ou concentração de custos decorrente de desvio de volume. Custo unitário real: ${formatBRLUnit(actualUnitCost || 0)}.`,
      impactoMargem: `A variação na margem de lucro decorre exclusivamente do rendimento das máquinas e do custo efetivo dos insumos.`,
    };
  }

  return {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    client: product.client,
    status: product.status,
    plannedQuantity: product.quantity,
    deliveredQuantity,
    quantityVariance,
    quantityVariancePercent,
    actualQuantityProcessed,
    actualQuantityApproved,
    actualQuantityScrapped,
    
    // Custos Bloco A
    plannedMaterialsCost: totalPlannedMaterials,
    actualMaterialsCost: totalActualMaterials,
    plannedTasksCost,
    actualTasksCost,
    plannedTotalCost: finalPlannedTotalCost,
    actualTotalCost: finalActualTotalCost,
    financialDifference,
    financialVariancePercent,
    plannedUnitCost,
    actualUnitCost,
    unitCostVariance,
    unitCostVariancePercent,
    productionVolumeAnalysis,

    // Tempos
    plannedTotalSeconds,
    actualTotalSeconds,
    timeDifferenceSeconds,
    timeVariancePercent,
    plannedLaborHours: Number(plannedLaborHours.toFixed(4)),
    actualLaborHours: Number(actualLaborHours.toFixed(4)),
    plannedMachineHours: Number(plannedMachineHours.toFixed(4)),
    actualMachineHours: Number(actualMachineHours.toFixed(4)),
    plannedLaborCost: Number(plannedLaborCost.toFixed(2)),
    actualLaborCost: Number(actualLaborCost.toFixed(2)),
    plannedMachineCost: Number(plannedMachineCost.toFixed(2)),
    actualMachineCost: Number(actualMachineCost.toFixed(2)),
    plannedMaterialCost: totalPlannedMaterials,
    actualMaterialCost: totalActualMaterials,

    // Excedentes e Economias
    totalCostOverruns: Number(totalCostOverruns.toFixed(2)),
    totalCostSavings: Number(totalCostSavings.toFixed(2)),
    netVariance: financialDifference,

    // Zona de Impacto na Margem de Lucro (Precificação)
    markupValue,
    plannedProfitMarginValue,
    plannedProfitMarginPercent,
    actualProfitMarginValue,
    actualProfitMarginPercent,
    profitMarginDiff,
    profitMarginPercentDiff,
    profitMarginShrunk,
    finalTotal: plannedPricing.finalTotal,

    operations: comparedOps,
    materials: productMaterials,
    totalOperations: comparedOps.length,
    completedOperations,
    inProgressOperations,
    pendingOperations,
  };
}
