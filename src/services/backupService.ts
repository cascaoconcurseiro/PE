/**
 * Serviço de Backup Local
 *
 * Implementa backup e restauração de dados usando IndexedDB
 * Permite recuperação de dados em caso de problemas
 */

import { logger } from './logger';

const DB_NAME = 'financial_backup';
const DB_VERSION = 1;
const STORE_NAME = 'backups';

interface BackupData {
  accounts: unknown[];
  transactions: unknown[];
  trips: unknown[];
  familyMembers: unknown[];
  budgets: unknown[];
  goals: unknown[];
  assets: unknown[];
  customCategories: unknown[];
}

interface BackupEntry {
  id: number;
  data: BackupData;
  timestamp: string;
  description: string;
}

/**
 * Abre conexão com IndexedDB
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('Erro ao abrir IndexedDB', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

/**
 * Salva backup local dos dados
 */
export const backupToLocal = async (
  data: BackupData,
  description: string = 'Backup automático'
): Promise<number> => {
  try {
    const db = await openDB();
    const backupId = Date.now();

    const entry: BackupEntry = {
      id: backupId,
      data,
      timestamp: new Date().toISOString(),
      description,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        logger.info('Backup local criado', undefined, { backupId, description });
        resolve(backupId);
      };

      request.onerror = () => {
        logger.error('Erro ao criar backup local', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Erro ao salvar backup local', error);
    throw error;
  }
};

/**
 * Restaura backup local pelo ID
 */
export const restoreFromLocal = async (backupId: number): Promise<BackupData | null> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(backupId);

      request.onsuccess = () => {
        const entry = request.result as BackupEntry | undefined;
        if (entry) {
          logger.info('Backup restaurado', undefined, { backupId });
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        logger.error('Erro ao restaurar backup', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Erro ao restaurar backup local', error);
    throw error;
  }
};

/**
 * Lista todos os backups disponíveis
 */
export const listBackups = async (): Promise<Omit<BackupEntry, 'data'>[]> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as BackupEntry[];
        // Retorna sem os dados para economizar memória
        const list = entries.map(({ id, timestamp, description }) => ({
          id,
          timestamp,
          description,
        }));
        resolve(list.sort((a, b) => b.id - a.id)); // Mais recente primeiro
      };

      request.onerror = () => {
        logger.error('Erro ao listar backups', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Erro ao listar backups locais', error);
    throw error;
  }
};

/**
 * Remove backup antigo pelo ID
 */
export const deleteBackup = async (backupId: number): Promise<void> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(backupId);

      request.onsuccess = () => {
        logger.info('Backup removido', undefined, { backupId });
        resolve();
      };

      request.onerror = () => {
        logger.error('Erro ao remover backup', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Erro ao remover backup local', error);
    throw error;
  }
};

/**
 * Limpa backups antigos, mantendo apenas os N mais recentes
 */
export const cleanupOldBackups = async (keepCount: number = 5): Promise<number> => {
  try {
    const backups = await listBackups();

    if (backups.length <= keepCount) {
      return 0;
    }

    const toDelete = backups.slice(keepCount);
    let deletedCount = 0;

    for (const backup of toDelete) {
      await deleteBackup(backup.id);
      deletedCount++;
    }

    logger.info('Backups antigos removidos', undefined, { deletedCount });
    return deletedCount;
  } catch (error) {
    logger.error('Erro ao limpar backups antigos', error);
    throw error;
  }
};

/**
 * Verifica se IndexedDB está disponível
 */
export const isBackupAvailable = (): boolean => {
  return typeof indexedDB !== 'undefined';
};

/**
 * Exporta backup como JSON para download
 */
export const exportBackupAsJSON = async (backupId: number): Promise<string | null> => {
  const data = await restoreFromLocal(backupId);
  if (!data) return null;

  return JSON.stringify(data, null, 2);
};

/**
 * Importa backup de JSON
 */
export const importBackupFromJSON = async (
  jsonString: string,
  description: string = 'Backup importado'
): Promise<number> => {
  try {
    const data = JSON.parse(jsonString) as BackupData;

    // Validação básica
    if (!data.accounts || !data.transactions) {
      throw new Error('Formato de backup inválido');
    }

    return await backupToLocal(data, description);
  } catch (error) {
    logger.error('Erro ao importar backup', error);
    throw error;
  }
};
