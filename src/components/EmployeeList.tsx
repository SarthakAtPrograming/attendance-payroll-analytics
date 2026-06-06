import React, { useState, useMemo } from 'react';
import { EmployeeSummary, DailyRecord } from '../types';
import { Search, ChevronDown, ChevronUp, Download, Eye, AlertCircle, Clock } from 'lucide-react';
import { formatHoursReadable } from '../utils/attendanceParser';

interface EmployeeListProps {
  employees: EmployeeSummary[];
  onSelectEmployee: (emp: EmployeeSummary) => void;
}

type SortField = 'id' | 'name' | 'present' | 'absent' | 'workHrs' | 'lateMins' | 'attn';
type SortOrder = 'asc' | 'desc';

export default function EmployeeList({ employees, onSelectEmployee }: EmployeeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('attn');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Handle headers sorting trigger
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // default high values first
    }
  };

  const sortedAndFilteredEmployees = useMemo(() => {
    let result = [...employees];

    // 1. Search Query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        emp =>
          emp.id.toLowerCase().includes(query) ||
          emp.name.toLowerCase().includes(query)
      );
    }

    // 2. Sorting
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 'id':
          valA = a.id;
          valB = b.id;
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        case 'name':
          valA = a.name;
          valB = b.name;
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        case 'present':
          valA = a.presentDays;
          valB = b.presentDays;
          break;
        case 'absent':
          valA = a.absentDays;
          valB = b.absentDays;
          break;
        case 'workHrs':
          valA = a.totalWorkHours;
          valB = b.totalWorkHours;
          break;
        case 'lateMins':
          valA = a.totalLateSlabs;
          valB = b.totalLateSlabs;
          break;
        case 'attn':
          valA = a.attendancePercentage;
          valB = b.attendancePercentage;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [employees, searchQuery, sortField, sortOrder]);

  // Export to CSV helper
  const exportToCSV = () => {
    const headers = 'Employee ID,Employee Name,Present Days,Absent Days,Weekly Offs,Leaves,Holidays,Actual Work Hours,Net Work Hours,Late Days / Slabs,Attendance Percentage\n';
    const csvContent = sortedAndFilteredEmployees
      .map(
        emp =>
          `"${emp.id}","${emp.name}",${emp.presentDays},${emp.absentDays},${emp.weeklyOffDays},${emp.leaveDays},${emp.holidayDays},${emp.totalActualHours ?? emp.totalWorkHours},${emp.totalNetHours ?? emp.totalWorkHours},"${emp.totalLateDays} / ${emp.totalLateSlabs}","${emp.attendancePercentage}%"`
      )
      .join('\n');
    
    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Biometric_Attendance_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="inline w-4 h-4 ml-1 text-slate-500" />
    ) : (
      <ChevronDown className="inline w-4 h-4 ml-1 text-slate-500" />
    );
  };

  return (
    <div id="employee-list-container" className="bg-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] p-6 overflow-hidden">
      {/* Table search controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">Employee Attendance Directory</h3>
          <p className="text-xs font-bold text-slate-400">Sort, search and drill down into daily punch-cards</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by ID or Name..."
              className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-900 text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none transition-colors"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Export to csv */}
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-2 border-slate-900 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV Export</span>
          </button>
        </div>
      </div>



      {/* Main Table */}
      <div className="overflow-x-auto select-none border-2 border-slate-900">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 text-xs font-black tracking-wider">
              <th className="py-3 px-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('id')}>
                EMP ID <SortIcon field="id" />
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('name')}>
                EMPLOYEE NAME <SortIcon field="name" />
              </th>
              <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('present')}>
                PRESENT <SortIcon field="present" />
              </th>
              <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('absent')}>
                ABSENT <SortIcon field="absent" />
              </th>
              <th className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('workHrs')}>
                ACTUAL / NET HOURS <SortIcon field="workHrs" />
              </th>
              <th className="py-3 px-3 text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('lateMins')}>
                LATE DAYS / SLABS <SortIcon field="lateMins" />
              </th>
              <th className="py-3 px-4 text-center cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('attn')}>
                ATTENDANCE <SortIcon field="attn" />
              </th>
              <th className="py-3 px-4 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
            {sortedAndFilteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 font-bold uppercase align-middle">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-55 text-slate-400" />
                  No matching employees found in database
                </td>
              </tr>
            ) : (
              sortedAndFilteredEmployees.map(emp => {
                // High risk threshold (Attendance < 75%)
                 const isUnderPerforming = emp.attendancePercentage < 75;
                 
                 return (
                   <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                     <td className="py-4 px-4 font-mono font-bold text-slate-500 align-middle">
                       [{emp.id}]
                     </td>
                     <td className="py-4 px-4 font-extrabold text-slate-900 align-middle">
                       <div className="flex items-center gap-2">
                         <span>{emp.name}</span>
                       </div>
                     </td>
                     <td className="py-4 px-3 text-center align-middle">
                       <span className="inline-flex items-center justify-center w-8 h-8 border border-slate-900 bg-emerald-150 text-slate-900 text-xs font-black font-mono">
                         {emp.presentDays}
                       </span>
                     </td>
                     <td className="py-4 px-3 text-center align-middle">
                       <span className={`inline-flex items-center justify-center w-8 h-8 border border-slate-900 text-xs font-black font-mono ${
                         emp.absentDays > 4 ? 'bg-rose-250 text-slate-900' : 'bg-slate-100 text-slate-700'
                       }`}>
                         {emp.absentDays}
                       </span>
                     </td>
                     <td className="py-4 px-3 text-right font-mono font-bold text-slate-650 align-middle">
                       <div className="flex flex-col items-end justify-center">
                          <span className="text-xs font-black text-slate-900 border-b border-dashed border-slate-300">{(emp.totalNetHours ?? emp.totalWorkHours).toFixed(1)}h Net</span>
                          <span className="text-[10px] text-slate-400 font-bold">{(emp.totalActualHours ?? emp.totalWorkHours).toFixed(1)}h Act</span>
                        </div>
                     </td>
                     <td className="py-4 px-3 text-right text-red-700 font-mono font-bold align-middle">
                       {emp.totalLateDays > 0 ? (
                         <span className="inline-flex items-center gap-1 justify-end w-full">
                           <Clock className="w-3 h-3 text-red-700 shrink-0" />
                           <span>{emp.totalLateDays} / {emp.totalLateSlabs}</span>
                         </span>
                       ) : (
                         '—'
                       )}
                     </td>
                     <td className="py-4 px-4 text-center align-middle">
                       <div className="flex flex-col items-center justify-center">
                         <span className={`text-xs font-black font-mono leading-none ${
                           isUnderPerforming ? 'text-red-650' : 'text-emerald-700'
                         }`}>
                           {emp.attendancePercentage}%
                         </span>
                         {/* Progress Bar background sparkline */}
                         <div className="w-16 h-1.5 mt-1.5 bg-slate-100 border border-slate-900 overflow-hidden shrink-0">
                           <div
                             className={`h-full ${
                               isUnderPerforming ? 'bg-red-500' : 'bg-emerald-500'
                             }`}
                             style={{ width: `${Math.min(100, emp.attendancePercentage)}%` }}
                           />
                         </div>
                       </div>
                     </td>
                     <td className="py-4 px-4 text-center align-middle">
                       <button
                         onClick={() => onSelectEmployee(emp)}
                         className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-950 text-xxs font-black border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer uppercase tracking-wider shrink-0"
                       >
                         <Eye className="w-3.5 h-3.5 text-indigo-600" />
                         <span>FULL REPORT</span>
                       </button>
                     </td>
                   </tr>
                 );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
