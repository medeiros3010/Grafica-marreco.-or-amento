/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  StandardTask,
  TaskSector,
  TimeCalculationModel,
  TimeUnit,
  SECTOR_LABELS,
  Machine,
} from '../../types';
import {
  calculateOperationTimes,
  formatBRL,
  formatSecondsToTime,
  timeUnitToSeconds,
} from '../../services/calculator';
import { storage } from '../../services/storage';
import { Calculator, Cpu } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: StandardTask) => Promise<void>;
  initialTask?: StandardTask | null;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
}) => {
  const [machinesList, setMachinesList] = useState<Machine[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sector, setSector] = useState<TaskSector>('Impressao');
  const [machineId, setMachineId] = useState<string>('');
  const [machine, setMachine] = useState('');
  const [productionUnit, setProductionUnit] = useState('Folhas');

  // Modelo de tempo
  const [timeModel, setTimeModel] = useState<TimeCalculationModel>('MODELO_A');
  
  // Setup
  const [setupValue, setSetupValue] = useState<number>(30);
  const [setupUnit, setSetupUnit] = useState<TimeUnit>('MINUTOS');

  // Modelo A: Velocidade por hora
  const [speedPerHour, setSpeedPerHour] = useState<number>(4500);

  // Modelo B: Por Lote
  const [batchSize, setBatchSize] = useState<number>(500);
  const [batchTimeValue, setBatchTimeValue] = useState<number>(10);
  const [batchTimeUnit, setBatchTimeUnit] = useState<TimeUnit>('MINUTOS');

  // Modelo C: Por Unidade
  const [unitTimeValue, setUnitTimeValue] = useState<number>(5);
  const [unitTimeUnit, setUnitTimeUnit] = useState<TimeUnit>('SEGUNDOS');

  // Custos padrão
  const [hourlyLaborRate, setHourlyLaborRate] = useState<number>(45.0);
  const [hourlyMachineRate, setHourlyMachineRate] = useState<number>(120.0);

  // Materiais
  const [materialName, setMaterialName] = useState('');
  const [materialUnit, setMaterialUnit] = useState('Unidade');
  const [materialCostPerUnit, setMaterialCostPerUnit] = useState<number>(0);
  const [materialApplication, setMaterialApplication] = useState<'POR_UNIDADE' | 'POR_LOTE' | 'FIXO'>('POR_UNIDADE');

  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulador interativo em tempo real
  const [previewQty, setPreviewQty] = useState<number>(10000);

  useEffect(() => {
    // Carregar máquinas cadastradas
    storage.getAllMachines().then((loaded) => {
      setMachinesList(loaded.filter((m) => m.active));
    });

    if (initialTask) {
      setCode(initialTask.code);
      setName(initialTask.name);
      setDescription(initialTask.description || '');
      setSector(initialTask.sector);
      setMachineId(initialTask.machineId || '');
      setMachine(initialTask.machine || '');
      setProductionUnit(initialTask.productionUnit);
      setTimeModel(initialTask.timeModel);

      // Converter setup para minutos ou manter
      const setupMin = Math.round(initialTask.setupTimeSeconds / 60);
      setSetupValue(setupMin);
      setSetupUnit('MINUTOS');

      setSpeedPerHour(initialTask.speedPerHour || 1000);
      setBatchSize(initialTask.batchSize || 500);
      setBatchTimeValue(Math.round((initialTask.batchTimeSeconds || 600) / 60));
      setBatchTimeUnit('MINUTOS');
      setUnitTimeValue(initialTask.unitTimeSeconds || 5);
      setUnitTimeUnit('SEGUNDOS');

      setHourlyLaborRate(initialTask.hourlyLaborRate);
      setHourlyMachineRate(initialTask.hourlyMachineRate);

      setMaterialName(initialTask.materialName || '');
      setMaterialUnit(initialTask.materialUnit || 'Unidade');
      setMaterialCostPerUnit(initialTask.materialCostPerUnit || 0);
      setMaterialApplication(initialTask.materialApplication || 'POR_UNIDADE');

      setActive(initialTask.active);
    } else {
      // Valores padrão para nova tarefa
      setCode('');
      setName('');
      setDescription('');
      setSector('Impressao');
      setMachineId('');
      setMachine('');
      setProductionUnit('Folhas');
      setTimeModel('MODELO_A');
      setSetupValue(30);
      setSetupUnit('MINUTOS');
      setSpeedPerHour(4500);
      setHourlyLaborRate(45.0);
      setHourlyMachineRate(120.0);
      setMaterialName('');
      setMaterialCostPerUnit(0);
      setMaterialApplication('POR_UNIDADE');
      setActive(true);
    }
    setError(null);
  }, [initialTask, isOpen]);

  // Manipulador de troca de máquina
  const handleMachineSelect = (selectedId: string) => {
    setMachineId(selectedId);
    if (!selectedId) {
      setMachine('');
      return;
    }
    const selectedMach = machinesList.find((m) => m.id === selectedId);
    if (selectedMach) {
      setMachine(selectedMach.nome);
      // REQUISITO: A entidade Task (Tarefa) agora deve buscar o custoHora diretamente da Máquina vinculada
      setHourlyMachineRate(selectedMach.custoHora);
    }
  };

  // Converter inputs de tempo em segundos
  const setupSeconds = timeUnitToSeconds(setupValue, setupUnit);
  const batchTimeSeconds = timeUnitToSeconds(batchTimeValue, batchTimeUnit);
  const unitTimeSeconds = timeUnitToSeconds(unitTimeValue, unitTimeUnit);

  // Calcular simulação ao vivo
  const previewTimes = calculateOperationTimes({
    timeModel,
    quantity: previewQty,
    setupTimeSeconds: setupSeconds,
    speedPerHour,
    batchSize,
    batchTimeSeconds,
    unitTimeSeconds,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Informe o código único da tarefa (ex: IMP-01).');
      return;
    }
    if (!name.trim()) {
      setError('Informe o nome da tarefa.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const task: StandardTask = {
        id: initialTask?.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        sector,
        machineId: machineId || undefined,
        machine: machine.trim() || undefined,
        productionUnit: productionUnit.trim() || 'Unidade',
        timeModel,
        setupTimeSeconds: setupSeconds,
        speedPerHour: timeModel === 'MODELO_A' ? Number(speedPerHour) : undefined,
        batchSize: timeModel === 'MODELO_B' ? Number(batchSize) : undefined,
        batchTimeSeconds: timeModel === 'MODELO_B' ? batchTimeSeconds : undefined,
        unitTimeSeconds: timeModel === 'MODELO_C' ? unitTimeSeconds : undefined,
        hourlyLaborRate: Number(hourlyLaborRate) || 0,
        hourlyMachineRate: Number(hourlyMachineRate) || 0,
        materialName: materialName.trim() || undefined,
        materialUnit: materialUnit.trim() || undefined,
        materialCostPerUnit: Number(materialCostPerUnit) || 0,
        materialApplication,
        active,
        createdAt: initialTask?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(task);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar tarefa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialTask ? `Editar Tarefa: ${initialTask.code}` : 'Cadastrar Nova Tarefa Padrão'}
      subtitle="Defina parâmetros operacionais, modelo de cálculo do tempo e custos padrão de mão de obra e máquina"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* 1. DADOS BÁSICOS */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Identificação da Operação
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código Único *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: IMP-01, CRT-02"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Tarefa / Operação *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Impressão Offset 4 Cores, Corte Linear, Laminação BOPP"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Setor / Categoria</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as TaskSector)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              >
                {(Object.keys(SECTOR_LABELS) as TaskSector[]).map((key) => (
                  <option key={key} value={key}>
                    {SECTOR_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Máquina Vinculada</span>
                {machineId && <span className="text-[10px] text-[#01B8AA] font-bold">Auto-taxa ativa</span>}
              </label>
              <select
                value={machineId}
                onChange={(e) => handleMachineSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              >
                <option value="">Nenhuma máquina cadastrada</option>
                {machinesList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} — {formatBRL(m.custoHora)}/h
                  </option>
                ))}
              </select>
              {machineId ? (
                <span className="text-[10px] text-emerald-700 font-medium block mt-1">
                  Taxa horária vinculada automaticamente: {formatBRL(hourlyMachineRate)}/h
                </span>
              ) : (
                <input
                  type="text"
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  placeholder="Ou digite o nome manual da máquina"
                  className="w-full mt-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unidade de Produção *
              </label>
              <input
                type="text"
                required
                value={productionUnit}
                onChange={(e) => setProductionUnit(e.target.value)}
                placeholder="Ex: Folhas, Unidades, Milheiro, Caderno"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição Detalhada / Instruções Técnicas
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Acerto de tinteiros, registro de 4 cores, checagem de densitometria e acerto de lavagem."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* 2. MODELO DE CÁLCULO DO TEMPO (REQUISITO CRÍTICO) */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Modelo de Cálculo de Tempo de Produção
          </h4>

          {/* Seletor dos 3 Modelos Mandatórios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTimeModel('MODELO_A')}
              className={`p-3 rounded-lg border text-left transition-all ${
                timeModel === 'MODELO_A'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 mb-1">Modelo A</div>
              <div className="text-[11px] font-medium text-[#00897B]">Preparação + Velocidade/Hora</div>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                Tempo = Setup + (Quantidade / Velocidade pç/h). Ex: Offset 900 pçs/h.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTimeModel('MODELO_B')}
              className={`p-3 rounded-lg border text-left transition-all ${
                timeModel === 'MODELO_B'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 mb-1">Modelo B</div>
              <div className="text-[11px] font-medium text-[#00897B]">Tempo por Lote</div>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                Tempo = Lotes necessários × Tempo por lote. Ex: Guilhotina a cada 500 folhas.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTimeModel('MODELO_C')}
              className={`p-3 rounded-lg border text-left transition-all ${
                timeModel === 'MODELO_C'
                  ? 'border-[#01B8AA] bg-[#01B8AA]/10 ring-1 ring-[#01B8AA]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="text-xs font-bold text-slate-900 mb-1">Modelo C</div>
              <div className="text-[11px] font-medium text-[#00897B]">Tempo por Unidade</div>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                Tempo = Quantidade × Segundos por peça. Ex: 5 segundos por embalagem.
              </p>
            </button>
          </div>

          {/* Parâmetros do Modelo Escolhido */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
            {/* Tempo de Preparação (Setup) - Contabilizado UMA ÚNICA VEZ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempo de Preparação (Setup)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={setupValue}
                    onChange={(e) => setSetupValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                  />
                  <select
                    value={setupUnit}
                    onChange={(e) => setSetupUnit(e.target.value as TimeUnit)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white shrink-0"
                  >
                    <option value="SEGUNDOS">Segundos</option>
                    <option value="MINUTOS">Minutos</option>
                    <option value="HORAS">Horas</option>
                  </select>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Contabilizado 1 única vez por lote/ordem. Não é multiplicado pela quantidade de peças.
                </span>
              </div>
            </div>

            {/* Campos condicionais por Modelo */}
            {timeModel === 'MODELO_A' && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Velocidade Nominal de Produção ({productionUnit} por hora) *
                </label>
                <div className="flex items-center gap-2 max-w-sm">
                  <input
                    type="number"
                    min={1}
                    value={speedPerHour}
                    onChange={(e) => setSpeedPerHour(Number(e.target.value))}
                    placeholder="Ex: 900 ou 4500"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {productionUnit}/h
                  </span>
                </div>
              </div>
            )}

            {timeModel === 'MODELO_B' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tamanho do Lote ({productionUnit} por lote) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    placeholder="Ex: 500"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tempo por Lote *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={batchTimeValue}
                      onChange={(e) => setBatchTimeValue(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                    />
                    <select
                      value={batchTimeUnit}
                      onChange={(e) => setBatchTimeUnit(e.target.value as TimeUnit)}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white shrink-0"
                    >
                      <option value="SEGUNDOS">Segundos</option>
                      <option value="MINUTOS">Minutos</option>
                      <option value="HORAS">Horas</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {timeModel === 'MODELO_C' && (
              <div className="pt-2 border-t border-slate-200 max-w-sm">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempo por Unidade Processada *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={unitTimeValue}
                    onChange={(e) => setUnitTimeValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                  />
                  <select
                    value={unitTimeUnit}
                    onChange={(e) => setUnitTimeUnit(e.target.value as TimeUnit)}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white shrink-0"
                  >
                    <option value="SEGUNDOS">Segundos</option>
                    <option value="MINUTOS">Minutos</option>
                    <option value="HORAS">Horas</option>
                  </select>
                </div>
              </div>
            )}

            {/* Simulador Interativo do Tempo da Tarefa */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Simulação para:</span>
                <input
                  type="number"
                  min={1}
                  value={previewQty}
                  onChange={(e) => setPreviewQty(Number(e.target.value))}
                  className="w-24 px-2 py-1 text-xs border border-slate-300 rounded text-center font-bold tabular-nums"
                />
                <span className="text-xs text-slate-500">{productionUnit}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Tempo Produção:</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {formatSecondsToTime(previewTimes.productionSeconds)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Tempo Total:</span>
                  <span className="font-bold text-blue-700 tabular-nums">
                    {formatSecondsToTime(previewTimes.totalSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CUSTOS PADRÃO (MÃO DE OBRA, MÁQUINA E MATERIAIS) */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            3. Custos Padrão da Operação
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custo de Mão de Obra (R$ por hora) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-400">R$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={hourlyLaborRate}
                  onChange={(e) => setHourlyLaborRate(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custo de Máquina (R$ por hora) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-400">R$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={hourlyMachineRate}
                  onChange={(e) => setHourlyMachineRate(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Materiais e Insumos Opcionais */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <span className="text-xs font-semibold text-slate-800 block">
              Materiais e Insumos Específicos da Tarefa (Opcional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Nome do Material / Insumo
                </label>
                <input
                  type="text"
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  placeholder="Ex: Tinta Offset CMYK, Cola Hot Melt, Filme BOPP"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Aplicação do Consumo
                </label>
                <select
                  value={materialApplication}
                  onChange={(e) =>
                    setMaterialApplication(
                      e.target.value as 'POR_UNIDADE' | 'POR_LOTE' | 'FIXO'
                    )
                  }
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="POR_UNIDADE">Por Unidade Produzida</option>
                  <option value="POR_LOTE">Por Lote</option>
                  <option value="FIXO">Custo Fixo por Ordem</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Custo Unitário do Material (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={materialCostPerUnit}
                  onChange={(e) => setMaterialCostPerUnit(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Unidade de Medida do Material
                </label>
                <input
                  type="text"
                  value={materialUnit}
                  onChange={(e) => setMaterialUnit(e.target.value)}
                  placeholder="Ex: Milheiro, Kg, Folha, Rolo"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status Ativo/Inativo */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="taskActiveCheck"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="taskActiveCheck" className="text-xs font-medium text-slate-700">
            Tarefa Ativa para novos orçamentos
          </label>
        </div>

        {/* Botões do Formulário */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : initialTask ? 'Atualizar Tarefa' : 'Cadastrar Tarefa'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
