/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  ProductProcessItem,
  ProcessItemType,
  BillingUnitType,
  Machine,
  StandardTask,
} from '../../types';
import { formatBRL, calculateProcessItemCost } from '../../services/calculator';
import { Cpu, Layers, Calculator, Plus, Check } from 'lucide-react';

interface AddProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProcess: (processItem: ProductProcessItem, keepOpen?: boolean) => void;
  machines: Machine[];
  standardTasks: StandardTask[];
  productQuantity: number;
  productUnit: string;
  initialProcess?: ProductProcessItem | null;
  nextOrder: number;
}

export const AddProcessModal: React.FC<AddProcessModalProps> = ({
  isOpen,
  onClose,
  onSaveProcess,
  machines,
  standardTasks,
  productQuantity,
  productUnit,
  initialProcess,
  nextOrder,
}) => {
  const [tipoItem, setTipoItem] = useState<ProcessItemType>('MAQUINA');
  const [origemId, setOrigemId] = useState<string>('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoCobranca, setTipoCobranca] = useState<BillingUnitType>('HORA');

  // Parâmetros se Custo por Hora
  const [tempoPrevistoHoras, setTempoPrevistoHoras] = useState<number>(1.5);
  const [custoHora, setCustoHora] = useState<number>(150);

  // Parâmetros se Custo por Milheiro
  const [quantidadeProducao, setQuantidadeProducao] = useState<number>(productQuantity || 1000);
  const [custoMilheiro, setCustoMilheiro] = useState<number>(80);

  const [error, setError] = useState<string | null>(null);

  // Filtra máquinas e tarefas ativas
  const activeMachines = machines.filter((m) => m.active);
  const activeTasks = standardTasks.filter((t) => t.active);

  useEffect(() => {
    if (initialProcess) {
      setTipoItem(initialProcess.tipoItem);
      setOrigemId(initialProcess.origemId || '');
      setNome(initialProcess.nome);
      setDescricao(initialProcess.descricao || '');
      setTipoCobranca(initialProcess.tipoCobranca);
      setTempoPrevistoHoras(initialProcess.tempoPrevistoHoras ?? 1);
      setCustoHora(initialProcess.custoHora ?? 150);
      setQuantidadeProducao(initialProcess.quantidadeProducao ?? productQuantity);
      setCustoMilheiro(initialProcess.custoMilheiro ?? 80);
    } else {
      // Criação de novo item: inicializa com a primeira máquina ativa se houver
      if (activeMachines.length > 0) {
        setTipoItem('MAQUINA');
        const first = activeMachines[0];
        setOrigemId(first.id);
        setNome(first.nome);
        setDescricao(first.descricao || '');
        const cobranca = first.tipoCobranca || 'HORA';
        setTipoCobranca(cobranca);
        setCustoHora(first.custoHora || 120);
        setCustoMilheiro(first.custoMilheiro || 80);
        setTempoPrevistoHoras(1.0);
        setQuantidadeProducao(productQuantity || 1000);
      } else if (activeTasks.length > 0) {
        setTipoItem('TAREFA');
        const first = activeTasks[0];
        setOrigemId(first.id);
        setNome(first.name);
        setDescricao(first.description || '');
        const cobranca = first.billingUnit || 'HORA';
        setTipoCobranca(cobranca);
        setCustoHora((first.hourlyMachineRate || 0) + (first.hourlyLaborRate || 0) || 120);
        setCustoMilheiro(first.costPerThousand || 60);
        setTempoPrevistoHoras(1.0);
        setQuantidadeProducao(productQuantity || 1000);
      } else {
        setTipoItem('MAQUINA');
        setOrigemId('');
        setNome('');
        setDescricao('');
        setTipoCobranca('HORA');
        setCustoHora(120);
        setCustoMilheiro(80);
        setTempoPrevistoHoras(1.0);
        setQuantidadeProducao(productQuantity || 1000);
      }
    }
    setError(null);
  }, [initialProcess, isOpen, productQuantity]);

  // Handler ao selecionar Máquina
  const handleSelectMachine = (machId: string) => {
    setOrigemId(machId);
    const mach = machines.find((m) => m.id === machId);
    if (mach) {
      setNome(mach.nome);
      if (mach.descricao) setDescricao(mach.descricao);
      const cobranca = mach.tipoCobranca || 'HORA';
      setTipoCobranca(cobranca);
      if (cobranca === 'HORA') {
        setCustoHora(mach.custoHora || 120);
      } else {
        setCustoMilheiro(mach.custoMilheiro || 80);
      }
    }
  };

  // Handler ao selecionar Tarefa
  const handleSelectTask = (taskId: string) => {
    setOrigemId(taskId);
    const task = standardTasks.find((t) => t.id === taskId);
    if (task) {
      setNome(task.name);
      if (task.description) setDescricao(task.description);
      const cobranca = task.billingUnit || 'HORA';
      setTipoCobranca(cobranca);
      if (cobranca === 'HORA') {
        const rate = (task.hourlyMachineRate || 0) + (task.hourlyLaborRate || 0);
        setCustoHora(rate > 0 ? rate : 120);
      } else {
        setCustoMilheiro(task.costPerThousand || 60);
      }
    }
  };

  // Handler ao alternar entre tipoItem (Máquina ou Tarefa)
  const handleChangeTipoItem = (novoTipo: ProcessItemType) => {
    setTipoItem(novoTipo);
    if (novoTipo === 'MAQUINA') {
      if (activeMachines.length > 0) {
        handleSelectMachine(activeMachines[0].id);
      } else {
        setOrigemId('');
        setNome('');
      }
    } else {
      if (activeTasks.length > 0) {
        handleSelectTask(activeTasks[0].id);
      } else {
        setOrigemId('');
        setNome('');
      }
    }
  };

  // Cálculo ao vivo do custo do item
  const calculatedCost = calculateProcessItemCost({
    tipoCobranca,
    tempoPrevistoHoras,
    custoHora,
    quantidadeProducao,
    custoMilheiro,
  });

  const handleSave = (keepOpen = false) => {
    if (!nome.trim()) {
      setError('Informe ou selecione o nome do processo (máquina ou tarefa).');
      return;
    }

    if (tipoCobranca === 'HORA') {
      if (tempoPrevistoHoras <= 0) {
        setError('O tempo previsto deve ser maior que zero horas.');
        return;
      }
      if (custoHora < 0) {
        setError('O custo por hora não pode ser negativo.');
        return;
      }
    } else {
      if (quantidadeProducao <= 0) {
        setError('A quantidade prevista deve ser maior que zero.');
        return;
      }
      if (custoMilheiro < 0) {
        setError('O custo por milheiro não pode ser negativo.');
        return;
      }
    }

    const item: ProductProcessItem = {
      id: initialProcess ? initialProcess.id : `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order: initialProcess ? initialProcess.order : nextOrder,
      tipoItem,
      origemId: origemId || undefined,
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      tipoCobranca,
      tempoPrevistoHoras: tipoCobranca === 'HORA' ? Number(tempoPrevistoHoras) : 0,
      custoHora: tipoCobranca === 'HORA' ? Number(custoHora) : 0,
      quantidadeProducao: tipoCobranca === 'MILHEIRO' ? Number(quantidadeProducao) : 0,
      custoMilheiro: tipoCobranca === 'MILHEIRO' ? Number(custoMilheiro) : 0,
      custoTotal: calculatedCost,
      tempoRealHoras: initialProcess?.tempoRealHoras,
      custoHoraReal: initialProcess?.custoHoraReal,
      quantidadeReal: initialProcess?.quantidadeReal,
      custoMilheiroReal: initialProcess?.custoMilheiroReal,
      custoTotalReal: initialProcess?.custoTotalReal,
      status: initialProcess?.status,
      realizadoNotas: initialProcess?.realizadoNotas,
    };

    onSaveProcess(item, keepOpen);

    if (keepOpen) {
      // Limpa para próximo cadastro rápido
      setError(null);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialProcess ? `Editar: ${initialProcess.nome}` : 'Vincular Máquina / Tarefa Produtiva'}
      subtitle="Selecione um processo do parque fabril e configure o tipo de precificação (Custo por Hora ou por Milheiro)"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-[#374151]">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            {error}
          </div>
        )}

        {/* 1. SELETOR DE ORIGEM: MÁQUINA OU TAREFA */}
        <div>
          <label className="block font-semibold text-gray-700 mb-2">
            1. Origem do Cadastro *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleChangeTipoItem('MAQUINA')}
              className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                tipoItem === 'MAQUINA'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA] text-[#00897B]'
                  : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  tipoItem === 'MAQUINA'
                    ? 'bg-[#01B8AA] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs block text-gray-900">Máquina do Parque</span>
                <span className="text-[11px] text-gray-500 block">
                  {activeMachines.length} máquina(s) disponível(is)
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleChangeTipoItem('TAREFA')}
              className={`p-3 rounded-xl border flex items-center gap-3 text-left transition-all ${
                tipoItem === 'TAREFA'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA] text-[#00897B]'
                  : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  tipoItem === 'TAREFA'
                    ? 'bg-[#01B8AA] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs block text-gray-900">Tarefa Padronizada</span>
                <span className="text-[11px] text-gray-500 block">
                  {activeTasks.length} tarefa(s) cadastrada(s)
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. SELEÇÃO DO ITEM ESPECÍFICO */}
        <div>
          <label className="block font-semibold text-gray-700 mb-1">
            2. Selecionar {tipoItem === 'MAQUINA' ? 'Máquina' : 'Tarefa'} Cadastrada *
          </label>
          {tipoItem === 'MAQUINA' ? (
            <select
              value={origemId}
              onChange={(e) => handleSelectMachine(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            >
              <option value="">-- Selecione uma Máquina --</option>
              {activeMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} — {m.tipoCobranca === 'MILHEIRO' ? `${formatBRL(m.custoMilheiro)}/milheiro` : `${formatBRL(m.custoHora)}/hora`}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={origemId}
              onChange={(e) => handleSelectTask(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            >
              <option value="">-- Selecione uma Tarefa --</option>
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} - {t.name} ({t.sector}) — {t.billingUnit === 'MILHEIRO' ? `${formatBRL(t.costPerThousand)}/milheiro` : `${formatBRL((t.hourlyMachineRate || 0) + (t.hourlyLaborRate || 0))}/hora`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Nome Customizado e Detalhes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Nome de Exibição no Orçamento *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Impressão 4x0, Corte e Vinco"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Observações / Detalhes da Etapa (Opcional)
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Acerto de canaletas, 2 passagens"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            />
          </div>
        </div>

        {/* 3. TIPO DE PRECIFICAÇÃO: CUSTO POR HORA OU POR MILHEIRO */}
        <div className="pt-2 border-t border-gray-100">
          <label className="block font-semibold text-gray-700 mb-2">
            3. Método de Cobrança Deste Item *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipoCobranca('HORA')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                tipoCobranca === 'HORA'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA] text-[#00897B] font-bold'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
              }`}
            >
              <div className="text-xs">⏱️ Custo por Hora</div>
              <div className="text-[11px] font-normal text-gray-500 mt-0.5">
                Tempo previsto (horas) × Custo cadastrado (R$/h)
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTipoCobranca('MILHEIRO')}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                tipoCobranca === 'MILHEIRO'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA] text-[#00897B] font-bold'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
              }`}
            >
              <div className="text-xs">📦 Custo por Milheiro</div>
              <div className="text-[11px] font-normal text-gray-500 mt-0.5">
                Quantidade prevista ÷ 1.000 × Custo cadastrado (R$)
              </div>
            </button>
          </div>
        </div>

        {/* 4. PARÂMETROS DINÂMICOS DE CÁLCULO */}
        {tipoCobranca === 'HORA' ? (
          <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-3">
            <div className="font-semibold text-sky-950 text-xs flex items-center justify-between">
              <span>Parâmetros de Custo por Hora</span>
              <span className="text-[11px] font-normal text-sky-700">Tempo de utilização × R$/hora</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Tempo Previsto de Utilização (Horas) *
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={tempoPrevistoHoras}
                    onChange={(e) => setTempoPrevistoHoras(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono font-bold"
                  />
                  <span className="text-xs text-gray-500 font-mono">horas</span>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setTempoPrevistoHoras(h)}
                      className="px-2 py-0.5 text-[10px] bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 font-mono"
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Custo Cadastrado por Hora (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-gray-400 font-medium">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={custoHora}
                    onChange={(e) => setCustoHora(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono font-bold"
                  />
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Valor cobrado a cada hora de processo produtivo.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-3">
            <div className="font-semibold text-amber-950 text-xs flex items-center justify-between">
              <span>Parâmetros de Custo por Milheiro</span>
              <span className="text-[11px] font-normal text-amber-800">Proporcional a cada 1.000 unidades</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Quantidade Prevista de Produção *
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={quantidadeProducao}
                    onChange={(e) => setQuantidadeProducao(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono font-bold"
                  />
                  <span className="text-xs text-gray-500 font-mono">{productUnit}</span>
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Equivale a {(quantidadeProducao / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} milheiros.
                </span>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Custo por Milheiro (R$ a cada 1.000 un) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-gray-400 font-medium">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={custoMilheiro}
                    onChange={(e) => setCustoMilheiro(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-white font-mono font-bold"
                  />
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Valor cobrado para processar cada 1.000 unidades.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. CARD DE RESULTADO / SIMULAÇÃO DO ITEM */}
        <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#01B8AA] text-white flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-teal-800 tracking-wider block">
                Custo Individual Previsto Deste Item
              </span>
              <span className="text-xs text-teal-900 font-medium">
                {tipoCobranca === 'HORA'
                  ? `${tempoPrevistoHoras}h × ${formatBRL(custoHora)}/h`
                  : `${quantidadeProducao.toLocaleString('pt-BR')} un × ${formatBRL(custoMilheiro)}/milheiro`}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-[#00897B] font-mono block">
              {formatBRL(calculatedCost)}
            </span>
            <span className="text-[10px] text-teal-700">Composição do Bloco A</span>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>

          {!initialProcess && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#00897B] bg-[#01B8AA]/10 hover:bg-[#01B8AA]/20 border border-[#01B8AA]/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Salvar e Adicionar Outro
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave(false)}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {initialProcess ? 'Atualizar Processo' : 'Salvar no Orçamento'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
