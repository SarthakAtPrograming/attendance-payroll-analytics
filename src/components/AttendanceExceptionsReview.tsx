import React, { useState } from 'react';
import { MonthlyReport, AttendanceAnomaly, PunchOverride, OverridesMap, WorkHoursReconciliation, EmployeeMatchReview } from '../types';
import { AlertOctagon, CheckCircle2, Clock, CalendarDays, Key, Trash2 } from 'lucide-react';

interface Props {
  anomalies: AttendanceAnomaly[];
  overrides: OverridesMap;
  reconciliations: Record<string, WorkHoursReconciliation>;
  onApplyOverride: (anomaly: AttendanceAnomaly, override: PunchOverride) => void;
  onClearOverride: (anomalyId: string) => void;
  onApplyReconciliation: (key: string, recon: WorkHoursReconciliation) => void;
  onClearReconciliation: (key: string) => void;
  matchReviews?: EmployeeMatchReview[];
  onApproveMatch?: (fromId: string, toId: string) => void;
  onRejectMatch?: (fromId: string, toId: string) => void;
}

export default function AttendanceExceptionsReview({ 
  anomalies, 
  overrides, 
  reconciliations,
  onApplyOverride, 
  onClearOverride,
  onApplyReconciliation,
  onClearReconciliation,
  matchReviews,
  onApproveMatch,
  onRejectMatch
}: Props) {
  const invalidAnomalies = anomalies.filter(a => {
    if (a.type === 'Work Hours Reconciliation') {
      try {
        const val = JSON.parse(a.value);
        return val.status === 'Pending Reconciliation';
      } catch (_) {
        return true;
      }
    }
    return a.type === 'Invalid Punch' || 
      a.type === 'Incomplete Punch' || 
      a.type === 'After-Hours Attendance';
  });

  const approvedAnomalies = anomalies.filter(a => {
    if (a.type === 'Work Hours Reconciliation') {
      try {
        const val = JSON.parse(a.value);
        return val.status === 'Approved Reconciliation' || val.status === 'Rejected Reconciliation';
      } catch (_) {
        return false;
      }
    }
    return a.type === 'Approved Exception' || a.type === 'Manual Entry';
  });

  if (invalidAnomalies.length === 0 && approvedAnomalies.length === 0 && (!matchReviews || matchReviews.length === 0)) {
    return (
      <div className="bg-white border-2 border-slate-900 p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] items-center flex flex-col justify-center gap-4 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <h3 className="text-xl font-black text-slate-900 tracking-tight">NO EXCEPTIONS FOUND</h3>
        <p className="text-sm font-bold text-slate-500">All punch records are logically sound.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Match & Consolidation Review Board */}
      {matchReviews && matchReviews.length > 0 && (
        <div className="bg-slate-950 text-white border-3 border-slate-900 p-6 shadow-[6px_6px_0px_0px_rgba(79,70,229,1)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-indigo-500/30 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <AlertOctagon className="w-6 h-6 text-yellow-400 shrink-0" />
              <div>
                <h2 className="text-lg font-black text-white tracking-tighter uppercase leading-none">Employee Match & Consolidation Review</h2>
                <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest block mt-1">Resolve missing IDs, Name variations, and consolidate monthly indexes</span>
              </div>
            </div>
            <span className="sm:ml-auto self-start sm:self-center bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-1 border border-amber-500 shadow-[1px_1px_rgba(0,0,0,1)] uppercase">
              {matchReviews.length} Conflict{matchReviews.length > 1 ? 's' : ''} Identified
            </span>
          </div>

          <div className="space-y-4">
            {matchReviews.map(review => {
              const isApproved = review.status === 'Approved';
              const isRejected = review.status === 'Rejected';
              const isPending = review.status === 'Pending';

              return (
                <div key={review.id} className="bg-slate-900 border-2 border-slate-800 p-4 shadow-[3px_3px_0px_0px_rgba(79,70,229,0.3)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 border ${
                        isApproved ? 'bg-emerald-500 text-slate-950 border-emerald-600 shadow-[1px_1px_rgba(0,0,0,0.5)]' :
                        isRejected ? 'bg-red-500 text-white border-red-600 shadow-[1px_1px_rgba(0,0,0,0.5)]' :
                        'bg-amber-400 text-slate-950 border-amber-500 shadow-[1px_1px_rgba(0,0,0,0.5)]'
                      }`}>
                        {isApproved ? '✓ AUTO MATCHED' : isRejected ? '✗ REJECTED MATCH' : '⚠ NEEDS REVIEW'}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wide">{review.conflictType}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/80 p-3.5 border border-slate-800 font-mono text-xs">
                      <div>
                        <span className="text-[8px] text-slate-400 block font-sans font-black uppercase tracking-wider">SOURCE ATTENDANCE ENTRY:</span>
                        <div className="font-bold text-slate-100 flex items-center gap-1.5 mt-1">
                          <span className="bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 text-[10px]">{review.fromId}</span>
                          <span className="text-sm font-sans text-slate-200">{review.fromName}</span>
                          {review.fromDept && <span className="text-[10px] text-slate-400 font-sans font-bold">[{review.fromDept}]</span>}
                        </div>
                      </div>

                      {review.toId ? (
                        <div>
                          <span className="text-[8px] text-indigo-400 block font-sans font-black uppercase tracking-wider">SUGGESTED MASTER TARGET:</span>
                          <div className="font-bold text-indigo-200 flex items-center gap-1.5 mt-1">
                            <span className="bg-indigo-950 border border-indigo-700 text-indigo-300 px-1.5 py-0.5 text-[10px]">{review.toId}</span>
                            <span className="text-sm font-sans text-indigo-100">{review.toName}</span>
                            {review.toDept && <span className="text-[10px] text-indigo-300 font-sans font-bold">[{review.toDept}]</span>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[8px] text-red-400 block font-sans font-black uppercase tracking-wider">SUGGESTED MASTER TARGET:</span>
                          <span className="text-slate-400 italic text-[11px] block mt-1">No matching master record found. This employee will remain isolated.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {review.toId && (
                    <div className="flex items-center gap-2 shrink-0 lg:ml-4">
                      {isPending && (
                        <>
                          <button
                            onClick={() => onApproveMatch?.(review.fromId, review.toId)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] px-3.5 py-2 border-2 border-slate-950 shadow-[1.5px_1.5px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all cursor-pointer uppercase tracking-wider"
                          >
                            Approve Match
                          </button>
                          <button
                            onClick={() => onRejectMatch?.(review.fromId, review.toId)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-[10px] px-3.5 py-2 border-2 border-slate-950 shadow-[1.5px_1.5px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all cursor-pointer uppercase tracking-wider"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <div className="flex items-center gap-2.5">
                          <span className="text-emerald-400 text-xs font-black font-sans flex items-center gap-1 bg-emerald-900/30 border border-emerald-800 shrink-0 px-2.5 py-1">✓ MERGED INTO {review.toId}</span>
                          <button
                            onClick={() => onRejectMatch?.(review.fromId, review.toId)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-[9px] px-2 py-1 cursor-pointer"
                          >
                            Undo
                          </button>
                        </div>
                      )}

                      {isRejected && (
                        <span className="text-rose-400 text-xs font-black font-sans bg-rose-900/20 border border-rose-900/40 px-2.5 py-1">✗ REJECTED (INDEPENDENT CODES)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {invalidAnomalies.length > 0 && (
        <div className="bg-white border-3 border-slate-900 p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-4 mb-4">
            <AlertOctagon className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Pending Exceptions Review</h2>
            <span className="ml-auto bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 border border-amber-300 shadow-[1px_1px_0px_0px_rgba(217,119,6,1)]">
              {invalidAnomalies.length} RECORD{invalidAnomalies.length > 1 ? 'S' : ''}
            </span>
          </div>
          
          <p className="text-xs font-bold text-slate-500 mb-6">
             The following punch records are isolated from all systems because mathematical extraction is illogical or missing. Review and provide manual override values below.
          </p>
          
          <div className="space-y-4">
            {invalidAnomalies.map(anomaly => {
              const baseId = anomaly.id.replace('_inv', '').replace('_inc', '').replace('_man', '').replace('_aft', '').replace('_rec', '');
              
              if (anomaly.type === 'Work Hours Reconciliation') {
                const existingRecon = reconciliations[baseId as keyof typeof reconciliations];
                return (
                  <ReconciliationCard 
                    key={anomaly.id}
                    anomaly={anomaly}
                    reconciliation={existingRecon}
                    onApply={(recon) => onApplyReconciliation(baseId, recon)}
                    onClear={() => onClearReconciliation(baseId)}
                  />
                );
              }

              const existingOverride = overrides[baseId as keyof typeof overrides];
              return (
                <ExceptionCard 
                  key={anomaly.id} 
                  anomaly={anomaly}
                  override={existingOverride}
                  onApply={(ov) => onApplyOverride(anomaly, ov)}
                  onClear={() => onClearOverride(baseId)}
                />
              );
            })}
          </div>
        </div>
      )}

      {approvedAnomalies.length > 0 && (
        <div className="bg-slate-50 border-2 border-slate-300 p-6">
          <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-4 mb-4 opacity-70">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-black text-slate-700 tracking-tighter uppercase">Approved Exceptions & Manual Entries</h2>
            <span className="ml-auto bg-slate-200 text-slate-700 text-xs font-black px-2.5 py-1 border border-slate-300">
              {approvedAnomalies.length} RECORD{approvedAnomalies.length > 1 ? 'S' : ''}
            </span>
          </div>
          
          <div className="space-y-4">
            {approvedAnomalies.map(anomaly => {
              const baseId = anomaly.id.replace('_inv', '').replace('_inc', '').replace('_man', '').replace('_aft', '').replace('_rec', '');
              
              if (anomaly.type === 'Work Hours Reconciliation') {
                const existingRecon = reconciliations[baseId as keyof typeof reconciliations];
                return (
                  <ReconciliationCard 
                    key={anomaly.id}
                    anomaly={anomaly}
                    reconciliation={existingRecon}
                    onApply={(recon) => onApplyReconciliation(baseId, recon)}
                    onClear={() => onClearReconciliation(baseId)}
                  />
                );
              }

              const existingOverride = overrides[baseId as keyof typeof overrides];
              return (
                <ExceptionCard 
                  key={anomaly.id} 
                  anomaly={anomaly}
                  override={existingOverride}
                  onApply={(ov) => onApplyOverride(anomaly, ov)}
                  onClear={() => onClearOverride(baseId)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const ExceptionCard: React.FC<{ anomaly: AttendanceAnomaly; override?: PunchOverride; onApply: (o: PunchOverride) => void; onClear: () => void }> = ({ anomaly, override, onApply, onClear }) => {
  const valParts = anomaly.value.split(', ');
  let displayInTime = '';
  let displayOutTime = '';
  valParts.forEach(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('IN:')) displayInTime = trimmed.replace('IN:', '').trim();
    if (trimmed.startsWith('OUT:')) displayOutTime = trimmed.replace('OUT:', '').trim();
  });

  const isMissingOutTime = anomaly.description === 'Missing OUT Time' || (anomaly.type === 'Incomplete Punch' && (displayOutTime === '--:--' || displayOutTime === '00:00' || displayOutTime === ''));

  const [inTime, setInTime] = useState(override?.inTime || (isMissingOutTime ? displayInTime : ''));
  const [outTime, setOutTime] = useState(override?.outTime || '');
  const [status, setStatus] = useState(override?.status || '');
  
  const [isEditing, setIsEditing] = useState(!override);

  const inMinutes = parseTimeToMinutes(displayInTime);
  const showQuickAction = isMissingOutTime && inMinutes !== null && inMinutes <= 1050; // 17:30 is 1050 mins

  const handleSave = () => {
    onApply({
      inTime: inTime.trim() !== '' ? inTime : undefined,
      outTime: outTime.trim() !== '' ? outTime : undefined,
      status: status.trim() !== '' ? status : undefined,
      reason: ''
    });
    setIsEditing(false);
  };

  const handleConsider1730OutTime = () => {
    onApply({
      inTime: inTime.trim() !== '' ? inTime : (displayInTime || undefined),
      outTime: '17:30',
      reason: ''
    });
    setIsEditing(false);
  };
  
  const handleAbsent = () => {
    onApply({ status: 'A', reason: '' });
    setIsEditing(false);
  };
  
  const handleIgnore = () => {
    onApply({ ignore: true, reason: '' });
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-300 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row md:items-start gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5">{anomaly.empCode}</span>
          <span className="font-black text-sm text-slate-800">{anomaly.empName}</span>
        </div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" /> {anomaly.dateStr}
        </div>
        {isMissingOutTime ? (
          <div className="mt-3 space-y-2 select-none">
            <div className="grid grid-cols-2 gap-3 bg-red-50/50 border-2 border-dashed border-red-300 p-3 leading-snug">
              <div>
                <span className="text-[9px] text-red-700 font-extrabold uppercase block leading-tight">IN TIME</span>
                <span className="font-mono text-xs font-black text-slate-900">{displayInTime || '—'}</span>
              </div>
              <div>
                <span className="text-[9px] text-red-700 font-extrabold uppercase block leading-tight">OUT TIME</span>
                <span className="font-mono text-xs font-black text-red-600 bg-red-100 px-1 border border-red-300 uppercase">Missing</span>
              </div>
              <div>
                <span className="text-[9px] text-red-700 font-extrabold uppercase block leading-tight">STATUS</span>
                <span className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-1 uppercase leading-none">Pending Review</span>
              </div>
              <div>
                <span className="text-[9px] text-red-700 font-extrabold uppercase block leading-tight">REASON</span>
                <span className="text-[10px] font-black text-rose-950 bg-rose-200/50 px-1 uppercase leading-none border border-rose-300">Missing OUT Time</span>
              </div>
            </div>
          </div>
        ) : anomaly.type === 'Approved Exception' || anomaly.type === 'Manual Entry' ? (
          <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 break-words">
            <strong className="flex items-center gap-1 uppercase tracking-wider"><CheckCircle2 className="w-4 h-4"/> {anomaly.type === 'Manual Entry' ? 'MANUAL ENTRY ✓' : 'RESOLVED EXCEPTION ✓'}</strong> 
            <span className="block mt-1.5 text-slate-700">{anomaly.description}</span>
            <span className="font-mono mt-1 block text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 inline-block text-[10px]">PUNCH DATA: {anomaly.value}</span>
          </div>
        ) : (
          <div className="mt-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2 break-words">
            <strong>ERROR:</strong> {anomaly.description} <br/>
            <span className="font-mono mt-1 block text-slate-700 bg-white border border-slate-200 px-1 py-0.5 inline-block text-[10px]">RAW: {anomaly.value}</span>
          </div>
        )}
      </div>
      
      <div className="w-full md:w-auto bg-white p-3 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shrink-0 min-w-[280px]">
        {!isEditing && override ? (
          <div className="space-y-3">
             <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center justify-between border-b border-slate-100 pb-1">
                <span>Correction Applied</span>
                <CheckCircle2 className="w-3 h-3" />
             </div>
             {override.ignore ? (
                <div className="font-bold text-xs text-slate-500">Record Explicitly Ignored</div>
             ) : override.status === 'A' ? (
                <div className="font-bold text-xs text-red-600">Marked as ABSENT</div>
             ) : (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold text-slate-900">
                   <div><span className="text-[9px] text-slate-400 block font-sans">CORRECTED IN</span>{override.inTime || '—'}</div>
                   <div><span className="text-[9px] text-slate-400 block font-sans">CORRECTED OUT</span>{override.outTime || '—'}</div>
                </div>
             )}

             <div className="pt-1 flex gap-2">
               <button onClick={() => setIsEditing(true)} className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 underline active:translate-y-px">
                 Edit Again
               </button>
               <button onClick={onClear} className="text-[9px] font-black uppercase text-red-600 hover:text-red-800 underline active:translate-y-px ml-auto">
                 Reset Clear
               </button>
             </div>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Manual Override</span>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500">IN TIME (HH:MM)</label>
                <input 
                  type="time" 
                  value={inTime} 
                  onChange={e => setInTime(e.target.value)}
                  className="w-full border-2 border-slate-300 p-1 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500">
                  {isMissingOutTime ? 'CORRECT OUT' : 'OUT THRU (HH:MM)'}
                </label>
                <input 
                  type="time" 
                  value={outTime} 
                  onChange={e => setOutTime(e.target.value)}
                  className="w-full border-2 border-slate-300 p-1 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>


            
            <div className="pt-2 flex flex-wrap gap-2">
              {showQuickAction && (
                <button 
                  onClick={handleConsider1730OutTime} 
                  className="flex-1 min-w-[200px] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase px-2 py-1.5 border border-indigo-800 shadow-[1px_1px_0px_0px_rgba(55,48,163,1)] active:translate-y-px active:shadow-none"
                >
                  CONSIDER 05:30 PM AS OUT TIME
                </button>
              )}
              <button 
                onClick={handleSave} 
                className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase px-2 py-1.5 border border-emerald-800 shadow-[1px_1px_0px_0px_rgba(6,78,59,1)] active:translate-y-px active:shadow-none"
              >
                {anomaly.type === 'After-Hours Attendance' ? 'Approve After-Hours' : 'Approve Times'}
              </button>
              <button 
                onClick={handleAbsent} 
                className="flex-1 min-w-[80px] bg-red-100 hover:bg-red-200 text-red-700 font-black text-[9px] uppercase px-2 py-1.5 border border-red-300 shadow-[1px_1px_0px_0px_rgba(252,165,165,1)] active:translate-y-px active:shadow-none"
              >
                Mark Absent
              </button>
              <button 
                onClick={handleIgnore} 
                className="flex-1 min-w-[80px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[9px] uppercase px-2 py-1.5 border border-slate-300 shadow-[1px_1px_0px_0px_rgba(203,213,225,1)] active:translate-y-px active:shadow-none"
              >
                Ignore / Invalid
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function minutesToTimeStr(mins: number | null): string {
  if (mins === null || isNaN(mins) || mins < 0) return '--:--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ReconciliationCard: React.FC<{
  anomaly: AttendanceAnomaly;
  reconciliation?: WorkHoursReconciliation;
  onApply: (recon: WorkHoursReconciliation) => void;
  onClear: () => void;
}> = ({ anomaly, reconciliation, onApply, onClear }) => {
  let meta = {
    rawIn: '--:--',
    rawOut: '--:--',
    roundedIn: '--:--',
    roundedOut: '--:--',
    systemActual: 0,
    uploadedHours: 0,
    reconciliationSource: 'WORK',
    difference: 0,
    status: 'Pending Reconciliation'
  };
  try {
    meta = { ...meta, ...JSON.parse(anomaly.value) };
  } catch (e) {
    console.error("Failed to parse anomaly metadata JSON", e);
  }

  const [penaltyHours, setPenaltyHours] = useState(reconciliation?.penaltyHours ?? 0);
  const [penaltyMinutes, setPenaltyMinutes] = useState(reconciliation?.penaltyMinutes ?? 0);
  const reason = '';
  
  const [isEditing, setIsEditing] = useState(!reconciliation || reconciliation.status === 'Pending Reconciliation');

  const handleAction = (status: 'Approved Reconciliation' | 'Rejected Reconciliation') => {
    const penaltyApplied = penaltyHours + (penaltyMinutes / 60);
    const adjustedHours = Math.max(0, meta.systemActual - penaltyApplied);
    const reviewer = "jsarthak265@gmail.com"; 
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false }); 

    onApply({
      empCode: anomaly.empCode,
      dayNum: anomaly.dayNum,
      penaltyHours: Number(penaltyHours) || 0,
      penaltyMinutes: Number(penaltyMinutes) || 0,
      reason: reason,
      status: status,
      originalSystemHours: meta.systemActual,
      uploadedSheetHours: meta.uploadedHours,
      difference: meta.difference,
      penaltyApplied,
      adjustedHours,
      reviewer,
      timestamp
    });
    setIsEditing(false);
  };

  const formattedDiff = meta.difference.toFixed(2);
  const formattedSys = meta.systemActual.toFixed(2);
  const formattedUp = meta.uploadedHours.toFixed(2);

  return (
    <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col gap-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b-2 border-slate-900 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black bg-yellow-400 text-slate-900 border-2 border-slate-900 px-2 py-0.5">
              {anomaly.empCode}
            </span>
            <span className="font-black text-sm text-slate-900">{anomaly.empName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
              📅 {anomaly.dateStr}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-900 bg-indigo-50 border border-indigo-200 uppercase px-1.5 py-0.5 rounded leading-none">
              🔍 Source: {meta.reconciliationSource === 'OT' ? 'OT Column' : 'WORK Column'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reconciliation && reconciliation.status !== 'Pending Reconciliation' ? (
            <span className={`px-2.5 py-1 text-[10px] font-black uppercase border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(10,10,10,1)] ${
              reconciliation.status === 'Approved Reconciliation' 
                ? 'bg-emerald-300 text-emerald-950' 
                : 'bg-rose-300 text-rose-950'
            }`}>
              {reconciliation.status}
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] font-black uppercase text-amber-950 bg-amber-300 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(10,10,10,1)] animate-pulse">
              PENDING RECONCILIATION
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 border-2 border-slate-200">
        <div>
          <span className="text-[9px] text-slate-500 font-extrabold uppercase block leading-tight">Raw In/Out</span>
          <span className="font-mono text-xs font-black text-slate-800">{meta.rawIn} → {meta.rawOut}</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 font-extrabold uppercase block leading-tight">Rounded In/Out</span>
          <span className="font-mono text-xs font-black text-slate-800">{meta.roundedIn} → {meta.roundedOut}</span>
        </div>
        <div>
          <span className="text-[9px] text-indigo-700 font-extrabold uppercase block leading-tight">Sys Actual Hours</span>
          <span className="font-mono text-xs font-black text-indigo-950">{formattedSys} hrs</span>
        </div>
        <div>
          <span className="text-[9px] text-emerald-700 font-extrabold uppercase block leading-tight">
            Uploaded Sheet {meta.reconciliationSource === 'OT' ? 'OT' : 'WORK'}
          </span>
          <span className="font-mono text-xs font-black text-emerald-950">{formattedUp} hrs</span>
        </div>
         <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-2 mt-1 bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-2">
          <div className="text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-amber-200 pb-1 flex items-center gap-1.5">🚨 Detailed Reconciliation Comparison</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] font-bold text-slate-800">
            <div>
              <span className="text-[9px] font-sans font-bold text-slate-500 block uppercase leading-none mb-1">Sys Calculated Work Hours:</span>
              <span className="text-indigo-950 font-black">{formattedSys} hrs</span>
            </div>
            <div>
              <span className="text-[9px] font-sans font-bold text-slate-500 block uppercase leading-none mb-1">Uploaded Sheet ({meta.reconciliationSource === 'OT' ? 'OT Column' : 'WORK Column'}):</span>
              <span className="text-emerald-950 font-black">{formattedUp} hrs</span>
            </div>
            <div>
              <span className="text-[9px] font-sans font-black text-red-700 block uppercase leading-none mb-1">Difference Over-reported:</span>
              <span className="text-red-600 font-black">+{formattedDiff} Hours</span>
            </div>
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="bg-yellow-50/50 p-4 border-2 border-dashed border-slate-900 space-y-4">
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-yellow-200 pb-1">🛠️ Review Option Controls</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-950 uppercase tracking-wider block mb-1">
                Penalty Duration
              </label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <div className="relative">
                    <input 
                      type="number"
                      min={0}
                      max={23}
                      value={penaltyHours}
                      onChange={e => setPenaltyHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full border-2 border-slate-900 p-1.5 font-mono text-xs focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[8px] font-black text-slate-400">HRS</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <input 
                      type="number"
                      min={0}
                      max={59}
                      value={penaltyMinutes}
                      onChange={e => setPenaltyMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                      className="w-full border-2 border-slate-900 p-1.5 font-mono text-xs focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[8px] font-black text-slate-400">MINS</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 font-bold mt-1.5">
                Penalty hours will be subtracted from System Calculated actual hours.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => handleAction('Approved Reconciliation')}
              className="flex-1 bg-emerald-400 hover:bg-emerald-500 text-emerald-950 font-black text-[10px] uppercase px-3 py-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(10,10,10,1)] active:translate-y-px active:shadow-none"
            >
              ✓ Approve Reconciliation
            </button>
            <button
              onClick={() => handleAction('Rejected Reconciliation')}
              className="flex-1 bg-rose-400 hover:bg-rose-500 text-rose-950 font-black text-[10px] uppercase px-3 py-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(10,10,10,1)] active:translate-y-px active:shadow-none"
            >
              ✗ Reject (Keep Original)
            </button>
            {reconciliation && reconciliation.status !== 'Pending Reconciliation' && (
              <button
                onClick={() => {
                  onClear();
                  setIsEditing(true);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-850 font-bold text-[10px] uppercase px-3 py-2 border-2 border-slate-900 active:translate-y-px"
              >
                Reset Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-500 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              🛡️ Audit Trail Logged
            </span>
            <span className="text-[9px] text-slate-400 font-mono font-medium">{reconciliation?.timestamp}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[9px] text-emerald-700 font-bold block uppercase leading-none mb-1">Total Penalty Subtracted</span>
              <span className="font-mono font-black text-slate-800">{reconciliation?.penaltyApplied.toFixed(2)} hrs</span>
            </div>
            <div>
              <span className="text-[9px] text-emerald-700 font-bold block uppercase leading-none mb-1">Configured Penalty Hours</span>
              <span className="font-mono font-black text-slate-800">{reconciliation?.penaltyHours ?? 0} hrs</span>
            </div>
            <div>
              <span className="text-[9px] text-emerald-700 font-bold block uppercase leading-none mb-1">Configured Penalty Minutes</span>
              <span className="font-mono font-black text-slate-800">{reconciliation?.penaltyMinutes ?? 0} mins</span>
            </div>
            <div>
              <span className="text-[9px] text-emerald-700 font-bold block uppercase leading-none mb-1">Adjusted System Hours</span>
              <span className="font-mono font-black text-emerald-950 bg-emerald-100 border border-emerald-300 px-1">{reconciliation?.adjustedHours.toFixed(2)} hrs</span>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-medium">Approved by: <strong className="font-mono text-slate-700">{reconciliation?.reviewer}</strong></span>
            <button
              onClick={() => setIsEditing(true)}
              className="text-[10px] font-black text-indigo-700 hover:text-indigo-900 underline uppercase"
            >
              Modify Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
