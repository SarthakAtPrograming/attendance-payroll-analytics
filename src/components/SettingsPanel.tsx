import React, { useState } from 'react';
import { Configuration, PolicyAuditLogEntry } from '../types';
import { Save, RefreshCw, AlertCircle, Info, ShieldAlert, History, User } from 'lucide-react';

interface SettingsPanelProps {
  config: Configuration;
  onUpdateConfig: (newConfig: Configuration, customMessage?: string) => void;
}

export default function SettingsPanel({ config, onUpdateConfig }: SettingsPanelProps) {
  const [shiftStart, setShiftStart] = useState(config.shiftStart);
  const [shiftEnd, setShiftEnd] = useState(config.shiftEnd);
  const [graceLateMin, setGraceLateMin] = useState(config.graceLateMin);
  const [inTimeBuffer, setInTimeBuffer] = useState(config.inTimeBuffer ?? 11);
  const [outTimeBuffer, setOutTimeBuffer] = useState(config.outTimeBuffer ?? 15);
  const [excludeWeeklyOff, setExcludeWeeklyOff] = useState(config.excludeWeeklyOffFromAbsent);

  const [weeklyOffDay, setWeeklyOffDay] = useState(config.weeklyOffDay || 'Monday');
  const [numWeeklyOffDays, setNumWeeklyOffDays] = useState(config.numWeeklyOffDays || 1);
  const [weeklyOffDay2, setWeeklyOffDay2] = useState(config.weeklyOffDay2 || 'Sunday');

  // Parse custom policy fields
  const [minWorkHr, setMinWorkHr] = useState(() => {
    const parts = (config.minWorkHoursStr || "08:30").split(':');
    return parseInt(parts[0], 10) || 8;
  });
  const [minWorkMin, setMinWorkMin] = useState(() => {
    const parts = (config.minWorkHoursStr || "08:30").split(':');
    return parseInt(parts[1], 10) || 30;
  });

  const [penaltyHr, setPenaltyHr] = useState(() => {
    const parts = (config.penaltyTimeStr || "00:30").split(':');
    return parseInt(parts[0], 10) || 0;
  });
  const [penaltyMin, setPenaltyMin] = useState(() => {
    const parts = (config.penaltyTimeStr || "00:30").split(':');
    return parseInt(parts[1], 10) || 30;
  });

  const [message, setMessage] = useState<string>('');

  const handleSave = () => {
    const pad = (num: number) => String(num).padStart(2, '0');
    const newMinStr = `${pad(minWorkHr)}:${pad(minWorkMin)}`;
    const newPenStr = `${pad(penaltyHr)}:${pad(penaltyMin)}`;

    onUpdateConfig({
      ...config,
      shiftStart,
      shiftEnd,
      graceLateMin: inTimeBuffer, // keep grace threshold and inBuffer aligned to prevent desync
      inTimeBuffer,
      outTimeBuffer,
      excludeWeeklyOffFromAbsent: excludeWeeklyOff,
      minWorkHoursStr: newMinStr,
      penaltyTimeStr: newPenStr,
      weeklyOffDay,
      numWeeklyOffDays,
      weeklyOffDay2,
    }, "✓ Settings Saved\n✓ Attendance Recalculated");

    setMessage("✓ Settings Saved\n✓ Attendance Recalculated");
    setTimeout(() => setMessage(''), 4500);
  };

  const handleReset = () => {
    setShiftStart("09:00");
    setShiftEnd("17:30");
    setGraceLateMin(11);
    setInTimeBuffer(11);
    setOutTimeBuffer(15);
    setExcludeWeeklyOff(true);

    setMinWorkHr(8);
    setMinWorkMin(30);
    setPenaltyHr(0);
    setPenaltyMin(30);

    setWeeklyOffDay('Monday');
    setNumWeeklyOffDays(1);
    setWeeklyOffDay2('Sunday');

    onUpdateConfig({
      ...config,
      shiftStart: "09:00",
      shiftEnd: "17:30",
      graceLateMin: 11,
      inTimeBuffer: 11,
      outTimeBuffer: 15,
      excludeWeeklyOffFromAbsent: true,
      minWorkHoursStr: "08:30",
      penaltyTimeStr: "00:30",
      weeklyOffDay: 'Monday',
      numWeeklyOffDays: 1,
      weeklyOffDay2: 'Sunday'
    });

    setMessage('Work schedules and Weekly Off variables restored to standard defaults.');
    setTimeout(() => setMessage(''), 4500);
  };

  return (
    <div id="settings-view-panel" className="bg-white border-3 border-slate-900 p-6 max-w-4xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-8">
      {/* Header */}
      <div className="border-b-3 border-slate-900 pb-4">
        <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">Work Rules & Policy Configurations</h3>
        <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide">Control biometric thresholds, grace limits, and work policy parameters</p>
      </div>

      {/* Success Notification */}
      {message && (
        <div className="p-4 border-2 border-slate-900 bg-yellow-350 text-slate-950 text-xs font-black leading-relaxed flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-bounce">
          <Info className="w-4 h-4 text-slate-950 shrink-0" />
          <span className="whitespace-pre-line">{message}</span>
        </div>
      )}

      {/* Grid containing Standard settings & Work Hour Policy Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x-2 divide-slate-200">
        
        {/* Left Side: Standard Biometric Timing Options */}
        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-2">
              📅 Shift & Buffer Timing
            </h4>
            
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1">Official Shift Start</label>
                <input
                  type="time"
                  className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none font-bold"
                  value={shiftStart}
                  onChange={e => setShiftStart(e.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] text-slate-950 font-extrabold uppercase tracking-wide mb-1">Official Shift End</label>
                <input
                  type="time"
                  className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none font-bold"
                  value={shiftEnd}
                  onChange={e => setShiftEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-2">
              ⏱️ Biometric Tolerances
            </h4>

            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>IN TIME BUFFER</span>
                  <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 font-black">0-30 MINUTES</span>
                </label>
                <input
                  type="number"
                  className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none font-bold font-mono"
                  min={0}
                  max={30}
                  value={inTimeBuffer}
                  onChange={e => setInTimeBuffer(Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)))}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>OUT TIME BUFFER</span>
                  <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 font-black">0-30 MINUTES</span>
                </label>
                <input
                  type="number"
                  className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none font-bold font-mono"
                  min={0}
                  max={30}
                  value={outTimeBuffer}
                  onChange={e => setOutTimeBuffer(Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)))}
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ex-wo-checkbox"
                  className="w-4 h-4 rounded-none border-2 border-slate-900 text-slate-950 focus:ring-0 cursor-pointer"
                  checked={excludeWeeklyOff}
                  onChange={e => setExcludeWeeklyOff(e.target.checked)}
                />
                <label htmlFor="ex-wo-checkbox" className="text-[11px] text-slate-950 font-extrabold uppercase cursor-pointer select-none">
                  Exclude Weekly Offs from Absent counters
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Work Hour Policy Settings */}
        <div className="space-y-6 md:pl-8 pt-6 md:pt-0">
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-2 text-indigo-950">
              🛡️ Work Hour Policy Settings
            </h4>

            <div className="space-y-5">
              {/* Minimum Work Hours Selection */}
              <div className="flex flex-col">
                <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Minimum Work Hours</span>
                  <span className="text-[9px] text-indigo-800 bg-indigo-50 px-1.5 py-0.5 border border-indigo-200 font-black">Default: 08:30</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <select
                      className="w-full px-2 py-2 border-2 border-slate-900 text-xs font-extrabold bg-slate-50 focus:bg-white focus:outline-none focus:ring-0"
                      value={minWorkHr}
                      onChange={e => setMinWorkHr(parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')} hrs</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      className="w-full px-2 py-2 border-2 border-slate-900 text-xs font-extrabold bg-slate-50 focus:bg-white focus:outline-none focus:ring-0"
                      value={minWorkMin}
                      onChange={e => setMinWorkMin(parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: 60 }).map((_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')} mins</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 leading-normal">
                  Minimum actual work hours an employee must complete to avoid penalty deduction.
                </p>
              </div>

              {/* Penalty Time Selection */}
              <div className="flex flex-col">
                <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Penalty Time</span>
                  <span className="text-[9px] text-red-800 bg-red-50 px-1.5 py-0.5 border border-red-200 font-black">Default: 00:30</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <select
                      className="w-full px-2 py-2 border-2 border-slate-900 text-xs font-extrabold bg-slate-50 focus:bg-white focus:outline-none focus:ring-0"
                      value={penaltyHr}
                      onChange={e => setPenaltyHr(parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: 13 }).map((_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')} hrs</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      className="w-full px-2 py-2 border-2 border-slate-900 text-xs font-extrabold bg-slate-50 focus:bg-white focus:outline-none focus:ring-0"
                      value={penaltyMin}
                      onChange={e => setPenaltyMin(parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: 60 }).map((_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')} mins</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 leading-normal">
                  Deducted from actual work hours if they fall below the minimum.
                </p>
              </div>

              {/* Graphical Formula representation */}
              <div className="p-3 bg-indigo-50/50 border-2 border-dashed border-slate-900 space-y-2">
                <h5 className="text-[10px] font-black text-slate-900 uppercase">📈 CALCULATED NET WORK HOURS FORMULA:</h5>
                <div className="text-[10px] font-mono leading-tight space-y-1.5 text-slate-700">
                  <div className="bg-emerald-150 border border-emerald-400 p-1.5 rounded-none text-emerald-950 font-sans font-bold">
                    IF Actual hrs &ge; {String(minWorkHr).padStart(2, '0')}:{String(minWorkMin).padStart(2, '0')}
                    <div className="text-[9px] font-mono text-emerald-800 mt-0.5">Net Hours = Actual Hours</div>
                  </div>
                  <div className="bg-rose-150 border border-rose-400 p-1.5 rounded-none text-rose-950 font-sans font-bold">
                    ELSE (Actual hrs &lt; {String(minWorkHr).padStart(2, '0')}:{String(minWorkMin).padStart(2, '0')})
                    <div className="text-[9px] font-mono text-rose-800 mt-0.5">
                      Net Hours = Actual Hours - {String(penaltyHr).padStart(2, '0')}:{String(penaltyMin).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Off Settings Section */}
      <div className="border-t-3 border-slate-900 pt-6">
        <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-3 pb-1 border-b-2 border-slate-900 flex items-center gap-2">
          ⚙️ Weekly Off Settings
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1.5">
              {numWeeklyOffDays === 2 ? 'Weekly Off Day 1' : 'Weekly Off Day'}
            </label>
            <select
              className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-0 font-bold appearance-none relative"
              style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
              value={weeklyOffDay}
              onChange={e => setWeeklyOffDay(e.target.value)}
            >
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1.5">
              Number of Weekly Off Days
            </label>
            <select
              className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-0 font-bold appearance-none relative"
              style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
              value={numWeeklyOffDays}
              onChange={e => setNumWeeklyOffDays(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          {numWeeklyOffDays === 2 && (
            <div className="flex flex-col">
              <label className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wide mb-1.5">
                Weekly Off Day 2
              </label>
              <select
                className="px-3 py-2 border-2 border-slate-900 rounded-none text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-0 font-bold appearance-none relative"
                style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
                value={weeklyOffDay2}
                onChange={e => setWeeklyOffDay2(e.target.value)}
              >
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons (Save and Reset) */}
      <div className="border-t-3 border-slate-900 pt-5 flex flex-col sm:flex-row gap-3 justify-end">
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-950 text-xs font-black uppercase transition-all cursor-pointer rounded-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none"
        >
          <RefreshCw className="w-4 h-4" />
          Default Configurations
        </button>

        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2 bg-yellow-350 hover:bg-yellow-400 border-2 border-slate-900 text-slate-950 text-xs font-black uppercase transition-all cursor-pointer rounded-none shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none"
        >
          <Save className="w-4 h-4" />
          Save and Recompute reports
        </button>
      </div>

      {/* Advisory section */}
      <div className="p-4 bg-amber-50 border-2 border-slate-900 flex items-start gap-3 rounded-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
        <ShieldAlert className="w-5 h-5 text-amber-950 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-800 leading-relaxed font-bold uppercase">
          <strong>Notice:</strong> Modifying work hour standard defaults alters the final calculated <strong>Net Work Hours</strong> across all past active biometric rosters imported instantly. These figures run as the single source of truth for summaries, dashboard KPIs, employee detailing, exports, and charting analytics.
        </p>
      </div>
    </div>
  );
}
