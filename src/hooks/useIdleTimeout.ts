import { useEffect, useRef } from 'react';
import { DEBUG_MODE } from '@/lib/constants';

interface UseIdleTimeoutOptions {
  timeoutMinutes: number;
  onTimeout: () => void;
  enableMultiTabSync?: boolean;
  enabled?: boolean;
}

export const useIdleTimeout = ({
  timeoutMinutes,
  onTimeout,
  enableMultiTabSync = true,
  enabled = true,
}: UseIdleTimeoutOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(0);
  const lastActivityKey = 'last_user_activity';

  const resetTimer = () => {
    // Debounce - só atualizar localStorage a cada 5 segundos
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    if (timeSinceLastUpdate < 5000) {
      // Menos de 5 segundos desde a última atualização - ignorar
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Update last activity timestamp
    if (enableMultiTabSync) {
      localStorage.setItem(lastActivityKey, now.toString());
      lastUpdateRef.current = now;
      if (DEBUG_MODE) {
        console.log(`🕐 Timer de inatividade resetado. Sessão expira em ${timeoutMinutes} minutos.`);
      }
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (DEBUG_MODE) {
        console.log(`⏰ Sessão expirada após ${timeoutMinutes} minutos de inatividade.`);
      }
      onTimeout();
    }, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    // Não fazer nada se disabled
    if (!enabled) return;

    // Check if session already expired on mount
    if (enableMultiTabSync) {
      const lastActivity = localStorage.getItem(lastActivityKey);
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        const timeoutMs = timeoutMinutes * 60 * 1000;
        
        if (timeSinceLastActivity >= timeoutMs) {
          onTimeout();
          return;
        }
      }
    }

    // Events to track user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Listen for activity in other tabs - prevenir loop infinito
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === lastActivityKey && e.newValue) {
        const newValue = parseInt(e.newValue);
        const currentValue = lastUpdateRef.current;
        
        // Só resetar se o valor for MAIS RECENTE (previne loop)
        if (newValue > currentValue) {
          resetTimer();
        }
      }
    };

    if (enableMultiTabSync) {
      window.addEventListener('storage', handleStorageChange);
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      if (enableMultiTabSync) {
        window.removeEventListener('storage', handleStorageChange);
      }
    };
  }, [timeoutMinutes, onTimeout, enableMultiTabSync, enabled]);
};
