/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Machine } from '../../types';
import { formatBRL } from '../../services/calculator';
import { Cpu } from 'lucide-react';

interface MachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (machine: Machine) => Promise<void>;
  initialMachine?: Machine | null;
}

export const MachineModal: React.FC<MachineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMachine,
}) => {
  const [nome, setNome] = useState('');
  const [custoHora, setCustoHora] = useState<number>(100);
  const [descricao, setDescricao] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMachine) {
      setNome(initialMachine.nome);
      setCustoHora(initialMachine.custoHora);
      setDescricao(initialMachine.descricao || '');
      setActive(initialMachine.active);
    } else {
      setNome('');
      setCustoHora(120);
      setDescricao('');
      setActive(true);
    }
    setError(null);
  }, [initialMachine, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Informe o nome ou modelo da máquina.');
      return;
    }
    if (custoHora < 0) {
      setError('O custo por hora não pode ser negativo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const machineData: Machine = {
        id: initialMachine ? initialMachine.id : `mach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nome: nome.trim(),
        custoHora: Number(custoHora),
        descricao: descricao.trim() || undefined,
        active,
        createdAt: initialMachine ? initialMachine.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(machineData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar máquina');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialMachine ? `Editar Máquina: ${initialMachine.nome}` : 'Cadastrar Nova Máquina'}
      subtitle="Defina o equipamento do parque gráfico e sua taxa horária para cálculo automático em tarefas"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nome / Modelo da Máquina *
          </label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Guilhotina Polar Mohr 115, Heidelberg SM 74"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Custo por Hora da Máquina (R$/h) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs text-slate-400 font-semibold">R$</span>
            <input
              type="number"
              step="0.01"
              min={0}
              required
              value={custoHora}
              onChange={(e) => setCustoHora(Number(e.target.value))}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            />
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Este valor será puxado automaticamente sempre que uma tarefa for associada a esta máquina.
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Descrição / Especificações Técnicas (Opcional)
          </label>
          <textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Formato máximo 74x52cm, 4 cores, velocidade nominal 12.000 folhas/hora"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="machineActive"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded text-[#01B8AA] accent-[#01B8AA] cursor-pointer"
          />
          <label htmlFor="machineActive" className="text-xs font-medium text-slate-700 cursor-pointer">
            Máquina Ativa no Parque Gráfico
          </label>
        </div>

        {/* Resumo da taxa horária */}
        <div className="p-3 bg-[#01B8AA]/10 border border-[#01B8AA]/30 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Cpu className="w-4 h-4 text-[#01B8AA]" />
            <span className="font-medium">Valor Hora Configurado:</span>
          </div>
          <span className="text-sm font-bold text-[#01B8AA] font-mono tabular-nums">
            {formatBRL(custoHora)}/h
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
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
            {loading ? 'Salvando...' : initialMachine ? 'Salvar Alterações' : 'Cadastrar Máquina'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
