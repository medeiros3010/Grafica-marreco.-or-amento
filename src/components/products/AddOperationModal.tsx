/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  StandardTask,
  ProductOperation,
  TimeCalculationModel,
  TimeUnit,
  TaskSector,
  SECTOR_LABELS,
} from '../../types';
import {
  calculateOperationCosts,
  calculateOperationTimes,
  createOperationFromStandardTask,
  formatBRL,
  formatSecondsToTime,
  timeUnitToSeconds,
} from '../../services/calculator';
import { Calculator, ArrowRight } from 'lucide-react';

interface AddOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOperation: (operation: ProductOperation) => void;
  standardTasks: StandardTask[];
  productQuantity: number;
  productUnit: string;
  initialOperation?: ProductOperation | null;
  nextOrder: number;
}

export const AddOperationModal: React.FC<AddOperationModalProps> = ({
  isOpen,
  onClose,
  onSaveOperation,
  standardTasks,
  productQuantity,
  productUnit,
  initialOperation,
  nextOrder,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState<TaskSector>('Impressao');
  const [machine, setMachine] = useState('');
  const [productionUnit, setProductionUnit] = useState('Folhas');

  // Quantidade planejada (pode incluir perdas/quebra)
  const [plannedQuantity, setPlannedQuantity] = useState<number>(productQuantity);

  // Modelo de tempo
  const [timeModel, setTimeModel] = useState<TimeCalculationModel>('MODELO_A');
  const [setupValue, setSetupValue] = useState<number>(30);
  const [setupUnit, setSetupUnit] = useState<TimeUnit>('MINUTOS');
  const [speedPerHour, setSpeedPerHour] = useState<number>(4500);
  const [batchSize, setBatchSize] = useState<number>(500);
  const [batchTimeValue, setBatchTimeValue] = useState<number>(10);
  const [batchTimeUnit, setBatchTimeUnit] = useState<TimeUnit>('MINUTOS');
  const [unitTimeValue, setUnitTimeValue] = useState<number>(5);
  const [unitTimeUnit, setUnitTimeUnit] = useState<TimeUnit>('SEGUNDOS');

  // Custos e multiplicadores
  const [hourlyLaborRate, setHourlyLaborRate] = useState<number>(45.0);
  const [hourlyMachineRate, setHourlyMachineRate] = useState<number>(120.0);
  const [laborMultiplier, setLaborMultiplier] = useState<number>(1.0);
  const [machineMultiplier, setMachineMultiplier] = useState<number>(1.0);

  // Insumos
  const [materialName, setMaterialName] = useState('');
  const [materialUnit, setMaterialUnit] = useState('');
  const [materialCostPerUnit, setMaterialCostPerUnit] = useState<number>(0);
  const [materialApplication, setMaterialApplication] = useState<'POR_UNIDADE' | 'POR_LOTE' | 'FIXO'>('POR_UNIDADE');

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Quando abre para edição ou criação
  useEffect(() => {
    if (initialOperation) {
      setSelectedTaskId(initialOperation.taskId);
      setCode(initialOperation.code);
      setName(initialOperation.name);
      setSector(initialOperation.sector);
      setMachine(initialOperation.machine || '');
      setProductionUnit(initialOperation.productionUnit);
      setPlannedQuantity(initialOperation.plannedQuantity);
      setTimeModel(initialOperation.timeModel);

      setSetupValue(Math.round(initialOperation.setupTimeSeconds / 60));
      setSetupUnit('MINUTOS');

      setSpeedPerHour(initialOperation.speedPerHour || 1000);
      setBatchSize(initialOperation.batchSize || 500);
      setBatchTimeValue(Math.round((initialOperation.batchTimeSeconds || 600) / 60));
      setBatchTimeUnit('MINUTOS');
      setUnitTimeValue(initialOperation.unitTimeSeconds || 5);
      setUnitTimeUnit('SEGUNDOS');

      setHourlyLaborRate(initialOperation.hourlyLaborRate);
      setHourlyMachineRate(initialOperation.hourlyMachineRate);
      setLaborMultiplier(initialOperation.laborConcurrencyMultiplier || 1.0);
      setMachineMultiplier(initialOperation.machineConcurrencyMultiplier || 1.0);

      setMaterialName(initialOperation.materialName || '');
      setMaterialUnit(initialOperation.materialUnit || '');
      setMaterialCostPerUnit(initialOperation.materialCostPerUnit || 0);
      setMaterialApplication(initialOperation.materialApplication || 'POR_UNIDADE');
      setNotes(initialOperation.notes || '');
    } else {
      // Padrão inicial: se houver tarefas cadastradas, seleciona a primeira
      const firstTask = standardTasks.find((t) => t.active) || standardTasks[0];
      if (firstTask) {
        applyTaskValues(firstTask);
      } else {
        setSelectedTaskId('');
        setCode('OP-01');
        setName('');
        setPlannedQuantity(productQuantity);
      }
    }
    setError(null);
  }, [initialOperation, isOpen]);

  const applyTaskValues = (task: StandardTask) => {
    setSelectedTaskId(task.id);
    setCode(task.code);
    setName(task.name);
    setSector(task.sector);
    setMachine(task.machine || '');
    setProductionUnit(task.productionUnit);
    setPlannedQuantity(productQuantity);
    setTimeModel(task.timeModel);

    setSetupValue(Math.round(task.setupTimeSeconds / 60));
    setSetupUnit('MINUTOS');

    setSpeedPerHour(task.speedPerHour || 1000);
    setBatchSize(task.batchSize || 500);
    setBatchTimeValue(Math.round((task.batchTimeSeconds || 600) / 60));
    setBatchTimeUnit('MINUTOS');
    setUnitTimeValue(task.unitTimeSeconds || 5);
    setUnitTimeUnit('SEGUNDOS');

    setHourlyLaborRate(task.hourlyLaborRate);
    setHourlyMachineRate(task.hourlyMachineRate);
    setLaborMultiplier(1.0);
    setMachineMultiplier(1.0);

    setMaterialName(task.materialName || '');
    setMaterialUnit(task.materialUnit || '');
    setMaterialCostPerUnit(task.materialCostPerUnit || 0);
    setMaterialApplication(task.materialApplication || 'POR_UNIDADE');
  };

  const handleTaskSelectChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    const task = standardTasks.find((t) => t.id === taskId);
    if (task) {
      applyTaskValues(task);
    }
  };

  // Conversões e cálculo de prévia
  const setupSeconds = timeUnitToSeconds(setupValue, setupUnit);
  const batchTimeSeconds = timeUnitToSeconds(batchTimeValue, batchTimeUnit);
  const unitTimeSeconds = timeUnitToSeconds(unitTimeValue, unitTimeUnit);

  const previewTimes = calculateOperationTimes({
    timeModel,
    quantity: plannedQuantity,
    setupTimeSeconds: setupSeconds,
    speedPerHour,
    batchSize,
    batchTimeSeconds,
    unitTimeSeconds,
    laborMultiplier,
    machineMultiplier,
  });

  const previewCosts = calculateOperationCosts({
    laborHours: previewTimes.laborHours,
    hourlyLaborRate,
    machineHours: previewTimes.machineHours,
    hourlyMachineRate,
    quantity: plannedQuantity,
    finalProductQuantity: productQuantity,
    materialApplication,
    materialCostPerUnit,
    batchSize,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da operação.');
      return;
    }
    if (plannedQuantity <= 0) {
      setError('A quantidade desta etapa deve ser maior que zero.');
      return;
    }

    const operation: ProductOperation = {
      id: initialOperation?.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId: selectedTaskId || 'custom_task',
      order: initialOperation?.order ?? nextOrder,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      sector,
      machine: machine.trim() || undefined,
      productionUnit,
      timeModel,
      setupTimeSeconds: setupSeconds,
      speedPerHour: timeModel === 'MODELO_A' ? Number(speedPerHour) : undefined,
      batchSize: timeModel === 'MODELO_B' ? Number(batchSize) : undefined,
      batchTimeSeconds: timeModel === 'MODELO_B' ? batchTimeSeconds : undefined,
      unitTimeSeconds: timeModel === 'MODELO_C' ? unitTimeSeconds : undefined,
      plannedQuantity: Number(plannedQuantity),
      hourlyLaborRate: Number(hourlyLaborRate) || 0,
      hourlyMachineRate: Number(hourlyMachineRate) || 0,
      laborConcurrencyMultiplier: Number(laborMultiplier) || 1.0,
      machineConcurrencyMultiplier: Number(machineMultiplier) || 1.0,
      materialName: materialName.trim() || undefined,
      materialUnit: materialUnit.trim() || undefined,
      materialCostPerUnit: Number(materialCostPerUnit) || 0,
      materialApplication,
      materialPlannedCost: previewCosts.materialCost,
      plannedSetupSeconds: previewTimes.setupSeconds,
      plannedProductionSeconds: previewTimes.productionSeconds,
      plannedTotalSeconds: previewTimes.totalSeconds,
      plannedLaborHours: previewTimes.laborHours,
      plannedMachineHours: previewTimes.machineHours,
      plannedLaborCost: previewCosts.laborCost,
      plannedMachineCost: previewCosts.machineCost,
      plannedTotalCost: previewCosts.totalCost,
      plannedUnitCost: previewCosts.unitCost,
      notes: notes.trim() || undefined,
    };

    onSaveOperation(operation);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialOperation ? `Editar Operação: ${initialOperation.name}` : 'Adicionar Operação ao Orçamento'}
      subtitle={`Tiragem final do produto: ${productQuantity.toLocaleString('pt-BR')} ${productUnit}. Ajuste perdas, máquinas e taxas para esta etapa.`}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* 1. SELEÇÃO DA TAREFA PADRÃO DO CADASTRO CENTRAL */}
        {!initialOperation && (
          <div className="p-4 bg-[#01B8AA]/10 border border-[#01B8AA]/30 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-[#01B8AA] uppercase tracking-wider">
              Importar Parâmetros do Cadastro de Tarefas
            </label>
            <p className="text-xs text-slate-700">
              Selecione uma tarefa padrão existente. Os parâmetros técnicos e custos serão copiados para este orçamento, permitindo ajustes específicos sem alterar o cadastro original.
            </p>
            <select
              value={selectedTaskId}
              onChange={(e) => handleTaskSelectChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#01B8AA]/40 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            >
              {standardTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name} — {SECTOR_LABELS[t.sector]} ({t.machine || 'Sem máquina'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 2. DADOS ESPECÍFICOS DESTA ETAPA */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono font-bold"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Etapa *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Setor</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as TaskSector)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {(Object.keys(SECTOR_LABELS) as TaskSector[]).map((k) => (
                <option key={k} value={k}>
                  {SECTOR_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Máquina Específica
            </label>
            <input
              type="text"
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              placeholder="Ex: Heidelberg SM 74"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantidade a Processar nesta Operação *
            </label>
            <input
              type="number"
              min={1}
              required
              value={plannedQuantity}
              onChange={(e) => setPlannedQuantity(Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-bold tabular-nums"
            />
            {plannedQuantity !== productQuantity && (
              <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
                {plannedQuantity > productQuantity
                  ? `+${plannedQuantity - productQuantity} unidades a mais (margem de quebra/perda)`
                  : `${productQuantity - plannedQuantity} unidades a menos que o produto final`}
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unidade desta Operação
            </label>
            <input
              type="text"
              value={productionUnit}
              onChange={(e) => setProductionUnit(e.target.value)}
              placeholder="Ex: Folhas, Cadernos, Cartuchos"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* 3. PARÂMETROS DE TEMPO */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Parâmetros de Tempo & Produção
            </span>
            <span className="text-xs font-semibold text-[#01B8AA]">
              {timeModel === 'MODELO_A'
                ? 'Modelo A (Velocidade/Hora)'
                : timeModel === 'MODELO_B'
                ? 'Modelo B (Por Lote)'
                : 'Modelo C (Por Unidade)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Tempo Preparação (Setup)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={setupValue}
                  onChange={(e) => setSetupValue(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white tabular-nums"
                />
                <select
                  value={setupUnit}
                  onChange={(e) => setSetupUnit(e.target.value as TimeUnit)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-[11px]"
                >
                  <option value="MINUTOS">min</option>
                  <option value="HORAS">h</option>
                  <option value="SEGUNDOS">s</option>
                </select>
              </div>
            </div>

            {timeModel === 'MODELO_A' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Velocidade de Produção ({productionUnit}/hora)
                </label>
                <input
                  type="number"
                  min={1}
                  value={speedPerHour}
                  onChange={(e) => setSpeedPerHour(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white tabular-nums"
                />
              </div>
            )}

            {timeModel === 'MODELO_B' && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Tamanho do Lote ({productionUnit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Tempo por Lote
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={batchTimeValue}
                      onChange={(e) => setBatchTimeValue(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white tabular-nums"
                    />
                    <select
                      value={batchTimeUnit}
                      onChange={(e) => setBatchTimeUnit(e.target.value as TimeUnit)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-[11px]"
                    >
                      <option value="MINUTOS">min</option>
                      <option value="HORAS">h</option>
                      <option value="SEGUNDOS">s</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {timeModel === 'MODELO_C' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Tempo por Unidade
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={unitTimeValue}
                    onChange={(e) => setUnitTimeValue(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white tabular-nums"
                  />
                  <select
                    value={unitTimeUnit}
                    onChange={(e) => setUnitTimeUnit(e.target.value as TimeUnit)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-[11px]"
                  >
                    <option value="SEGUNDOS">segundos</option>
                    <option value="MINUTOS">minutos</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. CUSTOS E OPERADORES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Custo MO (R$/h)
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyLaborRate}
              onChange={(e) => setHourlyLaborRate(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Operadores (Mult.)
            </label>
            <input
              type="number"
              step="0.5"
              min={0}
              value={laborMultiplier}
              onChange={(e) => setLaborMultiplier(Number(e.target.value))}
              title="Ex: 1 = 1 operador; 2 = 2 ajudantes; 0.5 = 1 operador divide 2 máquinas"
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Custo Máq (R$/h)
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyMachineRate}
              onChange={(e) => setHourlyMachineRate(Number(e.target.value))}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Custo Materiais
            </label>
            <div className="text-xs font-semibold text-slate-800 pt-1.5 tabular-nums">
              {formatBRL(previewCosts.materialCost)}
            </div>
          </div>
        </div>

        {/* 5. PRÉVIA AO VIVO DOS RESULTADOS DA ETAPA */}
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-[#01B8AA]" />
              Cálculo Previsto desta Operação
            </span>
            <span className="text-xs text-[#01B8AA] font-semibold tabular-nums">
              Ordem: #{initialOperation?.order ?? nextOrder}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Tempo Total:</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatSecondsToTime(previewTimes.totalSeconds)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                (Setup: {formatSecondsToTime(previewTimes.setupSeconds)})
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Mão de Obra:</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatBRL(previewCosts.laborCost)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {previewTimes.laborHours.toFixed(2)}h @ {formatBRL(hourlyLaborRate)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Máquina:</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatBRL(previewCosts.machineCost)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {previewTimes.machineHours.toFixed(2)}h @ {formatBRL(hourlyMachineRate)}
              </span>
            </div>
            <div className="bg-[#01B8AA]/15 p-2 rounded-lg border border-[#01B8AA]/40">
              <span className="text-[11px] text-[#01B8AA] block font-medium">Custo Total da Etapa:</span>
              <span className="text-base font-bold text-white tabular-nums">
                {formatBRL(previewCosts.totalCost)}
              </span>
              <span className="text-[10px] text-[#01B8AA] block mt-0.5">
                {formatBRL(previewCosts.unitCost)} / peça final
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-xs transition-colors"
          >
            {initialOperation ? 'Atualizar Operação' : 'Adicionar ao Orçamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
