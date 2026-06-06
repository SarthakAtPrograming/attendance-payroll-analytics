import React, { useMemo } from 'react';
import { EmployeeSummary, DailyRecord, MonthlyReport } from '../types';
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

interface ChartsAnalyticsProps {
  employees: EmployeeSummary[];
  isConsolidated?: boolean;
  allReports?: MonthlyReport[];
  selectedMonths?: string[];
}

export default function ChartsAnalytics({ 
  employees, 
  isConsolidated = false, 
  allReports = [], 
  selectedMonths = [] 
}: ChartsAnalyticsProps) {
  
  // Brand color palette
  const PRIMARY_COLOR = '#0f172a'; // slate-900
  const SECONDARY_COLOR = '#4f46e5'; // indigo-600
  const CYAN_COLOR = '#06b6d4'; // cyan-500
  const EMERALD_COLOR = '#10b981'; // emerald-500
  const ROSE_COLOR = '#f43f5e'; // rose-500
  const AMBER_COLOR = '#fbbf24'; // amber-400
  const INDIGO_100 = '#e0e7ff';
  const SLATE_900 = '#0f172a';

  // --- MONTH-WISE INDIVIDUAL MODE CALCULATIONS ---

  // 1. Compute totals for Present vs Absent Pie chart
  const pieData = useMemo(() => {
    let totPresent = 0;
    let totAbsent = 0;
    let totWO = 0;
    let totLeave = 0;

    employees.forEach(emp => {
      totPresent += emp.presentDays ?? 0;
      totAbsent += emp.absentDays ?? 0;
      totWO += emp.weeklyOffDays ?? 0;
      totLeave += (emp.leaveDays ?? 0) + (emp.holidayDays ?? 0);
    });

    const total = totPresent + totAbsent + totWO + totLeave;
    if (total === 0) return [];

    return [
      { name: 'Present Days', value: totPresent, color: EMERALD_COLOR },
      { name: 'Absent Days', value: totAbsent, color: ROSE_COLOR },
      { name: 'Weekly Offs', value: totWO, color: SECONDARY_COLOR },
      { name: 'Leaves & Holidays', value: totLeave, color: CYAN_COLOR }
    ];
  }, [employees]);

  // 2. Compute timeline trends for daily attendance (headcounts present per month day)
  const dailyTimelineData = useMemo(() => {
    if (employees.length === 0) return [];
    
    // Find the number of days in the roster (e.g. 1 to 31)
    const maxDays = Math.max(...employees[0].dailyRecords.map(r => r.dayNum), 31);
    const dayRecords = Array.from({ length: maxDays }, (_, idx) => {
      const dNum = idx + 1;
      let presentCount = 0;
      let absentCount = 0;
      let woCount = 0;
      let dayName = '';

      employees.forEach(emp => {
        const dRec = emp.dailyRecords.find(r => r.dayNum === dNum);
        if (dRec) {
          dayName = dRec.dayName;
          if (dRec.status === 'P' || dRec.status === 'APPROVED_EXCEPTION' || dRec.status === 'MANUAL_ENTRY') presentCount++;
          else if (dRec.status === 'A') absentCount++;
          else if (dRec.status === 'WO') woCount++;
        }
      });

      return {
        day: `Day ${dNum}`,
        dayName,
        'Present Count': presentCount,
        'Absent Count': absentCount,
        'Weekly Offs': woCount
      };
    });

    return dayRecords;
  }, [employees]);

  // 3. Late coming ranking (Top 8 late arrival minutes loggers)
  const lateRankingsData = useMemo(() => {
    return [...employees]
      .map(emp => ({
        name: emp.name,
        'Late Days': emp.totalLateDays ?? 0,
        'Late Slabs': emp.totalLateSlabs ?? 0
      }))
      .filter(item => item['Late Slabs'] > 0)
      .sort((a, b) => b['Late Slabs'] - a['Late Slabs'])
      .slice(0, 8);
  }, [employees]);


  // --- CONSOLIDATED MULTI-MONTH MODE TRENDS ---

  // Trend 1: Monthly Net Work Hours
  const monthlyNetHoursData = useMemo(() => {
    if (!isConsolidated || allReports.length === 0) return [];
    
    const targetMonths = selectedMonths.length > 0 
      ? selectedMonths 
      : allReports.map(r => r.monthName);

    return allReports
      .filter(r => targetMonths.includes(r.monthName))
      .map(r => {
        let netHrs = 0;
        r.employees.forEach(e => {
          netHrs += e.totalNetHours ?? e.totalWorkHours ?? 0;
        });
        return {
          month: r.monthName,
          'Net Work Hours (Hrs)': parseFloat(netHrs.toFixed(1))
        };
      });
  }, [isConsolidated, allReports, selectedMonths]);

  // Trend 2: Monthly Attendance Rate (%)
  const monthlyAttendanceData = useMemo(() => {
    if (!isConsolidated || allReports.length === 0) return [];
    
    const targetMonths = selectedMonths.length > 0 
      ? selectedMonths 
      : allReports.map(r => r.monthName);

    return allReports
      .filter(r => targetMonths.includes(r.monthName))
      .map(r => {
        let present = 0;
        let absent = 0;
        r.employees.forEach(e => {
          present += e.presentDays ?? 0;
          absent += e.absentDays ?? 0;
        });
        const working = present + absent;
        const rate = working > 0 ? parseFloat(((present / working) * 100).toFixed(1)) : 0;
        return {
          month: r.monthName,
          'Attendance Rate (%)': rate
        };
      });
  }, [isConsolidated, allReports, selectedMonths]);

  // Trend 3: Monthly Late Slabs Trend
  const monthlyLateSlabsData = useMemo(() => {
    if (!isConsolidated || allReports.length === 0) return [];
    
    const targetMonths = selectedMonths.length > 0 
      ? selectedMonths 
      : allReports.map(r => r.monthName);

    return allReports
      .filter(r => targetMonths.includes(r.monthName))
      .map(r => {
        let slabs = 0;
        r.employees.forEach(e => {
          slabs += e.totalLateSlabs ?? 0;
        });
        return {
          month: r.monthName,
          'Total Late Slabs': parseFloat(slabs.toFixed(1))
        };
      });
  }, [isConsolidated, allReports, selectedMonths]);

  // Trend 4: Monthly Present / Absent Absolute Volume Split Stack
  const monthlyStackData = useMemo(() => {
    if (!isConsolidated || allReports.length === 0) return [];
    
    const targetMonths = selectedMonths.length > 0 
      ? selectedMonths 
      : allReports.map(r => r.monthName);

    return allReports
      .filter(r => targetMonths.includes(r.monthName))
      .map(r => {
        let present = 0;
        let absent = 0;
        let wo = 0;
        r.employees.forEach(e => {
          present += e.presentDays ?? 0;
          absent += e.absentDays ?? 0;
          wo += e.weeklyOffDays ?? 0;
        });
        return {
          month: r.monthName,
          'Present Days': present,
          'Absent Days': absent,
          'Weekly Off Days': wo
        };
      });
  }, [isConsolidated, allReports, selectedMonths]);

  // Trend 5: Employee Productivity Rank Bar List
  const employeeProductivityData = useMemo(() => {
    return employees
      .map(emp => ({
        name: emp.name,
        'Net Work Hours': parseFloat((emp.totalNetHours ?? 0).toFixed(1))
      }))
      .sort((a, b) => b['Net Work Hours'] - a['Net Work Hours'])
      .slice(0, 10); // Display top 10 productivity loggers
  }, [employees]);


  // --- RENDER COMPONENT BRANCHING ---

  if (isConsolidated) {
    return (
      <div id="consolidated-charts-grid" className="space-y-6">
        
        {/* Banner Label */}
        <div className="bg-indigo-950 text-white p-5 border-3 border-indigo-900 shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black tracking-widest text-indigo-300 uppercase bg-white/10 px-2 py-0.5 rounded border border-white/10 select-none">
              CONSOLIDATED PERFORMANCE TRENDS
            </span>
            <h3 className="text-xl font-black uppercase mt-1">Multi-Month Analytics Portal</h3>
            <p className="text-xs text-indigo-200 mt-1">
              Consolidated interactive workforce metrics visualization across all selected biometric sheets
            </p>
          </div>
          <div className="text-xs font-mono font-bold bg-indigo-900 border border-indigo-700 px-3 py-1 text-indigo-200">
            LOADED MONTHS: [{monthlyNetHoursData.length}]
          </div>
        </div>

        {/* 1. Row 1: Net Work Hours & Attendance Rate Percentage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Monthly Net Work Hours Trend */}
          <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <h4 className="text-sm font-black text-slate-950 uppercase tracking-widest mb-1">
              📈 Monthly Net Work Hours Cumulative Trend
            </h4>
            <p className="text-xs font-bold text-slate-400 mb-4">Total workforce billable net work hours aggregated per month</p>
            <div className="h-64">
              {monthlyNetHoursData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-300">
                  NO TREND DATA AVAILABLE
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyNetHoursData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorNetHrs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SECONDARY_COLOR} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={SECONDARY_COLOR} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                    <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fontWeight: 'bold' } }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Area type="monotone" dataKey="Net Work Hours (Hrs)" stroke={SECONDARY_COLOR} strokeWidth={3} fillOpacity={1} fill="url(#colorNetHrs)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Monthly Attendance Trend */}
          <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <h4 className="text-sm font-black text-slate-950 uppercase tracking-widest mb-1">
              🎯 Monthly Attendance Average Percentage
            </h4>
            <p className="text-xs font-bold text-slate-400 mb-4">Average attendance rate index computed based on active working days roster</p>
            <div className="h-64">
              {monthlyAttendanceData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-300">
                  NO TREND DATA AVAILABLE
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyAttendanceData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                    <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" domain={[60, 100]} label={{ value: '% Rate', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fontWeight: 'bold' } }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Line type="monotone" dataKey="Attendance Rate (%)" stroke={EMERALD_COLOR} strokeWidth={4} activeDot={{ r: 8 }} dot={{ stroke: '#0f172a', strokeWidth: 2, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* 2. Row 2: Late Slabs & Present/Absent stack volumes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 3: Monthly Late Slabs Trend */}
          <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <h4 className="text-sm font-black text-slate-950 uppercase tracking-widest mb-1">
              🚨 Monthly Tardiness & Late Slabs Volume
            </h4>
            <p className="text-xs font-bold text-slate-400 mb-4">Total cumulative 30-minute late penalty slabs incurred by workforce</p>
            <div className="h-64">
              {monthlyLateSlabsData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-300">
                  NO TREND DATA AVAILABLE
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyLateSlabsData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                    <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Bar dataKey="Total Late Slabs" fill={AMBER_COLOR} stroke={SLATE_900} strokeWidth={2.5} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 4: Monthly Present / Absent Stack Volume */}
          <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <h4 className="text-sm font-black text-slate-950 uppercase tracking-widest mb-1">
              🗳️ Monthly Roster Absolute Volume Stack
            </h4>
            <p className="text-xs font-bold text-slate-400 mb-4">Stacked absolute volumes of Present, Absent and Weekly Off days</p>
            <div className="h-64">
              {monthlyStackData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-300">
                  NO TREND DATA AVAILABLE
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStackData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                    <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <Bar dataKey="Present Days" stackId="a" fill={EMERALD_COLOR} stroke={SLATE_900} strokeWidth={2} />
                    <Bar dataKey="Absent Days" stackId="a" fill={ROSE_COLOR} stroke={SLATE_900} strokeWidth={2} />
                    <Bar dataKey="Weekly Off Days" stackId="a" fill={PRIMARY_COLOR} stroke={SLATE_900} strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* 3. Row 3: Employee Productivity Comparison Leaderboard */}
        <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <h4 className="text-sm font-black text-slate-950 uppercase tracking-widest mb-1">
            ⏱️ Employee Combined Productivity Leaderboard
          </h4>
          <p className="text-xs font-bold text-slate-400 mb-4">Top 10 employees mapped by total combined Net Work Hours during selected range</p>
          <div className="h-72">
            {employeeProductivityData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-300">
                NO ROSTER LOADED
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeProductivityData} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" label={{ value: 'Net Hrs', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fontWeight: 'bold' } }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Bar dataKey="Net Work Hours" fill={SECONDARY_COLOR} stroke={SLATE_900} strokeWidth={2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    );
  }

  // --- ORIGINAL INDIVIDUAL MONTH BIOMETRICS DASHBOARD (DEFAULT) ---
  return (
    <div id="charts-dashboard-grid" className="space-y-6">
      
      {/* Visual Analytics top split: Pie + Timelines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Present/Absent Pie Chart */}
        <div className="lg:col-span-5 bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider mb-1">Roster Summary Breakdown</h4>
          <p className="text-xs font-bold text-slate-400 mb-3">Total aggregate distributions of monthly rosters</p>
          
          <div className="h-64 flex justify-center items-center">
            {pieData.length === 0 ? (
              <div className="text-xs text-slate-400 uppercase font-bold">Loading charts data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke={SLATE_900} strokeWidth={2.5} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }}
                    formatter={(value) => [`${value} Shift Slabs`, 'Total Count']} 
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="square" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Timeline Line Chart */}
        <div className="lg:col-span-7 bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider mb-1">Daily Attendance Headcounts</h4>
          <p className="text-xs font-bold text-slate-400 mb-3">Total employees present per day (timeline analysis)</p>

          <div className="h-64">
            {dailyTimelineData.length === 0 ? (
              <div className="text-xs text-slate-400 uppercase font-bold">Loading timeline...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTimelineData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} formatter={(value, name) => [value, `${name}`]} />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Line
                    type="monotone"
                    dataKey="Present Count"
                    stroke={EMERALD_COLOR}
                    strokeWidth={3}
                    dot={{ r: 3, stroke: '#0f172a', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, stroke: '#0f172a', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Absent Count"
                    stroke={ROSE_COLOR}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics bottom split: OT + Late Comers rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Late Coming slabs loggers */}
        <div className="bg-white border-3 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] md:col-span-2">
          <h4 className="text-sm font-black text-slate-950 uppercase tracking-wider mb-1">Late Comers penalty log (Slabs)</h4>
          <p className="text-xs font-bold text-slate-400 mb-3">Leaderboard tracking cumulative late days and slabs</p>

          <div className="h-64">
            {lateRankingsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-300">
                NO ACTIVE LATE ARRIVALS FOUND IN THIS SHEET
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lateRankingsData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#0f172a" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '3px solid #0f172a', fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="Late Slabs" fill={AMBER_COLOR} stroke={SLATE_900} strokeWidth={2} />
                  <Bar dataKey="Late Days" fill={SLATE_900} stroke={SLATE_900} strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
