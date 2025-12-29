import { useState, useEffect, useCallback } from 'react';
import { loadSheet, saveSheet } from '../storage/splitMoneyStore';

export const useSheetPersistence = (sheetName, parties, expenses, expenseTypes) => {
  const [isLoading, setIsLoading] = useState(true);

  // Auto-save with debouncing
  useEffect(() => {
    if (!sheetName || isLoading) return;
    
    const timeoutId = setTimeout(() => {
      saveSheet({ name: sheetName, parties, expenses, expenseTypes }).catch(() => {});
    }, 400);
    
    return () => clearTimeout(timeoutId);
  }, [sheetName, parties, expenses, expenseTypes, isLoading]);

  const loadSheetData = useCallback(async () => {
    if (!sheetName) return null;
    
    setIsLoading(true);
    try {
      const data = await loadSheet(sheetName);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, [sheetName]);

  return { loadSheetData, isLoading, setIsLoading };
};
