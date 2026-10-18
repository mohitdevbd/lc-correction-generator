import { useEffect } from 'react';

interface ShortcutHandlers {
  onGenerate?: () => void;
  onCopy?: () => void;
  onClear?: () => void;
}

export function useKeyboardShortcuts({ onGenerate, onCopy, onClear }: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Enter or Cmd+Enter
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        onGenerate?.();
        return;
      }

      // Check for Ctrl+Shift+C or Cmd+Shift+C
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
        event.preventDefault();
        onCopy?.();
        return;
      }

      // Check for Escape (only if not inside a modal or focused textarea)
      if (event.key === 'Escape') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        // If user is actively typing in input or textarea, escape unfocuses it first
        if (activeTag === 'input' || activeTag === 'textarea') {
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
        onClear?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGenerate, onCopy, onClear]);
}
