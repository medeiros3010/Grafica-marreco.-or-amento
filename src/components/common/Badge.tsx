/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProductStatus, OperationStatus, PRODUCT_STATUS_LABELS, OPERATION_STATUS_LABELS } from '../../types';

export const ProductStatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const styles: Record<ProductStatus, { bg: string; text: string; border: string }> = {
    RASCUNHO: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
    APROVADO: { bg: 'bg-[#01B8AA]/10', text: 'text-[#00897B]', border: 'border-[#01B8AA]/30' },
    EM_PRODUCAO: { bg: 'bg-[#F59E0B]/10', text: 'text-[#B45309]', border: 'border-[#F59E0B]/30' },
    CONCLUIDO: { bg: 'bg-[#10B981]/10', text: 'text-[#065F46]', border: 'border-[#10B981]/30' },
    CANCELADO: { bg: 'bg-[#EF4444]/10', text: 'text-[#B91C1C]', border: 'border-[#EF4444]/30' },
  };

  const style = styles[status] || styles.RASCUNHO;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
    >
      {PRODUCT_STATUS_LABELS[status] || status}
    </span>
  );
};

export const OperationStatusBadge: React.FC<{ status: OperationStatus; isPending?: boolean }> = ({
  status,
  isPending,
}) => {
  if (isPending || status === 'NAO_INICIADA') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        Pendente
      </span>
    );
  }

  const styles: Record<OperationStatus, { bg: string; text: string; border: string }> = {
    NAO_INICIADA: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
    EM_ANDAMENTO: { bg: 'bg-[#F59E0B]/10', text: 'text-[#B45309]', border: 'border-[#F59E0B]/30' },
    PARCIALMENTE_REALIZADA: { bg: 'bg-[#01B8AA]/10', text: 'text-[#00897B]', border: 'border-[#01B8AA]/30' },
    CONCLUIDA: { bg: 'bg-[#10B981]/10', text: 'text-[#065F46]', border: 'border-[#10B981]/30' },
  };

  const style = styles[status] || styles.NAO_INICIADA;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
    >
      {OPERATION_STATUS_LABELS[status] || status}
    </span>
  );
};
