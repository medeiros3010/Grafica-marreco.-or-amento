/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StandardTask, Product, ProductionLog, Machine, RawMaterial, ActualRecord } from '../types';
import {
  INITIAL_STANDARD_TASKS,
  INITIAL_PRODUCTS,
  INITIAL_PRODUCTION_LOGS,
  INITIAL_MACHINES,
  INITIAL_RAW_MATERIALS,
} from './seedData';

import { googleDriveService, DRIVE_DATABASE_FILENAME, DriveFileInfo } from './googleDriveService';
import { getCachedAccessToken, googleSignOut } from './googleAuth';
import type { User } from 'firebase/auth';

const DB_NAME = 'graficacustos_db_v1';
const DB_VERSION = 4;
const LOCAL_STORAGE_KEY = 'graficacustos_snapshot_v1';
const LOCAL_STORAGE_META_KEY = 'graficacustos_meta_v1';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface StorageStatusListener {
  (
    status: SaveStatus,
    lastSavedAt?: Date,
    errorMsg?: string,
    isDriveConnected?: boolean,
    driveDetails?: {
      fileId: string | null;
      fileName: string;
      lastSyncAt: Date | null;
      userEmail: string | null;
    }
  ): void;
}

export interface BackupData {
  format: 'GRAFICACUSTOS_BACKUP';
  version: number;
  exportedAt: string;
  machines: Machine[];
  materials: RawMaterial[];
  tasks: StandardTask[];
  products: Product[];
  logs: ProductionLog[];
  actualRecords: ActualRecord[];
  counts: {
    machines: number;
    materials: number;
    tasks: number;
    products: number;
    logs: number;
    actualRecords: number;
  };
}

export interface StorageSnapshot {
  version: number;
  updatedAt: string;
  machines: Machine[];
  materials: RawMaterial[];
  tasks: StandardTask[];
  products: Product[];
  logs: ProductionLog[];
  actualRecords: ActualRecord[];
}

class StorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Cache centralizado em memória (RAM)
  private memMachines: Map<string, Machine> = new Map();
  private memMaterials: Map<string, RawMaterial> = new Map();
  private memTasks: Map<string, StandardTask> = new Map();
  private memProducts: Map<string, Product> = new Map();
  private memLogs: Map<string, ProductionLog> = new Map();
  private memActualRecords: Map<string, ActualRecord> = new Map();

  // Status de salvamento e ouvintes
  private currentStatus: SaveStatus = 'saved';
  private lastSavedAt: Date = new Date();
  private lastError: string | null = null;
  private statusListeners: Set<StorageStatusListener> = new Set();
  private dataChangeListeners: Set<() => void> = new Set();
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Integração com Google Drive
  private isDriveConnected: boolean = false;
  private driveFileId: string | null = null;
  private driveUser: User | null = null;
  private driveLastSyncAt: Date | null = null;
  private driveUploadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Sincroniza abas/janelas via Storage Event
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
          try {
            const snapshot = JSON.parse(event.newValue) as StorageSnapshot;
            this.loadSnapshotIntoMemory(snapshot);
            this.notifyDataChange();
          } catch (e) {
            console.warn('Erro ao processar storage event externo:', e);
          }
        }
      });

      // Garantir flush de dados antes de fechar a janela
      window.addEventListener('beforeunload', () => {
        this.persistImmediateSnapshot();
      });
    }
  }

  // ==========================================
  // CONTROLE DE STATUS E EVENTOS
  // ==========================================

  public getSaveStatus(): { status: SaveStatus; lastSavedAt: Date; errorMsg: string | null } {
    return {
      status: this.currentStatus,
      lastSavedAt: this.lastSavedAt,
      errorMsg: this.lastError,
    };
  }

  public getDriveDetails() {
    return {
      isConnected: this.isDriveConnected,
      fileId: this.driveFileId,
      fileName: DRIVE_DATABASE_FILENAME,
      lastSyncAt: this.driveLastSyncAt,
      userEmail: this.driveUser?.email || null,
      userName: this.driveUser?.displayName || null,
      userPhoto: this.driveUser?.photoURL || null,
    };
  }

  public subscribeStatus(listener: StorageStatusListener): () => void {
    this.statusListeners.add(listener);
    // Dispara estado atual imediatamente para o novo ouvinte
    listener(
      this.currentStatus,
      this.lastSavedAt,
      this.lastError || undefined,
      this.isDriveConnected,
      {
        fileId: this.driveFileId,
        fileName: DRIVE_DATABASE_FILENAME,
        lastSyncAt: this.driveLastSyncAt,
        userEmail: this.driveUser?.email || null,
      }
    );
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: SaveStatus, errorMsg?: string) {
    this.currentStatus = status;
    if (status === 'saved') {
      this.lastSavedAt = new Date();
      this.lastError = null;
    } else if (status === 'error') {
      this.lastError = errorMsg || 'Erro desconhecido na gravação de dados';
    }
    this.statusListeners.forEach((l) => {
      try {
        l(
          this.currentStatus,
          this.lastSavedAt,
          this.lastError || undefined,
          this.isDriveConnected,
          {
            fileId: this.driveFileId,
            fileName: DRIVE_DATABASE_FILENAME,
            lastSyncAt: this.driveLastSyncAt,
            userEmail: this.driveUser?.email || null,
          }
        );
      } catch (err) {
        console.error('Erro em ouvinte de status do storage:', err);
      }
    });
  }

  public subscribeDataChange(listener: () => void): () => void {
    this.dataChangeListeners.add(listener);
    return () => this.dataChangeListeners.delete(listener);
  }

  private notifyDataChange() {
    this.dataChangeListeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Erro em ouvinte de alteração de dados:', err);
      }
    });
  }

  // ==========================================
  // INICIALIZAÇÃO E CAMADA DUAL (IndexedDB + localStorage)
  // ==========================================

  private hasIndexedDB(): boolean {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
  }

  private hasLocalStorage(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.hasIndexedDB()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('machines')) {
            const machineStore = db.createObjectStore('machines', { keyPath: 'id' });
            machineStore.createIndex('nome', 'nome', { unique: false });
            machineStore.createIndex('active', 'active', { unique: false });
          }

          if (!db.objectStoreNames.contains('materials')) {
            const matStore = db.createObjectStore('materials', { keyPath: 'id' });
            matStore.createIndex('nome', 'nome', { unique: false });
            matStore.createIndex('active', 'active', { unique: false });
          }

          if (!db.objectStoreNames.contains('tasks')) {
            const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
            taskStore.createIndex('code', 'code', { unique: true });
            taskStore.createIndex('sector', 'sector', { unique: false });
            taskStore.createIndex('active', 'active', { unique: false });
          }

          if (!db.objectStoreNames.contains('products')) {
            const prodStore = db.createObjectStore('products', { keyPath: 'id' });
            prodStore.createIndex('code', 'code', { unique: true });
            prodStore.createIndex('status', 'status', { unique: false });
          }

          if (!db.objectStoreNames.contains('logs')) {
            const logStore = db.createObjectStore('logs', { keyPath: 'id' });
            logStore.createIndex('productId', 'productId', { unique: false });
            logStore.createIndex('operationId', 'operationId', { unique: false });
            logStore.createIndex('date', 'date', { unique: false });
          }

          if (!db.objectStoreNames.contains('actual_records')) {
            const actualStore = db.createObjectStore('actual_records', { keyPath: 'id' });
            actualStore.createIndex('productId', 'productId', { unique: false });
          }

          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'id' });
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = (event) => {
          console.warn('IndexedDB bloqueado ou com falha. Operando com localStorage:', (event.target as IDBOpenDBRequest).error);
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('Abertura do IndexedDB bloqueada por outra aba.');
          resolve(null);
        };
      } catch (err) {
        console.warn('Exceção ao instanciar IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Inicialização unificada e segura.
   * Garante que os dados existentes NUNCA sejam sobrescritos por coleções vazias.
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.setStatus('saving');

        // 1. Tenta carregar snapshot síncrono do localStorage (mais rápido e tolerante a reloads)
        let localSnapshot: StorageSnapshot | null = null;
        if (this.hasLocalStorage()) {
          try {
            const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
            if (raw) {
              localSnapshot = JSON.parse(raw) as StorageSnapshot;
            }
          } catch (e) {
            console.warn('Falha ao ler snapshot do localStorage:', e);
          }
        }

        // 2. Tenta conectar ao IndexedDB
        const db = await this.getDB();
        let idbSnapshot: StorageSnapshot | null = null;

        if (db) {
          idbSnapshot = await this.readAllFromIDB(db);
        }

        // 3. Estratégia de resolução de dados:
        // Prioriza a fonte que possui registros válidos reais.
        const idbHasData = idbSnapshot && (
          idbSnapshot.products.length > 0 ||
          idbSnapshot.tasks.length > 0 ||
          idbSnapshot.machines.length > 0
        );

        const localHasData = localSnapshot && (
          localSnapshot.products.length > 0 ||
          localSnapshot.tasks.length > 0 ||
          localSnapshot.machines.length > 0
        );

        let chosenSnapshot: StorageSnapshot | null = null;

        if (idbHasData && localHasData) {
          // Se ambos possuem dados, compara timestamps ou maior volume de registros
          const idbTime = new Date(idbSnapshot!.updatedAt || 0).getTime();
          const localTime = new Date(localSnapshot!.updatedAt || 0).getTime();
          chosenSnapshot = localTime >= idbTime ? localSnapshot : idbSnapshot;
        } else if (localHasData) {
          chosenSnapshot = localSnapshot;
        } else if (idbHasData) {
          chosenSnapshot = idbSnapshot;
        }

        if (chosenSnapshot) {
          // Dados salvos previamente encontrados: carrega em memória e re-sincroniza ambos
          this.loadSnapshotIntoMemory(chosenSnapshot);
          this.persistImmediateSnapshot();
          if (db) {
            await this.writeAllToIDB(db, chosenSnapshot);
          }
        } else {
          // Primeira execução no dispositivo: inicializa com dados mestres de demonstração (seed)
          this.loadSeedDataIntoMemory();
          const initialSnapshot = this.createSnapshotFromMemory();
          this.persistImmediateSnapshot();
          if (db) {
            await this.writeAllToIDB(db, initialSnapshot);
          }
        }

        this.isInitialized = true;
        this.setStatus('saved');
      } catch (err) {
        console.error('Erro na inicialização da persistência centralizada:', err);
        // Fallback resiliente: se der qualquer erro, nunca deixa a aplicação sem dados
        if (this.memProducts.size === 0) {
          this.loadSeedDataIntoMemory();
        }
        this.isInitialized = true;
        this.setStatus('saved');
      }
    })();

    return this.initPromise;
  }

  private loadSeedDataIntoMemory() {
    this.memMachines.clear();
    this.memMaterials.clear();
    this.memTasks.clear();
    this.memProducts.clear();
    this.memLogs.clear();
    this.memActualRecords.clear();

    for (const m of INITIAL_MACHINES) this.memMachines.set(m.id, { ...m });
    for (const mat of INITIAL_RAW_MATERIALS) this.memMaterials.set(mat.id, { ...mat });
    for (const t of INITIAL_STANDARD_TASKS) this.memTasks.set(t.id, { ...t });
    for (const p of INITIAL_PRODUCTS) this.memProducts.set(p.id, { ...p });
    for (const l of INITIAL_PRODUCTION_LOGS) this.memLogs.set(l.id, { ...l });
  }

  private loadSnapshotIntoMemory(snapshot: StorageSnapshot) {
    this.memMachines.clear();
    this.memMaterials.clear();
    this.memTasks.clear();
    this.memProducts.clear();
    this.memLogs.clear();
    this.memActualRecords.clear();

    if (Array.isArray(snapshot.machines)) {
      for (const m of snapshot.machines) this.memMachines.set(m.id, m);
    }
    if (Array.isArray(snapshot.materials)) {
      for (const mat of snapshot.materials) this.memMaterials.set(mat.id, mat);
    }
    if (Array.isArray(snapshot.tasks)) {
      for (const t of snapshot.tasks) this.memTasks.set(t.id, t);
    }
    if (Array.isArray(snapshot.products)) {
      for (const p of snapshot.products) {
        this.memProducts.set(p.id, p);
        if (p.actualRecord) {
          this.memActualRecords.set(p.actualRecord.id, p.actualRecord);
        }
      }
    }
    if (Array.isArray(snapshot.logs)) {
      for (const l of snapshot.logs) this.memLogs.set(l.id, l);
    }
    if (Array.isArray(snapshot.actualRecords)) {
      for (const r of snapshot.actualRecords) this.memActualRecords.set(r.id, r);
    }
  }

  private createSnapshotFromMemory(): StorageSnapshot {
    return {
      version: DB_VERSION,
      updatedAt: new Date().toISOString(),
      machines: Array.from(this.memMachines.values()),
      materials: Array.from(this.memMaterials.values()),
      tasks: Array.from(this.memTasks.values()),
      products: Array.from(this.memProducts.values()),
      logs: Array.from(this.memLogs.values()),
      actualRecords: Array.from(this.memActualRecords.values()),
    };
  }

  /**
   * Grava imediatamente no localStorage para garantir sobrevivência instantânea a reload / fechamento
   */
  private persistImmediateSnapshot(): boolean {
    if (!this.hasLocalStorage()) return false;
    try {
      const snapshot = this.createSnapshotFromMemory();
      const serialized = JSON.stringify(snapshot);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
      window.localStorage.setItem(
        LOCAL_STORAGE_META_KEY,
        JSON.stringify({
          updatedAt: snapshot.updatedAt,
          version: snapshot.version,
          itemCount:
            snapshot.machines.length +
            snapshot.materials.length +
            snapshot.tasks.length +
            snapshot.products.length +
            snapshot.logs.length,
        })
      );
      return true;
    } catch (e) {
      console.warn('Aviso: falha ao gravar snapshot síncrono no localStorage:', e);
      return false;
    }
  }

  /**
   * Gravação centralizada de qualquer entidade.
   * Atualiza a memória, o espelho do localStorage e o IndexedDB com garantia de status,
   * e agenda sincronização automática com o Google Drive caso conectado.
   */
  private async persistChange(): Promise<void> {
    this.setStatus('saving');

    // 1. Grava no localStorage imediatamente
    this.persistImmediateSnapshot();

    // 2. Grava de forma assíncrona no IndexedDB
    try {
      const db = await this.getDB();
      if (db) {
        const snapshot = this.createSnapshotFromMemory();
        await this.writeAllToIDB(db, snapshot);
      }
      this.setStatus('saved');
      this.notifyDataChange();
    } catch (err) {
      console.error('Erro na gravação assíncrona do IndexedDB:', err);
      // Se o localStorage gravou, ainda estamos seguros
      if (this.hasLocalStorage()) {
        this.setStatus('saved');
        this.notifyDataChange();
      } else {
        this.setStatus('error', err instanceof Error ? err.message : 'Falha na gravação');
        throw err;
      }
    }

    // 3. Agenda persistência no Google Drive se usuário estiver conectado
    if (this.isDriveConnected) {
      this.scheduleDriveSync();
    }
  }

  // ==========================================
  // SINCRONIZAÇÃO E PERSISTÊNCIA GOOGLE DRIVE
  // ==========================================

  public async connectGoogleDrive(
    token: string,
    user: User,
    mode: 'PULL_FIRST' | 'PUSH' = 'PULL_FIRST'
  ): Promise<{ action: 'PULLED' | 'CREATED' | 'PUSHED'; fileId: string }> {
    this.isDriveConnected = true;
    this.driveUser = user;
    this.setStatus('saving');

    try {
      const existingFile = await googleDriveService.findDatabaseFile(token);

      if (!existingFile) {
        // Arquivo ainda não existe no Google Drive do usuário: cria com a base atual
        const snapshot = this.createSnapshotFromMemory();
        const created = await googleDriveService.createDatabaseFile(token, snapshot);
        this.driveFileId = created.id;
        this.driveLastSyncAt = new Date();
        this.setStatus('saved');
        return { action: 'CREATED', fileId: created.id };
      }

      this.driveFileId = existingFile.id;

      if (mode === 'PUSH') {
        const snapshot = this.createSnapshotFromMemory();
        await googleDriveService.updateDatabaseFile(token, existingFile.id, snapshot);
        this.driveLastSyncAt = new Date();
        this.setStatus('saved');
        return { action: 'PUSHED', fileId: existingFile.id };
      }

      // PULL_FIRST: Lê os dados mais recentes do Google Drive (ex: alterações feitas na empresa ou em casa)
      const cloudSnapshot = await googleDriveService.downloadDatabaseFile(token, existingFile.id);
      if (
        cloudSnapshot &&
        (Array.isArray(cloudSnapshot.products) ||
          Array.isArray(cloudSnapshot.tasks) ||
          Array.isArray(cloudSnapshot.machines))
      ) {
        this.loadSnapshotIntoMemory(cloudSnapshot);
        this.persistImmediateSnapshot();
        const db = await this.getDB();
        if (db) {
          await this.writeAllToIDB(db, cloudSnapshot);
        }
        this.driveLastSyncAt = new Date();
        this.setStatus('saved');
        this.notifyDataChange();
        return { action: 'PULLED', fileId: existingFile.id };
      } else {
        // Se arquivo cloud estiver vazio ou incompatível, sobe a base local existente
        const snapshot = this.createSnapshotFromMemory();
        await googleDriveService.updateDatabaseFile(token, existingFile.id, snapshot);
        this.driveLastSyncAt = new Date();
        this.setStatus('saved');
        return { action: 'PUSHED', fileId: existingFile.id };
      }
    } catch (err: any) {
      console.error('Erro na conexão/sincronização com Google Drive:', err);
      this.setStatus('error', err?.message === 'AUTH_EXPIRED' ? 'Sessão Google expirada' : 'Erro ao sincronizar');
      throw err;
    }
  }

  public async disconnectGoogleDrive(): Promise<void> {
    this.isDriveConnected = false;
    this.driveFileId = null;
    this.driveUser = null;
    this.driveLastSyncAt = null;
    if (this.driveUploadDebounceTimer) {
      clearTimeout(this.driveUploadDebounceTimer);
      this.driveUploadDebounceTimer = null;
    }
    await googleSignOut();
    this.setStatus('saved');
  }

  public async forcePushToDrive(): Promise<void> {
    const token = getCachedAccessToken();
    if (!token) throw new Error('Não autenticado com o Google Drive');
    this.setStatus('saving');
    try {
      const snapshot = this.createSnapshotFromMemory();
      if (this.driveFileId) {
        await googleDriveService.updateDatabaseFile(token, this.driveFileId, snapshot);
      } else {
        const created = await googleDriveService.createDatabaseFile(token, snapshot);
        this.driveFileId = created.id;
      }
      this.driveLastSyncAt = new Date();
      this.setStatus('saved');
    } catch (err: any) {
      console.error('Erro ao forçar envio para o Google Drive:', err);
      this.setStatus('error', 'Erro ao sincronizar');
      throw err;
    }
  }

  public async forcePullFromDrive(): Promise<void> {
    const token = getCachedAccessToken();
    if (!token) throw new Error('Não autenticado com o Google Drive');
    if (!this.driveFileId) {
      const file = await googleDriveService.findDatabaseFile(token);
      if (!file) throw new Error('Arquivo de banco de dados não encontrado no Google Drive');
      this.driveFileId = file.id;
    }

    this.setStatus('saving');
    try {
      const cloudSnapshot = await googleDriveService.downloadDatabaseFile(token, this.driveFileId);
      this.loadSnapshotIntoMemory(cloudSnapshot);
      this.persistImmediateSnapshot();
      const db = await this.getDB();
      if (db) {
        await this.writeAllToIDB(db, cloudSnapshot);
      }
      this.driveLastSyncAt = new Date();
      this.setStatus('saved');
      this.notifyDataChange();
    } catch (err: any) {
      console.error('Erro ao restaurar do Google Drive:', err);
      this.setStatus('error', 'Erro ao sincronizar');
      throw err;
    }
  }

  private scheduleDriveSync() {
    if (!this.isDriveConnected) return;
    const token = getCachedAccessToken();
    if (!token) return;

    if (this.driveUploadDebounceTimer) {
      clearTimeout(this.driveUploadDebounceTimer);
    }

    this.driveUploadDebounceTimer = setTimeout(async () => {
      try {
        const currentToken = getCachedAccessToken();
        if (!currentToken || !this.isDriveConnected) return;

        this.setStatus('saving');
        const snapshot = this.createSnapshotFromMemory();

        if (this.driveFileId) {
          await googleDriveService.updateDatabaseFile(currentToken, this.driveFileId, snapshot);
        } else {
          const file = await googleDriveService.findDatabaseFile(currentToken);
          if (file) {
            this.driveFileId = file.id;
            await googleDriveService.updateDatabaseFile(currentToken, file.id, snapshot);
          } else {
            const created = await googleDriveService.createDatabaseFile(currentToken, snapshot);
            this.driveFileId = created.id;
          }
        }

        this.driveLastSyncAt = new Date();
        this.setStatus('saved');
      } catch (err: any) {
        console.error('Erro no salvamento automático no Google Drive:', err);
        this.setStatus('error', 'Erro ao sincronizar');
      }
    }, 700);
  }

  private async readAllFromIDB(db: IDBDatabase): Promise<StorageSnapshot | null> {
    return new Promise((resolve) => {
      try {
        const storeNames = ['machines', 'materials', 'tasks', 'products', 'logs', 'actual_records'];
        const validStores = storeNames.filter((name) => db.objectStoreNames.contains(name));
        if (validStores.length === 0) {
          resolve(null);
          return;
        }

        const tx = db.transaction(validStores, 'readonly');
        const snapshot: Partial<StorageSnapshot> = {
          version: DB_VERSION,
          updatedAt: new Date().toISOString(),
          machines: [],
          materials: [],
          tasks: [],
          products: [],
          logs: [],
          actualRecords: [],
        };

        if (db.objectStoreNames.contains('machines')) {
          const req = tx.objectStore('machines').getAll();
          req.onsuccess = () => (snapshot.machines = req.result || []);
        }
        if (db.objectStoreNames.contains('materials')) {
          const req = tx.objectStore('materials').getAll();
          req.onsuccess = () => (snapshot.materials = req.result || []);
        }
        if (db.objectStoreNames.contains('tasks')) {
          const req = tx.objectStore('tasks').getAll();
          req.onsuccess = () => (snapshot.tasks = req.result || []);
        }
        if (db.objectStoreNames.contains('products')) {
          const req = tx.objectStore('products').getAll();
          req.onsuccess = () => (snapshot.products = req.result || []);
        }
        if (db.objectStoreNames.contains('logs')) {
          const req = tx.objectStore('logs').getAll();
          req.onsuccess = () => (snapshot.logs = req.result || []);
        }
        if (db.objectStoreNames.contains('actual_records')) {
          const req = tx.objectStore('actual_records').getAll();
          req.onsuccess = () => (snapshot.actualRecords = req.result || []);
        }

        tx.oncomplete = () => {
          resolve(snapshot as StorageSnapshot);
        };
        tx.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  private async writeAllToIDB(db: IDBDatabase, snapshot: StorageSnapshot): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const storeNames = ['machines', 'materials', 'tasks', 'products', 'logs', 'actual_records', 'metadata'];
        const validStores = storeNames.filter((name) => db.objectStoreNames.contains(name));
        const tx = db.transaction(validStores, 'readwrite');

        if (db.objectStoreNames.contains('machines')) {
          const store = tx.objectStore('machines');
          store.clear();
          for (const m of snapshot.machines) store.put(m);
        }
        if (db.objectStoreNames.contains('materials')) {
          const store = tx.objectStore('materials');
          store.clear();
          for (const mat of snapshot.materials) store.put(mat);
        }
        if (db.objectStoreNames.contains('tasks')) {
          const store = tx.objectStore('tasks');
          store.clear();
          for (const t of snapshot.tasks) store.put(t);
        }
        if (db.objectStoreNames.contains('products')) {
          const store = tx.objectStore('products');
          store.clear();
          for (const p of snapshot.products) store.put(p);
        }
        if (db.objectStoreNames.contains('logs')) {
          const store = tx.objectStore('logs');
          store.clear();
          for (const l of snapshot.logs) store.put(l);
        }
        if (db.objectStoreNames.contains('actual_records')) {
          const store = tx.objectStore('actual_records');
          store.clear();
          for (const r of snapshot.actualRecords) store.put(r);
        }
        if (db.objectStoreNames.contains('metadata')) {
          const store = tx.objectStore('metadata');
          store.put({
            id: 'app_config',
            version: DB_VERSION,
            updatedAt: snapshot.updatedAt,
          });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ==========================================
  // CADASTRO BÁSICO: MÁQUINAS
  // ==========================================

  async getAllMachines(): Promise<Machine[]> {
    await this.ensureInitialized();
    return Array.from(this.memMachines.values());
  }

  async getMachineById(id: string): Promise<Machine | null> {
    await this.ensureInitialized();
    return this.memMachines.get(id) || null;
  }

  async saveMachine(machine: Machine): Promise<void> {
    await this.ensureInitialized();
    const updated: Machine = {
      ...machine,
      updatedAt: new Date().toISOString(),
      createdAt: machine.createdAt || new Date().toISOString(),
    };
    this.memMachines.set(updated.id, updated);
    await this.persistChange();
  }

  async deleteMachine(id: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    const tasks = await this.getAllTasks();
    const isUsed = tasks.some((t) => t.machineId === id || t.machine?.includes(id));
    if (isUsed) {
      return {
        success: false,
        error: 'Esta máquina está vinculada a tarefas cadastradas. Inative-a para preservar a integridade histórica.',
      };
    }

    this.memMachines.delete(id);
    await this.persistChange();
    return { success: true };
  }

  async toggleMachineActive(id: string, active: boolean): Promise<void> {
    const mach = await this.getMachineById(id);
    if (!mach) throw new Error('Máquina não encontrada');
    mach.active = active;
    await this.saveMachine(mach);
  }

  // ==========================================
  // CADASTRO BÁSICO: MATÉRIAS-PRIMAS (INSUMOS)
  // ==========================================

  async getAllMaterials(): Promise<RawMaterial[]> {
    await this.ensureInitialized();
    return Array.from(this.memMaterials.values());
  }

  async getMaterialById(id: string): Promise<RawMaterial | null> {
    await this.ensureInitialized();
    return this.memMaterials.get(id) || null;
  }

  async saveMaterial(material: RawMaterial): Promise<void> {
    await this.ensureInitialized();
    const updated: RawMaterial = {
      ...material,
      updatedAt: new Date().toISOString(),
      createdAt: material.createdAt || new Date().toISOString(),
    };
    this.memMaterials.set(updated.id, updated);
    await this.persistChange();
  }

  async deleteMaterial(id: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    const products = await this.getAllProducts();
    const isUsed = products.some((p) =>
      p.materials?.some((m) => m.materialId === id)
    );
    if (isUsed) {
      return {
        success: false,
        error: 'Esta matéria-prima está em uso em orçamentos. Inative-a para preservar a integridade histórica.',
      };
    }

    this.memMaterials.delete(id);
    await this.persistChange();
    return { success: true };
  }

  async toggleMaterialActive(id: string, active: boolean): Promise<void> {
    const mat = await this.getMaterialById(id);
    if (!mat) throw new Error('Matéria-prima não encontrada');
    mat.active = active;
    await this.saveMaterial(mat);
  }

  // ==========================================
  // TAREFAS PADRÃO
  // ==========================================

  async getAllTasks(): Promise<StandardTask[]> {
    await this.ensureInitialized();
    return Array.from(this.memTasks.values());
  }

  async getTaskById(id: string): Promise<StandardTask | null> {
    await this.ensureInitialized();
    return this.memTasks.get(id) || null;
  }

  async saveTask(task: StandardTask): Promise<void> {
    await this.ensureInitialized();
    const updated: StandardTask = {
      ...task,
      updatedAt: new Date().toISOString(),
      createdAt: task.createdAt || new Date().toISOString(),
    };
    this.memTasks.set(updated.id, updated);
    await this.persistChange();
  }

  async deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    this.memTasks.delete(id);
    await this.persistChange();
    return { success: true };
  }

  async toggleTaskActive(id: string, active: boolean): Promise<void> {
    const task = await this.getTaskById(id);
    if (!task) throw new Error('Tarefa não encontrada');
    task.active = active;
    await this.saveTask(task);
  }

  // ==========================================
  // PRODUTOS E ORÇAMENTOS
  // ==========================================

  async getAllProducts(): Promise<Product[]> {
    await this.ensureInitialized();
    return Array.from(this.memProducts.values());
  }

  async getProductById(id: string): Promise<Product | null> {
    await this.ensureInitialized();
    return this.memProducts.get(id) || null;
  }

  async saveProduct(product: Product): Promise<void> {
    await this.ensureInitialized();
    const updated: Product = {
      ...product,
      updatedAt: new Date().toISOString(),
      createdAt: product.createdAt || new Date().toISOString(),
    };
    this.memProducts.set(updated.id, updated);

    // Se o produto possuir actualRecord vinculado, sincroniza na coleção de actualRecords
    if (updated.actualRecord) {
      this.memActualRecords.set(updated.actualRecord.id, updated.actualRecord);
    }

    await this.persistChange();
  }

  async deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    this.memProducts.delete(id);

    // Limpeza em cascata de logs e actualRecords vinculados
    for (const [logId, l] of Array.from(this.memLogs.entries())) {
      if (l.productId === id) this.memLogs.delete(logId);
    }
    for (const [recId, r] of Array.from(this.memActualRecords.entries())) {
      if (r.productId === id) this.memActualRecords.delete(recId);
    }

    await this.persistChange();
    return { success: true };
  }

  // ==========================================
  // APONTAMENTOS DE PRODUÇÃO (LOGS)
  // ==========================================

  async getAllLogs(): Promise<ProductionLog[]> {
    await this.ensureInitialized();
    return Array.from(this.memLogs.values());
  }

  async getLogsByProductId(productId: string): Promise<ProductionLog[]> {
    await this.ensureInitialized();
    return Array.from(this.memLogs.values()).filter((l) => l.productId === productId);
  }

  async saveLog(log: ProductionLog): Promise<void> {
    await this.ensureInitialized();
    const updated: ProductionLog = {
      ...log,
      createdAt: log.createdAt || new Date().toISOString(),
    };
    this.memLogs.set(updated.id, updated);
    await this.persistChange();
  }

  async cancelLog(id: string, reason: string): Promise<void> {
    await this.ensureInitialized();
    const log = this.memLogs.get(id);
    if (!log) throw new Error('Apontamento não encontrado');
    log.cancelled = true;
    log.cancelledAt = new Date().toISOString();
    log.cancelledReason = reason;
    await this.saveLog(log);
  }

  // ==========================================
  // APONTAMENTO REALIZADO (LAYOUT ESPELHO - ACTUAL RECORD)
  // ==========================================

  async saveActualRecord(record: ActualRecord): Promise<void> {
    await this.ensureInitialized();
    const updated: ActualRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
      createdAt: record.createdAt || new Date().toISOString(),
    };
    this.memActualRecords.set(updated.id, updated);

    // Sincroniza diretamente no produto correspondente
    const prod = this.memProducts.get(record.productId);
    if (prod) {
      prod.actualRecord = updated;
      if (prod.materials) {
        prod.materials = prod.materials.map((m) => {
          const act = updated.materials.find(
            (rm) => rm.materialItemId === m.id || rm.nome.toLowerCase() === m.nome.toLowerCase()
          );
          if (act) {
            return {
              ...m,
              quantidadeReal: act.quantidadeReal,
              custoUnitarioReal: act.custoUnitarioReal,
              totalCustoReal: act.totalCustoReal,
            };
          }
          return m;
        });
      }
      if (prod.activeRevision?.materials) {
        prod.activeRevision.materials = prod.activeRevision.materials.map((m) => {
          const act = updated.materials.find(
            (rm) => rm.materialItemId === m.id || rm.nome.toLowerCase() === m.nome.toLowerCase()
          );
          if (act) {
            return {
              ...m,
              quantidadeReal: act.quantidadeReal,
              custoUnitarioReal: act.custoUnitarioReal,
              totalCustoReal: act.totalCustoReal,
            };
          }
          return m;
        });
      }
      this.memProducts.set(prod.id, prod);
    }

    await this.persistChange();
  }

  async getActualRecordByProduct(productId: string): Promise<ActualRecord | null> {
    await this.ensureInitialized();
    for (const r of this.memActualRecords.values()) {
      if (r.productId === productId) return r;
    }
    const prod = this.memProducts.get(productId);
    return prod?.actualRecord || null;
  }

  async getAllActualRecords(): Promise<ActualRecord[]> {
    await this.ensureInitialized();
    return Array.from(this.memActualRecords.values());
  }

  // ==========================================
  // BACKUP COMPLETO E RESTAURAÇÃO (JSON)
  // ==========================================

  async exportBackup(): Promise<string> {
    await this.ensureInitialized();
    const machines = Array.from(this.memMachines.values());
    const materials = Array.from(this.memMaterials.values());
    const tasks = Array.from(this.memTasks.values());
    const products = Array.from(this.memProducts.values());
    const logs = Array.from(this.memLogs.values());
    const actualRecords = Array.from(this.memActualRecords.values());

    const backup: BackupData = {
      format: 'GRAFICACUSTOS_BACKUP',
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      machines,
      materials,
      tasks,
      products,
      logs,
      actualRecords,
      counts: {
        machines: machines.length,
        materials: materials.length,
        tasks: tasks.length,
        products: products.length,
        logs: logs.length,
        actualRecords: actualRecords.length,
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  validateBackup(jsonString: string): { valid: boolean; data?: BackupData; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.format !== 'GRAFICACUSTOS_BACKUP') {
        return {
          valid: false,
          error: 'Formato de arquivo incompatível. O arquivo deve ser um backup gerado pela Gráfica Marreco.',
        };
      }
      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.products) || !Array.isArray(parsed.logs)) {
        return {
          valid: false,
          error: 'Estrutura corrompida: coleções essenciais de tarefas, produtos ou apontamentos ausentes.',
        };
      }

      // Normaliza coleções adicionais se ausentes em backups legados
      const normalized: BackupData = {
        format: 'GRAFICACUSTOS_BACKUP',
        version: parsed.version || DB_VERSION,
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        machines: Array.isArray(parsed.machines) ? parsed.machines : [],
        materials: Array.isArray(parsed.materials) ? parsed.materials : [],
        tasks: parsed.tasks,
        products: parsed.products,
        logs: parsed.logs,
        actualRecords: Array.isArray(parsed.actualRecords) ? parsed.actualRecords : [],
        counts: {
          machines: Array.isArray(parsed.machines) ? parsed.machines.length : 0,
          materials: Array.isArray(parsed.materials) ? parsed.materials.length : 0,
          tasks: parsed.tasks.length,
          products: parsed.products.length,
          logs: parsed.logs.length,
          actualRecords: Array.isArray(parsed.actualRecords) ? parsed.actualRecords.length : 0,
        },
      };

      return {
        valid: true,
        data: normalized,
      };
    } catch (e) {
      return {
        valid: false,
        error: `Arquivo JSON inválido: ${e instanceof Error ? e.message : 'Falha na leitura'}`,
      };
    }
  }

  async restoreBackup(backup: BackupData, mode: 'REPLACE' | 'MERGE'): Promise<void> {
    await this.ensureInitialized();
    this.setStatus('saving');

    if (mode === 'REPLACE') {
      this.memMachines.clear();
      this.memMaterials.clear();
      this.memTasks.clear();
      this.memProducts.clear();
      this.memLogs.clear();
      this.memActualRecords.clear();
    }

    if (Array.isArray(backup.machines)) {
      for (const m of backup.machines) this.memMachines.set(m.id, m);
    }
    if (Array.isArray(backup.materials)) {
      for (const mat of backup.materials) this.memMaterials.set(mat.id, mat);
    }
    if (Array.isArray(backup.tasks)) {
      for (const t of backup.tasks) this.memTasks.set(t.id, t);
    }
    if (Array.isArray(backup.products)) {
      for (const p of backup.products) {
        this.memProducts.set(p.id, p);
        if (p.actualRecord) {
          this.memActualRecords.set(p.actualRecord.id, p.actualRecord);
        }
      }
    }
    if (Array.isArray(backup.logs)) {
      for (const l of backup.logs) this.memLogs.set(l.id, l);
    }
    if (Array.isArray(backup.actualRecords)) {
      for (const r of backup.actualRecords) this.memActualRecords.set(r.id, r);
    }

    await this.persistChange();
  }

  async resetToSeedData(): Promise<void> {
    await this.ensureInitialized();
    this.loadSeedDataIntoMemory();
    await this.persistChange();
  }
}

export const storage = new StorageService();
