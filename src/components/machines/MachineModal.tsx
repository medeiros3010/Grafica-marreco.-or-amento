/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Machine, BillingUnitType } from '../../types';
import { formatBRL } from '../../services/calculator';
import { Cpu, Clock, Layers } from 'lucide-react';

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
  const [tipoCobranca, setTipoCobranca] = useState<BillingUnitType>('HORA');
  const [custoHora, setCustoHora] = useState<number>(120);
  const [custoMilheiro, setCustoMilheiro] = useState<number>(80);
  const [descricao, setDescricao] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMachine) {
      setNome(initialMachine.nome);
      setTipoCobranca(initialMachine.tipoCobranca || 'HORA');
      setCustoHora(initialMachine.custoHora ?? 120);
      setCustoMilheiro(initialMachine.custoMilheiro ?? 80);
      setDescricao(initialMachine.descricao || '');
      setActive(initialMachine.active);
    } else {
      setNome('');
      setTipoCobranca('HORA');
      setCustoHora(120);
      setCustoMilheiro(80);
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
    if (tipoCobranca === 'HORA' && custoHora < 0) {
      setError('O custo por hora não pode ser negativo.');
      return;
    }
    if (tipoCobranca === 'MILHEIRO' && custoMilheiro < 0) {
      setError('O custo por milheiro não pode ser negativo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const machineData: Machine = {
        id: initialMachine ? initialMachine.id : `mach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nome: nome.trim(),
        tipoCobranca,
        custoHora: tipoCobranca === 'HORA' ? Number(custoHora) : 0,
        custoMilheiro: tipoCobranca === 'MILHEIRO' ? Number(custoMilheiro) : undefined,
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
      subtitle="Defina o equipamento e seu método de precificação (por hora ou por milheiro)"
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

        {/* TIPO DE PRECIFICAÇÃO */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Tipo de Precificação *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipoCobranca('HORA')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                tipoCobranca === 'HORA'
                  ? 'bg-white text-[#01B8AA] border-[#01B8AA] shadow-xs ring-1 ring-[#01B8AA]'
                  : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Custo por Hora</span>
            </button>

            <button
              type="button"
              onClick={() => setTipoCobranca('MILHEIRO')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                tipoCobranca === 'MILHEIRO'
                  ? 'bg-white text-[#01B8AA] border-[#01B8AA] shadow-xs ring-1 ring-[#01B8AA]'
                  : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Custo por Milheiro</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {tipoCobranca === 'HORA'
              ? 'O sistema utilizará o tempo de execução (em horas) para calcular o custo.'
              : 'O sistema utilizará a quantidade produzida para calcular o custo proporcionalmente a cada mil unidades.'}
          </p>
        </div>

        {/* CAMPOS DINÂMICOS CONFORME O TIPO DE PRECIFICAÇÃO */}
        {tipoCobranca === 'HORA' ? (
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
              Exemplo: 2 horas de execução a {formatBRL(custoHora)}/h = {formatBRL(custoHora * 2)}.
            </span>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custo por Milheiro da Máquina (R$/1.000 un) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-400 font-semibold">R$</span>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={custoMilheiro}
                onChange={(e) => setCustoMilheiro(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Exemplo: 5.000 unidades a {formatBRL(custoMilheiro)}/milheiro = {formatBRL((5000 / 1000) * custoMilheiro)}.
            </span>
          </div>
        )}

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

        {/* Resumo da Precificação Configurada */}
        <div className="p-3 bg-[#01B8AA]/10 border border-[#01B8AA]/30 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Cpu className="w-4 h-4 text-[#01B8AA]" />
            <span className="font-medium">
              {tipoCobranca === 'HORA' ? 'Taxa Horária Configurada:' : 'Taxa por Milheiro Configurada:'}
            </span>
          </div>
          <span className="text-sm font-bold text-[#01B8AA] font-mono tabular-nums">
            {tipoCobranca === 'HORA' ? `${formatBRL(custoHora)}/h` : `${formatBRL(custoMilheiro)} / 1.000 un`}
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
