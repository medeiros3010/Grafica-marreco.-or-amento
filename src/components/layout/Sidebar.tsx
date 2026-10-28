/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Layers,
  FileSpreadsheet,
  ClipboardCheck,
  BarChart3,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Package,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'machines'
  | 'materials'
  | 'tasks'
  | 'products'
  | 'logs'
  | 'analysis';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenBackup: () => void;
  onOpenTests: () => void;
  counts?: {
    machines: number;
    materials: number;
    tasks: number;
    products: number;
    logs: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenBackup,
  onOpenTests,
  counts,
}) => {
  const mainNavItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'dashboard',
      label: 'Painel Geral',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Produtos & Orçamentos',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      badge: counts?.products,
    },
    {
      id: 'logs',
      label: 'Realizado (Chão de Fábrica)',
      icon: <ClipboardCheck className="w-4 h-4" />,
      badge: counts?.logs,
    },
    {
      id: 'analysis',
      label: 'Análises & Margem',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  const catalogNavItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'machines',
      label: 'Máquinas & Custo/Hora',
      icon: <Cpu className="w-4 h-4" />,
      badge: counts?.machines,
    },
    {
      id: 'materials',
      label: 'Matérias-Primas (Insumos)',
      icon: <Package className="w-4 h-4" />,
      badge: counts?.materials,
    },
    {
      id: 'tasks',
      label: 'Tarefas & Operações',
      icon: <Layers className="w-4 h-4" />,
      badge: counts?.tasks,
    },
  ];

  return (
    <aside className="w-64 bg-[#01B8AA] text-white flex flex-col shrink-0 select-none shadow-md z-20">
      {/* Brand Header com Logotipo da Gráfica Marreco */}
      <div className="p-5 border-b border-white/15 flex items-center gap-3 bg-black/5">
        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 shadow-xs bg-white/10 flex items-center justify-center p-1">
          <img
            src="/assets/aistudio/image_fa3ff075.png"
            alt="gráfica marreco"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="truncate">
          <span className="text-base font-bold text-white tracking-tight leading-none block font-sans lowercase">
            gráfica marreco
          </span>
          <span className="text-[11px] text-white/80 mt-1 block truncate font-medium">
            custos e produção
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="p-3.5 space-y-1.5 flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-white/70 uppercase tracking-wider">
          Produção & Orçamentos
        </div>
        {mainNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-black/15 text-white font-semibold shadow-xs ring-1 ring-white/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-white/80'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                    isActive ? 'bg-white/25 text-white' : 'bg-black/10 text-white/90'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-white/70 uppercase tracking-wider">
          Cadastros Básicos
        </div>
        {catalogNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-black/15 text-white font-semibold shadow-xs ring-1 ring-white/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-white/80'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                    isActive ? 'bg-white/25 text-white' : 'bg-black/10 text-white/90'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-white/70 uppercase tracking-wider">
          Auditoria & Dados
        </div>

        {/* Botão de Testes Automatizados */}
        <button
          onClick={onOpenTests}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-white" />
          <span className="truncate">Bateria de Testes (14/14)</span>
        </button>

        {/* Botão de Backup Local JSON */}
        <button
          onClick={onOpenBackup}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <HardDrive className="w-4 h-4 text-white" />
          <span className="truncate">Backup & Dados JSON</span>
        </button>
      </nav>

      {/* Footer / Status do Banco de Dados Local */}
      <div className="p-4 border-t border-white/15 bg-black/10">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/80 text-[11px] font-medium">Armazenamento:</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-white font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            IndexedDB Local
          </span>
        </div>
        <p className="text-[10px] text-white/70 leading-tight">
          Dados gravados no navegador da Gráfica Marreco.
        </p>
      </div>
    </aside>
  );
};
