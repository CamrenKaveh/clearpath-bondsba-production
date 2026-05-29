import React, { memo, useMemo } from 'react';
import { AuditTraceTerminal } from './AuditTraceTerminal';
import { CommandPalette, type CommandPaletteAction } from './CommandPalette';
import type { AuditTraceDoc } from '../../../../shared/types/auditTrace';

interface AuditTraceWorkspaceProps {
  trace: AuditTraceDoc;
  onRunTrace: () => void;
  onOpenApplication: () => void;
  onExportTrace: () => void;
}

export const AuditTraceWorkspace = memo(function AuditTraceWorkspace({
  trace,
  onRunTrace,
  onOpenApplication,
  onExportTrace,
}: AuditTraceWorkspaceProps): JSX.Element {
  const actions = useMemo<CommandPaletteAction[]>(
    () => [
      { id: 'run-trace', label: 'Run underwriting trace', hint: 'Execute engine', run: onRunTrace },
      { id: 'open-application', label: 'Open application record', hint: trace.applicationId, run: onOpenApplication },
      { id: 'export-trace', label: 'Export immutable trace', hint: trace.id, run: onExportTrace },
    ],
    [onExportTrace, onOpenApplication, onRunTrace, trace.applicationId, trace.id],
  );

  return (
    <div className="min-h-screen bg-[#020617] p-4 text-slate-100 md:p-6">
      <CommandPalette actions={actions} />
      <AuditTraceTerminal trace={trace} />
    </div>
  );
});
