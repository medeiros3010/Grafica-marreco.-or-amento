/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProductProcessItem } from '../../types';
import {
  formatBRL,
  calculateProcessItemActualCost,
  formatHoursToHMin,
} from '../../services/calculator';
import { X, Cpu, Layers, Check, TrendingUp, TrendingDown, Clock, Calculator } from 'lucide-react';

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
  // 3 Tempos Independentes Realizados (em horas decimais)
  const [tempoProdutivoRealHoras, setTempoProdutivoRealHoras] = useState<number>(0);
  const [tempoAcertoRealHoras, setTempoAcertoRealHoras] = useState<number>(0);
  const [tempoExtraRealHoras, setTempoExtraRealHoras] = useState<number>(0);

  const [custoHoraReal, setCustoHoraReal] = useState<number>(0);
  const [quantidadeReal, setQuantidadeReal] = useState<number>(0);
  const [custoMilheiroReal, setCustoMilheiroReal] = useState<number>(0);
  const [realizadoNotas, setRealizadoNotas] = useState<string>('');

  // Cálculo automático: Tempo Total Real = Produtivo Real + Acerto Real + Extra Real
  const tempoTotalRealHoras = Number(
    (tempoProdutivoRealHoras + tempoAcertoRealHoras + tempoExtraRealHoras).toFixed(4)
  );

  useEffect(() => {
    if (processItem) {
      const prodH =
        processItem.tempoProdutivoRealHoras !== undefined
          ? processItem.tempoProdutivoRealHoras
          : processItem.tempoProdutivoHoras !== undefined
          ? processItem.tempoProdutivoHoras
          : (processItem.tempoRealHoras !== undefined ? processItem.tempoRealHoras : processItem.tempoPrevistoHoras);

      const acertoH =
        processItem.tempoAcertoRealHoras !== undefined
          ? processItem.tempoAcertoRealHoras
          : processItem.tempoAcertoHoras !== undefined
          ? processItem.tempoAcertoHoras
          : 0;

      const extraH =
        processItem.tempoExtraRealHoras !== undefined
          ? processItem.tempoExtraRealHoras
          : processItem.tempoExtraHoras !== undefined
          ? processItem.tempoExtraHoras
          : 0;

      setTempoProdutivoRealHoras(prodH || 0);
      setTempoAcertoRealHoras(acertoH || 0);
      setTempoExtraRealHoras(extraH || 0);

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
    tempoProdutivoHoras: processItem.tempoProdutivoHoras,
    tempoAcertoHoras: processItem.tempoAcertoHoras,
    tempoExtraHoras: processItem.tempoExtraHoras,
    tempoPrevistoHoras: processItem.tempoPrevistoHoras,
    tempoProdutivoRealHoras,
    tempoAcertoRealHoras,
    tempoExtraRealHoras,
    tempoRealHoras: tempoTotalRealHoras,
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
      tempoProdutivoRealHoras: processItem.tipoCobranca === 'HORA' ? tempoProdutivoRealHoras : undefined,
      tempoAcertoRealHoras: processItem.tipoCobranca === 'HORA' ? tempoAcertoRealHoras : undefined,
      tempoExtraRealHoras: processItem.tipoCobranca === 'HORA' ? tempoExtraRealHoras : undefined,
      tempoRealHoras: processItem.tipoCobranca === 'HORA' ? tempoTotalRealHoras : undefined,
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
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col">
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
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">
              Parâmetro Orçado
            </span>
            <div className="text-sm font-bold text-gray-800">{processItem.nome}</div>
            <div className="text-xs text-gray-600">
              {processItem.tipoCobranca === 'HORA' ? (
                <>
                  Tempo Total: <strong>{formatHoursToHMin(processItem.tempoPrevistoHoras)}</strong> ({processItem.tempoPrevistoHoras.toFixed(2)}h) a {formatBRL(processItem.custoHora)}/h ={' '}
                  <strong className="text-[#00897B]">{formatBRL(processItem.custoTotal)}</strong>
                  {(processItem.tempoProdutivoHoras !== undefined || processItem.tempoAcertoHoras !== undefined || processItem.tempoExtraHoras !== undefined) && (
                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                      <span className="text-blue-700 font-semibold">
                        Prod: {formatHoursToHMin(processItem.tempoProdutivoHoras)}
                      </span>
                      <span>·</span>
                      <span className="text-amber-700 font-semibold">
                        Acerto: {formatHoursToHMin(processItem.tempoAcertoHoras)}
                      </span>
                      <span>·</span>
                      <span className="text-purple-700 font-semibold">
                        Extra: {formatHoursToHMin(processItem.tempoExtraHoras)}
                      </span>
                    </div>
                  )}
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
            <div className="space-y-3 p-3 bg-sky-50/60 border border-sky-200 rounded-xl">
              <div className="font-bold text-sky-950 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#01B8AA]" />
                  Divisão do Tempo Real Executado
                </span>
                <span className="text-[10px] font-normal text-sky-700">
                  Soma automática
                </span>
              </div>

              {/* 3 Tempos Independentes */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-blue-700 uppercase mb-0.5 truncate" title="Tempo Produtivo Real">
                    Produtivo (h) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={tempoProdutivoRealHoras}
                    onChange={(e) => setTempoProdutivoRealHoras(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                    {formatHoursToHMin(tempoProdutivoRealHoras)}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-700 uppercase mb-0.5 truncate" title="Tempo de Acerto Real">
                    Acerto (h) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={tempoAcertoRealHoras}
                    onChange={(e) => setTempoAcertoRealHoras(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                    {formatHoursToHMin(tempoAcertoRealHoras)}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-purple-700 uppercase mb-0.5 truncate" title="Tempo Extra Real">
                    Extra (h) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={tempoExtraRealHoras}
                    onChange={(e) => setTempoExtraRealHoras(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                    {formatHoursToHMin(tempoExtraRealHoras)}
                  </span>
                </div>
              </div>

              {/* Resultado Automático: Tempo Total Real e Custo/Hora Real */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-sky-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-sky-900 block">
                    Tempo Total Real (Automático)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-base font-black font-mono text-[#00897B]">
                      {formatHoursToHMin(tempoTotalRealHoras)}
                    </span>
                    <span className="text-[11px] text-sky-800 font-mono">
                      ({tempoTotalRealHoras.toFixed(2)}h)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 text-[11px] mb-1">
                    Taxa Real da Hora (R$) *
                  </label>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={custoHoraReal}
                      onChange={(e) => setCustoHoraReal(Number(e.target.value))}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-gray-300 rounded-lg font-mono font-bold bg-white"
                    />
                  </div>
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
