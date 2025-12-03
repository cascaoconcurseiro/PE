import React from 'react';
import { Tab } from '@/components/ui/Tab';

export const Reports = () => {
  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row md:space-x-4 space-y-2 md:space-y-0">
        <Tab
          label="Resumo Mensal"
          className="flex-1 text-center py-2 rounded-md bg-gray-100 dark:bg-gray-800"
        />
        <Tab
          label="Detalhes"
          className="flex-1 text-center py-2 rounded-md bg-gray-100 dark:bg-gray-800"
        />
        <Tab
          label="Histórico"
          className="flex-1 text-center py-2 rounded-md bg-gray-100 dark:bg-gray-800"
        />
      </div>
      {/* Rest of the report content */}
    </div>
  );
};