/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { MachinesAndTasksView } from './components/operations/MachinesAndTasksView';
import { ProductsView } from './components/products/ProductsView';
import { ProductionLogsView } from './components/logs/ProductionLogsView';
import { ComparisonView } from './components/analysis/ComparisonView';
import { RawMaterialsView } from './components/materials/RawMaterialsView';
import { BackupModal } from './components/common/BackupModal';
import { TestsModal } from './components/common/TestsModal';
import { GoogleDriveModal } from './components/common/GoogleDriveModal';
import { GoogleAuthStartupModal } from './components/common/GoogleAuthStartupModal';
import { storage } from './services/storage';
import { initAuth } from './services/googleAuth';
import { StandardTask, Product, ProductionLog, Machine, RawMaterial } from './types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [tasks, setTasks] = useState<StandardTask[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    return (typeof window !== 'undefined' ? sessionStorage.getItem('grafica_selected_product_id') : '') || '';
  });
  const selectedProductIdRef = React.useRef<string>(selectedProductId);
  const [loading, setLoading] = useState(true);

  // Mantém a ref e a sessionStorage sincronizadas com o estado ativo
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    selectedProductIdRef.current = productId;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('grafica_selected_product_id', productId);
    }
  };

  React.useEffect(() => {
    selectedProductIdRef.current = selectedProductId;
    if (selectedProductId && typeof window !== 'undefined') {
      sessionStorage.setItem('grafica_selected_product_id', selectedProductId);
    }
  }, [selectedProductId]);

  // Modais utilitários
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isTestsOpen, setIsTestsOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isAuthStartupModalOpen, setIsAuthStartupModalOpen] = useState(false);

  const loadAllData = async () => {
    try {
      // Carregamento dos dados cadastrais e operacionais
      const [
        allMachines,
        allMaterials,
        allTasks,
        allProducts,
        allLogs,
      ] = await Promise.all([
        storage.getAllMachines(),
        storage.getAllMaterials(),
        storage.getAllTasks(),
        storage.getAllProducts(),
        storage.getAllLogs(),
      ]);

      setMachines(allMachines);
      setMaterials(allMaterials);
      setTasks(allTasks);
      setProducts(allProducts);
      setLogs(allLogs);

      // PRESERVAÇÃO TOTAL DA SELEÇÃO DO USUÁRIO:
      // Verifica se o ID selecionado atualmente ainda existe na lista de produtos.
      // Se existir, mantém! Jamais reseta de forma forçada para o primeiro item.
      const currentSelected =
        selectedProductIdRef.current ||
        (typeof window !== 'undefined' ? sessionStorage.getItem('grafica_selected_product_id') : '');

      const productStillExists = allProducts.some((p) => p.id === currentSelected);

      if (currentSelected && productStillExists) {
        if (selectedProductIdRef.current !== currentSelected) {
          setSelectedProductId(currentSelected);
          selectedProductIdRef.current = currentSelected;
        }
      } else if (allProducts.length > 0) {
        const firstId = allProducts[0].id;
        setSelectedProductId(firstId);
        selectedProductIdRef.current = firstId;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('grafica_selected_product_id', firstId);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar dados do IndexedDB:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const unsubscribeData = storage.subscribeDataChange(() => {
      loadAllData();
    });

    // Inicialização da sincronização com o Google Drive via OAuth2
    const unsubscribeAuth = initAuth(async (user, token) => {
      if (user && token) {
        try {
          // Lê os dados mais recentes do Google Drive
          await storage.connectGoogleDrive(token, user, 'PULL_FIRST');
          await loadAllData();
        } catch (e) {
          console.error('Erro na sincronização inicial do Google Drive:', e);
        }
      } else if (!user) {
        // Exibe modal de autenticação na inicialização se ainda não exibido na sessão
        const hasPrompted = sessionStorage.getItem('grafica_drive_prompted_v1');
        if (!hasPrompted) {
          sessionStorage.setItem('grafica_drive_prompted_v1', 'true');
          setIsAuthStartupModalOpen(true);
        }
      }
    });

    return () => {
      unsubscribeData();
      unsubscribeAuth();
    };
  }, []);

  const handleGoToLogs = (productId: string) => {
    handleSelectProduct(productId);
    setActiveTab('logs');
  };

  const handleGoToAnalysis = (productId: string) => {
    handleSelectProduct(productId);
    setActiveTab('analysis');
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#01B8AA]" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Inicializando sistema da Gráfica Marreco...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F3F4F6] font-sans antialiased text-[#374151]">
      {/* Menu Lateral de Navegação */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenTests={() => setIsTestsOpen(true)}
        counts={{
          machines: machines.length,
          materials: materials.length,
          tasks: tasks.length,
          products: products.length,
          logs: logs.filter((l) => !l.cancelled).length,
        }}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra Superior de Contexto com Indicador de Persistência no Google Drive */}
        <Header
          activeTab={activeTab}
          currentProductTitle={
            activeTab === 'logs' || activeTab === 'analysis'
              ? selectedProduct
                ? `${selectedProduct.code} - ${selectedProduct.name}`
                : undefined
              : undefined
          }
          onOpenGoogleDriveModal={() => setIsDriveModalOpen(true)}
          onOpenGoogleAuth={() => setIsAuthStartupModalOpen(true)}
          onOpenBackup={() => setIsBackupOpen(true)}
        />

        {/* Viewport de Conteúdo com Rolagem */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                products={products}
                logs={logs}
                tasks={tasks}
                onSelectProduct={(id) => {
                  setSelectedProductId(id);
                  setActiveTab('products');
                }}
                onGoToAnalysis={handleGoToAnalysis}
                onGoToLogs={handleGoToLogs}
                onOpenBackup={() => setIsBackupOpen(true)}
              />
            )}

            {activeTab === 'machines-tasks' && (
              <MachinesAndTasksView
                machines={machines}
                tasks={tasks}
                onRefresh={loadAllData}
              />
            )}

            {activeTab === 'materials' && (
              <RawMaterialsView materials={materials} onRefresh={loadAllData} />
            )}

            {activeTab === 'products' && (
              <ProductsView
                products={products}
                standardTasks={tasks}
                machines={machines}
                onRefresh={loadAllData}
                onGoToLogs={handleGoToLogs}
                onGoToAnalysis={handleGoToAnalysis}
              />
            )}

            {activeTab === 'logs' && (
              <ProductionLogsView
                products={products}
                logs={logs}
                selectedProductId={selectedProductId}
                onSelectProduct={handleSelectProduct}
                onRefresh={loadAllData}
                onGoToAnalysis={handleGoToAnalysis}
              />
            )}

            {activeTab === 'analysis' && (
              <ComparisonView
                products={products}
                logs={logs}
                selectedProductId={selectedProductId}
                onSelectProduct={handleSelectProduct}
                onGoToLogs={handleGoToLogs}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modal de Gerenciamento da Integração com o Google Drive */}
      <GoogleDriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onDataChanged={loadAllData}
      />

      {/* Modal de Conexão Google na Inicialização */}
      <GoogleAuthStartupModal
        isOpen={isAuthStartupModalOpen}
        onClose={() => setIsAuthStartupModalOpen(false)}
        onSyncComplete={loadAllData}
      />

      {/* Modal de Backup e Restauração de Dados em JSON */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onDataChanged={loadAllData}
      />

      {/* Modal Interativo com a Bateria de 10 Testes Mandatórios */}
      <TestsModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
      />
    </div>
  );
}
