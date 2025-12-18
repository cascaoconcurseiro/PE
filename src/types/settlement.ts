/**
 * Tipos para Sistema de Settlement (Acertos de Contas)
 */

import { BaseEntity } from '../types';

export interface SettlementRequest extends BaseEntity {
  id: string;
  payerId: string; // ID do usuário que deve pagar
  receiverId: string; // ID do usuário que deve receber
  amount: number;
  currency: string;
  status: SettlementStatus;
  transactionId?: string; // Transação relacionada (se houver)
  description?: string;
  metadata?: Record<string, unknown>;
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface SettlementPayment {
  id: string;
  settlementRequestId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod?: string;
  transactionId?: string; // Transação criada para o pagamento
}

export interface PendingSettlement extends SettlementRequest {
  payerName?: string;
  receiverName?: string;
  createdAt: string;
}

