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
import {
  formatBRL,
  calculateProcessItemCost,
  hoursMinutesToDecimal,
  decimalToHoursMinutes,
  formatHoursToHMin,
} from '../../services/calculator';
import { Cpu, Layers, Calculator, Plus, Check, Clock, Wrench, Sparkles } from 'lucide-react';

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

  // Parâmetros se Custo por Hora: 3 Tempos Independentes (Horas e Minutos)
  // 1. Tempo Produtivo: tempo efetivamente utilizado na produção
  const [prodHoras, setProdHoras] = useState<number>(2);
  const [prodMinutos, setProdMinutos] = useState<number>(30);

  // 2. Tempo de Acerto: preparação, regulagem, ajustes e acerto da máquina
  const [acertoHoras, setAcertoHoras] = useState<number>(0);
  const [acertoMinutos, setAcertoMinutos] = useState<number>(45);

  // 3. Tempo Extra: tempo adicional de utilização da máquina
  const [extraHoras, setExtraHoras] = useState<number>(0);
  const [extraMinutos, setExtraMinutos] = useState<number>(15);

  // Custo por hora da máquina
  const [custoHora, setCustoHora] = useState<number>(120);

  // Parâmetros se Custo por Milheiro
  const [quantidadeProducao, setQuantidadeProducao] = useState<number>(productQuantity || 1000);
  const [custoMilheiro, setCustoMilheiro] = useState<number>(80);

  const [error, setError] = useState<string | null>(null);

  // Filtra máquinas e tarefas ativas
  const activeMachines = machines.filter((m) => m.active);
  const activeTasks = standardTasks.filter((t) => t.active);

  // Conversão para horas decimais e cálculo automático do Tempo Total:
  // Tempo Total = Tempo Produtivo + Tempo de Acerto + Tempo Extra
  const tempoProdutivoHoras = hoursMinutesToDecimal(prodHoras, prodMinutos);
  const tempoAcertoHoras = hoursMinutesToDecimal(acertoHoras, acertoMinutos);
  const tempoExtraHoras = hoursMinutesToDecimal(extraHoras, extraMinutos);
  const tempoTotalHoras = Number((tempoProdutivoHoras + tempoAcertoHoras + tempoExtraHoras).toFixed(4));

  useEffect(() => {
    if (initialProcess) {
      setTipoItem(initialProcess.tipoItem);
      setOrigemId(initialProcess.origemId || '');
      setNome(initialProcess.nome);
      setDescricao(initialProcess.descricao || '');
      setTipoCobranca(initialProcess.tipoCobranca);
      setCustoHora(initialProcess.custoHora ?? 120);
      setQuantidadeProducao(initialProcess.quantidadeProducao ?? productQuantity);
      setCustoMilheiro(initialProcess.custoMilheiro ?? 80);

      // Carrega os 3 tempos se já cadastrados, ou inicializa a partir do tempo total legado
      const hasDetailedTimes =
        initialProcess.tempoProdutivoHoras !== undefined ||
        initialProcess.tempoAcertoHoras !== undefined ||
        initialProcess.tempoExtraHoras !== undefined;

      if (hasDetailedTimes) {
        const pHM = decimalToHoursMinutes(initialProcess.tempoProdutivoHoras || 0);
        setProdHoras(pHM.hours);
        setProdMinutos(pHM.minutes);

        const aHM = decimalToHoursMinutes(initialProcess.tempoAcertoHoras || 0);
        setAcertoHoras(aHM.hours);
        setAcertoMinutos(aHM.minutes);

        const eHM = decimalToHoursMinutes(initialProcess.tempoExtraHoras || 0);
        setExtraHoras(eHM.hours);
        setExtraMinutos(eHM.minutes);
      } else {
        const totalHM = decimalToHoursMinutes(initialProcess.tempoPrevistoHoras ?? 1.5);
        setProdHoras(totalHM.hours);
        setProdMinutos(totalHM.minutes);
        setAcertoHoras(0);
        setAcertoMinutos(0);
        setExtraHoras(0);
        setExtraMinutos(0);
      }
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
        setProdHoras(2);
        setProdMinutos(30);
        setAcertoHoras(0);
        setAcertoMinutos(45);
        setExtraHoras(0);
        setExtraMinutos(15);
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
        setProdHoras(1);
        setProdMinutos(30);
        setAcertoHoras(0);
        setAcertoMinutos(30);
        setExtraHoras(0);
        setExtraMinutos(0);
        setQuantidadeProducao(productQuantity || 1000);
      } else {
        setTipoItem('MAQUINA');
        setOrigemId('');
        setNome('');
        setDescricao('');
        setTipoCobranca('HORA');
        setCustoHora(120);
        setCustoMilheiro(80);
        setProdHoras(2);
        setProdMinutos(0);
        setAcertoHoras(0);
        setAcertoMinutos(30);
        setExtraHoras(0);
        setExtraMinutos(0);
        setQuantidadeProducao(productQuantity || 1000);
      }
    }
    setError(null);
  }, [initialProcess, isOpen, productQuantity]);

  // Handler ao alternar explicitamente para Custo por Milheiro
  const handleSwitchToMilheiro = () => {
    setTipoCobranca('MILHEIRO');
    setError(null);
    if (!quantidadeProducao || quantidadeProducao <= 0) {
      setQuantidadeProducao(productQuantity > 0 ? productQuantity : 1000);
    }
    if (!custoMilheiro || custoMilheiro <= 0) {
      if (tipoItem === 'MAQUINA' && origemId) {
        const mach = machines.find((m) => m.id === origemId);
        if (mach?.custoMilheiro && mach.custoMilheiro > 0) {
          setCustoMilheiro(mach.custoMilheiro);
          return;
        }
      } else if (tipoItem === 'TAREFA' && origemId) {
        const task = standardTasks.find((t) => t.id === origemId);
        if (task?.costPerThousand && task.costPerThousand > 0) {
          setCustoMilheiro(task.costPerThousand);
          return;
        }
      }
      setCustoMilheiro(80);
    }
  };

  // Handler ao alternar explicitamente para Custo por Hora
  const handleSwitchToHora = () => {
    setTipoCobranca('HORA');
    setError(null);
    if (tempoTotalHoras <= 0) {
      setProdHoras(2);
      setProdMinutos(0);
    }
    if (!custoHora || custoHora <= 0) {
      if (tipoItem === 'MAQUINA' && origemId) {
        const mach = machines.find((m) => m.id === origemId);
        if (mach?.custoHora && mach.custoHora > 0) {
          setCustoHora(mach.custoHora);
          return;
        }
      } else if (tipoItem === 'TAREFA' && origemId) {
        const task = standardTasks.find((t) => t.id === origemId);
        const rate = (task?.hourlyMachineRate || 0) + (task?.hourlyLaborRate || 0);
        if (rate > 0) {
          setCustoHora(rate);
          return;
        }
      }
      setCustoHora(120);
    }
  };

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
        if (!quantidadeProducao || quantidadeProducao <= 0) {
          setQuantidadeProducao(productQuantity > 0 ? productQuantity : 1000);
        }
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
        if (!quantidadeProducao || quantidadeProducao <= 0) {
          setQuantidadeProducao(productQuantity > 0 ? productQuantity : 1000);
        }
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
    tempoProdutivoHoras,
    tempoAcertoHoras,
    tempoExtraHoras,
    tempoPrevistoHoras: tempoTotalHoras,
    custoHora,
    quantidadeProducao: quantidadeProducao > 0 ? quantidadeProducao : (productQuantity || 1000),
    custoMilheiro,
  });

  const handleSave = (keepOpen = false) => {
    if (!nome.trim()) {
      setError('Informe ou selecione o nome do processo (máquina ou tarefa).');
      return;
    }

    const finalQtdMilheiro = Number(quantidadeProducao) > 0 ? Number(quantidadeProducao) : (productQuantity > 0 ? productQuantity : 1000);

    if (tipoCobranca === 'HORA') {
      if (tempoTotalHoras <= 0) {
        setError('O Tempo Total deve ser maior que zero (informe Tempo Produtivo, Acerto ou Extra).');
        return;
      }
      if (custoHora < 0) {
        setError('O custo por hora não pode ser negativo.');
        return;
      }
    } else {
      // Precificação por MILHEIRO: não exige preenchimento de horas nem custo/hora!
      if (finalQtdMilheiro <= 0) {
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
      // 3 tempos discriminados (apenas se HORA):
      tempoProdutivoHoras: tipoCobranca === 'HORA' ? tempoProdutivoHoras : 0,
      tempoAcertoHoras: tipoCobranca === 'HORA' ? tempoAcertoHoras : 0,
      tempoExtraHoras: tipoCobranca === 'HORA' ? tempoExtraHoras : 0,
      // Tempo Total calculado automaticamente:
      tempoPrevistoHoras: tipoCobranca === 'HORA' ? tempoTotalHoras : 0,
      custoHora: tipoCobranca === 'HORA' ? Number(custoHora) || 0 : 0,
      quantidadeProducao: tipoCobranca === 'MILHEIRO' ? finalQtdMilheiro : 0,
      custoMilheiro: tipoCobranca === 'MILHEIRO' ? Number(custoMilheiro) || 0 : 0,
      custoTotal: calculatedCost,
      tempoProdutivoRealHoras: initialProcess?.tempoProdutivoRealHoras,
      tempoAcertoRealHoras: initialProcess?.tempoAcertoRealHoras,
      tempoExtraRealHoras: initialProcess?.tempoExtraRealHoras,
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
              onClick={handleSwitchToHora}
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
              onClick={handleSwitchToMilheiro}
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
          <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-xl space-y-4">
            <div className="font-semibold text-sky-950 text-xs flex items-center justify-between border-b border-sky-100 pb-2">
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="w-4 h-4 text-[#01B8AA]" />
                Divisão do Tempo de Utilização da Máquina
              </span>
              <span className="text-[11px] font-normal text-sky-700">
                Independentes · Editáveis · Soma automática
              </span>
            </div>

            {/* Grid com os 3 Tempos Independentes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Tempo Produtivo */}
              <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-800 text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                    1. Tempo Produtivo *
                  </label>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {formatHoursToHMin(tempoProdutivoHoras)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Tempo efetivamente utilizado na produção.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#01B8AA] focus-within:border-[#01B8AA]">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={prodHoras}
                        onChange={(e) => setProdHoras(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-800 focus:outline-none"
                      />
                      <span className="pr-2 text-[11px] text-gray-400 font-mono">h</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#01B8AA] focus-within:border-[#01B8AA]">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={prodMinutos}
                        onChange={(e) => setProdMinutos(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-800 focus:outline-none"
                      />
                      <span className="pr-2 text-[11px] text-gray-400 font-mono">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Tempo de Acerto */}
              <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-800 text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                    2. Tempo de Acerto *
                  </label>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {formatHoursToHMin(tempoAcertoHoras)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Preparação, regulagem, ajustes e acerto.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#01B8AA] focus-within:border-[#01B8AA]">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={acertoHoras}
                        onChange={(e) => setAcertoHoras(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-800 focus:outline-none"
                      />
                      <span className="pr-2 text-[11px] text-gray-400 font-mono">h</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#01B8AA] focus-within:border-[#01B8AA]">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={acertoMinutos}
                        onChange={(e) => setAcertoMinutos(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-800 focus:outline-none"
                      />
                      <span className="pr-2 text-[11px] text-gray-400 font-mono">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Tempo Extra */}
              <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-800 text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                    3. Tempo Extra *
                  </label>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {formatHoursToHMin(tempoExtraHoras)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Tempo adicional além do produtivo e acerto.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#01B8AA] focus-within:border-[#01B8AA]">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={extraHoras}
                        onChange={(e) => setExtraHoras(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-800 focus:outline-none"
                      />
                      <span className="pr-2 text-[11px] text-gray-400 font-mono">h</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-[#01B8AA] focus-within:border-[#01B8AA]">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={extraMinutos}
                        onChange={(e) => setExtraMinutos(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold text-gray-800 focus:outline-none"
                      />
                      <span className="pr-2 text-[11px] text-gray-400 font-mono">min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Painel do Resultado Automático: Tempo Total e Custo da Máquina */}
            <div className="p-3.5 bg-gradient-to-r from-sky-100/90 to-teal-100/80 border border-sky-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-900 block flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-[#00897B]" />
                  Tempo Total (Cálculo Automático)
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black font-mono text-[#00897B]">
                    {formatHoursToHMin(tempoTotalHoras)}
                  </span>
                  <span className="text-xs text-sky-800 font-mono">
                    ({tempoTotalHoras.toFixed(2)} horas)
                  </span>
                </div>
                <div className="text-[11px] text-sky-900 mt-1 font-mono">
                  Fórmula: {formatHoursToHMin(tempoProdutivoHoras)} (Produtivo) + {formatHoursToHMin(tempoAcertoHoras)} (Acerto) + {formatHoursToHMin(tempoExtraHoras)} (Extra)
                </div>
              </div>

              {/* Custo/Hora da Máquina */}
              <div className="sm:text-right shrink-0">
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Custo da Máquina por Hora (R$) *
                </label>
                <div className="relative inline-block w-40">
                  <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-medium">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={custoHora}
                    onChange={(e) => setCustoHora(Number(e.target.value))}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs text-right border border-gray-300 rounded-lg bg-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
                  />
                </div>
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
                  ? `${formatHoursToHMin(tempoTotalHoras)} (${tempoTotalHoras.toFixed(2)}h) × ${formatBRL(custoHora)}/h`
                  : `${quantidadeProducao.toLocaleString('pt-BR')} un × ${formatBRL(custoMilheiro)}/milheiro`}
              </span>
              {tipoCobranca === 'HORA' && (
                <div className="text-[10px] text-teal-700 mt-0.5">
                  Composição: {formatHoursToHMin(tempoProdutivoHoras)} produtivo + {formatHoursToHMin(tempoAcertoHoras)} acerto + {formatHoursToHMin(tempoExtraHoras)} extra
                </div>
              )}
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
