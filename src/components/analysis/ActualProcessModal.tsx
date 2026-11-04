/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProductProcessItem } from '../../types';
import { formatBRL, calculateProcessItemActualCost } from '../../services/calculator';
import { X, Cpu, Layers, Check, TrendingUp, TrendingDown } from 'lucide-react';

interface ActualProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  processItem: ProductProcessItem | null;
  onSave: (updatedItem: ProductProcessItem) => void;
}

export const ActualProcessModal: React.FC<ActualProcessModalProps> = ({
  isOpen,
  onClose,
  processItem,
  onSave,
}) => {
  const [tempoRealHoras, setTempoRealHoras] = useState<number>(0);
  const [custoHoraReal, setCustoHoraReal] = useState<number>(0);
  const [quantidadeReal, setQuantidadeReal] = useState<number>(0);
  const [custoMilheiroReal, setCustoMilheiroReal] = useState<number>(0);
  const [realizadoNotas, setRealizadoNotas] = useState<string>('');

  useEffect(() => {
    if (processItem) {
      setTempoRealHoras(
        processItem.tempoRealHoras !== undefined
          ? processItem.tempoRealHoras
          : processItem.tempoPrevistoHoras
      );
      setCustoHoraReal(
        processItem.custoHoraReal !== undefined
          ? processItem.custoHoraReal
          : processItem.custoHora
      );
      setQuantidadeReal(
        processItem.quantidadeReal !== undefined
          ? processItem.quantidadeReal
          : processItem.quantidadeProducao
      );
      setCustoMilheiroReal(
        processItem.custoMilheiroReal !== undefined
          ? processItem.custoMilheiroReal
          : processItem.custoMilheiro
      );
      setRealizadoNotas(processItem.realizadoNotas || '');
    }
  }, [processItem]);

  if (!isOpen || !processItem) return null;

  const totalCustoReal = calculateProcessItemActualCost({
    tipoCobranca: processItem.tipoCobranca,
    tempoPrevistoHoras: processItem.tempoPrevistoHoras,
    custoHora: processItem.custoHora,
    quantidadeProducao: processItem.quantidadeProducao,
    custoMilheiro: processItem.custoMilheiro,
    tempoRealHoras,
    custoHoraReal,
    quantidadeReal,
    custoMilheiroReal,
  });

  const diferenca = Number((totalCustoReal - processItem.custoTotal).toFixed(2));
  const diferencaPct =
    processItem.custoTotal > 0
      ? Number(((diferenca / processItem.custoTotal) * 100).toFixed(1))
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...processItem,
      tempoRealHoras: processItem.tipoCobranca === 'HORA' ? tempoRealHoras : undefined,
      custoHoraReal: processItem.tipoCobranca === 'HORA' ? custoHoraReal : undefined,
      quantidadeReal: processItem.tipoCobranca === 'MILHEIRO' ? quantidadeReal : undefined,
      custoMilheiroReal: processItem.tipoCobranca === 'MILHEIRO' ? custoMilheiroReal : undefined,
      custoTotalReal: totalCustoReal,
      status: 'CONCLUIDA',
      realizadoNotas: realizadoNotas.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {processItem.tipoItem === 'MAQUINA' ? (
              <Cpu className="w-5 h-5 text-[#01B8AA]" />
            ) : (
              <Layers className="w-5 h-5 text-[#01B8AA]" />
            )}
            <div>
              <h3 className="text-sm font-bold text-[#374151]">
                Apontar Execução Real da Operação
              </h3>
              <p className="text-[11px] text-gray-500">
                {processItem.tipoItem === 'MAQUINA' ? 'Máquina' : 'Tarefa'}: {processItem.nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-gray-700">
          {/* Card Resumo do Orçado */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">
              Parâmetro Orçado
            </span>
            <div className="text-sm font-bold text-gray-800 mt-0.5">{processItem.nome}</div>
            <div className="text-xs text-gray-600 mt-1">
              {processItem.tipoCobranca === 'HORA' ? (
                <>
                  Previsto: <strong>{processItem.tempoPrevistoHoras} horas</strong> a {formatBRL(processItem.custoHora)}/h ={' '}
                  <strong className="text-[#00897B]">{formatBRL(processItem.custoTotal)}</strong>
                </>
              ) : (
                <>
                  Previsto: <strong>{processItem.quantidadeProducao.toLocaleString('pt-BR')} un</strong> a {formatBRL(processItem.custoMilheiro)}/milheiro ={' '}
                  <strong className="text-[#00897B]">{formatBRL(processItem.custoTotal)}</strong>
                </>
              )}
            </div>
          </div>

          {/* Campos Realizados conforme Tipo de Cobrança */}
          {processItem.tipoCobranca === 'HORA' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Tempo Real Efetivo (Horas) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={tempoRealHoras}
                  onChange={(e) => setTempoRealHoras(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Taxa Real da Hora (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-gray-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={custoHoraReal}
                    onChange={(e) => setCustoHoraReal(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Qtd. Real Produzida (un) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={quantidadeReal}
                  onChange={(e) => setQuantidadeReal(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Taxa do Milheiro Real (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-gray-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={custoMilheiroReal}
                    onChange={(e) => setCustoMilheiroReal(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Justificativa / Observações */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Observações / Motivo de Eventual Desvio (Opcional)
            </label>
            <textarea
              rows={2}
              value={realizadoNotas}
              onChange={(e) => setRealizadoNotas(e.target.value)}
              placeholder="Ex: Parada para troca de faca, quebra na alimentação..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
            />
          </div>

          {/* Card Comparativo com Desvio */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              diferenca > 0
                ? 'bg-rose-50/70 border-rose-200'
                : diferenca < 0
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-500 block">
                Custo Real Calculado
              </span>
              <span className="text-base font-bold font-mono text-gray-900">
                {formatBRL(totalCustoReal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-gray-500 block">
                Variação (R$ / %)
              </span>
              <div
                className={`text-xs font-bold font-mono flex items-center justify-end gap-1 ${
                  diferenca > 0
                    ? 'text-rose-600'
                    : diferenca < 0
                    ? 'text-emerald-600'
                    : 'text-gray-600'
                }`}
              >
                {diferenca > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : diferenca < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : null}
                {diferenca > 0 ? `+${formatBRL(diferenca)}` : formatBRL(diferenca)} ({diferenca > 0 ? '+' : ''}{diferencaPct}%)
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Salvar Realizado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
