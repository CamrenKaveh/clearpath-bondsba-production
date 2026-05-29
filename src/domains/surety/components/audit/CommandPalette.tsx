import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface CommandPaletteAction {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

interface CommandPaletteProps {
  actions: CommandPaletteAction[];
}

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const CommandPalette = memo(function CommandPalette({ actions }: CommandPaletteProps): JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return actions;
    return actions.filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(normalizedQuery));
  }, [actions, query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease }}
            className="w-full max-w-2xl border border-slate-700 bg-slate-950 shadow-2xl"
          >
            <div className="border-b border-slate-800 p-3">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Run command..."
                className="w-full bg-transparent font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.run();
                    setIsOpen(false);
                  }}
                  className="grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-3 text-left hover:bg-slate-900 focus:bg-slate-900 focus:outline-none"
                >
                  <span className="text-sm font-semibold text-slate-100">{action.label}</span>
                  <span className="font-mono text-xs text-slate-500">{action.hint}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
