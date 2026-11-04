import { Lock } from 'lucide-react';
import { APPOINTMENT_STATUS } from '../utils/labels.js';
import { time } from '../utils/format.js';
import { StatusBadge } from './ui/index.js';

/** Linha compacta de agendamento (dashboard, portal, fichas). */
export function AppointmentRow({ appt, onClick, showDate, dateLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-50"
    >
      <div className="w-14 shrink-0 text-right">
        {showDate && <p className="text-[11px] font-medium uppercase text-zinc-400">{dateLabel}</p>}
        <p className="text-sm font-semibold tabular text-zinc-900">{time(appt.start)}</p>
        <p className="text-[11px] tabular text-zinc-400">{time(appt.end)}</p>
      </div>
      <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: appt.instructor?.color || '#d4d4d8' }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-900">
          {appt.client?.confidential && <Lock className="size-3 shrink-0 text-zinc-500" />}
          {appt.client?.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {appt.service?.name}
          {appt.quantity > 1 && ` · ${appt.quantity} simuladores`}
          {appt.instructor && ` · ${appt.instructor.name}`}
          {appt.room && ` · ${appt.room.name}`}
        </p>
      </div>
      <StatusBadge map={APPOINTMENT_STATUS} value={appt.status} className="hidden sm:inline-flex" />
    </button>
  );
}
