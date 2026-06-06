import React, { useState, useMemo } from 'react';
import { EmployeeSummary, DailyRecord } from '../types';
import {
  Calendar as CalendarIcon,
  Clock,
  Award,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  User,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Coffee,
  PieChart as PieIcon,
  HelpCircle,
  Download
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { formatHoursReadable, minutesToTimeStr } from '../utils/attendanceParser';

interface EmployeeDashboardProps {
  employees: EmployeeSummary[];
  selectedEmpId: string;
  onSelectEmpId: (id: string) => void;
  onOpenDetail?: (emp: EmployeeSummary) => void;
  isConsolidated?: boolean;
  allReports?: any[];
}

export default function EmployeeDashboard({ 
  employees, 
  selectedEmpId, 
  onSelectEmpId, 
  onOpenDetail,
  isConsolidated = false,
  allReports = []
}: EmployeeDashboardProps) {
  // Find currently selected employee
  const selectedEmp = useMemo(() => {
    return employees.find(emp => emp.id === selectedEmpId) || employees[0] || null;
  }, [employees, selectedEmpId]);

  // Find employee summaries in individual months
  const monthlySummaries = useMemo(() => {
    if (!isConsolidated || !allReports || !selectedEmp) return [];
    
    return allReports.map(rep => {
      // Find matching employee in this report
      const match = rep.employees?.find((e: any) => e.id === selectedEmp.id);
      if (!match) return null;
      
      return {
        monthName: rep.monthName,
        totalNetHours: match.totalNetHours ?? match.totalWorkHours ?? 0,
        presentDays: match.presentDays ?? 0,
        absentDays: match.absentDays ?? 0,
        weeklyOffDays: match.weeklyOffDays ?? 0,
        totalLateSlabs: match.totalLateSlabs ?? 0
      };
    }).filter(x => x !== null) as {
      monthName: string;
      totalNetHours: number;
      presentDays: number;
      absentDays: number;
      weeklyOffDays: number;
      totalLateSlabs: number;
    }[];
  }, [isConsolidated, allReports, selectedEmp]);

  // Handle dropdown change
  const handleEmpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectEmpId(e.target.value);
  };

  // Select employee directly
  const selectEmployee = (id: string) => {
    onSelectEmpId(id);
  };

  // Convert "HH:MM" 24 hour string to readable 12 hour string (e.g. "09:15" -> "09:15 AM")
  const formatTime12H = (timeStr: string) => {
    if (!timeStr || timeStr === '--:--') return '—';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${m} ${ampm}`;
  };

  // Helper to format minutes into readable decimal hours
  const formatMinsToHrs = (mins: number) => {
    if (mins === 0) return '0h';
    const hrs = mins / 60;
    return `${hrs.toFixed(1)}h`;
  };

  // Calculate high-level HR Performance Insights (Punctual, Highest OT, Lowest Attendance)
  const hrInsights = useMemo(() => {
    if (employees.length === 0) return null;

    // 1. Most Punctual (attendance > 85%, sorted by lowest average late minutes)
    const listForPunctual = [...employees]
      .filter(e => e.attendancePercentage >= 80)
      .sort((a, b) => a.totalLateSlabs - b.totalLateSlabs);
    const punctual = listForPunctual.slice(0, 3);

    // 2. Lowest Attendance Rate
    const listForLowAttn = [...employees]
      .filter(e => typeof e.attendancePercentage === 'number' && Number.isFinite(e.attendancePercentage))
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);
    const lowAttn = listForLowAttn.slice(0, 3);

    // 4. Workforce Consistency Index
    const totalCount = employees.filter(e => e && typeof e.attendancePercentage === 'number' && Number.isFinite(e.attendancePercentage)).length;
    const overallAvgAttn = totalCount > 0 
      ? employees.reduce((acc, curr) => {
          const val = curr && typeof curr.attendancePercentage === 'number' && Number.isFinite(curr.attendancePercentage)
            ? curr.attendancePercentage
            : 0;
          return acc + val;
        }, 0) / totalCount 
      : 0;
    const consistentCount = employees.filter(e => e && typeof e.attendancePercentage === 'number' && Number.isFinite(e.attendancePercentage) && e.attendancePercentage >= 90).length;
    const consistentPercent = totalCount > 0 ? Math.round((consistentCount / totalCount) * 100) : 0;

    return {
      punctual,
      lowAttn,
      overallAvgAttn: Math.round(overallAvgAttn),
      consistentPercent
    };
  }, [employees]);

  // Generate Calendar Grid items with proper padding offsets
  const calendarCells = useMemo(() => {
    if (!selectedEmp) return [];
    const records = selectedEmp.dailyRecords;
    if (records.length === 0) return [];

    // Map day abbreviations to column indices (0-indexed: Mon...Sun)
    const dayOfWeekMap: { [key: string]: number } = {
      'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6,
      'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
    };

    const firstDay = records[0];
    const firstDayNameLower = firstDay.dayName.toLowerCase();
    const startIndex = dayOfWeekMap[firstDayNameLower] !== undefined ? dayOfWeekMap[firstDayNameLower] : 0;

    // Create padded cells for the leading blank spaces in the calendar grid
    const paddedCells = Array.from({ length: startIndex }, (_, idx) => ({
      padding: true,
      id: `pad-${idx}`,
      dayNum: 0,
      status: '',
      inTime: '',
      outTime: '',
      calculatedLateMins: 0
    }));

    const realCells = records.map(rec => ({
      padding: false,
      id: `day-${rec.dayNum}`,
      dayNum: rec.dayNum,
      status: rec.status,
      inTime: rec.inTime,
      outTime: rec.outTime,
      calculatedLateMins: rec.calculatedLateMins,
      dayName: rec.dayName
    }));

    return [...paddedCells, ...realCells];
  }, [selectedEmp]);

  // Recharts: Attendance Status distribution data helper
  const pieDistributionData = useMemo(() => {
    if (!selectedEmp) return [];
    
    let present = 0;
    let absent = 0;
    let weeklyOff = 0;
    let leaveHolidays = 0;

    selectedEmp.dailyRecords.forEach(rec => {
      if (rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') present++;
      else if (rec.status === 'A') absent++;
      else if (rec.status === 'WO') weeklyOff++;
      else if (rec.status === 'LV' || rec.status === 'HL') leaveHolidays++;
    });

    return [
      { name: 'Present Days', value: present, color: '#10b981' },
      { name: 'Absent Days', value: absent, color: '#f43f5e' },
      { name: 'Weekly Offs', value: weeklyOff, color: '#64748b' },
      { name: 'Leaves / Holidays', value: leaveHolidays, color: '#6366f1' }
    ].filter(item => item.value > 0);
  }, [selectedEmp]);

  // Recharts: Daily In-Time vs Out-Time formatting & chart preparation
  const punchTrendsData = useMemo(() => {
    if (!selectedEmp) return [];

    return selectedEmp.dailyRecords.map(rec => {
      // In-time minutes from midnight: 09:00 = 540 min
      const inVal = rec.parsedInMin !== null ? rec.parsedInMin : null;
      // Out-time minutes from midnight: 17:30 = 1050 min
      const outVal = rec.parsedOutMin !== null ? rec.parsedOutMin : null;

      return {
        day: `Day ${rec.dayNum}`,
        dayNum: rec.dayNum,
        dayName: rec.dayName,
        'In Minutes': inVal,
        'Out Minutes': outVal,
        'Work Hours': rec.calculatedRegularHrs,
        'Actual Work Hours': rec.actualWorkHrs,
        'Net Work Hours': rec.netWorkHrs,
        'Late Slabs': Math.ceil(rec.calculatedLateMins / 30),
        status: rec.status,
        inTimeRaw: rec.inTime,
        outTimeRaw: rec.outTime
      };
    });
  }, [selectedEmp]);

  // Aggregate stats by calendar weeks
  const weeklySummary = useMemo(() => {
    if (!selectedEmp) return [];
    
    const records = selectedEmp.dailyRecords;
    const weeks: { [key: string]: DailyRecord[] } = {
      'Week 1 (Days 1-7)': [],
      'Week 2 (Days 8-14)': [],
      'Week 3 (Days 15-21)': [],
      'Week 4 (Days 22-28)': [],
      'Week 5 (Days 29+)': []
    };

    records.forEach(rec => {
      if (rec.dayNum <= 7) weeks['Week 1 (Days 1-7)'].push(rec);
      else if (rec.dayNum <= 14) weeks['Week 2 (Days 8-14)'].push(rec);
      else if (rec.dayNum <= 21) weeks['Week 3 (Days 15-21)'].push(rec);
      else if (rec.dayNum <= 28) weeks['Week 4 (Days 22-28)'].push(rec);
      else weeks['Week 5 (Days 29+)'].push(rec);
    });

    return Object.keys(weeks)
      .map(weekName => {
        const weekRecords = weeks[weekName];
        if (weekRecords.length === 0) return null;

        const presentDays = weekRecords.filter(r => r.status === 'P' || r.status === 'APPROVED_EXCEPTION' || r.status === 'MANUAL_ENTRY').length;
        const absentDays = weekRecords.filter(r => r.status === 'A').length;
        const weeklyLateDays = weekRecords.reduce((acc, r) => acc + (r.calculatedLateMins > 0 ? 1 : 0), 0);
        const weeklyLateSlabs = weekRecords.reduce((acc, r) => acc + (Math.ceil(r.calculatedLateMins / 30)), 0);
        const regHrs = weekRecords.reduce((acc, r) => acc + r.calculatedRegularHrs, 0);

        const activeDays = presentDays + absentDays;
        const attnPct = activeDays > 0 ? Math.round((presentDays / activeDays) * 100) : 100;

        return {
          week: weekName,
          presentDays,
          absentDays,
          attnPct,
          lateDays: weeklyLateDays,
          lateSlabs: weeklyLateSlabs,
          totalHours: parseFloat(regHrs.toFixed(1))
        };
      })
      .filter(item => item !== null);
  }, [selectedEmp]);

  // Smart HR Dynamic Remarks Generator for Table view
  const getDailyRemarks = (rec: DailyRecord) => {
    if (rec.status === 'WO') return 'Standard Weekly Off (Rest Day)';
    if (rec.status === 'A') return 'Absent (No Biometric Punch Recorded)';
    if (rec.status === 'LV') return 'Approved Leave Record';
    if (rec.status === 'HL') return 'Paid National/Public Holiday';
    if (rec.status === 'INVALID_PUNCH') return 'Invalid Punch (Requires Manual Review)';
    if (rec.status === 'APPROVED_EXCEPTION') return 'Approved Exception (Manual Override)';
    if (rec.status === 'MANUAL_ENTRY') return 'Manual Entry (Approved)';
    
    const remarks: string[] = [];
    if (rec.calculatedLateMins > 0) {
      remarks.push(`Late arrival: Penalized ${Math.ceil(rec.calculatedLateMins / 30)} slabs`);
    } else if (rec.inTime !== '--:--') {
      remarks.push('Punctual arrival');
    }

    // Check early departure
    if (rec.parsedOutMin !== null && rec.parsedOutMin < 1050) {
      remarks.push(`Early checkout (${rec.outTime})`);
    }

    if (rec.inTime !== '--:--' && rec.outTime === '--:--') {
      remarks.push('Single punch exception');
    }

    return remarks.length > 0 ? remarks.join(' | ') : 'Regular compliant attendance';
  };

  // Double formatting functions for Recharts clock dials
  const formatMinutesAsClockTicks = (value: number) => {
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayH = hours % 12 === 0 ? 12 : hours % 12;
    return `${String(displayH).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
  };

  // Simple day-wise CSV report exporter
  const exportEmpActivityToCSV = () => {
    if (!selectedEmp) return;
    const headers = 'Date/Day,IN Punch,OUT Punch,Actual Work Hours,Net Work Hours,Attendance Status,Late Days,Late Slabs,Remarks\n';
    
    const csvContent = selectedEmp.dailyRecords
      .map(rec => {
        const dateStr = `Day ${rec.dayNum} (${rec.dayName})`;
        const remarks = getDailyRemarks(rec).replace(/"/g, '""');
        const lateDay = rec.calculatedLateMins > 0 ? 1 : 0;
        const lateSlabs = Math.ceil(rec.calculatedLateMins / 30);
        return `"${dateStr}","${rec.inTime}","${rec.outTime}",${rec.actualWorkHrs ?? rec.calculatedRegularHrs},${rec.netWorkHrs ?? rec.calculatedRegularHrs},"${rec.status}",${lateDay},${lateSlabs},"${remarks}"`;
      })
      .join('\n');

    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Ledger_Emp_${selectedEmp.id}_${selectedEmp.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedEmp) {
    return (
      <div className="bg-white border-2 border-slate-900 p-8 text-center shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-2" />
        <h4 className="font-black text-lg uppercase tracking-tight">Data Unavailable</h4>
        <p className="text-xs text-slate-500 font-bold mt-1">Please load a biometric excel worksheet first.</p>
      </div>
    );
  }

  return (
    <div id="employee-dashboard-viewport" className="space-y-8 select-none">
      
      {/* 1. Header Toolbar & Combobox Selector */}
      <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border-2 border-slate-900 bg-indigo-50 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase text-slate-950 tracking-tight leading-none">Employee-wise Interactive Dashboard</h3>
            <span className="text-[10px] h-3 text-slate-400 font-black tracking-widest block uppercase mt-1">Operational Reports & Payroll Visibilities</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Label selector */}
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider shrink-0 block sm:text-right align-middle py-2.5">
            Select Employee:
          </span>
          <select
            className="px-4 py-2.5 border-2 border-slate-900 bg-slate-50 text-xs font-black text-slate-950 uppercase focus:outline-none focus:bg-white focus:ring-0 cursor-pointer w-full sm:w-64"
            value={selectedEmpId}
            onChange={handleEmpChange}
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                [{emp.id}] {emp.name.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Export Employee Day ledger */}
          <button
            onClick={exportEmpActivityToCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-2 border-slate-900 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Day Ledger</span>
          </button>

          {/* View Monthly Punch Log */}
          {selectedEmp && (
            <button
              onClick={() => onOpenDetail?.(selectedEmp)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer shrink-0"
            >
              <Activity className="w-4 h-4" />
              <span>Monthly Punch Log</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Employee Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* Core Employee Details (4 cols) */}
        <div 
          id="company-employee-info-card" 
          onClick={() => onOpenDetail?.(selectedEmp)}
          className="md:col-span-4 bg-slate-950 border-3 border-slate-900 text-white p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between relative overflow-hidden cursor-pointer hover:bg-slate-900 transition-colors group"
          title="Click card to view detailed monthly punch log"
        >
          <div className="absolute right-0 bottom-0 text-slate-900 font-black text-8xl h-32 select-none pointer-events-none tracking-tighter opacity-30 font-mono translate-x-3 translate-y-3">
            {selectedEmp.id}
          </div>
          <div className="space-y-4 z-10">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-white/10 px-2 py-1 border border-white/10 rounded">
                  INDIVIDUAL ROSTER PROFILE
                </span>
                <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest leading-none bg-slate-900 group-hover:bg-slate-850 px-2 py-1 border border-indigo-500 rounded hidden md:flex items-center gap-1">
                  VIEW PUNCH LOG
                </span>
              </div>
              
              <h2 
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.(selectedEmp);
                }}
                className="text-2xl font-black uppercase mt-4 tracking-tight font-sans text-white hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
                title="Click name to view detailed monthly punch log"
              >
                {selectedEmp.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs font-black text-yellow-350">ID CODE: [{selectedEmp.id}]</span>
                <span className="text-xs text-slate-400 font-bold">• Active Employee</span>
              </div>

              {/* View Details clickable action button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.(selectedEmp);
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer uppercase tracking-wider shrink-0"
              >
                <span>View Details & Punch Log</span>
                <ChevronRight className="w-3" />
              </button>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Base Business Location:</span>
                <span className="font-black text-slate-200">Main Factory Warehouse</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Configured Standard Shift:</span>
                <span className="font-mono font-black text-slate-200">09:00 AM - 17:30 PM</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Standard Work Day Slab:</span>
                <span className="font-mono font-black text-slate-200">8.0 hours net work</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 mt-6 flex items-center justify-between z-10">
            <div>
              <span className="text-[9px] text-slate-400 font-bold tracking-wider block uppercase">ATTENDANCE LEVEL</span>
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                {selectedEmp.attendancePercentage}%
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-400 font-bold tracking-wider block uppercase flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" /> Late Days / Slabs
              </span>
              <div className={`text-xl font-black font-mono tracking-tight ${selectedEmp.totalLateDays > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {selectedEmp.totalLateDays} / {selectedEmp.totalLateSlabs}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic HR metrics checklist card (8 cols) */}
        <div id="company-employee-metrics-grid" className="md:col-span-8 bg-white border-3 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] grid grid-cols-2 sm:grid-cols-4 gap-6 items-center">
          
          {/* Metric 1 */}
          <div className="bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Present Days</span>
            <div className="text-2xl font-black font-mono text-emerald-600 mt-1">✔️ {selectedEmp.presentDays} <span className="text-xs text-slate-400 font-bold">Days</span></div>
            <p className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Active shift presences computed</p>
          </div>

          {/* Metric 2 */}
          <div className="bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Absent Days</span>
            <div className={`text-2xl font-black font-mono mt-1 ${selectedEmp.absentDays > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              ❌ {selectedEmp.absentDays} <span className="text-xs text-slate-400 font-bold">Days</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Absent days excluding rest days</p>
          </div>

          {/* Metric 3 */}
          <div className="bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Weekly Off / Hol</span>
            <div className="text-2xl font-black font-mono text-indigo-600 mt-1">⛱️ {selectedEmp.weeklyOffDays + selectedEmp.leaveDays + selectedEmp.holidayDays} <span className="text-xs text-slate-400 font-bold">Days</span></div>
            <p className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Weekly offs, leaves & holidays</p>
          </div>

          {/* Metric 4 */}
          <div className="bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Calculated Work Hrs</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1.5">{selectedEmp.totalWorkHours} <span className="text-xs text-slate-400 font-bold">Hrs</span></div>
            <p className="text-[9px] text-slate-400 mt-2 leading-normal font-semibold">Accumulated hours from attendance</p>
          </div>

          {/* Metric 5 */}
          <div className="bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Avg Hours / Present Day</span>
            <div className="text-xl font-black font-mono text-slate-700 mt-1.5">{selectedEmp.presentDays > 0 ? (selectedEmp.totalWorkHours / selectedEmp.presentDays).toFixed(1) : '0'} <span className="text-xs text-slate-400 font-bold">Hrs</span></div>
            <p className="text-[9px] text-slate-400 mt-2 leading-normal font-semibold">Average work hours per active shift</p>
          </div>

          {/* Metric 6 */}
          <div className="bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Late Days / Slabs</span>
            <div className="text-xl font-black font-mono text-rose-700 mt-1.5">
              {selectedEmp.totalLateDays} / {selectedEmp.totalLateSlabs}
            </div>
            <p className="text-[9px] text-slate-400 mt-2 leading-normal font-semibold">Tardiness days and 30m slabs</p>
          </div>

          {/* Metric 7 */}
          <div className="bg-indigo-650 text-white border-2 border-slate-900 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-indigo-700 transition-colors">
            <span className="text-[9px] font-black text-indigo-200 uppercase tracking-wider block">Punctuality Grade</span>
            <div className="text-xl font-black font-mono text-white mt-1.5">
              {selectedEmp.totalLateSlabs === 0 ? 'GRADE A+' : selectedEmp.totalLateSlabs <= 3 ? 'GRADE A' : selectedEmp.totalLateSlabs <= 8 ? 'GRADE B' : 'GRADE C'}
            </div>
            <p className="text-[9px] text-indigo-200 mt-2 leading-normal font-semibold">Evaluation based on late slabs</p>
          </div>

        </div>
      </div>

      {/* 2.5 Multi-Month Consolidated Summary Row */}
      {isConsolidated && monthlySummaries.length > 0 && (
        <div id="employee-multi-month-summary-card" className="bg-indigo-50 border-3 border-indigo-900 p-6 shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] space-y-4 animate-in fade-in duration-200">
          <div>
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 border border-indigo-300 px-2 py-1 uppercase tracking-widest rounded leading-none">
              Multi-Month Consolidated Breakdown
            </span>
            <h3 className="text-lg font-black tracking-tight text-slate-950 uppercase mt-2">
              📅 {selectedEmp.name} — Monthly Cumulative Summary Records
            </h3>
            <p className="text-xs text-indigo-800 font-semibold uppercase tracking-wide mt-0.5">
              Comparison across all uploaded biometrics segments
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {monthlySummaries.map((ms) => (
              <div key={ms.monthName} className="bg-white border-2 border-slate-900 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">MONTH REPORT</span>
                  <span className="text-sm font-black text-slate-900 uppercase">{ms.monthName}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2.5">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">NET WORK</span>
                    <span className="font-mono font-black text-slate-950">{ms.totalNetHours.toFixed(1)} Hrs</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">PRESENCES</span>
                    <span className="font-mono font-black text-slate-950">{ms.presentDays} Days</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">ABSENCES</span>
                    <span className="font-mono font-black text-slate-950">{ms.absentDays} Days</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[8px] font-bold text-amber-600 uppercase block">LATE SLABS</span>
                    <span className="font-mono font-black text-amber-700">{ms.totalLateSlabs}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Combined Aggregate Column Card */}
            <div className="bg-slate-950 text-white border-2 border-slate-900 p-4 shadow-[2px_2px_0px_0px_rgba(79,70,229,1)] flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block leading-none mb-1">AGGREGATE</span>
                <span className="text-sm font-black text-white uppercase">COMBINED SUMMARY</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-2.5">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">NET WORK</span>
                  <span className="font-mono font-black text-yellow-350">{selectedEmp.totalNetHours.toFixed(1)} Hrs</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">PRESENCES</span>
                  <span className="font-mono font-black text-white">{selectedEmp.presentDays} Days</span>
                </div>
                <div className="mt-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">ABSENCES</span>
                  <span className="font-mono font-black text-white">{selectedEmp.absentDays} Days</span>
                </div>
                <div className="mt-1">
                  <span className="text-[8px] font-bold text-indigo-300 uppercase block">LATE SLABS</span>
                  <span className="font-mono font-black text-indigo-400">{selectedEmp.totalLateSlabs}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Monthly Attendance Calendar View & Status Distribution Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Calendar Grid card (8 cols) */}
        <div className="lg:col-span-8 bg-white border-3 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] select-none">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b-2 border-slate-200 pb-4 mb-4">
            <div>
              <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                Monthly Attendance Calendar View
              </h4>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Visually maps index punches onto a standard calendar week</p>
            </div>
            
            <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase">
              <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Present</span>
              <span className="flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Absent</span>
              <span className="flex items-center gap-1 bg-slate-150 text-slate-700 border border-slate-300 px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Off Day</span>
              <span className="flex items-center gap-1 bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-505 bg-indigo-600" /> Leave</span>
            </div>
          </div>

          {/* Roster Calendar layout */}
          <div className="grid grid-cols-7 gap-2">
            
            {/* Calendar Headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(wday => (
              <div key={wday} className="text-center font-black text-xs text-slate-400 bg-slate-50 border border-slate-200 py-1.5 uppercase font-mono tracking-wider">
                {wday}
              </div>
            ))}

            {/* Grid days */}
            {calendarCells.map((cell) => {
              if (cell.padding) {
                return (
                  <div key={cell.id} className="aspect-square bg-slate-50/50 border border-dashed border-slate-200 opacity-40 rounded" />
                );
              }

              const isLate = cell.calculatedLateMins > 0;
              
              let cellClass = 'bg-slate-50 border-slate-200 text-slate-400';
              let badgeStatus = '';
              let punchTiming = <span className="text-[8px] font-mono block text-slate-400 mt-1">No Punches</span>;

              if (cell.status === 'P' || cell.status === 'APPROVED_EXCEPTION' || cell.status === 'MANUAL_ENTRY') {
                cellClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                badgeStatus = 'P';
                punchTiming = (
                  <div className="text-[7.5px] font-mono leading-tight mt-1 text-emerald-700 font-extrabold uppercase truncate">
                    {cell.inTime} - {cell.outTime}
                  </div>
                );
              } else if (cell.status === 'A') {
                cellClass = 'bg-rose-50 border-rose-300 text-rose-700';
                badgeStatus = 'A';
                punchTiming = (
                  <div className="text-[8px] font-mono leading-tight mt-1 text-rose-600 font-black uppercase">
                    ABSENT
                  </div>
                );
              } else if (cell.status === 'WO') {
                cellClass = 'bg-slate-100 border-slate-300 text-slate-600';
                badgeStatus = 'WO';
                punchTiming = (
                  <div className="text-[8px] font-mono leading-tight mt-1 text-slate-505 text-slate-500 font-bold uppercase">
                    WEEK OFF
                  </div>
                );
              } else if (cell.status === 'LV' || cell.status === 'HL') {
                cellClass = 'bg-indigo-50 border-indigo-200 text-indigo-800';
                badgeStatus = cell.status;
                punchTiming = (
                  <div className="text-[8px] font-mono leading-tight mt-1 text-indigo-600 font-extrabold uppercase">
                    {cell.status === 'LV' ? 'LEAVE' : 'HOLIDAY'}
                  </div>
                );
              }

              return (
                <div
                  key={cell.id}
                  className={`aspect-square border-2 ${cellClass} p-2 flex flex-col justify-between hover:scale-[1.03] active:scale-[0.98] transition-all relative overflow-hidden`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-black">{cell.dayNum}</span>
                    <span className="text-[8px] font-extrabold px-1 border border-current rounded-sm">
                      {badgeStatus}
                    </span>
                  </div>

                  {punchTiming}

                  {/* Highlights flags */}
                  <div className="flex gap-1 absolute bottom-1.5 right-1.5">
                    {isLate && (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-slate-950" title={`Arrival Late: ${Math.ceil(cell.calculatedLateMins / 30)} Slabs`} />
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Attendance Status Pie Chart Card (4 cols) */}
        <div className="lg:col-span-4 bg-white border-3 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between select-none">
          <div>
            <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider mb-1 flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-600" />
              Slab Status Distribution
            </h4>
            <p className="text-xs font-bold text-slate-400 mb-4">Total breakdown count of monthly rosters</p>
          </div>

          <div className="h-44 w-full flex justify-center items-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }}
                  formatter={(value) => [`${value} Days`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2 text-[10px] font-black uppercase">
            {pieDistributionData.map((d, index) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-slate-950 inline-block" style={{ backgroundColor: d.color }}></span>
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-mono text-slate-900">{d.value} Days</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. Employee-wise Trends Charts Layout Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
        
        {/* Chart A: Daily In-Time vs Out-Time trend (Linen-dial) */}
        <div className="lg:col-span-12 bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-200 pb-3 mb-4 gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider">
                Daily In-Time vs Out-Time Chronology
              </h4>
              <p className="text-xs font-bold text-slate-400">Punches comparison plotted against standard 09:00 - 17:30 corporate schedules</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-indigo-600 rounded"></span> IN PUNCH</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-emerald-500 rounded"></span> OUT PUNCH</span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={punchTrendsData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dayNum" stroke="#0f172a" style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }} label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, style: { fontSize: '10px', fontWeight: 'bold' } }} />
                <YAxis
                  stroke="#0f172a"
                  style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}
                  domain={[480, 1140]} // Range 08:00 AM to 07:00 PM (480 min to 1140 min)
                  tickFormatter={formatMinutesAsClockTicks}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontSize: '11px', fontWeight: 'bold' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border-2 border-slate-900 p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase text-[10px] font-black">
                          <p className="border-b border-slate-200 pb-1 mb-1 text-slate-800">Day {data.dayNum} ({data.dayName})</p>
                          <p className="text-indigo-600">IN: {formatTime12H(data.inTimeRaw)}</p>
                          <p className="text-emerald-600">OUT: {formatTime12H(data.outTimeRaw)}</p>
                          <p className="text-slate-500 mt-1">Status: {data.status}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="In Minutes" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                <Area type="monotone" dataKey="Out Minutes" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 5. Split Row for Late, OT, and Work Hour Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none">
        
        {/* Trend 1: Daily Work Hours */}
        <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div>
            <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-1">
              Daily Productive Hours
            </h4>
            <p className="text-[10px] font-black text-slate-400 mb-3 uppercase">Actual and Net shift timelines output</p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={punchTrendsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dayNum" style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <YAxis domain={[0, 12]} style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <Tooltip
                  contentStyle={{ fontSize: '10px', border: '2px solid #0a0a0a', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Actual Work Hours" stroke="#64748b" fill="#f1f5f9" strokeWidth={1.5} />
                <Area type="monotone" dataKey="Net Work Hours" stroke="#0f172a" fill="#e2e8f0" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend 2: Late Coming Trend */}
        <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <div>
            <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-1 text-red-650">
              Late Coming Slabs
            </h4>
            <p className="text-[10px] font-black text-slate-400 mb-3 uppercase">Daily Delay duration slabs</p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={punchTrendsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dayNum" style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <YAxis style={{ fontSize: '9px', fontWeight: 'bold' }} />
                <Tooltip
                  contentStyle={{ fontSize: '10px', border: '2px solid #0a0a0a', fontWeight: 'bold' }}
                  formatter={(value) => [`${value} Slabs`, 'Late Delay']}
                />
                <Bar dataKey="Late Slabs" fill="#f43f5e" stroke="#0f172a" strokeWidth={1.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 6. Weekly Performance Summary */}
      <div className="bg-white border-3 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div>
          <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider mb-1">Weekly Metrics Aggregates Combined</h4>
          <p className="text-xs font-bold text-slate-400 mb-5">Consolidated weekly performance and attendance trends for payroll support</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {weeklySummary.map(w => {
            if (!w) return null;
            const isGoodWeek = w.attnPct >= 85;
            return (
              <div key={w.week} className="bg-slate-50 border-2 border-slate-900 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,_1)]">
                <span className="text-[10px] font-black text-slate-505 text-slate-400 block uppercase font-mono">{w.week}</span>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-xs font-bold text-slate-700">Attendance:</span>
                  <span className={`text-sm font-black font-mono ${isGoodWeek ? 'text-emerald-650' : 'text-rose-650'}`}>{w.attnPct}%</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-slate-500 font-bold">Total Hours:</span>
                  <span className="font-mono font-black text-slate-800">{w.totalHours} Hrs</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-slate-500 font-bold">Late Days / Slabs:</span>
                  <span className={`font-mono font-black ${w.lateDays > 0 ? 'text-red-700' : 'text-slate-400'}`}>{w.lateDays} / {w.lateSlabs}</span>
                </div>

                {/* Progress bar visually represent attendance consistency */}
                <div className="h-1.5 w-full bg-slate-200 border border-slate-900 mt-3 overflow-hidden">
                  <div className={`h-full ${isGoodWeek ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${w.attnPct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Employee Activity Day-Wise Ledger Table */}
      <div className="bg-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-slate-200 pb-4 mb-4">
          <div>
            <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-650" />
              Employee Biometric Day-Wise Activity Ledger
            </h4>
            <p className="text-xs font-bold text-slate-400 mt-0.5">Comprehensive shift records of all manual shifts and delays</p>
          </div>
        </div>

        <div className="overflow-x-auto border-2 border-slate-900">
          <table className="w-full text-left border-collapse select-text">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 text-xxs font-black tracking-wider uppercase font-mono">
                <th className="py-2.5 px-4 font-mono">DATE / DAY</th>
                <th className="py-2.5 px-3 text-center">IN TIME</th>
                <th className="py-2.5 px-3 text-center">OUT TIME</th>
                <th className="py-2.5 px-3 text-right">ACTUAL HR</th>
                <th className="py-2.5 px-3 text-right">NET HR</th>
                <th className="py-2.5 px-4 text-center">STATUS</th>
                <th className="py-2.5 px-4 text-right">LATE SLABS</th>
                <th className="py-2.5 px-4">REMARKS & REMINDERS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
              {selectedEmp.dailyRecords.map(rec => {
                const isLate = rec.calculatedLateMins > 0;
                let statusBadge = 'bg-slate-200 text-slate-700 border-slate-350';
                
                if (rec.status === 'P') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-450 border-emerald-400';
                else if (rec.status === 'A') statusBadge = 'bg-red-100 text-red-800 border-red-400';
                else if (rec.status === 'WO') statusBadge = 'bg-slate-100 text-slate-505 text-slate-500 border-slate-300';
                else if (rec.status === 'LV' || rec.status === 'HL') statusBadge = 'bg-indigo-100 text-indigo-800 border-indigo-300';
                else if (rec.status === 'INVALID_PUNCH') statusBadge = 'bg-amber-100 text-amber-800 border-amber-400';
                else if (rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') statusBadge = 'bg-blue-100 text-blue-800 border-blue-400';

                return (
                  <tr key={rec.dayNum} className="hover:bg-slate-50/50 transition-colors font-semibold">
                    <td className="py-2 px-4 text-slate-900 font-extrabold font-mono">
                      Day {rec.dayNum} ({rec.dayName})
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {formatTime12H(rec.inTime)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {formatTime12H(rec.outTime)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-500">
                      {rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY' ? `${(rec.actualWorkHrs ?? rec.calculatedRegularHrs).toFixed(1).replace(/\.0$/, '')}h` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900 bg-yellow-50/50">
                      {rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY' ? `${(rec.netWorkHrs ?? rec.calculatedRegularHrs).toFixed(1).replace(/\.0$/, '')}h` : '—'}
                    </td>
                    <td className="py-2 px-4 text-center select-none">
                      <span className={`inline-flex px-2 py-0.5 border text-[9px] font-black uppercase ${statusBadge}`}>
                        {rec.status === 'P' ? 'PRESENT' : rec.status === 'A' ? 'ABSENT' : rec.status === 'WO' ? 'WEEK OFF' : rec.status === 'LV' ? 'LEAVE' : rec.status === 'HL' ? 'HOLIDAY' : rec.status === 'INVALID_PUNCH' ? 'INVALID' : rec.status === 'APPROVED_EXCEPTION' ? 'APPROVED' : rec.status === 'MANUAL_ENTRY' ? 'MANUAL' : rec.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-red-700 font-bold select-none">
                      {isLate ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                          {Math.ceil(rec.calculatedLateMins / 30)} Slabs
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-4 text-xs font-medium text-slate-550 select-text">
                      {getDailyRemarks(rec)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Workforce Performance Insights Card (Professional / CA / HR-oriented) */}
      <div id="company-workforce-performance-insights" className="bg-indigo-50 border-3 border-indigo-650 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-6">
        <div>
          <h4 className="text-sm font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            CA HRMS Ledger - Workforce Performance Insights
          </h4>
          <p className="text-xs font-bold text-indigo-700 mt-1">
            Aggregate payroll review statistics computed directly from loaded biometric spreadsheets
          </p>
        </div>

        {hrInsights ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Box 1: Most punctual */}
            <div className="md:col-span-4 bg-white border-2 border-indigo-650 p-4 shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]">
              <h5 className="text-xs font-black uppercase text-indigo-900 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-1">
                🏆 Most Punctual Roster Members
              </h5>
              <div className="space-y-3">
                {hrInsights.punctual.map((emp, idx) => (
                  <div key={emp.id} className="flex justify-between items-center text-xs cursor-pointer hover:bg-slate-50 py-1 px-1.5 rounded" onClick={() => selectEmployee(emp.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-indigo-500 font-mono text-xxs">0{idx+1}</span>
                      <span className="font-extrabold text-slate-900">{emp.name}</span>
                    </div>
                    <span className="font-mono text-emerald-650 font-black text-xxs bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 uppercase">
                      {emp.totalLateDays}d / {emp.totalLateSlabs}sl
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Box 3: Lowest Attendance */}
            <div className="md:col-span-4 bg-white border-2 border-indigo-650 p-4 shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]">
              <h5 className="text-xs font-black uppercase text-indigo-900 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-1">
                ⚠️ Lowest Attendance Ratio
              </h5>
              <div className="space-y-3">
                {hrInsights.lowAttn.map((emp, idx) => (
                  <div key={emp.id} className="flex justify-between items-center text-xs cursor-pointer hover:bg-slate-50 py-1 px-1.5 rounded" onClick={() => selectEmployee(emp.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-indigo-500 font-mono text-xxs">0{idx+1}</span>
                      <span className="font-extrabold text-slate-900">{emp.name}</span>
                    </div>
                    <span className="font-mono text-rose-650 font-black text-xxs bg-rose-50 border border-rose-200 px-1.5 py-0.5 uppercase">
                      {emp.attendancePercentage}% rate
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="text-xs text-indigo-800 font-bold uppercase">No insights computed. Please upload records.</div>
        )}

        <div className="pt-4 border-t border-indigo-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs select-none">
          <div className="flex items-center gap-2 bg-indigo-100/50 p-3 rounded">
            <CheckCircle2 className="w-5 h-5 text-indigo-700 shrink-0" />
            <div>
              <span className="font-black text-indigo-900 block uppercase">Attendance Consistency Factor</span>
              <span className="text-slate-650">{hrInsights?.consistentPercent}% of personnel achieved greater than 90% attendance.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-indigo-100/50 p-3 rounded">
            <Coffee className="w-5 h-5 text-indigo-700 shrink-0" />
            <div>
              <span className="font-black text-indigo-900 block uppercase">Roster Average Level</span>
              <span className="text-slate-650">The aggregate system width is running at a healthy {hrInsights?.overallAvgAttn}% average attendance level.</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
