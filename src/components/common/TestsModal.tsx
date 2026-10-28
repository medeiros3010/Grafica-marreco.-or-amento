/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { runAllValidationTests, TestResult } from '../../services/validationSuite';

interface TestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestsModal: React.FC<TestsModalProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const executeTests = async () => {
    setLoading(true);
    try {
      const res = await runAllValidationTests();
      setResults(res);
    } catch (e) {
      console.error('Erro ao executar testes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeTests();
    }
  }, [isOpen]);

  const allPassed = results.length > 0 && results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bateria de Testes e Validação Matemática"
      subtitle="Validação em tempo real dos 14 cenários de cálculo, tempos, tributações, apontamento espelho, quantidade entregue e integridade"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            allPassed
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <ShieldCheck
              className={`w-6 h-6 ${allPassed ? 'text-emerald-700' : 'text-amber-700'}`}
            />
            <div>
              <h4 className="text-sm font-semibold">
                {loading
                  ? 'Executando testes automatizados...'
                  : allPassed
                  ? `Todos os ${results.length} cenários foram validados com 100% de precisão`
                  : `${passedCount} de ${results.length} testes aprovados`}
              </h4>
              <p className="text-xs opacity-80 mt-0.5">
                Custos de MO, máquina, matérias-primas, markup divisor por dentro, impostos por fora, erosão da margem e IndexedDB.
              </p>
            </div>
          </div>
          <button
            onClick={executeTests}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reexecutar Testes
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {results.map((test) => (
            <div key={test.id} className="p-4 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 tabular-nums">
                      #{test.id.toString().padStart(2, '0')}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{test.title}</span>
                  </div>
                  <p className="text-xs text-slate-600">{test.scenario}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                        Esperado pelo Requisito:
                      </span>
                      <span className="text-slate-700 tabular-nums font-mono text-[11px]">
                        {test.expected}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                        Calculado pelo Sistema:
                      </span>
                      <span
                        className={`tabular-nums font-mono text-[11px] font-medium ${
                          test.passed ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        {test.actual}
                      </span>
                    </div>
                  </div>

                  {test.details && (
                    <p className="text-[11px] text-slate-400 italic pt-1">{test.details}</p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                  {test.passed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Aprovado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Falha
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </Modal>
  );
};
