/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Product,
  ProductionLog,
  ProductMaterialItem,
} from '../../types';
import {
  computeProductComparisonSummary,
  formatBRL,
  formatBRLUnit,
  formatPercent,
  formatSecondsToTime,
} from '../../services/calculator';
import { storage } from '../../services/storage';
import { OperationStatusBadge, ProductStatusBadge } from '../common/Badge';
import { ComparisonCharts } from './ComparisonCharts';
import { ProductFinalReport } from './ProductFinalReport';
import { ActualMaterialModal } from './ActualMaterialModal';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  FileText,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Layers,
  Package,
  Edit2,
  Percent,
  DollarSign,
  Receipt,
  Info,
} from 'lucide-react';

type SortOption = 'EXCESS_COST' | 'VARIANCE_PCT' | 'EXCESS_TIME' | 'ACTUAL_COST' | 'ORDER';

interface ComparisonViewProps {
  products: Product[];
  logs: ProductionLog[];
  selectedProductId?: string;
  onSelectProduct: (id: string) => void;
  onGoToLogs: (productId: string) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  products,
  logs,
  selectedProductId,
  onSelectProduct,
  onGoToLogs,
}) => {
  const activeProductId = selectedProductId || products[0]?.id || '';
  const currentProduct = products.find((p) => p.id === activeProductId);

  const [sortOption, setSortOption] = useState<SortOption>('EXCESS_COST');
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Modal para apontamento real de matéria-prima
  const [isMatModalOpen, setIsMatModalOpen] = useState(false);
  const [selectedMaterialForEdit, setSelectedMaterialForEdit] = useState<ProductMaterialItem | null>(null);

  if (!currentProduct) {
    return (
      <div className="py-16 text-center bg-white border border-gray-200 rounded-xl">
        <BarChart3 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
        <p className="text-sm font-semibold text-[#374151]">Nenhum produto cadastrado</p>
        <p className="text-xs text-gray-400 mt-1">
          Cadastre produtos e orçamentos para gerar comparativos.
        </p>
      </div>
    );
  }

  const summary = computeProductComparisonSummary(currentProduct, logs);

  // Salvar apontamento real de matéria-prima
  const handleSaveActualMaterial = async (updatedItem: ProductMaterialItem) => {
    const isRevision = !!currentProduct.activeRevision;
    let list = isRevision
      ? [...(currentProduct.activeRevision?.materials || currentProduct.materials || [])]
      : [...(currentProduct.materials || [])];

    const idx = list.findIndex((m) => m.id === updatedItem.id);
    if (idx >= 0) {
      list[idx] = updatedItem;
    } else {
      list.push(updatedItem);
    }

    if (isRevision && currentProduct.activeRevision) {
      const updatedRev = {
        ...currentProduct.activeRevision,
        materials: list,
      };
      const updatedProduct: Product = {
        ...currentProduct,
        materials: list,
        activeRevision: updatedRev,
        revisions: currentProduct.revisions.map((r) =>
          r.revisionNumber === updatedRev.revisionNumber ? updatedRev : r
        ),
      };
      await storage.saveProduct(updatedProduct);
    } else {
      const updatedProduct: Product = {
        ...currentProduct,
        materials: list,
      };
      await storage.saveProduct(updatedProduct);
    }

    // Dispara recarregamento
    onSelectProduct(currentProduct.id);
  };

  // Ordenação de operações
  const sortedOperations = [...summary.operations].sort((a, b) => {
    switch (sortOption) {
      case 'EXCESS_COST':
        return b.financialDifference - a.financialDifference;
      case 'VARIANCE_PCT':
        return (b.financialVariancePercent || 0) - (a.financialVariancePercent || 0);
      case 'EXCESS_TIME':
        return b.timeDifferenceSeconds - a.timeDifferenceSeconds;
      case 'ACTUAL_COST':
        return b.actualTotalCost - a.actualTotalCost;
      case 'ORDER':
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* Barra de Seleção de Produto e Ações */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Produto em Análise:
          </label>
          <select
            value={activeProductId}
            onChange={(e) => onSelectProduct(e.target.value)}
            className="w-full md:max-w-md px-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white text-[#374151] focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name} ({p.quantity.toLocaleString('pt-BR')} {p.productionUnit})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <ProductStatusBadge status={currentProduct.status} />
          <button
            onClick={() => onGoToLogs(currentProduct.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
          >
            <Clock className="w-4 h-4 text-[#01B8AA]" />
            Apontamento Espelho
          </button>
          <button
            onClick={() => setShowReport(!showReport)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            {showReport ? 'Ver Grade Comparativa' : 'Relatório Executivo Consolidado'}
          </button>
        </div>
      </div>

      {showReport ? (
        <ProductFinalReport summary={summary} product={currentProduct} onBack={() => setShowReport(false)} />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* ZONA DE COMPARATIVO: IMPACTO NA MARGEM DE LUCRO (REQUISITO FUNDAMENTAL) */}
          {/* ========================================================================= */}
          <div
            className={`p-6 rounded-xl border shadow-sm transition-all ${
              summary.profitMarginShrunk
                ? 'bg-red-50/70 border-red-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/60">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    summary.profitMarginShrunk
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-[#10B981] text-white'
                  }`}
                >
                  {summary.profitMarginShrunk ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <TrendingUp className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-base font-bold ${
                        summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                      }`}
                    >
                      {summary.profitMarginShrunk
                        ? 'Alerta de Impacto: Margem de Lucro Encolheu!'
                        : 'Margem de Lucro Preservada ou Superior'}
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        summary.profitMarginShrunk
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {summary.profitMarginShrunk ? 'Erosão de Lucro' : 'Meta Atingida'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl">
                    O Valor Final de Venda ({formatBRL(summary.finalTotal)}) e o Valor Markup ({formatBRL(summary.markupValue)}) estão fixos e faturados ao cliente. Cada real de desvio de custo na produção é absorvido diretamente pela margem da gráfica.
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Variação da Margem
                </span>
                <span
                  className={`text-2xl font-black font-mono ${
                    summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}
                >
                  {summary.profitMarginDiff > 0
                    ? `+${formatBRL(summary.profitMarginDiff)}`
                    : formatBRL(summary.profitMarginDiff)}
                </span>
                <span
                  className={`text-xs font-bold block ${
                    summary.profitMarginShrunk ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {summary.profitMarginPercentDiff > 0 ? '+' : ''}
                  {summary.profitMarginPercentDiff.toFixed(2)} pontos percentuais
                </span>
              </div>
            </div>

            {/* Grid Comparativo de Margem */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {/* Margem Orçada */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Margem de Lucro Prevista
                </span>
                <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                  {formatBRL(summary.plannedProfitMarginValue)}
                </span>
                <span className="text-xs font-bold text-teal-600 font-mono">
                  {summary.plannedProfitMarginPercent.toFixed(2)}% do Markup
                </span>
              </div>

              {/* Margem Realizada Efetiva */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.profitMarginShrunk
                    ? 'bg-red-50/50 border-red-300'
                    : 'bg-emerald-50/50 border-emerald-300'
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block ${
                    summary.profitMarginShrunk ? 'text-red-700' : 'text-emerald-800'
                  }`}
                >
                  Margem de Lucro Realizada
                </span>
                <span
                  className={`text-xl font-black font-mono block mt-1 ${
                    summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}
                >
                  {formatBRL(summary.actualProfitMarginValue)}
                </span>
                <span
                  className={`text-xs font-bold font-mono ${
                    summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}
                >
                  {summary.actualProfitMarginPercent.toFixed(2)}% do Markup
                </span>
              </div>

              {/* Custo Total Orçado */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Custo Total Previsto (A)
                </span>
                <span className="text-xl font-bold text-gray-700 font-mono block mt-1">
                  {formatBRL(summary.plannedTotalCost)}
                </span>
                <span className="text-[11px] text-gray-400">Insumos + Tarefas</span>
              </div>

              {/* Custo Total Realizado */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.financialDifference > 0
                    ? 'bg-red-50/50 border-red-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider block ${
                    summary.financialDifference > 0 ? 'text-red-700 font-bold' : 'text-gray-400'
                  }`}
                >
                  Custo Total Realizado (A)
                </span>
                <span
                  className={`text-xl font-bold font-mono block mt-1 ${
                    summary.financialDifference > 0 ? 'text-[#EF4444]' : 'text-gray-800'
                  }`}
                >
                  {formatBRL(summary.actualTotalCost)}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    summary.financialDifference > 0 ? 'text-[#EF4444]' : 'text-emerald-700'
                  }`}
                >
                  Desvio: {summary.financialDifference > 0 ? `+${formatBRL(summary.financialDifference)}` : formatBRL(summary.financialDifference)}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD DE ALERTA VISUAL: 'VARIAÇÃO DE PRODUÇÃO & PÓS-CÁLCULO DE VOLUME' */}
          {/* ========================================================================= */}
          <div
            className={`p-6 rounded-xl border shadow-sm transition-all ${
              summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                ? 'bg-amber-50/80 border-amber-200'
                : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200/70">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                    summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                      ? 'bg-amber-500 text-white'
                      : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#01B8AA] text-white'
                  }`}
                >
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-[#374151]">
                      Variação de Produção & Custo Unitário (Pós-Cálculo)
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                        summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                          ? 'bg-amber-200 text-amber-900'
                          : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {summary.productionVolumeAnalysis.titulo}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-3xl">
                    {summary.productionVolumeAnalysis.descricao}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Variação de Tiragem
                </span>
                <span
                  className={`text-2xl font-black font-mono ${
                    summary.quantityVariance > 0
                      ? 'text-amber-700'
                      : summary.quantityVariance < 0
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {summary.quantityVariance > 0
                    ? `+${summary.quantityVariance.toLocaleString('pt-BR')}`
                    : summary.quantityVariance.toLocaleString('pt-BR')}{' '}
                  <span className="text-sm font-bold text-gray-500 uppercase">
                    {currentProduct.productionUnit}
                  </span>
                </span>
                <span className="text-xs font-bold block text-gray-600 font-mono">
                  {summary.quantityVariancePercent !== null && summary.quantityVariancePercent > 0 ? '+' : ''}
                  {summary.quantityVariancePercent !== null ? summary.quantityVariancePercent.toFixed(2) : '0.00'}% da tiragem prevista
                </span>
              </div>
            </div>

            {/* Grid Comparativo dos 4 Indicadores de Volume e Custo Unitário */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              {/* Quantidade Orçada */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Quantidade Orçada
                </span>
                <span className="text-xl font-bold text-gray-800 font-mono block mt-1">
                  {summary.plannedQuantity.toLocaleString('pt-BR')} {currentProduct.productionUnit}
                </span>
                <span className="text-[11px] text-gray-500">Volume acordado na proposta</span>
              </div>

              {/* Quantidade Entregue */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.quantityVariance !== 0
                    ? 'bg-teal-50/60 border-teal-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span className="text-[11px] font-bold text-[#00897B] uppercase tracking-wider block">
                  Quantidade Realmente Entregue
                </span>
                <span className="text-xl font-black text-gray-900 font-mono block mt-1">
                  {summary.deliveredQuantity.toLocaleString('pt-BR')} {currentProduct.productionUnit}
                </span>
                <span className="text-[11px] font-semibold text-teal-800 font-mono">
                  Diferença: {summary.quantityVariance > 0 ? `+${summary.quantityVariance.toLocaleString('pt-BR')}` : summary.quantityVariance.toLocaleString('pt-BR')} un
                </span>
              </div>

              {/* Custo Unitário Orçado */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Custo Unitário Orçado
                </span>
                <span className="text-xl font-bold text-gray-800 font-mono block mt-1">
                  {formatBRLUnit(summary.plannedUnitCost)}
                </span>
                <span className="text-[11px] text-gray-400">
                  Custo Total ({formatBRL(summary.plannedTotalCost)}) / {summary.plannedQuantity.toLocaleString('pt-BR')} un
                </span>
              </div>

              {/* Custo Unitário Realizado */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.unitCostVariance > 0
                    ? 'bg-red-50/60 border-red-200'
                    : summary.unitCostVariance < 0
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block ${
                    summary.unitCostVariance > 0
                      ? 'text-red-700'
                      : summary.unitCostVariance < 0
                      ? 'text-emerald-800'
                      : 'text-gray-500'
                  }`}
                >
                  Custo Unitário Realizado
                </span>
                <span
                  className={`text-xl font-black font-mono block mt-1 ${
                    summary.unitCostVariance > 0
                      ? 'text-[#EF4444]'
                      : summary.unitCostVariance < 0
                      ? 'text-[#10B981]'
                      : 'text-gray-900'
                  }`}
                >
                  {summary.actualUnitCost ? formatBRLUnit(summary.actualUnitCost) : 'Pendente'}
                </span>
                <span className="text-[11px] font-semibold text-gray-600 block">
                  Custo Real ({formatBRL(summary.actualTotalCost)}) / {summary.deliveredQuantity.toLocaleString('pt-BR')} un
                </span>
              </div>
            </div>

            {/* Painel Narrativo: Diagnóstico de Diluição e Reflexo na Margem */}
            <div className="mt-4 pt-4 border-t border-gray-200/70 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white/80 rounded-lg border border-gray-200/80">
                <span className="font-bold text-gray-700 block uppercase text-[10px] tracking-wide mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#01B8AA]" />
                  Diluição / Concentração de Custos
                </span>
                <p className="text-gray-600 leading-relaxed">
                  {summary.productionVolumeAnalysis.diluicao}
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  summary.profitMarginShrunk
                    ? 'bg-red-50/80 border-red-200 text-red-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}
              >
                <span className="font-bold block uppercase text-[10px] tracking-wide mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  Reflexo no Preço Faturado e na Margem Real
                </span>
                <p className="leading-relaxed">
                  {summary.productionVolumeAnalysis.impactoMargem}
                </p>
              </div>
            </div>
          </div>

          {/* Cartões de Indicadores Chave de Desvio */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* 1. Custo Orçado x Realizado */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Custo Orçado Total
              </span>
              <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                {formatBRL(summary.plannedTotalCost)}
              </span>
              <span className="text-[11px] text-gray-400">Previsto em orçamento</span>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Custo Realizado Total
              </span>
              <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                {formatBRL(summary.actualTotalCost)}
              </span>
              <span className="text-[11px] text-gray-500">
                {summary.pendingOperations > 0
                  ? `${summary.pendingOperations} etapa(s) pendente(s)`
                  : 'Todas etapas apontadas'}
              </span>
            </div>

            {/* 2. Saldo Líquido de Desvio */}
            <div
              className={`p-4 rounded-xl border shadow-xs ${
                summary.financialDifference > 0
                  ? 'bg-red-50/70 border-red-200'
                  : summary.financialDifference < 0
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <span className={summary.financialDifference > 0 ? 'text-red-900' : 'text-emerald-900'}>
                  Saldo de Desvio
                </span>
                {summary.financialDifference > 0 ? (
                  <TrendingUp className="w-4 h-4 text-[#EF4444]" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-[#10B981]" />
                )}
              </div>
              <span
                className={`text-xl font-bold font-mono block mt-1 ${
                  summary.financialDifference > 0
                    ? 'text-[#EF4444]'
                    : summary.financialDifference < 0
                    ? 'text-[#10B981]'
                    : 'text-gray-900'
                }`}
              >
                {summary.financialDifference > 0
                  ? `+${formatBRL(summary.financialDifference)}`
                  : formatBRL(summary.financialDifference)}
              </span>
              <span
                className={`text-[11px] font-semibold font-mono ${
                  summary.financialDifference > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {formatPercent(summary.financialVariancePercent)}
              </span>
            </div>

            {/* 3. Desvios Positivos e Economias Separados */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Excedentes e Economias
              </span>
              <div className="mt-1 space-y-0.5 text-xs">
                <div className="text-red-700 font-semibold font-mono">
                  Excedente: +{formatBRL(summary.totalCostOverruns)}
                </div>
                <div className="text-emerald-700 font-semibold font-mono">
                  Economia: -{formatBRL(summary.totalCostSavings)}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 block mt-1">Valores brutos separados</span>
            </div>

            {/* 4. Tempo Previsto x Realizado */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Tempo Total
              </span>
              <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                {formatSecondsToTime(summary.actualTotalSeconds)}
              </span>
              <div className="text-[11px] text-gray-500 font-mono">
                Prev: {formatSecondsToTime(summary.plannedTotalSeconds)}
                <span
                  className={`ml-1 font-semibold ${
                    summary.timeDifferenceSeconds > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  ({formatPercent(summary.timeVariancePercent)})
                </span>
              </div>
            </div>

            {/* 5. Custo por Unidade Entregue */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <span>Custo Unitário Real</span>
                <span className="text-[10px] text-teal-300 font-mono">
                  {summary.deliveredQuantity.toLocaleString('pt-BR')} un
                </span>
              </div>
              <span className="text-xl font-bold text-white font-mono block mt-1">
                {summary.actualUnitCost ? formatBRLUnit(summary.actualUnitCost) : 'Pendente'}
              </span>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mt-0.5">
                <span>Orçado: {formatBRLUnit(summary.plannedUnitCost)}</span>
                <span
                  className={`font-bold ${
                    summary.unitCostVariance > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {summary.unitCostVariance > 0 ? '+' : ''}
                  {summary.unitCostVariancePercent?.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Gráficos Comparativos Orçado x Realizado */}
          <ComparisonCharts summary={summary} />

          {/* ========================================================================= */}
          {/* TABELA COMPARATIVA DE MATÉRIAS-PRIMAS DO BLOCO A */}
          {/* ========================================================================= */}
          {summary.materials.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#01B8AA]" />
                  <h3 className="text-sm font-bold text-[#374151]">
                    Comparativo de Matérias-Primas (Bloco A)
                  </h3>
                </div>
                <div className="text-xs text-gray-500">
                  Total Orçado: <strong className="font-mono text-gray-800">{formatBRL(summary.plannedMaterialsCost)}</strong> · Real: <strong className="font-mono text-gray-800">{formatBRL(summary.actualMaterialsCost)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#374151]">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Insumo</th>
                      <th className="py-2.5 px-4 text-center">Unidade</th>
                      <th className="py-2.5 px-4 text-right">Qtd. Orçada</th>
                      <th className="py-2.5 px-4 text-right">Qtd. Real Consumida</th>
                      <th className="py-2.5 px-4 text-right">Custo Unit. (R$)</th>
                      <th className="py-2.5 px-4 text-right">Custo Orçado</th>
                      <th className="py-2.5 px-4 text-right">Custo Real</th>
                      <th className="py-2.5 px-4 text-right">Desvio (R$)</th>
                      <th className="py-2.5 px-4 text-center w-28">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.materials.map((mat) => {
                      const realQty = mat.quantidadeReal !== undefined ? mat.quantidadeReal : mat.quantidade;
                      const realUnitCost = mat.custoUnitarioReal !== undefined ? mat.custoUnitarioReal : mat.custoUnitario;
                      const realTotal = mat.totalCustoReal !== undefined ? mat.totalCustoReal : (realQty * realUnitCost);
                      const diff = Number((realTotal - mat.totalCusto).toFixed(2));

                      return (
                        <tr key={mat.id} className="hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-gray-800">{mat.nome}</td>
                          <td className="py-2.5 px-4 text-center font-mono text-gray-500">{mat.unidade}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-700">
                            {mat.quantidade.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900">
                            {realQty.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                            {formatBRLUnit(realUnitCost)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-gray-700">
                            {formatBRL(mat.totalCusto)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#00897B]">
                            {formatBRL(realTotal)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            <span className={diff > 0 ? 'text-[#EF4444]' : diff < 0 ? 'text-[#10B981]' : 'text-gray-500'}>
                              {diff > 0 ? `+${formatBRL(diff)}` : formatBRL(diff)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedMaterialForEdit(mat);
                                setIsMatModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#00897B] bg-[#01B8AA]/10 hover:bg-[#01B8AA]/20 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                              Apontar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TABELA COMPARATIVA DETALHADA POR OPERAÇÃO */}
          {/* ========================================================================= */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-[#374151]">
                  Comparativo Detalhado por Tarefa / Operação
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Análise cruzada de tempos, custos de mão de obra e máquina e motivos de desvios.
                </p>
              </div>

              {/* Controles de Ordenação */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium whitespace-nowrap">Ordenar por:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
                >
                  <option value="EXCESS_COST">Maior Custo Excedente (R$)</option>
                  <option value="VARIANCE_PCT">Maior Variação Percentual (%)</option>
                  <option value="EXCESS_TIME">Maior Excesso de Tempo (Horas)</option>
                  <option value="ACTUAL_COST">Maior Custo Realizado Acumulado</option>
                  <option value="ORDER">Sequência Original da Produção</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#374151]">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Operação</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Qtd. Orçada x Real</th>
                    <th className="py-3 px-4 text-right">Tempo Previsto</th>
                    <th className="py-3 px-4 text-right">Tempo Real</th>
                    <th className="py-3 px-4 text-right">Dif. Tempo</th>
                    <th className="py-3 px-4 text-right">Custo Orçado</th>
                    <th className="py-3 px-4 text-right">Custo Real</th>
                    <th className="py-3 px-4 text-right">Dif. Financeira</th>
                    <th className="py-3 px-4 text-right">Variação %</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedOperations.map((op) => {
                    const isExpanded = expandedOpId === op.operationId;
                    const isOverBudget = op.financialDifference > 0;
                    const isUnderBudget = op.financialDifference < 0 && !op.isPending;

                    return (
                      <React.Fragment key={op.operationId}>
                        <tr
                          className={`hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors ${
                            isExpanded ? 'bg-teal-50/30' : ''
                          }`}
                        >
                          {/* Nome da Tarefa */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-gray-900">{op.code}</div>
                            <div className="font-semibold text-gray-800">{op.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {op.machine || 'Sem máquina'}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            <OperationStatusBadge status={op.status} isPending={op.isPending} />
                          </td>

                          {/* Quantidades */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <div>
                              <strong className="text-gray-900">
                                {op.isPending ? '0' : op.actualQuantityProcessed.toLocaleString('pt-BR')}
                              </strong>
                              <span className="text-gray-400"> / {op.plannedQuantity.toLocaleString('pt-BR')}</span>
                            </div>
                            {!op.isPending && op.quantityDifference !== 0 && (
                              <div
                                className={`text-[10px] font-semibold ${
                                  op.quantityDifference > 0 ? 'text-blue-700' : 'text-amber-700'
                                }`}
                              >
                                {op.quantityDifference > 0 ? `+${op.quantityDifference}` : op.quantityDifference}{' '}
                                ({formatPercent(op.quantityDifferencePercent)})
                              </div>
                            )}
                          </td>

                          {/* Tempos */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-gray-600">
                            {formatSecondsToTime(op.plannedTotalSeconds)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-gray-900">
                            {op.isPending ? '—' : formatSecondsToTime(op.actualTotalSeconds)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {op.isPending ? (
                              <span className="text-gray-400">Pendente</span>
                            ) : (
                              <span
                                className={`font-semibold ${
                                  op.timeDifferenceSeconds > 0
                                    ? 'text-[#EF4444]'
                                    : op.timeDifferenceSeconds < 0
                                    ? 'text-[#10B981]'
                                    : 'text-gray-600'
                                }`}
                              >
                                {op.timeDifferenceSeconds > 0
                                  ? `+${formatSecondsToTime(op.timeDifferenceSeconds)}`
                                  : formatSecondsToTime(op.timeDifferenceSeconds)}
                              </span>
                            )}
                          </td>

                          {/* Custos Financeiros */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-gray-700">
                            {formatBRL(op.plannedTotalCost)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-gray-900">
                            {op.isPending ? (
                              <span className="text-gray-400 font-normal italic">Pendente</span>
                            ) : (
                              formatBRL(op.actualTotalCost)
                            )}
                          </td>

                          {/* Diferença Financeira */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                            {op.isPending ? (
                              <span className="text-gray-400 font-normal">—</span>
                            ) : (
                              <span
                                className={
                                  isOverBudget
                                    ? 'text-[#EF4444]'
                                    : isUnderBudget
                                    ? 'text-[#10B981]'
                                    : 'text-gray-700'
                                }
                              >
                                {isOverBudget
                                  ? `+${formatBRL(op.financialDifference)}`
                                  : formatBRL(op.financialDifference)}
                              </span>
                            )}
                          </td>

                          {/* Variação Percentual */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {op.isPending ? (
                              <span className="text-gray-400">N/A</span>
                            ) : (
                              <span
                                className={`font-bold ${
                                  isOverBudget
                                    ? 'text-[#EF4444]'
                                    : isUnderBudget
                                    ? 'text-[#10B981]'
                                    : 'text-gray-600'
                                }`}
                              >
                                {formatPercent(op.financialVariancePercent)}
                              </span>
                            )}
                          </td>

                          {/* Ações / Expandir */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setExpandedOpId(isExpanded ? null : op.operationId)}
                              className="p-1.5 text-gray-400 hover:text-[#01B8AA] hover:bg-[#01B8AA]/10 rounded-lg transition-colors"
                              title="Expandir Composição e Ocorrências"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Linha Expandida de Análise Detalhada */}
                        {isExpanded && (
                          <tr className="bg-gray-50/80 border-b border-gray-200">
                            <td colSpan={11} className="p-5">
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  {/* Mão de Obra Detalhada */}
                                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                      Mão de Obra
                                    </span>
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                      <span className="text-gray-500">Horas:</span>
                                      <span className="font-mono font-medium tabular-nums">
                                        {op.actualLaborHours.toFixed(2)}h / {op.plannedLaborHours.toFixed(2)}h
                                      </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                      <span className="text-gray-500">Custo MO:</span>
                                      <span className="font-mono font-bold tabular-nums">
                                        {formatBRL(op.actualLaborCost)} (prev: {formatBRL(op.plannedLaborCost)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-1 font-semibold">
                                      <span className="text-gray-600">Variação MO:</span>
                                      <span className={`font-mono tabular-nums ${op.laborCostDiff > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                                        {op.laborCostDiff > 0 ? `+${formatBRL(op.laborCostDiff)}` : formatBRL(op.laborCostDiff)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Máquina Detalhada */}
                                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                      Máquina
                                    </span>
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                      <span className="text-gray-500">Horas Máquina:</span>
                                      <span className="font-mono font-medium tabular-nums">
                                        {op.actualMachineHours.toFixed(2)}h / {op.plannedMachineHours.toFixed(2)}h
                                      </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                      <span className="text-gray-500">Custo Máq:</span>
                                      <span className="font-mono font-bold tabular-nums">
                                        {formatBRL(op.actualMachineCost)} (prev: {formatBRL(op.plannedMachineCost)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-1 font-semibold">
                                      <span className="text-gray-600">Variação Máq:</span>
                                      <span className={`font-mono tabular-nums ${op.machineCostDiff > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                                        {op.machineCostDiff > 0 ? `+${formatBRL(op.machineCostDiff)}` : formatBRL(op.machineCostDiff)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Insumos & Custo Unitário */}
                                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                      Insumos & Custo Unitário
                                    </span>
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                      <span className="text-gray-500">Materiais:</span>
                                      <span className="font-mono font-bold tabular-nums">
                                        {formatBRL(op.actualMaterialCost)} (prev: {formatBRL(op.plannedMaterialCost)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-gray-100">
                                      <span className="text-gray-500">Custo Unitário Etapa:</span>
                                      <span className="font-mono font-medium tabular-nums">
                                        {op.actualUnitCost ? formatBRLUnit(op.actualUnitCost) : 'N/A'} (prev: {formatBRLUnit(op.plannedUnitCost)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-1 text-gray-600">
                                      <span>Apontamentos:</span>
                                      <span className="font-semibold">{op.logsCount} registro(s)</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Justificativas de Desvios Registradas */}
                                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg">
                                  <span className="text-xs font-bold text-amber-900 block mb-1">
                                    Justificativas e Ocorrências Técnicas Registradas:
                                  </span>
                                  {op.deviationReasons.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic">
                                      Nenhum motivo de desvio foi registrado pela equipe de chão de fábrica para esta etapa.
                                    </p>
                                  ) : (
                                    <ul className="list-disc list-inside text-xs text-amber-950 space-y-1">
                                      {op.deviationReasons.map((reason, rIdx) => (
                                        <li key={rIdx}>{reason}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Apontamento Real de Matéria-Prima */}
      <ActualMaterialModal
        isOpen={isMatModalOpen}
        onClose={() => {
          setIsMatModalOpen(false);
          setSelectedMaterialForEdit(null);
        }}
        materialItem={selectedMaterialForEdit}
        onSave={handleSaveActualMaterial}
      />
    </div>
  );
};
