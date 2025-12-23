/**
 * Componente de Paginação Inteligente
 * 
 * Interface responsiva para navegação entre páginas com
 * informações de contexto e controles otimizados.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { PaginationMetadata } from '../../services/paginationService';

interface PaginationProps {
  pagination: PaginationMetadata;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
  showInfo?: boolean;
  showJumpToPage?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange,
  loading = false,
  className = '',
  showInfo = true,
  showJumpToPage = false
}) => {
  const {
    currentPage,
    totalPages,
    totalItems,
    hasNext,
    hasPrevious,
    pageSize
  } = pagination;

  // Calculate visible page numbers
  const getVisiblePages = (): (number | 'ellipsis')[] => {
    const delta = 2; // Number of pages to show around current page
    const pages: (number | 'ellipsis')[] = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);
    
    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push('ellipsis');
    }
    
    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      pages.push('ellipsis');
    }
    
    // Always show last page (if more than 1 page)
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const handlePageClick = (page: number) => {
    if (page !== currentPage && !loading) {
      onPageChange(page);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious && !loading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (hasNext && !loading) {
      onPageChange(currentPage + 1);
    }
  };

  if (totalPages <= 1) {
    return showInfo ? (
      <div className={`flex items-center justify-center text-sm text-slate-600 dark:text-slate-400 ${className}`}>
        {totalItems === 0 ? 'Nenhum item encontrado' : `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`}
      </div>
    ) : null;
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Info */}
      {showInfo && (
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Mostrando {startItem} a {endItem} de {totalItems} {totalItems === 1 ? 'item' : 'itens'}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          disabled={!hasPrevious || loading}
          className={`
            flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${hasPrevious && !loading
              ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }
          `}
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) => (
            page === 'ellipsis' ? (
              <div
                key={`ellipsis-${index}`}
                className="flex items-center justify-center w-10 h-10 text-slate-400 dark:text-slate-600"
              >
                <MoreHorizontal className="w-4 h-4" />
              </div>
            ) : (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                disabled={loading}
                className={`
                  flex items-center justify-center w-10 h-10 text-sm font-medium rounded-lg transition-colors
                  ${page === currentPage
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : loading
                    ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }
                `}
                aria-label={`Página ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={!hasNext || loading}
          className={`
            flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${hasNext && !loading
              ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }
          `}
          aria-label="Próxima página"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Jump to Page (Optional) */}
      {showJumpToPage && totalPages > 10 && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="jump-to-page" className="text-slate-600 dark:text-slate-400">
            Ir para:
          </label>
          <input
            id="jump-to-page"
            type="number"
            min={1}
            max={totalPages}
            defaultValue={currentPage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const page = parseInt((e.target as HTMLInputElement).value);
                if (page >= 1 && page <= totalPages) {
                  handlePageClick(page);
                }
              }
            }}
            className="w-16 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Componente simplificado para paginação móvel
 */
export const MobilePagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange,
  loading = false,
  className = ''
}) => {
  const { currentPage, totalPages, hasNext, hasPrevious } = pagination;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevious || loading}
        className={`
          flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
          ${hasPrevious && !loading
            ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }
        `}
      >
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </button>

      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <span>{currentPage}</span>
        <span>de</span>
        <span>{totalPages}</span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext || loading}
        className={`
          flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
          ${hasNext && !loading
            ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }
        `}
      >
        Próxima
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};