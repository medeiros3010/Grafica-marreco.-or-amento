/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Product,
  ProductionLog,
  ProductOperation,
  ProductMaterialItem,
  ProductPricing,
  ActualRecord,
  ActualMaterialItem,
  ActualTaskItem,
  ActualExtraItem,
  DEFAULT_PRODUCT_PRICING,
} from '../../types';
import {
  formatBRL,
  formatBRLUnit,
  formatPercent,
  formatSecondsToTime,
  calculateMarkupAndPricing,
} from '../../services/calculator';
import { storage } from '../../services/storage';
import { ProductStatusBadge } from '../common/Badge';
import {
  ClipboardCheck,
  Save,
  Copy,
  Clock,
  Coins,
  Package,
  Layers,
  Receipt,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Search,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ProductionLogsViewProps {
  products: Product[];
  logs: ProductionLog[];
  selectedProductId?: string;
  onRefresh: () => void;
  onSelectProduct: (id: string) => void;
  onGoToAnalysis: (productId: string) => void;
}

export const ProductionLogsView: React.FC<ProductionLogsViewProps> = ({
  products,
  logs,
  selectedProductId,
  onRefresh,
  onSelectProduct,
  onGoToAnalysis,
}) => {
  // Lista de produtos orçados / disponíveis
  const activeProductId = selectedProductId || products[0]?.id || '';
  const currentProduct = products.find((p) => p.id === activeProductId);

  // Estados locais do preenchimento espelhado (Coluna da Direita: Realizado)
  const [materialsState, setMaterialsState] = useState<
    {
      id: string;
      materialItemId?: string;
      nome: string;
      unidade: string;
      quantidadeOrçada: number;
      custoUnitarioOrçado: number;
      totalCustoOrçado: number;
      quantidadeReal: number;
      custoUnitarioReal: number;
    }[]
  >([]);

  const [tasksState, setTasksState] = useState<
    {
      id: string;
      operationId: string;
      order: number;
      code: string;
      name: string;
      machine?: string;
      hourlyMachineRate: number;
      hourlyLaborRate: number;
      tempoAcertoOrçadoHoras: number;
      tempoProdutivoOrçadoHoras: number;
      tempoTotalOrçadoHoras: number;
      totalCostOrçado: number;
      tempoAcertoRealHoras: number;
      tempoProdutivoRealHoras: number;
    }[]
  >([]);

  const [extrasState, setExtrasState] = useState<{
    despesasAdicionaisOrçadas: number;
    despesasAdicionaisReal: number;
    transporteOrçado: number;
    transporteReal: number;
  }>({
    despesasAdicionaisOrçadas: 0,
    despesasAdicionaisReal: 0,
    transporteOrçado: 0,
    transporteReal: 0,
  });

  const [apontamentoDate, setApontamentoDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Quantidade Realmente Entregue ao Cliente (Pós-Cálculo de Volume)
  const [deliveredQuantityState, setDeliveredQuantityState] = useState<number>(0);

  // Inicializa o formulário espelho a partir do produto selecionado ou do seu actualRecord existente
  useEffect(() => {
    if (!currentProduct) return;

    const activeRev = currentProduct.activeRevision;
    const existingRecord = currentProduct.actualRecord;

    // Inicializa a quantidade entregue
    setDeliveredQuantityState(
      existingRecord?.quantidadeEntregue !== undefined && existingRecord.quantidadeEntregue > 0
        ? existingRecord.quantidadeEntregue
        : currentProduct.quantity
    );

    // 1. Matérias-Primas do Orçado
    const baseMaterials: ProductMaterialItem[] =
      activeRev?.materials || currentProduct.materials || [];

    const initMaterials = baseMaterials.map((m, idx) => {
      const matchSaved = existingRecord?.materials.find(
        (sm) => sm.materialItemId === m.id || sm.nome.toLowerCase() === m.nome.toLowerCase()
      );

      const qReal =
        matchSaved !== undefined
          ? matchSaved.quantidadeReal
          : m.quantidadeReal !== undefined
          ? m.quantidadeReal
          : m.quantidade;

      const cReal =
        matchSaved !== undefined
          ? matchSaved.custoUnitarioReal
          : m.custoUnitarioReal !== undefined
          ? m.custoUnitarioReal
          : m.custoUnitario;

      return {
        id: `mat_mirror_${idx}_${m.id}`,
        materialItemId: m.id,
        nome: m.nome,
        unidade: m.unidade,
        quantidadeOrçada: m.quantidade,
        custoUnitarioOrçado: m.custoUnitario,
        totalCustoOrçado: m.totalCusto,
        quantidadeReal: qReal,
        custoUnitarioReal: cReal,
      };
    });
    setMaterialsState(initMaterials);

    // 2. Tarefas / Processos do Orçado
    const baseOps: ProductOperation[] =
      activeRev?.operations || currentProduct.draftOperations || [];

    const initTasks = baseOps.map((op) => {
      const matchSaved = existingRecord?.tasks.find(
        (st) => st.operationId === op.id || st.code === op.code
      );

      const setupOrçadoH = Number((op.plannedSetupSeconds / 3600).toFixed(4));
      const prodOrçadoH = Number((op.plannedProductionSeconds / 3600).toFixed(4));
      const totalOrçadoH = Number((op.plannedTotalSeconds / 3600).toFixed(4));

      const setupRealH =
        matchSaved !== undefined ? matchSaved.tempoAcertoRealHoras : setupOrçadoH;
      const prodRealH =
        matchSaved !== undefined ? matchSaved.tempoProdutivoRealHoras : prodOrçadoH;

      return {
        id: `task_mirror_${op.id}`,
        operationId: op.id,
        order: op.order,
        code: op.code,
        name: op.name,
        machine: op.machine,
        hourlyMachineRate: op.hourlyMachineRate || 100,
        hourlyLaborRate: op.hourlyLaborRate || 40,
        tempoAcertoOrçadoHoras: setupOrçadoH,
        tempoProdutivoOrçadoHoras: prodOrçadoH,
        tempoTotalOrçadoHoras: totalOrçadoH,
        totalCostOrçado: op.plannedTotalCost,
        tempoAcertoRealHoras: setupRealH,
        tempoProdutivoRealHoras: prodRealH,
      };
    });
    setTasksState(initTasks);

    // 3. Custos Extras / Despesas Adicionais
    const pricingConfig = activeRev?.pricing || currentProduct.pricing || DEFAULT_PRODUCT_PRICING;
    const despOrçada = pricingConfig.additionalExpenses || 0;

    setExtrasState({
      despesasAdicionaisOrçadas: despOrçada,
      despesasAdicionaisReal:
        existingRecord?.extras.despesasAdicionaisReal !== undefined
          ? existingRecord.extras.despesasAdicionaisReal
          : despOrçada,
      transporteOrçado: existingRecord?.extras.transporteOrçado || 0,
      transporteReal: existingRecord?.extras.transporteReal || 0,
    });

    if (existingRecord?.date) {
      setApontamentoDate(existingRecord.date);
    }
    if (existingRecord?.notes) {
      setNotes(existingRecord.notes);
    }
    setSaveSuccessMsg(null);
  }, [currentProduct?.id]);

  // Ação de copiar os valores orçados diretamente para o realizado (acelera apontamento)
  const handleCopyBudgetToActual = () => {
    if (currentProduct) {
      setDeliveredQuantityState(currentProduct.quantity);
    }

    setMaterialsState((prev) =>
      prev.map((m) => ({
        ...m,
        quantidadeReal: m.quantidadeOrçada,
        custoUnitarioReal: m.custoUnitarioOrçado,
      }))
    );

    setTasksState((prev) =>
      prev.map((t) => ({
        ...t,
        tempoAcertoRealHoras: t.tempoAcertoOrçadoHoras,
        tempoProdutivoRealHoras: t.tempoProdutivoOrçadoHoras,
      }))
    );

    setExtrasState((prev) => ({
      ...prev,
      despesasAdicionaisReal: prev.despesasAdicionaisOrçadas,
      transporteReal: prev.transporteOrçado,
    }));

    setSaveSuccessMsg('Valores orçados copiados para a coluna do realizado!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // CÁLCULOS IMEDIATOS EM TEMPO REAL
  const calculations = useMemo(() => {
    if (!currentProduct) {
      return {
        totalMateriaisOrçado: 0,
        totalMateriaisReal: 0,
        totalTarefasOrçado: 0,
        totalTarefasReal: 0,
        totalExtrasOrçado: 0,
        totalExtrasReal: 0,
        totalCustoOrçado: 0,
        totalCustoReal: 0,
        diferencaTotal: 0,
        variacaoPct: null,
        markupValue: 0,
        finalTotal: 0,
        margemOrçadaValor: 0,
        margemOrçadaPercent: 0,
        margemRealValor: 0,
        margemRealPercent: 0,
        margemEncolheu: false,
        quantidadeOrçada: 0,
        quantidadeEntregue: 0,
        variacaoQtd: 0,
        variacaoQtdPct: 0,
        custoUnitarioOrçado: 0,
        custoUnitarioReal: 0,
      };
    }

    // 1. Materiais
    const totalMateriaisOrçado = Number(
      materialsState.reduce((sum, m) => sum + m.totalCustoOrçado, 0).toFixed(2)
    );
    const totalMateriaisReal = Number(
      materialsState
        .reduce((sum, m) => sum + (m.quantidadeReal || 0) * (m.custoUnitarioReal || 0), 0)
        .toFixed(2)
    );

    // 2. Tarefas: Total Real = (Tempo Acerto Real + Tempo Produtivo Real em Horas) * Valor Hora
    const totalTarefasOrçado = Number(
      tasksState.reduce((sum, t) => sum + t.totalCostOrçado, 0).toFixed(2)
    );
    const totalTarefasReal = Number(
      tasksState
        .reduce((sum, t) => {
          const totalHoras = (t.tempoAcertoRealHoras || 0) + (t.tempoProdutivoRealHoras || 0);
          return sum + totalHoras * (t.hourlyMachineRate || 0);
        }, 0)
        .toFixed(2)
    );

    // 3. Extras
    const totalExtrasOrçado = Number(
      ((extrasState.despesasAdicionaisOrçadas || 0) + (extrasState.transporteOrçado || 0)).toFixed(2)
    );
    const totalExtrasReal = Number(
      ((extrasState.despesasAdicionaisReal || 0) + (extrasState.transporteReal || 0)).toFixed(2)
    );

    // Totais Gerais
    const totalCustoOrçado = Number(
      (totalMateriaisOrçado + totalTarefasOrçado + totalExtrasOrçado).toFixed(2)
    );
    const totalCustoReal = Number(
      (totalMateriaisReal + totalTarefasReal + totalExtrasReal).toFixed(2)
    );

    const diferencaTotal = Number((totalCustoReal - totalCustoOrçado).toFixed(2));
    const variacaoPct =
      totalCustoOrçado > 0
        ? Number(((diferencaTotal / totalCustoOrçado) * 100).toFixed(2))
        : null;

    // Cálculo da Margem de Lucro (Preço Faturado Fixo)
    const pricingConfig =
      currentProduct.activeRevision?.pricing || currentProduct.pricing || DEFAULT_PRODUCT_PRICING;

    // Custos de produção Bloco A para markup
    const custoBlocoAOrçado = totalMateriaisOrçado + totalTarefasOrçado;
    const custoBlocoAReal = totalMateriaisReal + totalTarefasReal;

    const plannedPricing = calculateMarkupAndPricing(
      custoBlocoAOrçado,
      pricingConfig,
      currentProduct.quantity
    );

    const markupValue = plannedPricing.markupValue;
    const margemOrçadaValor = plannedPricing.profitMarginValue;
    const margemOrçadaPercent = plannedPricing.profitMarginPercent;

    // Encargos proporcionais retidos sobre o faturado fixo
    const fixedTaxesAndCharges =
      plannedPricing.taxValue + plannedPricing.commissionValue + plannedPricing.interestValue;

    // Margem Real = Markup Fixo - Encargos Proporcionais - Custo Real Total Bloco A
    const margemRealValor = Number((markupValue - fixedTaxesAndCharges - custoBlocoAReal).toFixed(2));
    const margemRealPercent =
      markupValue > 0 ? Number(((margemRealValor / markupValue) * 100).toFixed(2)) : 0;

    const margemEncolheu = margemRealValor < margemOrçadaValor;

    // Pós-Cálculo de Volume e Custos Unitários
    const quantidadeOrçada = currentProduct.quantity;
    const quantidadeEntregue =
      deliveredQuantityState > 0 ? deliveredQuantityState : currentProduct.quantity;
    const variacaoQtd = quantidadeEntregue - quantidadeOrçada;
    const variacaoQtdPct =
      quantidadeOrçada > 0
        ? Number(((variacaoQtd / quantidadeOrçada) * 100).toFixed(2))
        : 0;

    const custoUnitarioOrçado =
      quantidadeOrçada > 0
        ? Number((totalCustoOrçado / quantidadeOrçada).toFixed(4))
        : 0;
    const custoUnitarioReal =
      quantidadeEntregue > 0
        ? Number((totalCustoReal / quantidadeEntregue).toFixed(4))
        : 0;

    return {
      totalMateriaisOrçado,
      totalMateriaisReal,
      totalTarefasOrçado,
      totalTarefasReal,
      totalExtrasOrçado,
      totalExtrasReal,
      totalCustoOrçado,
      totalCustoReal,
      diferencaTotal,
      variacaoPct,
      markupValue,
      finalTotal: plannedPricing.finalTotal,
      margemOrçadaValor,
      margemOrçadaPercent,
      margemRealValor,
      margemRealPercent,
      margemEncolheu,
      quantidadeOrçada,
      quantidadeEntregue,
      variacaoQtd,
      variacaoQtdPct,
      custoUnitarioOrçado,
      custoUnitarioReal,
    };
  }, [materialsState, tasksState, extrasState, currentProduct, deliveredQuantityState]);

  // SALVAR APONTAMENTO REALIZADO (ENTIDADE ActualRecord)
  const handleSaveActualRecord = async () => {
    if (!currentProduct) return;
    setSaving(true);

    try {
      // Monta as linhas de matérias-primas
      const mappedMaterials: ActualMaterialItem[] = materialsState.map((m) => {
        const qR = Number(m.quantidadeReal) || 0;
        const cR = Number(m.custoUnitarioReal) || 0;
        return {
          id: m.id,
          materialItemId: m.materialItemId,
          nome: m.nome,
          unidade: m.unidade,
          quantidadeOrçada: m.quantidadeOrçada,
          custoUnitarioOrçado: m.custoUnitarioOrçado,
          totalCustoOrçado: m.totalCustoOrçado,
          quantidadeReal: qR,
          custoUnitarioReal: cR,
          totalCustoReal: Number((qR * cR).toFixed(2)),
        };
      });

      // Monta as linhas de tarefas
      const mappedTasks: ActualTaskItem[] = tasksState.map((t) => {
        const setupR = Number(t.tempoAcertoRealHoras) || 0;
        const prodR = Number(t.tempoProdutivoRealHoras) || 0;
        const totalH = Number((setupR + prodR).toFixed(4));
        const totalC = Number((totalH * (t.hourlyMachineRate || 0)).toFixed(2));

        return {
          id: t.id,
          operationId: t.operationId,
          order: t.order,
          code: t.code,
          name: t.name,
          machine: t.machine,
          hourlyMachineRate: t.hourlyMachineRate,
          hourlyLaborRate: t.hourlyLaborRate,
          tempoAcertoOrçadoHoras: t.tempoAcertoOrçadoHoras,
          tempoProdutivoOrçadoHoras: t.tempoProdutivoOrçadoHoras,
          tempoTotalOrçadoHoras: t.tempoTotalOrçadoHoras,
          totalCostOrçado: t.totalCostOrçado,
          tempoAcertoRealHoras: setupR,
          tempoProdutivoRealHoras: prodR,
          tempoTotalRealHoras: totalH,
          totalCostReal: totalC,
        };
      });

      const actualRecord: ActualRecord = {
        id: currentProduct.actualRecord?.id || `act_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: currentProduct.id,
        productCode: currentProduct.code,
        productName: currentProduct.name,
        revisionNumber: currentProduct.currentRevisionNumber || 1,
        date: apontamentoDate,
        notes: notes.trim() || undefined,
        quantidadeOrçada: calculations.quantidadeOrçada,
        quantidadeEntregue: calculations.quantidadeEntregue,
        custoUnitarioOrçado: calculations.custoUnitarioOrçado,
        custoUnitarioReal: calculations.custoUnitarioReal,
        variacaoQuantidade: calculations.variacaoQtd,
        variacaoQuantidadePercent: calculations.variacaoQtdPct,
        materials: mappedMaterials,
        totalMateriaisOrçado: calculations.totalMateriaisOrçado,
        totalMateriaisReal: calculations.totalMateriaisReal,
        tasks: mappedTasks,
        totalTarefasOrçado: calculations.totalTarefasOrçado,
        totalTarefasReal: calculations.totalTarefasReal,
        extras: {
          despesasAdicionaisOrçadas: extrasState.despesasAdicionaisOrçadas,
          despesasAdicionaisReal: extrasState.despesasAdicionaisReal,
          transporteOrçado: extrasState.transporteOrçado,
          transporteReal: extrasState.transporteReal,
          totalExtrasOrçado: calculations.totalExtrasOrçado,
          totalExtrasReal: calculations.totalExtrasReal,
        },
        totalCustoOrçado: calculations.totalCustoOrçado,
        totalCustoReal: calculations.totalCustoReal,
        diferencaFinanceira: calculations.diferencaTotal,
        variacaoPercentual: calculations.variacaoPct,
        markupValue: calculations.markupValue,
        finalTotal: calculations.finalTotal,
        margemOrçadaValor: calculations.margemOrçadaValor,
        margemOrçadaPercent: calculations.margemOrçadaPercent,
        margemRealValor: calculations.margemRealValor,
        margemRealPercent: calculations.margemRealPercent,
        margemEncolheu: calculations.margemEncolheu,
        createdAt: currentProduct.actualRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.saveActualRecord(actualRecord);
      setSaveSuccessMsg('Apontamento de produção registrado com sucesso na base de dados!');
      onRefresh();

      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar apontamento real:', err);
      alert('Erro ao gravar o apontamento. Verifique os dados digitados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Seletor de Orçamento Aprovado */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Selecione o Orçamento para Apontamento (Layout Espelho):
          </label>
          <div className="flex items-center gap-2 max-w-xl">
            <select
              value={activeProductId}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white text-[#374151] focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA] focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name} — {p.client || 'Sem cliente'} ({p.quantity.toLocaleString('pt-BR')}{' '}
                  {p.productionUnit})
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentProduct && (
          <div className="flex items-center gap-2.5 shrink-0">
            <ProductStatusBadge status={currentProduct.status} />
            <button
              onClick={handleCopyBudgetToActual}
              title="Copia todos os valores previstos para os campos de digitação real"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
            >
              <Copy className="w-3.5 h-3.5 text-gray-500" />
              Copiar Orçado para o Realizado
            </button>
            <button
              onClick={() => onGoToAnalysis(currentProduct.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
            >
              <Coins className="w-4 h-4" />
              Ver Análise & Margem
            </button>
          </div>
        )}
      </div>

      {!currentProduct ? (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-xl">
          <ClipboardCheck className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-[#374151]">Nenhum produto cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">
            Cadastre um produto na aba "Produtos & Orçamentos" para habilitar o apontamento.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alerta de Feedback de Salvamento */}
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{saveSuccessMsg}</span>
              </div>
              <button
                onClick={() => setSaveSuccessMsg(null)}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Dispensar
              </button>
            </div>
          )}

          {/* Dados Gerais do Apontamento */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <label className="text-xs font-semibold text-gray-600">Data do Apontamento:</label>
                <input
                  type="date"
                  value={apontamentoDate}
                  onChange={(e) => setApontamentoDate(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 font-mono focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
                />
              </div>

              <div className="flex-1 min-w-[260px]">
                <input
                  type="text"
                  placeholder="Observações do chão de fábrica (ex: lote de papel com umidade, troca de faca)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSaveActualRecord}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-all shrink-0 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Gravando Apontamento...' : 'Salvar Apontamento (Gravar Realizado)'}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* PAINEL ESPELHADO LADO A LADO: ORÇADO (ESQUERDA) x REALIZADO (DIREITA) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Cabeçalho das Duas Colunas Espelhadas */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-200 text-xs font-bold uppercase tracking-wider">
              {/* Coluna da Esquerda: O ORÇADO */}
              <div className="p-3.5 bg-slate-50 border-r border-gray-200 text-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span>COLUNA DA ESQUERDA: O ORÇADO (APENAS LEITURA)</span>
                </div>
                <span className="text-[10px] text-gray-400 font-normal lowercase">referência congelada</span>
              </div>

              {/* Coluna da Direita: O REALIZADO */}
              <div className="p-3.5 bg-teal-50/70 text-[#00897B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#01B8AA]"></span>
                  <span>COLUNA DA DIREITA: O REALIZADO (CHÃO DE FÁBRICA)</span>
                </div>
                <span className="text-[10px] text-[#00897B]/80 font-normal lowercase">campos editáveis</span>
              </div>
            </div>

            {/* DESTAQUE DO ESPELHO: QUANTIDADE ORÇADA x QUANTIDADE REALMENTE ENTREGUE AO CLIENTE */}
            <div className="border-b-2 border-[#01B8AA]/30 bg-teal-50/20">
              <div className="p-3 bg-teal-50/80 border-b border-teal-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#01B8AA]" />
                  <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                    Volume da Ordem: Quantidade Orçada vs Quantidade Realmente Entregue
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-teal-800 hidden sm:inline">
                  Impacto imediato no Custo Unitário e na Diluição da Margem
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 text-xs">
                {/* Lado Esquerdo: ORÇADO (Leitura) */}
                <div className="p-4 bg-slate-50/90 border-r border-gray-200 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                      Quantidade Orçada (Referência Contratada)
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-200 text-gray-700">
                      ORÇADO FIXO
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-gray-900 tracking-tight">
                      {currentProduct.quantity.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-xs font-bold text-gray-500 uppercase">
                      {currentProduct.productionUnit || 'unidades'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-gray-600 font-mono text-[11px]">
                    <span>Custo Total Orçado: {formatBRL(calculations.totalCustoOrçado)}</span>
                    <span className="font-bold text-gray-800">
                      Custo Unit. Orçado: {formatBRLUnit(calculations.custoUnitarioOrçado)}
                    </span>
                  </div>
                </div>

                {/* Lado Direito: REALIZADO (Input em Destaque) */}
                <div className="p-4 bg-white flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#00897B] uppercase tracking-wide flex items-center gap-1.5">
                      <span>Quantidade Realmente Entregue ao Cliente</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {calculations.variacaoQtd !== 0 ? (
                      <span
                        className={`px-2 py-0.5 text-[11px] font-black rounded-full font-mono ${
                          calculations.variacaoQtd > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {calculations.variacaoQtd > 0 ? `+${calculations.variacaoQtd.toLocaleString('pt-BR')}` : calculations.variacaoQtd.toLocaleString('pt-BR')} un ({calculations.variacaoQtdPct > 0 ? '+' : ''}{calculations.variacaoQtdPct.toFixed(2)}%)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 font-mono">
                        100% EXATO
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveredQuantityState === 0 ? '' : deliveredQuantityState}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDeliveredQuantityState(isNaN(val) ? 0 : val);
                      }}
                      placeholder={String(currentProduct.quantity)}
                      className="w-full px-3.5 py-2 text-xl font-black font-mono border-2 border-teal-300 rounded-lg bg-teal-50/20 text-[#374151] focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA] focus:bg-white focus:outline-none transition-all"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-gray-400 uppercase pointer-events-none">
                      {currentProduct.productionUnit || 'un'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-teal-100 text-[11px] font-mono">
                    <span className="text-gray-600">
                      Custo Total Real: {formatBRL(calculations.totalCustoReal)}
                    </span>
                    <span
                      className={`font-bold ${
                        calculations.custoUnitarioReal > calculations.custoUnitarioOrçado
                          ? 'text-[#EF4444]'
                          : 'text-emerald-700'
                      }`}
                    >
                      Custo Unit. Real: {formatBRLUnit(calculations.custoUnitarioReal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alerta contextual de volume e reflexo na margem */}
              {calculations.variacaoQtd !== 0 && (
                <div className="px-4 py-2 bg-amber-50/70 border-t border-amber-200/60 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {calculations.variacaoQtd > 0
                        ? `Atenção à sobretiragem: Entregar +${calculations.variacaoQtd.toLocaleString('pt-BR')} unidades sem reajuste de faturamento dilui e reduz a margem de lucro real da gráfica.`
                        : `Atenção à defasagem: Entregar ${Math.abs(calculations.variacaoQtd).toLocaleString('pt-BR')} unidades a menos concentra os custos fixos em menos peças, elevando o custo unitário real.`}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-800 shrink-0 ml-2">
                    {calculations.variacaoQtdPct > 0 ? '+' : ''}{calculations.variacaoQtdPct.toFixed(2)}% volume
                  </span>
                </div>
              )}
            </div>

            {/* SEÇÃO 1: MATÉRIAS-PRIMAS (INSUMOS) */}
            <div className="border-b border-gray-200">
              <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#01B8AA]" />
                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                  1. Matérias-Primas (Insumos do Bloco A)
                </h4>
              </div>

              {materialsState.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Nenhuma matéria-prima cadastrada no orçamento deste produto.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {materialsState.map((mat, idx) => {
                    const totalReal = Number(
                      ((mat.quantidadeReal || 0) * (mat.custoUnitarioReal || 0)).toFixed(2)
                    );
                    const diff = Number((totalReal - mat.totalCustoOrçado).toFixed(2));
                    const isExcess = diff > 0;
                    const isSavings = diff < 0;

                    return (
                      <div key={mat.id} className="grid grid-cols-1 md:grid-cols-2 text-xs">
                        {/* Lado Esquerdo: ORÇADO (Leitura) */}
                        <div className="p-3.5 bg-slate-50/80 border-r border-gray-200 flex flex-col justify-between space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-800">{mat.nome}</span>
                            <span className="text-[11px] font-mono text-gray-500">{mat.unidade}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-600 font-mono text-[11px] pt-1">
                            <span>
                              Qtd: <strong>{mat.quantidadeOrçada.toLocaleString('pt-BR')}</strong>
                            </span>
                            <span>
                              Unit: <strong>{formatBRLUnit(mat.custoUnitarioOrçado)}</strong>
                            </span>
                            <span className="text-gray-800 font-bold">
                              Total: {formatBRL(mat.totalCustoOrçado)}
                            </span>
                          </div>
                        </div>

                        {/* Lado Direito: REALIZADO (Campos de Input) */}
                        <div className="p-3.5 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                Qtd Real Utilizada ({mat.unidade})
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={mat.quantidadeReal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setMaterialsState((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, quantidadeReal: val } : item
                                    )
                                  );
                                }}
                                className="w-full text-xs font-bold font-mono text-gray-800 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                Valor Unit Real (R$)
                              </label>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={mat.custoUnitarioReal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setMaterialsState((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, custoUnitarioReal: val } : item
                                    )
                                  );
                                }}
                                className="w-full text-xs font-bold font-mono text-gray-800 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
                              />
                            </div>
                          </div>

                          <div className="text-right shrink-0 min-w-[120px]">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">
                              Total Real
                            </span>
                            <span className="text-sm font-bold font-mono text-[#00897B]">
                              {formatBRL(totalReal)}
                            </span>
                            <div className="text-[10px] font-bold font-mono mt-0.5">
                              {diff !== 0 && (
                                <span className={isExcess ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                                  {isExcess ? `+${formatBRL(diff)}` : formatBRL(diff)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Subtotal de Matérias-Primas Espelhado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 bg-gray-50/90 font-bold text-xs border-t border-gray-200">
                    <div className="p-3 border-r border-gray-200 flex justify-between items-center text-gray-700">
                      <span>Subtotal Matérias-Primas (Orçado):</span>
                      <span className="font-mono text-sm">{formatBRL(calculations.totalMateriaisOrçado)}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-[#00897B]">
                      <span>Subtotal Matérias-Primas (Realizado):</span>
                      <span className="font-mono text-sm">{formatBRL(calculations.totalMateriaisReal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 2: TAREFAS / PROCESSOS PRODUTIVOS */}
            <div className="border-b border-gray-200">
              <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#01B8AA]" />
                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                  2. Tarefas / Processos Produtivos (Horas de Acerto + Produtivo)
                </h4>
              </div>

              {tasksState.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Nenhuma tarefa/operação cadastrada neste orçamento.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {tasksState.map((task, idx) => {
                    const totalHorasReal = Number(
                      ((task.tempoAcertoRealHoras || 0) + (task.tempoProdutivoRealHoras || 0)).toFixed(4)
                    );
                    const totalReal = Number(
                      (totalHorasReal * (task.hourlyMachineRate || 0)).toFixed(2)
                    );
                    const diff = Number((totalReal - task.totalCostOrçado).toFixed(2));
                    const isExcess = diff > 0;

                    return (
                      <div key={task.id} className="grid grid-cols-1 md:grid-cols-2 text-xs">
                        {/* Lado Esquerdo: ORÇADO (Leitura) */}
                        <div className="p-3.5 bg-slate-50/80 border-r border-gray-200 flex flex-col justify-between space-y-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-gray-500 mr-1.5">
                                #{task.order} {task.code}
                              </span>
                              <span className="font-bold text-gray-800">{task.name}</span>
                            </div>
                            <span className="text-[11px] font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                              {formatBRL(task.hourlyMachineRate)}/h
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-500 truncate mt-0.5">
                            Máquina: <strong>{task.machine || 'Sem máquina'}</strong>
                          </div>

                          <div className="flex items-center justify-between text-gray-600 font-mono text-[11px] pt-1">
                            <span>
                              Acerto: <strong>{task.tempoAcertoOrçadoHoras.toFixed(2)}h</strong>
                            </span>
                            <span>
                              Prod: <strong>{task.tempoProdutivoOrçadoHoras.toFixed(2)}h</strong>
                            </span>
                            <span>
                              Total: <strong>{task.tempoTotalOrçadoHoras.toFixed(2)}h</strong>
                            </span>
                            <span className="text-gray-900 font-bold">
                              Custo: {formatBRL(task.totalCostOrçado)}
                            </span>
                          </div>
                        </div>

                        {/* Lado Direito: REALIZADO (Campos de Input) */}
                        <div className="p-3.5 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                Tempo Acerto REAL (Horas)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={task.tempoAcertoRealHoras}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setTasksState((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, tempoAcertoRealHoras: val } : item
                                    )
                                  );
                                }}
                                className="w-full text-xs font-bold font-mono text-gray-800 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                                Tempo Produtivo REAL (Horas)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={task.tempoProdutivoRealHoras}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setTasksState((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, tempoProdutivoRealHoras: val } : item
                                    )
                                  );
                                }}
                                className="w-full text-xs font-bold font-mono text-gray-800 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
                              />
                            </div>
                          </div>

                          <div className="text-right shrink-0 min-w-[130px]">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">
                              Total Real ({totalHorasReal.toFixed(2)}h)
                            </span>
                            <span className="text-sm font-bold font-mono text-[#00897B]">
                              {formatBRL(totalReal)}
                            </span>
                            <div className="text-[10px] font-bold font-mono mt-0.5">
                              {diff !== 0 && (
                                <span className={isExcess ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                                  {isExcess ? `+${formatBRL(diff)}` : formatBRL(diff)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Subtotal de Tarefas Espelhado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 bg-gray-50/90 font-bold text-xs border-t border-gray-200">
                    <div className="p-3 border-r border-gray-200 flex justify-between items-center text-gray-700">
                      <span>Subtotal Tarefas (Orçado):</span>
                      <span className="font-mono text-sm">{formatBRL(calculations.totalTarefasOrçado)}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-[#00897B]">
                      <span>Subtotal Tarefas (Realizado):</span>
                      <span className="font-mono text-sm">{formatBRL(calculations.totalTarefasReal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO 3: CUSTOS EXTRAS / DESPESAS ADICIONAIS & TRANSPORTE */}
            <div>
              <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#01B8AA]" />
                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                  3. Custos Extras (Despesas Adicionais, Frete e Transporte)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 text-xs">
                {/* Lado Esquerdo: ORÇADO */}
                <div className="p-4 bg-slate-50/80 border-r border-gray-200 space-y-2">
                  <div className="flex justify-between items-center text-gray-700">
                    <span className="font-semibold">Despesas Adicionais Orçadas:</span>
                    <span className="font-mono font-bold">{formatBRL(extrasState.despesasAdicionaisOrçadas)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700">
                    <span className="font-semibold">Transporte / Frete Orçado:</span>
                    <span className="font-mono font-bold">{formatBRL(extrasState.transporteOrçado)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center font-bold text-gray-800">
                    <span>Total Extras Orçado:</span>
                    <span className="font-mono">{formatBRL(calculations.totalExtrasOrçado)}</span>
                  </div>
                </div>

                {/* Lado Direito: REALIZADO */}
                <div className="p-4 bg-white space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                        Despesas Adicionais REAL (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={extrasState.despesasAdicionaisReal}
                        onChange={(e) =>
                          setExtrasState({
                            ...extrasState,
                            despesasAdicionaisReal: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-xs font-bold font-mono text-gray-800 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                        Transporte / Frete REAL (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={extrasState.transporteReal}
                        onChange={(e) =>
                          setExtrasState({
                            ...extrasState,
                            transporteReal: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-xs font-bold font-mono text-gray-800 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 font-bold text-[#00897B]">
                    <span className="text-xs">Total Extras Real:</span>
                    <span className="font-mono text-sm">{formatBRL(calculations.totalExtrasReal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PRÉVIA DO COMPARATIVO (ATUALIZADA EM TEMPO REAL) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#01B8AA]" />
                <h3 className="text-sm font-bold text-[#374151] uppercase tracking-wider">
                  Prévia do Comparativo em Tempo Real (Orçado x Realizado)
                </h3>
              </div>
              <span className="text-xs text-gray-400">
                Calculado instantaneamente com base nos dados digitados acima
              </span>
            </div>

            {/* Grid dos Totais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Custo Total Orçado */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Custo Total Orçado
                </span>
                <span className="text-xl font-bold font-mono text-gray-800 block mt-1">
                  {formatBRL(calculations.totalCustoOrçado)}
                </span>
                <span className="text-[10px] text-gray-500">MP + Tarefas + Extras</span>
              </div>

              {/* Custo Total Real */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Custo Total Realizado
                </span>
                <span className="text-xl font-bold font-mono text-[#00897B] block mt-1">
                  {formatBRL(calculations.totalCustoReal)}
                </span>
                <span className="text-[10px] text-gray-500">Apontado no formulário</span>
              </div>

              {/* Saldo de Desvio */}
              <div
                className={`p-4 rounded-xl border ${
                  calculations.diferencaTotal > 0
                    ? 'bg-red-50/70 border-red-200 text-red-950'
                    : calculations.diferencaTotal < 0
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Saldo de Desvio
                  </span>
                  {calculations.diferencaTotal > 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#EF4444]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#10B981]" />
                  )}
                </div>
                <span
                  className={`text-xl font-bold font-mono block mt-1 ${
                    calculations.diferencaTotal > 0
                      ? 'text-[#EF4444]'
                      : calculations.diferencaTotal < 0
                      ? 'text-[#10B981]'
                      : 'text-gray-800'
                  }`}
                >
                  {calculations.diferencaTotal > 0
                    ? `+${formatBRL(calculations.diferencaTotal)}`
                    : formatBRL(calculations.diferencaTotal)}
                </span>
                <span className="text-[10px] font-bold">
                  {formatPercent(calculations.variacaoPct)} vs Orçamento
                </span>
              </div>

              {/* Preço Faturado ao Cliente */}
              <div className="p-4 bg-slate-900 text-white rounded-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Preço Faturado ao Cliente
                </span>
                <span className="text-xl font-bold font-mono text-white block mt-1">
                  {formatBRL(calculations.finalTotal)}
                </span>
                <span className="text-[10px] text-teal-400">Markup Base Fixo: {formatBRL(calculations.markupValue)}</span>
              </div>
            </div>

            {/* Impacto na Margem de Lucro */}
            <div
              className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                calculations.margemEncolheu
                  ? 'bg-red-50/80 border-red-300'
                  : 'bg-emerald-50/80 border-emerald-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${
                    calculations.margemEncolheu ? 'bg-[#EF4444]' : 'bg-[#10B981]'
                  }`}
                >
                  {calculations.margemEncolheu ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <TrendingUp className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4
                    className={`text-sm font-bold ${
                      calculations.margemEncolheu ? 'text-[#EF4444]' : 'text-[#10B981]'
                    }`}
                  >
                    {calculations.margemEncolheu
                      ? 'Impacto Financeiro: Margem de Lucro Encolheu!'
                      : 'Margem de Lucro Preservada'}
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Como o preço já foi vendido, desvios de custo reduzem diretamente o lucro líquido da empresa.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Margem Orçada
                  </span>
                  <span className="text-sm font-bold font-mono text-gray-700">
                    {formatBRL(calculations.margemOrçadaValor)} ({calculations.margemOrçadaPercent}%)
                  </span>
                </div>

                <div className="pl-4 border-l border-gray-300">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider block ${
                      calculations.margemEncolheu ? 'text-red-700' : 'text-emerald-800'
                    }`}
                  >
                    Margem Realizada
                  </span>
                  <span
                    className={`text-lg font-black font-mono ${
                      calculations.margemEncolheu ? 'text-[#EF4444]' : 'text-[#10B981]'
                    }`}
                  >
                    {formatBRL(calculations.margemRealValor)} ({calculations.margemRealPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Impacto no Pós-Cálculo de Volume e Custo Unitário */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-[#01B8AA] flex items-center justify-center font-bold shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Pós-Cálculo de Volume e Custo Unitário
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {calculations.variacaoQtd > 0
                      ? `Foram entregues +${calculations.variacaoQtd.toLocaleString('pt-BR')} un (+${calculations.variacaoQtdPct.toFixed(2)}%) acima do orçamento. A tiragem sobressalente diluiu a margem pelo valor fixado de venda.`
                      : calculations.variacaoQtd < 0
                      ? `Foram entregues ${Math.abs(calculations.variacaoQtd).toLocaleString('pt-BR')} un a menos. Custos de acerto concentrados em menos unidades.`
                      : 'Tiragem entregue exatamente igual à orçada (100% de conformidade de volume).'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Custo Unitário Orçado
                  </span>
                  <span className="text-sm font-bold font-mono text-gray-700">
                    {formatBRLUnit(calculations.custoUnitarioOrçado)}
                  </span>
                  <span className="text-[10px] text-gray-400 block font-mono">
                    base {calculations.quantidadeOrçada.toLocaleString('pt-BR')} un
                  </span>
                </div>

                <div className="pl-4 border-l border-gray-300">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider block ${
                      calculations.custoUnitarioReal > calculations.custoUnitarioOrçado
                        ? 'text-red-700'
                        : 'text-emerald-800'
                    }`}
                  >
                    Custo Unitário Real
                  </span>
                  <span
                    className={`text-lg font-black font-mono ${
                      calculations.custoUnitarioReal > calculations.custoUnitarioOrçado
                        ? 'text-[#EF4444]'
                        : 'text-[#10B981]'
                    }`}
                  >
                    {formatBRLUnit(calculations.custoUnitarioReal)}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 block font-mono">
                    base {calculations.quantidadeEntregue.toLocaleString('pt-BR')} un entregues
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Ação no Rodapé */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Clique em <strong>Salvar Apontamento</strong> para consolidar os dados para auditoria e relatórios.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveActualRecord}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Gravando...' : 'Salvar Apontamento'}
                </button>

                <button
                  onClick={() => onGoToAnalysis(currentProduct.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
                >
                  <span>Ir para o Comparativo Completo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
