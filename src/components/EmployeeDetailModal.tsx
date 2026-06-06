import React from 'react';
import { EmployeeSummary } from '../types';
import { X, Clock, AlertTriangle, CheckSquare, Calendar, ChevronRight } from 'lucide-react';
import { minutesToTimeStr, formatHoursReadable } from '../utils/attendanceParser';

interface EmployeeDetailModalProps {
  employee: EmployeeSummary | null;
  onClose: () => void;
}

export default function EmployeeDetailModal({ employee, onClose }: EmployeeDetailModalProps) {
  if (!employee) return null;

  return (
    <div id="employee-drilldown-modal" className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Modal Card content */}
      <div className="bg-white rounded-none w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-3 border-slate-900 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header summary of employee */}
        <div className="bg-slate-950 text-white p-6 shrink-0 relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-3 border-slate-900">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 bg-white hover:bg-slate-100 text-slate-950 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-yellow-350">[{employee.id}]</span>
              <h3 className="text-xl font-black uppercase tracking-tight">{employee.name}</h3>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Detailed biometric shift punches and calculated times</p>
          </div>

          <div className="flex items-center gap-5 pr-12">
            <div className="text-center bg-white/10 px-3 py-1.5 border border-white/20">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Attendance Rate</span>
              <div className="text-lg font-black text-emerald-400 font-mono">{employee.attendancePercentage}%</div>
            </div>
            <div className="text-center bg-white/10 px-3 py-1.5 border border-white/20">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Act. Work Hours</span>
              <div className="text-sm font-black text-slate-300 font-mono">
                {employee.totalActualHours ?? employee.totalWorkHours}H
              </div>
            </div>
            <div className="text-center bg-white/10 px-3 py-1.5 border border-white/90 bg-yellow-350/10">
              <span className="text-[9px] text-yellow-350 uppercase font-bold tracking-wider">Net Work Hours</span>
              <div className="text-sm font-black text-yellow-350 font-mono">
                {employee.totalNetHours ?? employee.totalWorkHours}H
              </div>
            </div>
          </div>
        </div>

        {/* Core summary metrics header bar */}
        <div className="bg-slate-50 border-b-3 border-slate-900 px-6 py-4 shrink-0 grid grid-cols-2 sm:grid-cols-5 gap-4 text-center select-none">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Present Days</span>
            <span className="text-xs font-black text-emerald-650 font-mono uppercase block">✔️ {employee.presentDays} Days</span>
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Absent Days</span>
            <span className="text-xs font-black text-red-650 font-mono uppercase block">❌ {employee.absentDays} Days</span>
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Weekly Off</span>
            <span className="text-xs font-black text-slate-700 font-mono uppercase block">⛱️ {employee.weeklyOffDays} Days</span>
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Leaves / Hols</span>
            <span className="text-xs font-black text-slate-700 font-mono uppercase block">🌴 {employee.leaveDays + employee.holidayDays} Days</span>
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Late Days / Slabs</span>
            <span className={`text-xs font-black font-mono uppercase block ${employee.totalLateDays > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
              🚨 {employee.totalLateDays} / {employee.totalLateSlabs}
            </span>
          </div>
        </div>

        {/* Scrolling logs rows list */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50">
          <div className="flex items-center justify-between pointer-events-none mb-1 text-slate-500 text-xs font-black tracking-widest select-none uppercase">
            <span>Daily Attendance Timelines</span>
            <span className="flex items-center gap-1 font-black"><Calendar className="w-3.5 h-3.5" /> Monthly Punch Log</span>
          </div>

          {employee.dailyRecords.map(rec => {
            const isLate = rec.calculatedLateMins > 0;
            
            // Check early leaving details (clocked out before 17:30 / 5:30 PM)
            const leftEarly = (rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') && rec.parsedOutMin !== null && rec.parsedOutMin < 1050;
            
            // Determine BG depending on status
            let statusBg = 'bg-slate-200 text-slate-700 border-slate-300';
            let cardBorder = 'border-slate-300';
            if (rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') {
              statusBg = 'bg-emerald-400 text-slate-950 border-emerald-500';
              cardBorder = 'border-l-[10px] border-l-emerald-400';
            } else if (rec.status === 'A') {
              statusBg = 'bg-red-400 text-white border-red-500';
              cardBorder = 'border-l-[10px] border-l-red-400';
            } else if (rec.status === 'WO') {
              statusBg = 'bg-slate-300 text-slate-900 border-slate-400';
              cardBorder = 'border-l-[10px] border-l-slate-400';
            } else if (rec.status === 'HL' || rec.status === 'LV') {
              statusBg = 'bg-indigo-600 text-white border-indigo-750';
              cardBorder = 'border-l-[10px] border-l-indigo-600';
            } else if (rec.status === 'INVALID_PUNCH') {
              statusBg = 'bg-amber-400 text-slate-950 border-amber-600';
              cardBorder = 'border-l-[10px] border-l-amber-500';
            }

            return (
              <div
                key={rec.dayNum}
                className={`bg-white border-2 border-slate-900 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] ${cardBorder}`}
              >
                {/* Day num & Day Name & Status tag */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 border-2 border-slate-900 bg-yellow-350 flex flex-col items-center justify-center text-slate-950 shrink-0 select-none font-black">
                    <span className="text-sm font-black leading-none font-mono">{rec.dayNum}</span>
                    <span className="text-[8px] uppercase font-bold text-slate-900 mt-0.5">{rec.dayName.substring(0, 3)}</span>
                  </div>

                  <div className="space-y-1">
                    <span className={`inline-flex px-2 py-0.5 border border-slate-900 text-[9px] font-black uppercase ${statusBg}`}>
                      {rec.status === 'P' ? 'PRESENT' : rec.status === 'A' ? 'ABSENT' : rec.status === 'WO' ? 'WEEKLY OFF' : rec.status === 'INVALID_PUNCH' ? 'INVALID' : rec.status === 'APPROVED_EXCEPTION' ? 'APPROVED EXCEPTION' : rec.status === 'MANUAL_ENTRY' ? 'MANUAL ENTRY' : rec.status}
                    </span>
                    <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Shift Timing: 09:00 - 17:30</div>
                  </div>
                </div>

                {/* Timings log */}
                <div className="grid grid-cols-4 gap-4 px-2 select-text w-full md:w-auto">
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase block font-black tracking-wider">In-Punch</span>
                    <span className={`font-mono text-xs font-black ${isLate ? 'text-red-650 font-extrabold' : 'text-slate-950'}`}>
                      {rec.inTime || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase block font-black tracking-wider">Out-Punch</span>
                    <span className="font-mono text-xs font-black text-slate-950">
                      {rec.outTime || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase block font-black tracking-wider">Actual Hr</span>
                    <span className="font-mono text-xs font-black text-slate-500">
                      {rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY' ? `${(rec.actualWorkHrs ?? rec.calculatedRegularHrs).toFixed(1).replace(/\.0$/, '')}H` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase block font-black tracking-wider">Net Hr</span>
                    <span className="font-mono text-xs font-black text-slate-950 bg-yellow-50 px-1 border border-yellow-200">
                      {rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY' ? `${(rec.netWorkHrs ?? rec.calculatedRegularHrs).toFixed(1).replace(/\.0$/, '')}H` : '—'}
                    </span>
                  </div>
                </div>

                {/* Late coming absent tag notifications */}
                <div className="shrink-0 flex items-center gap-2 flex-wrap">
                  {isLate && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black border border-slate-900 bg-red-100 text-slate-950 uppercase select-none">
                      <Clock className="w-3.5 h-3.5 text-red-650" />
                      Late: {Math.ceil(rec.calculatedLateMins / 30)} SLABS
                    </span>
                  )}
                  {leftEarly && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black border border-slate-900 bg-amber-200 text-slate-950 uppercase select-none">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Early Exit
                    </span>
                  )}
                  {!isLate && !leftEarly && (rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') && (
                    <span className="text-[10px] text-emerald-650 font-black uppercase tracking-wider">✓ Compliant</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>

        {/* Footer controls */}
        <div className="bg-slate-50 border-t-3 border-slate-900 px-6 py-4 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-yellow-350 hover:bg-yellow-400 text-slate-950 border-2 border-slate-900 text-xs font-black uppercase transition-all cursor-pointer rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none"
          >
            Close Drill Down
          </button>
        </div>

      </div>
    </div>
  );
}
