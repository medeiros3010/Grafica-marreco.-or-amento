/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  Product,
  ProductOperation,
  ProductionLog,
  TimeUnit,
} from '../../types';
import {
  formatBRL,
  formatSecondsToTime,
  timeUnitToSeconds,
} from '../../services/calculator';
import { Calculator } from 'lucide-react';

interface LogEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: ProductionLog) => Promise<void>;
  product: Product;
  operation: ProductOperation;
  initialLog?: ProductionLog | null;
}

export const LogEntryModal: React.FC<LogEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  operation,
  initialLog,
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  const [shift, setShift] = useState('1º Turno (07h às 15h)');
  const [operatorName, setOperatorName] = useState('');

  // Quantidades
  const [quantityProcessed, setQuantityProcessed] = useState<number>(operation.plannedQuantity);
  const [quantityApproved, setQuantityApproved] = useState<number>(operation.plannedQuantity);
  const [quantityScrapped, setQuantityScrapped] = useState<number>(0);

  // Tempos reais
  const [setupValue, setSetupValue] = useState<number>(
    Math.round(operation.plannedSetupSeconds / 60)
  );
  const [setupUnit, setSetupUnit] = useState<TimeUnit>('MINUTOS');

  const [prodValue, setProdValue] = useState<number>(
    Math.round(operation.plannedProductionSeconds / 60)
  );
  const [prodUnit, setProdUnit] = useState<TimeUnit>('MINUTOS');

  // Horas e taxas reais
  const [laborHours, setLaborHours] = useState<number>(operation.plannedLaborHours);
  const [machineHours, setMachineHours] = useState<number>(operation.plannedMachineHours);

  const [actualHourlyLaborRate, setActualHourlyLaborRate] = useState<number>(
    operation.hourlyLaborRate
  );
  const [actualHourlyMachineRate, setActualHourlyMachineRate] = useState<number>(
    operation.hourlyMachineRate
  );

  // Materiais reais
  const [actualMaterialCost, setActualMaterialCost] = useState<number>(
    operation.materialPlannedCost
  );
  const [materialNotes, setMaterialNotes] = useState('');

  // Justificativa e observações
  const [deviationReason, setDeviationReason] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLog) {
      setDate(initialLog.date);
      setTime(initialLog.time);
      setShift(initialLog.shift || '1º Turno');
      setOperatorName(initialLog.operatorName || '');
      setQuantityProcessed(initialLog.quantityProcessed);
      setQuantityApproved(initialLog.quantityApproved);
      setQuantityScrapped(initialLog.quantityScrapped);

      setSetupValue(Math.round(initialLog.actualSetupSeconds / 60));
      setSetupUnit('MINUTOS');

      setProdValue(Math.round(initialLog.actualProductionSeconds / 60));
      setProdUnit('MINUTOS');

      setLaborHours(initialLog.actualLaborHours);
      setMachineHours(initialLog.actualMachineHours);
      setActualHourlyLaborRate(initialLog.actualHourlyLaborRate);
      setActualHourlyMachineRate(initialLog.actualHourlyMachineRate);

      setActualMaterialCost(initialLog.actualMaterialCost);
      setMaterialNotes(initialLog.materialNotes || '');
      setDeviationReason(initialLog.deviationReason || '');
      setNotes(initialLog.notes || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setShift('1º Turno (07h às 15h)');
      setOperatorName('');
      setQuantityProcessed(operation.plannedQuantity);
      setQuantityApproved(operation.plannedQuantity);
      setQuantityScrapped(0);

      setSetupValue(Math.round(operation.plannedSetupSeconds / 60));
      setSetupUnit('MINUTOS');

      setProdValue(Math.round(operation.plannedProductionSeconds / 60));
      setProdUnit('MINUTOS');

      setLaborHours(operation.plannedLaborHours);
      setMachineHours(operation.plannedMachineHours);
      setActualHourlyLaborRate(operation.hourlyLaborRate);
      setActualHourlyMachineRate(operation.hourlyMachineRate);

      setActualMaterialCost(operation.materialPlannedCost);
      setMaterialNotes('');
      setDeviationReason('');
      setNotes('');
    }
    setError(null);
  }, [initialLog, operation, isOpen]);

  // Conversões em tempo real
  const actualSetupSeconds = timeUnitToSeconds(setupValue, setupUnit);
  const actualProductionSeconds = timeUnitToSeconds(prodValue, prodUnit);
  const totalActualSeconds = actualSetupSeconds + actualProductionSeconds;

  // Custos calculados deste apontamento específico
  const calculatedLaborCost = Number((laborHours * actualHourlyLaborRate).toFixed(2));
  const calculatedMachineCost = Number((machineHours * actualHourlyMachineRate).toFixed(2));
  const calculatedTotalCost = Number(
    (calculatedLaborCost + calculatedMachineCost + Number(actualMaterialCost || 0)).toFixed(2)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError('Informe a data do apontamento.');
      return;
    }
    if (quantityProcessed < 0) {
      setError('A quantidade processada não pode ser negativa.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const log: ProductionLog = {
        id: initialLog?.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: product.id,
        operationId: operation.id,
        date,
        time,
        shift: shift.trim() || undefined,
        operatorName: operatorName.trim() || undefined,
        quantityProcessed: Number(quantityProcessed),
        quantityApproved: Number(quantityApproved),
        quantityScrapped: Number(quantityScrapped),
        actualSetupSeconds,
        actualProductionSeconds,
        actualLaborHours: Number(laborHours),
        actualMachineHours: Number(machineHours),
        actualHourlyLaborRate: Number(actualHourlyLaborRate),
        actualHourlyMachineRate: Number(actualHourlyMachineRate),
        actualMaterialCost: Number(actualMaterialCost) || 0,
        materialNotes: materialNotes.trim() || undefined,
        actualLaborCost: calculatedLaborCost,
        actualMachineCost: calculatedMachineCost,
        actualTotalCost: calculatedTotalCost,
        deviationReason: deviationReason.trim() || undefined,
        notes: notes.trim() || undefined,
        cancelled: false,
        createdAt: initialLog?.createdAt || new Date().toISOString(),
      };

      await onSave(log);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar apontamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lançar Apontamento Realizado: [${operation.code}] ${operation.name}`}
      subtitle={`Produto: ${product.code} - ${product.name} | Máquina: ${operation.machine || 'Sem máquina'}`}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* 1. DATA, TURNO E OPERADOR */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Data *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Horário</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Turno</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="1º Turno (07h às 15h)">1º Turno (07h às 15h)</option>
              <option value="2º Turno (15h às 23h)">2º Turno (15h às 23h)</option>
              <option value="3º Turno (23h às 07h)">3º Turno (23h às 07h)</option>
              <option value="Turno Geral / Comercial">Turno Geral / Comercial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Operador Responsável</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Ex: João Silva (Impressor)"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* 2. QUANTIDADES PRODUZIDAS NESTE APONTAMENTO */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Quantidades Deste Lançamento ({operation.productionUnit})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Quantidade Total Processada *
              </label>
              <input
                type="number"
                min={0}
                required
                value={quantityProcessed}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setQuantityProcessed(val);
                  setQuantityApproved(val - quantityScrapped);
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Quantidade Aprovada / Conforme *
              </label>
              <input
                type="number"
                min={0}
                required
                value={quantityApproved}
                onChange={(e) => setQuantityApproved(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold tabular-nums text-emerald-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Refugo / Perdas (Quebra)
              </label>
              <input
                type="number"
                min={0}
                value={quantityScrapped}
                onChange={(e) => {
                  const scrap = Number(e.target.value);
                  setQuantityScrapped(scrap);
                  setQuantityApproved(Math.max(0, quantityProcessed - scrap));
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold tabular-nums text-rose-800"
              />
            </div>
          </div>
        </div>

        {/* 3. TEMPOS EFETIVOS DE PRODUÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Tempo Real de Preparação (Setup)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="any"
                value={setupValue}
                onChange={(e) => setSetupValue(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded tabular-nums"
              />
              <select
                value={setupUnit}
                onChange={(e) => setSetupUnit(e.target.value as TimeUnit)}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-xs"
              >
                <option value="MINUTOS">Minutos</option>
                <option value="HORAS">Horas</option>
                <option value="SEGUNDOS">Segundos</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-400 block tabular-nums">
              Previsto no orçamento: {formatSecondsToTime(operation.plannedSetupSeconds)}
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Tempo Real de Produção / Rodagem
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="any"
                value={prodValue}
                onChange={(e) => setProdValue(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded tabular-nums"
              />
              <select
                value={prodUnit}
                onChange={(e) => setProdUnit(e.target.value as TimeUnit)}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-xs"
              >
                <option value="MINUTOS">Minutos</option>
                <option value="HORAS">Horas</option>
                <option value="SEGUNDOS">Segundos</option>
              </select>
            </div>
            <span className="text-[11px] text-slate-400 block tabular-nums">
              Previsto no orçamento: {formatSecondsToTime(operation.plannedProductionSeconds)}
            </span>
          </div>
        </div>

        {/* 4. HORAS REAIS E TARIFAS EFETIVAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Horas Reais MO
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={laborHours}
              onChange={(e) => setLaborHours(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Taxa Real MO (R$/h)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={actualHourlyLaborRate}
              onChange={(e) => setActualHourlyLaborRate(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Horas Reais Máquina
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={machineHours}
              onChange={(e) => setMachineHours(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Taxa Real Máq (R$/h)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={actualHourlyMachineRate}
              onChange={(e) => setActualHourlyMachineRate(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded tabular-nums"
            />
          </div>
        </div>

        {/* 5. MATERIAIS EFETIVAMENTE CONSUMIDOS */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Custo Real de Materiais / Insumos (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={actualMaterialCost}
                onChange={(e) => setActualMaterialCost(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Previsto: {formatBRL(operation.materialPlannedCost)}
              </span>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Detalhamento dos Insumos Utilizados
              </label>
              <input
                type="text"
                value={materialNotes}
                onChange={(e) => setMaterialNotes(e.target.value)}
                placeholder="Ex: Utilizadas 2 latas de tinta amarela e 1 rolo extra de filme térmico"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </div>

        {/* 6. JUSTIFICATIVA DE EVENTUAL DESVIO (OBRIGATÓRIO PARA DIAGNÓSTICO) */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-800">
            Motivo de Eventual Desvio (Ocorrência / Justificativa)
          </label>
          <input
            type="text"
            value={deviationReason}
            onChange={(e) => setDeviationReason(e.target.value)}
            placeholder="Ex: Papel couché com estática causou paradas na alimentação; Acerto fino de cores exigiu 40 min extras."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
          <span className="text-[11px] text-slate-500">
            Este texto será registrado nos comparativos e no relatório executivo do produto.
          </span>
        </div>

        {/* 7. RESUMO CALCULADO DO APONTAMENTO */}
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-[#01B8AA]" />
              Custo Real deste Apontamento
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              Tempo Total: {formatSecondsToTime(totalActualSeconds)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Mão de Obra Real:</span>
              <span className="font-semibold text-white tabular-nums">
                {formatBRL(calculatedLaborCost)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Máquina Real:</span>
              <span className="font-semibold text-white tabular-nums">
                {formatBRL(calculatedMachineCost)}
              </span>
            </div>
            <div className="bg-[#01B8AA]/20 p-2 rounded-lg border border-[#01B8AA]/40">
              <span className="text-[10px] text-[#01B8AA] block font-medium">Total do Lançamento:</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatBRL(calculatedTotalCost)}
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
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Gravando...' : initialLog ? 'Salvar Edição' : 'Registrar Apontamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
