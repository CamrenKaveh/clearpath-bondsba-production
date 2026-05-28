// src/components/QbFreshnessIndicator.jsx
// QuickBooks data freshness indicator badge showing sync status and recency.

export function getFreshnessStatus(lastSyncedAt) {
  // lastSyncedAt: ISO date string or null
  // Returns: { label, color, hoursAgo }
  if (!lastSyncedAt) return { label: 'Not Connected', color: 'gray', hoursAgo: null };
  const hoursAgo = (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return { label: 'Live Data', color: 'green', hoursAgo };
  if (hoursAgo < 72) return { label: 'Data May Be Stale', color: 'amber', hoursAgo };
  return { label: 'Reconnect QuickBooks', color: 'red', hoursAgo };
}

const colorMap = {
  green: {
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-700',
  },
  amber: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  red: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  gray: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-500',
  },
};

function getSubtext(hoursAgo) {
  if (hoursAgo === null) return 'Set up QB sync in Settings';
  if (hoursAgo < 48) {
    const rounded = Math.round(hoursAgo);
    return `Updated ${rounded} hour${rounded === 1 ? '' : 's'} ago`;
  }
  const daysAgo = Math.round(hoursAgo / 24);
  return `Updated ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
}

export function QbFreshnessIndicator({ lastSyncedAt, className = '' }) {
  const status = getFreshnessStatus(lastSyncedAt);
  const colors = colorMap[status.color];

  return (
    <div className={`flex items-center gap-3 rounded-lg ${colors.badge} px-4 py-3 ${className}`}>
      <div className={`flex-shrink-0 w-2 h-2 rounded-full ${colors.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{status.label}</div>
        <div className="text-xs opacity-75">{getSubtext(status.hoursAgo)}</div>
      </div>
    </div>
  );
}

export default QbFreshnessIndicator;
