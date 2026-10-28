/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product, ProductComparisonSummary } from '../../types';
import {
  formatBRL,
  formatBRLUnit,
  formatPercent,
  formatSecondsToTime,
} from '../../services/calculator';
import { ProductStatusBadge } from '../common/Badge';
import {
  Printer,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  Percent,
} from 'lucide-react';

interface ProductFinalReportProps {
  summary: ProductComparisonSummary;
  product: Product;
  onBack: () => void;
}

export const ProductFinalReport: React.FC<ProductFinalReportProps> = ({
  summary,
  product,
  onBack,
}) => {
  // Identificação diagnóstica
  const operationsOverCost = summary.operations.filter(
    (o) => !o.isPending && o.financialDifference > 0
  );
  const operationsUnderCost = summary.operations.filter(
    (o) => !o.isPending && o.financialDifference < 0
  );

  // Categorias responsáveis pelo desvio
  const categoryDeviations = [
    {
      name: 'Mão de Obra',
      diff: summary.actualLaborCost - summary.plannedLaborCost,
      planned: summary.plannedLaborCost,
      actual: summary.actualLaborCost,
    },
    {
      name: 'Máquina',
      diff: summary.actualMachineCost - summary.plannedMachineCost,
      planned: summary.plannedMachineCost,
      actual: summary.actualMachineCost,
    },
    {
      name: 'Matérias-Primas (Insumos)',
      diff: summary.actualMaterialsCost - summary.plannedMaterialsCost,
      planned: summary.plannedMaterialsCost,
      actual: summary.actualMaterialsCost,
    },
  ];

  // Coleta de justificativas reais cadastradas
  const allReasons: { opName: string; reason: string }[] = [];
  summary.operations.forEach((op) => {
    op.deviationReasons.forEach((r) => {
      allReasons.push({ opName: `${op.code} - ${op.name}`, reason: r });
    });
  });

  return (
    <div className="space-y-6">
      {/* Botões de Ação do Relatório */}
      <div className="flex items-center justify-between no-print bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Análise Cruzada
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Salvar Laudo em PDF
        </button>
      </div>

      {/* DOCUMENTO OFICIAL DO LAUDO EXECUTIVO */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* Cabeçalho do Laudo */}
        <div className="border-b-2 border-[#01B8AA] pb-6 flex justify-between items-start">
          <div className="flex items-start gap-4">
            <img
              src="/assets/aistudio/image_fa3ff075.png"
              alt="Gráfica Marreco"
              className="w-14 h-14 rounded-lg object-contain shadow-xs shrink-0"
            />
            <div>
              <span className="text-[10px] font-bold text-[#01B8AA] uppercase tracking-widest block font-sans">
                gráfica marreco · laudo técnico executivo
              </span>
              <h1 className="text-xl font-bold text-[#374151] mt-0.5">
                Análise Pós-Cálculo: Orçado x Realizado
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Consolidação financeira, operacional e impacto na margem de lucro
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-sm font-bold text-gray-800 block">{product.code}</span>
            <div className="mt-1">
              <ProductStatusBadge status={product.status} />
            </div>
            <span className="text-[11px] text-gray-400 block mt-1">
              Emitido em {new Date().toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Ficha Técnica do Produto */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs">
          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold block">Produto / Serviço</span>
            <span className="font-bold text-gray-800 block mt-0.5">{product.name}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold block">Cliente</span>
            <span className="font-semibold text-gray-700 block mt-0.5">{product.client || 'Não informado'}</span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold block">Tiragem (Orçada → Entregue)</span>
            <span className="font-bold text-gray-800 tabular-nums block mt-0.5 font-mono">
              {product.quantity.toLocaleString('pt-BR')} → {summary.deliveredQuantity.toLocaleString('pt-BR')} {product.productionUnit}
            </span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold block">Custo Unit. (Orçado x Real)</span>
            <span className="font-bold text-gray-800 tabular-nums block mt-0.5 font-mono">
              {formatBRLUnit(summary.plannedUnitCost)} → {summary.actualUnitCost ? formatBRLUnit(summary.actualUnitCost) : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold block">Valor Faturado (Venda)</span>
            <span className="font-bold text-[#00897B] tabular-nums block mt-0.5 font-mono">
              {formatBRL(summary.finalTotal)}
            </span>
          </div>
        </div>

        {/* ANÁLISE DE VOLUME PRODUZIDO E DILUIÇÃO DE CUSTO */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-gray-700">
                Análise de Volume e Pós-Cálculo de Tiragem
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                    ? 'bg-amber-100 text-amber-800'
                    : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {summary.productionVolumeAnalysis.titulo}
              </span>
            </div>
            <span className="font-mono text-gray-500 font-semibold text-[11px]">
              Variação: {summary.quantityVariance > 0 ? `+${summary.quantityVariance.toLocaleString('pt-BR')}` : summary.quantityVariance.toLocaleString('pt-BR')} un ({summary.quantityVariancePercent !== null && summary.quantityVariancePercent > 0 ? '+' : ''}{summary.quantityVariancePercent?.toFixed(2)}%)
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Tiragem Orçada</span>
              <span className="font-bold font-mono text-gray-800 text-sm mt-0.5 block">
                {summary.plannedQuantity.toLocaleString('pt-BR')} {product.productionUnit}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Quantidade Entregue</span>
              <span className="font-bold font-mono text-teal-800 text-sm mt-0.5 block">
                {summary.deliveredQuantity.toLocaleString('pt-BR')} {product.productionUnit}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Custo Unitário Orçado</span>
              <span className="font-bold font-mono text-gray-800 text-sm mt-0.5 block">
                {formatBRLUnit(summary.plannedUnitCost)}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Custo Unitário Real</span>
              <span className={`font-bold font-mono text-sm mt-0.5 block ${summary.unitCostVariance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {summary.actualUnitCost ? formatBRLUnit(summary.actualUnitCost) : 'Pendente'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-gray-600 text-[11px]">
            <p><strong>Diluição de Custos:</strong> {summary.productionVolumeAnalysis.diluicao}</p>
            <p><strong>Reflexo na Margem:</strong> {summary.productionVolumeAnalysis.impactoMargem}</p>
          </div>
        </div>

        {/* 1. IMPACTO NA MARGEM DE LUCRO */}
        <div className={`p-4 rounded-xl border ${summary.profitMarginShrunk ? 'bg-red-50/70 border-red-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {summary.profitMarginShrunk ? (
                <TrendingDown className="w-5 h-5 text-[#EF4444]" />
              ) : (
                <TrendingUp className="w-5 h-5 text-[#10B981]" />
              )}
              <h2 className={`text-sm font-bold uppercase tracking-wider ${summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {summary.profitMarginShrunk ? 'Atenção: Margem de Lucro Real Encolheu' : 'Margem de Lucro Preservada'}
              </h2>
            </div>
            <span className={`text-xs font-bold font-mono ${summary.profitMarginShrunk ? 'text-red-700' : 'text-emerald-700'}`}>
              Impacto: {summary.profitMarginDiff > 0 ? `+${formatBRL(summary.profitMarginDiff)}` : formatBRL(summary.profitMarginDiff)} ({summary.profitMarginPercentDiff > 0 ? '+' : ''}{summary.profitMarginPercentDiff.toFixed(2)} p.p.)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Valor Base (Markup)</span>
              <span className="font-bold font-mono text-gray-800 text-sm mt-0.5 block">{formatBRL(summary.markupValue)}</span>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Margem Orçada</span>
              <span className="font-bold font-mono text-teal-700 text-sm mt-0.5 block">
                {formatBRL(summary.plannedProfitMarginValue)} ({summary.plannedProfitMarginPercent.toFixed(2)}%)
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Margem Realizada</span>
              <span className={`font-black font-mono text-sm mt-0.5 block ${summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {formatBRL(summary.actualProfitMarginValue)} ({summary.actualProfitMarginPercent.toFixed(2)}%)
              </span>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Custo Total Real</span>
              <span className="font-bold font-mono text-gray-800 text-sm mt-0.5 block">{formatBRL(summary.actualTotalCost)}</span>
            </div>
          </div>
        </div>

        {/* 2. RESUMO FINANCEIRO (Requisito 8.1) */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-[#374151] uppercase tracking-wider border-b border-gray-200 pb-1.5">
            2. Resumo Financeiro Consolidado
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs">
              <span className="text-gray-500 block">Custo Total Orçado:</span>
              <span className="text-lg font-bold text-[#374151] tabular-nums font-mono mt-1 block">
                {formatBRL(summary.plannedTotalCost)}
              </span>
              <span className="text-[11px] text-gray-400">
                Unitário: {formatBRLUnit(summary.plannedUnitCost)}
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs">
              <span className="text-gray-500 block">Custo Total Realizado:</span>
              <span className="text-lg font-bold text-[#374151] tabular-nums font-mono mt-1 block">
                {formatBRL(summary.actualTotalCost)}
              </span>
              <span className="text-[11px] text-gray-500">
                Unitário Real: {summary.actualUnitCost ? formatBRLUnit(summary.actualUnitCost) : 'Pendente'}
              </span>
            </div>

            <div className={`p-3 rounded border text-xs ${
              summary.financialDifference > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className={summary.financialDifference > 0 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}>
                Diferença Financeira Líquida:
              </span>
              <span className={`text-lg font-bold tabular-nums font-mono mt-1 block ${
                summary.financialDifference > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
              }`}>
                {summary.financialDifference > 0 ? `+${formatBRL(summary.financialDifference)}` : formatBRL(summary.financialDifference)}
              </span>
              <span className={`text-[11px] font-semibold tabular-nums ${
                summary.financialDifference > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}>
                Variação: {formatPercent(summary.financialVariancePercent)}
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs">
              <span className="text-gray-500 block">Excedentes vs Economias:</span>
              <div className="mt-1 space-y-0.5">
                <span className="text-red-700 font-semibold tabular-nums block">
                  Excesso: +{formatBRL(summary.totalCostOverruns)}
                </span>
                <span className="text-emerald-700 font-semibold tabular-nums block">
                  Economia: -{formatBRL(summary.totalCostSavings)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. RESUMO OPERACIONAL (Requisito 8.2) */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-[#374151] uppercase tracking-wider border-b border-gray-200 pb-1.5">
            3. Resumo Operacional (Tempos e Volumes)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <span className="text-gray-500 block">Tempo Total Previsto:</span>
              <span className="font-bold text-[#374151] text-base tabular-nums mt-0.5 block font-mono">
                {formatSecondsToTime(summary.plannedTotalSeconds)}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <span className="text-gray-500 block">Tempo Total Realizado:</span>
              <span className="font-bold text-[#374151] text-base tabular-nums mt-0.5 block font-mono">
                {formatSecondsToTime(summary.actualTotalSeconds)}
              </span>
              <span className={`text-[11px] font-semibold ${
                summary.timeDifferenceSeconds > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}>
                Dif: {summary.timeDifferenceSeconds > 0 ? `+${formatSecondsToTime(summary.timeDifferenceSeconds)}` : formatSecondsToTime(summary.timeDifferenceSeconds)} ({formatPercent(summary.timeVariancePercent)})
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <span className="text-gray-500 block">Horas de Mão de Obra:</span>
              <span className="font-bold text-[#374151] text-base tabular-nums mt-0.5 block font-mono">
                {summary.actualLaborHours.toFixed(2)}h
              </span>
              <span className="text-[11px] text-gray-400">Previsto: {summary.plannedLaborHours.toFixed(2)}h</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <span className="text-gray-500 block">Horas de Máquina:</span>
              <span className="font-bold text-[#374151] text-base tabular-nums mt-0.5 block font-mono">
                {summary.actualMachineHours.toFixed(2)}h
              </span>
              <span className="text-[11px] text-gray-400">Previsto: {summary.plannedMachineHours.toFixed(2)}h</span>
            </div>
          </div>
        </div>

        {/* 4. DIAGNÓSTICO TÉCNICO E CAUSAL */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#374151] uppercase tracking-wider border-b border-gray-200 pb-1.5">
            4. Diagnóstico e Conclusões
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Operações com Excesso */}
            <div className="p-4 bg-red-50/60 border border-red-200 rounded-lg space-y-2">
              <span className="font-bold text-red-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                Operações com Excesso de Custo / Tempo:
              </span>
              {operationsOverCost.length === 0 ? (
                <p className="text-gray-600 italic">Nenhuma operação extrapolou o custo previsto.</p>
              ) : (
                <ul className="space-y-1.5">
                  {operationsOverCost.map((op) => (
                    <li key={op.operationId} className="flex justify-between items-center bg-white p-2 rounded border border-red-100">
                      <span className="font-medium text-gray-800">
                        {op.code} - {op.name}
                      </span>
                      <span className="font-bold text-[#EF4444] font-mono tabular-nums">
                        +{formatBRL(op.financialDifference)} ({formatPercent(op.financialVariancePercent)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Operações com Economia */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                Operações com Economia em Relação ao Orçamento:
              </span>
              {operationsUnderCost.length === 0 ? (
                <p className="text-gray-600 italic">Nenhuma operação teve custo abaixo do orçado.</p>
              ) : (
                <ul className="space-y-1.5">
                  {operationsUnderCost.map((op) => (
                    <li key={op.operationId} className="flex justify-between items-center bg-white p-2 rounded border border-emerald-100">
                      <span className="font-medium text-gray-800">
                        {op.code} - {op.name}
                      </span>
                      <span className="font-bold text-[#10B981] font-mono tabular-nums">
                        {formatBRL(op.financialDifference)} ({formatPercent(op.financialVariancePercent)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Categorias Responsáveis */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-2">
            <span className="font-bold text-[#374151] block">
              Comportamento por Categoria de Custo:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {categoryDeviations.map((cat) => (
                <div key={cat.name} className="p-2.5 bg-white rounded border border-gray-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-800">{cat.name}</span>
                    <span className={`font-bold font-mono tabular-nums ${
                      cat.diff > 0 ? 'text-[#EF4444]' : cat.diff < 0 ? 'text-[#10B981]' : 'text-gray-500'
                    }`}>
                      {cat.diff > 0 ? `+${formatBRL(cat.diff)}` : formatBRL(cat.diff)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 tabular-nums">
                    Orçado: {formatBRL(cat.planned)} | Real: {formatBRL(cat.actual)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Justificativas Registradas */}
          {allReasons.length > 0 && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-2">
              <span className="font-bold text-amber-950 block">
                Ocorrências Registradas pelos Operadores:
              </span>
              <ul className="space-y-1.5 text-amber-950">
                {allReasons.map((item, idx) => (
                  <li key={idx} className="bg-white/80 p-2 rounded border border-amber-200">
                    <strong>[{item.opName}]:</strong> {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Rodapé do Relatório */}
        <div className="pt-6 border-t border-gray-200 text-xs text-gray-400 flex justify-between items-center">
          <span className="font-sans lowercase font-semibold text-gray-500">gráfica marreco · sistema de custos e produção</span>
          <span>Armazenamento local auditado</span>
        </div>
      </div>
    </div>
  );
};
