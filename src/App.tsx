import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MonthlyReport, Configuration } from './types';
import { parseAttendanceSheet, modifyWorksheetTimings, isInvalidEmployeeName } from './utils/attendanceParser';
import { generateExecutivePDF } from './utils/pdfGenerator';
import { LOGO_DATA_URI } from './utils/logo';
import { 
  ConsolidationFilter, 
  consolidateReports, 
  getISOStringFromMonthDay, 
  exportCombinedAttendanceReport 
} from './utils/consolidationHelper';

// Components
import EmployeeList from './components/EmployeeList';
import EmployeeDashboard from './components/EmployeeDashboard';
import ChartsAnalytics from './components/ChartsAnalytics';
import EmployeeDetailModal from './components/EmployeeDetailModal';
import SettingsPanel from './components/SettingsPanel';
import AttendanceExceptionsReview from './components/AttendanceExceptionsReview';

// Icons
import {
  UploadCloud,
  FileSpreadsheet,
  AlertOctagon,
  Settings,
  TrendingUp,
  Users,
  User,
  Grid,
  Clock,
  Briefcase,
  FileText,
  Calendar,
  Layers,
  Download
} from 'lucide-react';

function getReportingPeriod(months: string[]): string {
  if (!months || months.length === 0) return '01-Apr-2026 to 30-Apr-2026';

  const monthMap: Record<string, { num: number, short: string, days: number }> = {
    'january': { num: 1, short: 'Jan', days: 31 },
    'february': { num: 2, short: 'Feb', days: 28 },
    'march': { num: 3, short: 'Mar', days: 31 },
    'april': { num: 4, short: 'Apr', days: 30 },
    'may': { num: 5, short: 'May', days: 31 },
    'june': { num: 6, short: 'Jun', days: 30 },
    'july': { num: 7, short: 'Jul', days: 31 },
    'august': { num: 8, short: 'Aug', days: 31 },
    'september': { num: 9, short: 'Sep', days: 30 },
    'october': { num: 10, short: 'Oct', days: 31 },
    'november': { num: 11, short: 'Nov', days: 30 },
    'december': { num: 12, short: 'Dec', days: 31 }
  };

  const parsed = months.map(m => {
    const parts = m.split('-');
    const mName = parts[0].toLowerCase().trim();
    const yStr = parts[1]?.trim();
    const year = parseInt(yStr, 10) || 2026;
    const mInfo = monthMap[mName] || { num: 4, short: 'Apr', days: 30 };
    return {
      monthStr: mInfo.short,
      num: mInfo.num,
      days: mInfo.days,
      year: year
    };
  });

  parsed.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.num - b.num;
  });

  const earliest = parsed[0];
  const latest = parsed[parsed.length - 1];

  let latestDayNum = latest.days;
  if (latest.num === 2 && ((latest.year % 4 === 0 && latest.year % 100 !== 0) || (latest.year % 400 === 0))) {
    latestDayNum = 29;
  }

  return `01-${earliest.monthStr}-${earliest.year} to ${String(latestDayNum).padStart(2, '0')}-${latest.monthStr}-${latest.year}`;
}

export default function App() {
  // Master state
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [nameCorrections, setNameCorrections] = useState<Record<string, string>>({});
  const [activeReportIdx, setActiveReportIdx] = useState<number>(-1);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'individual' | 'charts' | 'settings' | 'exceptions'>('directory');

  // Consolidation Mode States
  const [viewMode, setViewMode] = useState<'individual' | 'consolidated'>('individual');
  const [consolidationFilter, setConsolidationFilter] = useState<ConsolidationFilter>({
    selectedMonths: []
  });
  const [filterInputs, setFilterInputs] = useState<ConsolidationFilter>({
    selectedMonths: []
  });
  const [consolidatedReportTab, setConsolidatedReportTab] = useState<'employees' | 'workforce' | 'attendance' | 'exceptions'>('employees');


  // Input elements ref for upload programmatic triggers
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Work rule configurations
  const [config, setConfig] = useState<Configuration>({
    shiftStart: '09:00',
    shiftEnd: '17:30',
    graceLateMin: 11,
    inTimeBuffer: 11,
    outTimeBuffer: 15,
    excludeWeeklyOffFromAbsent: true,
    minWorkHoursStr: '08:30',
    penaltyTimeStr: '00:30',
    policyAuditLog: [],
    weeklyOffDay: 'Monday',
    numWeeklyOffDays: 1,
    weeklyOffDay2: 'Sunday'
  });

  // Current system localized stats
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1005);
    return () => clearInterval(timer);
  }, []);

  // Recalculates reports whenever work rule configurations shift
  const handleUpdateConfig = (newConfig: Configuration, customMessage?: string) => {
    setConfig(newConfig);
    setReports(prev => {
      const recalculated = prev.map(rep => {
        if (rep.rawWorkbook) {
          const firstSheetName = rep.rawWorkbook.SheetNames[0];
          const worksheet = rep.rawWorkbook.Sheets[firstSheetName];
          const parsed = parseAttendanceSheet(worksheet, rep.fileName, newConfig);
          parsed.rawWorkbook = rep.rawWorkbook; // preserve workbook reference
          return parsed;
        }
        return rep;
      });
      
      // Update selected employee reference if current report shifts
      if (activeReportIdx !== -1 && recalculated[activeReportIdx]) {
        const matching = recalculated[activeReportIdx].employees.find(e => e.id === selectedEmpId);
        if (matching) {
          setSelectedEmployee(matching);
        } else if (recalculated[activeReportIdx].employees.length > 0) {
          setSelectedEmployee(recalculated[activeReportIdx].employees[0]);
          setSelectedEmpId(recalculated[activeReportIdx].employees[0].id);
        }
      }
      return recalculated;
    });
    
    if (activeReportIdx !== -1) {
      if (customMessage) {
        setMessage(customMessage);
      } else {
        setMessage(`Recalculated attendance results with Shift: ${newConfig.shiftStart} - ${newConfig.shiftEnd}`);
      }
      setTimeout(() => setMessage(''), 4500);
    }
  };

  const employeesWithInvalidNames = React.useMemo(() => {
    const map: Record<string, { id: string; rawDetectedName: string; department?: string }> = {};
    reports.forEach(r => {
      r.employees.forEach(e => {
        if (e.isNameInvalid) {
          map[e.id] = {
            id: e.id,
            rawDetectedName: e.rawDetectedName || e.name || 'Unknown',
            department: e.department
          };
        }
      });
    });
    return Object.values(map);
  }, [reports]);

  const handleSaveCorrectedName = (empCode: string, correctedName: string) => {
    if (isInvalidEmployeeName(correctedName)) {
      alert("Error: The corrected name must be a valid string and cannot be numeric or an attendance metric.");
      return;
    }

    const newConfig = {
      ...config,
      employeeNames: {
        ...(config.employeeNames || {}),
        [empCode]: correctedName
      }
    };

    setNameCorrections(prev => {
      const copy = { ...prev };
      delete copy[empCode];
      return copy;
    });

    handleUpdateConfig(newConfig, `APPROVED & SAVED CORRECTION: Employee Name for ID ${empCode} is now set to "${correctedName}".`);
  };

  const [message, setMessage] = useState('');

  // Handle excel files uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Direct clean isolation: reset previous spreadsheet sessions completely 
    // to prevent any memory leakage or state persistence of prior documents.
    setReports([]);
    setActiveReportIdx(-1);
    setSelectedEmployee(null);
    setSelectedEmpId('');

    const filesArray = Array.from(files) as File[];
    const parsedReports: MonthlyReport[] = [];
    let completedCount = 0;

    filesArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          // Re-instantiate completely new SheetJS Workbook structure to avoid caching
          const wb = XLSX.read(bstr, { type: 'binary', cellStyles: true, cellFormula: true, cellNF: true, cellHTML: false });
          const firstSheetName = wb.SheetNames[0];
          const worksheet = wb.Sheets[firstSheetName];
          
          // Re-run the full dynamic roster processing algorithm strictly on this file with current config
          const parsed = parseAttendanceSheet(worksheet, file.name, config);
          parsed.rawWorkbook = wb; // Store reference securely for download module
          
          parsedReports.push(parsed);
          completedCount++;
          
          if (completedCount === filesArray.length) {
            setReports(parsedReports);
            if (parsedReports.length > 0) {
              setActiveReportIdx(0);
              const firstReport = parsedReports[0];
              if (firstReport.employees.length > 0) {
                setSelectedEmpId(firstReport.employees[0].id);
                setSelectedEmployee(firstReport.employees[0]);
              }
            }
            setActiveTab('exceptions');
            setMessage("✓ Upload Successful");
            setTimeout(() => setMessage(''), 4500);
          }
        } catch (err) {
          console.error(err);
          alert(`Failed to parse biometric file "${file.name}". Please confirm format matches structure shown in format guide.`);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  // Download format guide specifications trigger
  const handleDownloadFormatGuide = () => {
    const link = document.createElement('a');
    link.href = '/biometric_format_guide.txt';
    link.download = 'biometric_format_guide.txt';
    link.click();
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const currentReport = activeReportIdx !== -1 ? reports[activeReportIdx] : null;

  const consolidatedData = React.useMemo(() => {
    return consolidateReports(reports, consolidationFilter, config);
  }, [reports, consolidationFilter, config]);

  // Sync consolidation filter with uploaded reports
  useEffect(() => {
    if (reports.length > 0) {
      const allMonthNames = reports.map(r => r.monthName);
      const updateFilter = (prev: ConsolidationFilter) => {
        const newSelected = prev.selectedMonths.length === 0 
          ? allMonthNames
          : prev.selectedMonths.filter(m => allMonthNames.includes(m));
          
        return {
          selectedMonths: newSelected.length === 0 ? allMonthNames : newSelected
        };
      };

      setConsolidationFilter(prev => updateFilter(prev));
      setFilterInputs(prev => updateFilter(prev));
    }
  }, [reports]);

  // Active employees depending on viewMode
  const activeEmployeesList = React.useMemo(() => {
    if (viewMode === 'consolidated') {
      return consolidatedData.employees;
    } else {
      return currentReport ? currentReport.employees : [];
    }
  }, [viewMode, consolidatedData, currentReport]);

  // Keep selectedEmployee locked in sync with activeEmployeesList or selectedEmpId
  useEffect(() => {
    const matched = activeEmployeesList.find(e => e.id === selectedEmpId);
    if (matched) {
      setSelectedEmployee(matched);
    } else if (activeEmployeesList.length > 0) {
      setSelectedEmpId(activeEmployeesList[0].id);
      setSelectedEmployee(activeEmployeesList[0]);
    } else {
      setSelectedEmployee(null);
    }
  }, [activeEmployeesList, selectedEmpId]);


  // Compute live dashboard quick highlights
  const metrics = React.useMemo(() => {
    if (viewMode === 'consolidated') {
      return {
        processed: consolidatedData.employees.length,
        presentCount: consolidatedData.employees.length > 0 
          ? Math.round(consolidatedData.totalPresentDays / consolidatedData.employees.length)
          : 0,
        absentCount: consolidatedData.employees.length > 0
          ? Math.round(consolidatedData.totalAbsentDays / consolidatedData.employees.length)
          : 0,
        avgAttendance: consolidatedData.attendancePercentage,
        invalidCount: consolidatedData.pendingExceptions,
        approvedCount: consolidatedData.approvedExceptions
      };
    }

    if (!currentReport) return { processed: 0, presentCount: 0, absentCount: 0, avgAttendance: 0, invalidCount: 0, approvedCount: 0 };
    
    // Filter out any anomalous records to prevent division errors
    const validEmps = currentReport.employees.filter(emp => emp && typeof emp.attendancePercentage === 'number' && Number.isFinite(emp.attendancePercentage));
    const totalEmps = validEmps.length;
    let presentAcc = 0;
    let absentAcc = 0;
    let totAttendanceAcc = 0;

    validEmps.forEach(emp => {
      presentAcc += emp.presentDays || 0;
      absentAcc += emp.absentDays || 0;
      totAttendanceAcc += emp.attendancePercentage || 0;
    });
    
    const isPendingAnomaly = (a: any) => {
      if (a.type === 'Work Hours Reconciliation') {
        try {
          const parsed = JSON.parse(a.value);
          return parsed.status === 'Pending Reconciliation';
        } catch (_) {
          return true;
        }
      }
      return a.type === 'Invalid Punch' || 
        a.type === 'Incomplete Punch' ||
        a.type === 'After-Hours Attendance';
    };

    const isApprovedAnomaly = (a: any) => {
      if (a.type === 'Work Hours Reconciliation') {
        try {
          const parsed = JSON.parse(a.value);
          return parsed.status === 'Approved Reconciliation' || parsed.status === 'Rejected Reconciliation';
        } catch (_) {
          return false;
        }
      }
      return a.type === 'Approved Exception' || a.type === 'Manual Entry';
    };

    const invalidCount = currentReport.anomalies.filter(isPendingAnomaly).length;
    const approvedCount = currentReport.anomalies.filter(isApprovedAnomaly).length;

    return {
      processed: totalEmps,
      presentCount: Math.round(presentAcc / Math.max(1, totalEmps)), // avg active days
      absentCount: Math.round(absentAcc / Math.max(1, totalEmps)), // avg absent days
      avgAttendance: totalEmps > 0 ? Math.round(totAttendanceAcc / totalEmps) : 0,
      invalidCount,
      approvedCount
    };
  }, [currentReport, viewMode, consolidatedData]);

  React.useEffect(() => {
    if (activeTab === 'exceptions' && currentReport) {
       const dashboardPendingCount = metrics.invalidCount;
       const exceptionPagePendingCount = currentReport.anomalies.filter((a: any) => {
         if (a.type === 'Work Hours Reconciliation') {
           try {
             const p = JSON.parse(a.value);
             return p.status === 'Pending Reconciliation';
           } catch (_) {
             return true;
           }
         }
         return a.type === 'Invalid Punch' || 
           a.type === 'Incomplete Punch' ||
           a.type === 'After-Hours Attendance';
       }).length;
       if (dashboardPendingCount !== exceptionPagePendingCount) {
         console.error(`Validation Error: Dashboard Pending Count (${dashboardPendingCount}) does not match Exception Page Pending Count (${exceptionPagePendingCount}). Initiating recalculation.`);
         // Force recalculation by triggering a dummy config update
         handleUpdateConfig({ ...config });
       }
    }
  }, [activeTab, currentReport, metrics.invalidCount, config]);

  const handleExportPDF = () => {
    if (viewMode === 'consolidated') {
      const consolidatedPeriod = getReportingPeriod(consolidationFilter.selectedMonths);
      const consolidatedReportMock: MonthlyReport = {
        monthName: "Consolidated Period",
        employees: consolidatedData.employees,
        anomalies: consolidatedData.anomalies,
        rawWorkbook: undefined,
        fileName: "Consolidated_File",
        hasValidationDiscrepancies: false,
        totalErrorsCount: 0
      };
      generateExecutivePDF(consolidatedReportMock, consolidatedPeriod);
    } else {
      if (!currentReport) return;
      const period = getReportingPeriod([currentReport.monthName]);
      generateExecutivePDF(currentReport, period);
    }
  };

  const handleExportExcel = () => {
    if (viewMode === 'consolidated') {
      const reportingPeriod = getReportingPeriod(consolidationFilter.selectedMonths);
      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.aoa_to_sheet([
        ["CONSOLIDATED WORKFORCE ANALYTICS REPORT"],
        ["Reporting Period", reportingPeriod],
        [],
        ["Metric", "Value"],
        ["Total Monitored Employees", consolidatedData.employees.length],
        ["Average Attendance Percentage", `${consolidatedData.attendancePercentage}%`],
        ["Total Regular Work Hours (Net)", consolidatedData.totalNetHours],
        ["Total Actual Work Hours Worked", consolidatedData.totalActualHours],
        ["Total Late Slabs Registered", consolidatedData.totalLateSlabs]
      ]);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

      const employeeData = [
        ["Employee ID", "Employee Name", "Department", "Present Days", "Absent Days", "Weekly Offs", "Leaves", "Holidays", "Actual Work Hours", "Net Work Hours", "Late Days", "Late Slabs", "Attendance Percentage"]
      ];
      consolidatedData.employees.forEach(emp => {
        employeeData.push([
          emp.id,
          emp.name,
          emp.department,
          emp.presentDays,
          emp.absentDays,
          emp.weeklyOffDays,
          emp.leaveDays,
          emp.holidayDays,
          emp.totalActualHours,
          emp.totalNetHours,
          emp.totalLateDays,
          emp.totalLateSlabs,
          emp.attendancePercentage
        ]);
      });
      const wsEmployees = XLSX.utils.aoa_to_sheet(employeeData);
      XLSX.utils.book_append_sheet(wb, wsEmployees, "Employee Ledger");

      const anomalyData = [
        ["Date", "Employee ID", "Employee Name", "Anomaly Type", "Severity", "Description", "Raw Timing Punch Values"]
      ];
      consolidatedData.anomalies.forEach(ano => {
        anomalyData.push([
          ano.dateStr,
          ano.empCode,
          ano.empName,
          ano.type,
          ano.severity,
          ano.description,
          ano.value
        ]);
      });
      const wsAnomalies = XLSX.utils.aoa_to_sheet(anomalyData);
      XLSX.utils.book_append_sheet(wb, wsAnomalies, "Anomalies");

      XLSX.writeFile(wb, `Consolidated_Workforce_Report_${reportingPeriod.replace(/\s+/g, '_')}.xlsx`);
    } else {
      if (!currentReport) return;
      if (currentReport.rawWorkbook) {
        try {
          const firstSheetName = currentReport.rawWorkbook.SheetNames[0];
          const ws = currentReport.rawWorkbook.Sheets[firstSheetName];
          modifyWorksheetTimings(ws, config);
          XLSX.writeFile(currentReport.rawWorkbook, `Cleaned_Biometric_${currentReport.monthName}.xlsx`);
          setMessage("CLEANED & RECALCULATED BIOMETRIC EXCEL DOWNLOADED SUCCESSFULLY!");
          setTimeout(() => setMessage(''), 5000);
        } catch (err: any) {
          console.error(err);
          alert(`Failed to modify sheet: ${err.message || err}`);
        }
      } else {
        alert("Error: No raw workbook structure found for this session.");
      }
    }
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let filename = "";
    let mappingError = false;

    if (viewMode === 'consolidated') {
      const reportingPeriod = getReportingPeriod(consolidationFilter.selectedMonths);
      filename = `Consolidated_Attendance_Report_${reportingPeriod.replace(/\s+/g, '_')}.csv`;
      csvContent += "Employee ID,Employee Name,Department,Present Days,Absent Days,Weekly Offs,Leaves,Holidays,Actual Work Hours,Net Work Hours,Late Days,Late Slabs,Attendance Percentage\n";
      consolidatedData.employees.forEach(emp => {
        const lateDays = emp.totalLateDays;
        const lateSlabs = emp.totalLateSlabs;

        // Verify Late Days and Late Slabs are safe integers
        if (typeof lateDays !== 'number' || isNaN(lateDays) || !Number.isFinite(lateDays) || !Number.isInteger(lateDays) ||
            typeof lateSlabs !== 'number' || isNaN(lateSlabs) || !Number.isFinite(lateSlabs) || !Number.isInteger(lateSlabs)) {
          mappingError = true;
        }

        csvContent += `"${emp.id}","${emp.name}","${emp.department}",${emp.presentDays},${emp.absentDays},${emp.weeklyOffDays},${emp.leaveDays},${emp.holidayDays},${emp.totalActualHours},${emp.totalNetHours},${lateDays},${lateSlabs},${emp.attendancePercentage}%\n`;
      });
    } else {
      if (!currentReport) return;
      filename = `Monthly_Attendance_Report_${currentReport.monthName}.csv`;
      csvContent += "Employee ID,Employee Name,Department,Present Days,Absent Days,Weekly Offs,Leaves,Holidays,Actual Work Hours,Net Work Hours,Late Days,Late Slabs,Attendance Percentage\n";
      currentReport.employees.forEach(emp => {
        const lateDays = emp.totalLateDays;
        const lateSlabs = emp.totalLateSlabs;

        // Verify Late Days and Late Slabs are safe integers
        if (typeof lateDays !== 'number' || isNaN(lateDays) || !Number.isFinite(lateDays) || !Number.isInteger(lateDays) ||
            typeof lateSlabs !== 'number' || isNaN(lateSlabs) || !Number.isFinite(lateSlabs) || !Number.isInteger(lateSlabs)) {
          mappingError = true;
        }

        csvContent += `"${emp.id}","${emp.name}","${emp.department}",${emp.presentDays},${emp.absentDays},${emp.weeklyOffDays},${emp.leaveDays},${emp.holidayDays},${emp.totalActualHours},${emp.totalNetHours},${lateDays},${lateSlabs},${emp.attendancePercentage}%\n`;
      });
    }

    if (mappingError) {
      alert("CSV EXPORT DATA MAPPING ERROR: Non-numeric, non-integer, or corrupted values detected in Late Days or Late Slabs columns.");
      throw new Error("CSV EXPORT DATA MAPPING ERROR");
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="application-root" className="min-h-screen bg-[#fafaf9] text-slate-900 font-sans flex flex-col antialiased">
      
      {/* Neo-brutalist Notification banner */}
      {message && (
        <div className="bg-yellow-400 border-b-4 border-slate-900 text-slate-900 text-xs text-center py-3 px-4 font-black tracking-wide select-none transition-all flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse border border-slate-900"></span>
          <span className="whitespace-pre-line text-xs font-black tracking-wider leading-relaxed">{message}</span>
        </div>
      )}

      {/* Bento Standard Header */}
      <header className="bg-white border-b-4 border-slate-900 shrink-0 select-none py-5 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white border-3 border-slate-900 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shrink-0 p-1.5 overflow-hidden">
              <img
                src={LOGO_DATA_URI}
                alt="Workforce Analytics"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 border border-indigo-200">
                  BIOMETRIC ENGINE v2.0
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500">SYSTEM DATE: 2026-05-26</span>
              </div>
              <h1 className="text-2xl font-black tracking-tighter mt-0.5 text-slate-950">
                WORKFORCE ANALYTICS <span className="text-indigo-650">v2.4</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                HRMS Attendance Slab Engine & Attendance Analytics
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-slate-100 border-2 border-slate-900 px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-slate-950 animate-pulse"></div>
              <span className="text-[10px] font-mono font-bold text-slate-800">
                {reports.length} ACTIVE {reports.length === 1 ? 'SHEET' : 'SHEETS'} LOADED
              </span>
            </div>

            <div className="text-right hidden xl:block border-l-2 border-slate-200 pl-4">
              <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-widest">LIVE TRACKER</span>
              <span className="font-mono text-xs font-black text-slate-800">
                {currentTime.toLocaleTimeString()} UTC
              </span>
            </div>

            {/* Print action buttons */}
            {reports.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{viewMode === 'consolidated' ? 'Consolidated CSV' : 'Monthly CSV'}</span>
                </button>
                <button
                  id="bt-download-cleaned-sheet"
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>{viewMode === 'consolidated' ? 'Consolidated Excel' : 'Monthly Excel'}</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-2 border-slate-900 font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>{viewMode === 'consolidated' ? 'Consolidated PDF' : 'Monthly PDF'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Primary Bento Workspace Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        
        {reports.length === 0 ? (
          /* Centered pristine empty state / upload workflow workspace */
          <div className="max-w-xl w-full mx-auto my-auto py-12 px-6 sm:px-12 bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-indigo-50 border-3 border-indigo-600 rounded-none flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] mb-6">
              <UploadCloud className="w-10 h-10 text-indigo-650" />
            </div>
            
            <h2 className="font-sans font-black text-xl sm:text-2xl tracking-tighter text-slate-950 uppercase border-b-2 border-slate-100 pb-3 w-full">
              UPLOAD ATTENDANCE SHEET
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-600 font-semibold leading-relaxed mt-4 max-w-md">
              Upload biometric attendance spreadsheets for automated timing analysis and workforce processing.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 w-full">
              <button
                id="btn-upload-attendance-primary"
                onClick={handleTriggerUpload}
                className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 font-black uppercase text-xs tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                UPLOAD EXCEL FILE
              </button>
              
              <button
                id="btn-download-format-guide-secondary"
                onClick={handleDownloadFormatGuide}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 font-black uppercase text-xs tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                DOWNLOAD FORMAT GUIDE
              </button>
            </div>
            
            {/* Hidden file input element */}
            <input
              type="file"
              ref={fileInputRef}
              id="multi-xls-upload-empty"
              multiple
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          /* Active reports workspace dashboard analytics layout */
          <div className="space-y-8 animate-in fade-in duration-200">
            
            {/* File input drag drop card (Span 12) */}
            <div className="bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 md:max-w-xl text-left">
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 uppercase px-2.5 py-0.5 leading-none">
                  CORE FILE PARSER
                </span>
                <h3 className="text-sm font-black text-slate-950 tracking-tight flex items-center gap-2 mt-1">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-650" />
                  Upload Additional Worksheet Ledger
                </h3>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Add another month directory or department register biometric ledger to analyze and process timing anomalies in real time. Standardizes repeating 8-row employee punch records.
                </p>
              </div>

              {/* Neo upload label trigger */}
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 select-none">
                <label
                  htmlFor="multi-xls-upload-active"
                  className="flex items-center justify-center gap-3 px-4 py-2.5 border-2 border-dashed border-slate-400 hover:border-slate-800 bg-slate-50 hover:bg-slate-100 rounded-none text-center cursor-pointer transition-all w-full md:w-auto shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5"
                >
                  <UploadCloud className="w-5 h-5 text-indigo-650" />
                  <div className="text-left">
                    <span className="block text-xs font-black text-slate-800 uppercase tracking-wide">Browse Worksheets</span>
                    <span className="block text-[9px] font-semibold text-slate-400">Supports multiple .xls / .xlsx</span>
                  </div>
                </label>
                <input
                  type="file"
                  id="multi-xls-upload-active"
                  multiple
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {/* EMPLOYEE NAME VERIFICATION REQUIRED PANEL */}
            {employeesWithInvalidNames.length > 0 && (
              <div id="employee-name-verification-container" className="bg-amber-50 border-4 border-amber-500 p-6 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] space-y-4 animate-in fade-in slide-in-from-top-4 duration-200 text-left">
                <div className="flex items-center gap-3 border-b-2 border-amber-200 pb-3">
                  <span className="px-2 py-1 bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider border border-amber-600">
                    EMPLOYEE NAME VERIFICATION REQUIRED
                  </span>
                </div>
                
                <p className="text-xs text-slate-700 font-bold leading-relaxed">
                  The system detected invalid placeholder metrics (such as raw numeric counts, attendance labels, or percentage values) in the Employee Name column of the biometric ledger.
                  Please consult HR Records and confirm the correct human employee names below:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employeesWithInvalidNames.map(emp => (
                    <div key={emp.id} className="bg-white border-2 border-slate-900 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold font-mono">
                        <div>
                          <span className="block text-[9px] text-slate-400 uppercase">Employee ID:</span>
                          <span className="text-slate-900 font-extrabold text-sm">{emp.id}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-slate-400 uppercase">Detected Name:</span>
                          <span className="text-red-650 font-extrabold text-sm">{emp.rawDetectedName}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-700 uppercase">
                          Please Enter Correct Employee Name:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id={`input-correct-name-${emp.id}`}
                            placeholder="Enter correct name..."
                            value={nameCorrections[emp.id] || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNameCorrections(prev => ({
                                ...prev,
                                [emp.id]: v
                              }));
                            }}
                            className="flex-1 bg-white border-2 border-slate-900 px-3 py-1.5 text-xs font-mono font-black shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = nameCorrections[emp.id]?.trim();
                                if (val) {
                                  handleSaveCorrectedName(emp.id, val);
                                }
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              const val = nameCorrections[emp.id]?.trim();
                              if (val) {
                                handleSaveCorrectedName(emp.id, val);
                              } else {
                                alert("Please enter a valid correction name.");
                              }
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 font-black text-xs uppercase shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                          >
                            SAVE & APPROVE
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-month Dashboard Selectors & Filters */}
            {reports.length > 0 && (
              <div className="bg-white border-3 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-6 select-none">
                
                {/* Mode Selector Row */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-slate-200 pb-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 uppercase px-2 py-0.5 rounded leading-none">
                      ANALYTICS ENGINE WORKSPACE
                    </span>
                    <h4 className="text-sm font-black tracking-tight text-slate-950 uppercase mt-1">
                      Dashboard Selection Mode
                    </h4>
                  </div>

                  <div className="inline-flex rounded-none p-1 bg-slate-100 border-2 border-slate-900 shrink-0 select-none">
                    <button
                      onClick={() => setViewMode('individual')}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        viewMode === 'individual'
                          ? 'bg-slate-950 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                          : 'text-slate-600 hover:text-slate-950 bg-transparent hover:bg-slate-200'
                      }`}
                    >
                      📅 INDIVIDUAL MONTH
                    </button>
                    <button
                      onClick={() => setViewMode('consolidated')}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        viewMode === 'consolidated'
                          ? 'bg-slate-950 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                          : 'text-slate-600 hover:text-slate-950 bg-transparent hover:bg-slate-200'
                      }`}
                    >
                      📈 CONSOLIDATED MODE
                    </button>
                  </div>
                </div>

                {/* Sub-Filters / Settings based on active View Mode */}
                {viewMode === 'individual' ? (
                  /* --- Individual month select block (Original code behavior) --- */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border-2 border-slate-200 p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-indigo-600 border border-slate-950 animate-pulse shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-widest leading-none font-sans">ACTIVE ROSTER FILE</span>
                        <span className="text-xs text-slate-700 font-extrabold">Active Roster: {currentReport?.monthName}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-500 font-extrabold uppercase">Select Month:</span>
                      <div className="inline-flex gap-1 bg-white border border-slate-350 p-1">
                        {reports.map((rep, idx) => (
                          <button
                            key={rep.monthName}
                            onClick={() => {
                              setActiveReportIdx(idx);
                              // Sync selected employee ID inside this report
                              if (rep.employees.length > 0) {
                                setSelectedEmpId(rep.employees[0].id);
                                setSelectedEmployee(rep.employees[0]);
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                              activeReportIdx === idx
                                ? 'bg-indigo-600 text-white shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent hover:bg-slate-100'
                            }`}
                          >
                            {rep.monthName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* --- Consolidated view multiple months select block --- */
                  <div className="bg-indigo-50/50 border-3 border-indigo-900 p-5 shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] space-y-3">
                    <div>
                      <span className="text-[8px] font-black text-indigo-700 uppercase tracking-widest leading-none block">MONTH FILTER</span>
                      <h5 className="text-xs font-black text-slate-950 uppercase mt-0.5">Verify / Select Target Months</h5>
                      <p className="text-[10px] text-slate-500 font-extrabold mt-0.5">Select sheets to combine into consolidated index instantly</p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {reports.map((rep) => {
                        const isChecked = consolidationFilter.selectedMonths.includes(rep.monthName);
                        return (
                          <button
                            key={rep.monthName}
                            onClick={() => {
                              const newMs = isChecked
                                ? consolidationFilter.selectedMonths.filter(m => m !== rep.monthName)
                                : [...consolidationFilter.selectedMonths, rep.monthName];
                              if (newMs.length === 0) {
                                alert("Please keep at least one month checked for consolidation.");
                                return;
                              }
                              const updated = { selectedMonths: newMs };
                              setConsolidationFilter(updated);
                              setFilterInputs(updated);
                            }}
                            className={`px-3.5 py-2 border-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-600 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-mono text-sm leading-none">{isChecked ? '☑' : '☐'}</span>
                            <span>{rep.monthName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Modular Bento Sections tabs */}
            <div className="space-y-6">
              
              {/* Dock tab selectors buttons */}
              <div className="flex flex-wrap items-center gap-2 select-none border-b-2 border-slate-200 pb-0.5">
                <button
                  onClick={() => setActiveTab('directory')}
                  className={`py-2 px-4 text-xs font-black uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'directory' 
                      ? 'border-indigo-600 text-slate-900 border-b-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Grid className="w-4 h-4 text-indigo-650" />
                   Personnel Directory
                </button>

                <button
                  onClick={() => setActiveTab('individual')}
                  className={`py-2 px-4 text-xs font-black uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'individual' 
                      ? 'border-indigo-600 text-slate-900 border-b-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <User className="w-4 h-4 text-indigo-650" />
                  Employee Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('charts')}
                  className={`py-2 px-4 text-xs font-black uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'charts' 
                      ? 'border-indigo-600 text-slate-900 border-b-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 text-indigo-650" />
                  Workforce Trends
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`py-2 px-4 text-xs font-black uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'settings' 
                      ? 'border-indigo-600 text-slate-900 border-b-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Settings className="w-4 h-4 text-slate-600" />
                  Schedules Settings
                </button>
                  <button
                  onClick={() => setActiveTab('exceptions')}
                  className={`py-2 px-4 text-xs font-black uppercase tracking-wider border-b-4 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'exceptions' 
                      ? 'border-indigo-600 text-slate-900 border-b-indigo-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <AlertOctagon className="w-4 h-4 text-amber-500" />
                  Exceptions
                </button>
              </div>

              {/* Dashboard Bento KPI Row */}
              {activeTab === 'directory' && currentReport && (
                <div className="space-y-6">
                  {/* Minimum Work Hours & Penalty Basis Header Section */}
                  <div className="bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] select-none">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-650 inline-block animate-pulse"></span>
                          <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">Grounds of Calculation Basis</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-950 uppercase tracking-tight mt-1 flex items-center flex-wrap gap-2">
                          📋 Work Hour Policy Basis: <span className="text-indigo-650 font-mono bg-indigo-50 border border-indigo-200 px-2 py-0.5">{config.minWorkHoursStr || '08:30'} HR Threshold</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide mt-1.5 leading-normal">
                          Calculated Net Work Hours operates as the single source of truth for all dashboards, lists, KPI tiles, charts, and report exports.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-50 border-2 border-slate-900 p-3.5 shrink-0 rounded-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                        <div>
                          <span className="text-[8px] text-slate-400 font-extrabold uppercase block leading-none mb-1">MINIMUM HOURS</span>
                          <span className="font-mono text-xs font-black text-indigo-950">{config.minWorkHoursStr || '08:30'} hrs / day</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-red-500 font-extrabold uppercase block leading-none mb-1 text-red-600">PENALTY TIME</span>
                          <span className="font-mono text-xs font-black text-red-650">-{config.penaltyTimeStr || '00:30'} hrs / day</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-dashed border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-900">📐 Calculation logic:</span>
                        <span className="bg-emerald-50 border border-emerald-250 px-2 py-0.5 text-emerald-800 font-mono">
                          Actual &ge; {config.minWorkHoursStr || '08:30'} &rArr; Net Hours = Actual Hours
                        </span>
                        <span className="bg-rose-50 border border-rose-250 px-2 py-0.5 text-rose-800 font-mono">
                          Actual &lt; {config.minWorkHoursStr || '08:30'} &rArr; Net Hours = Actual Hours - {config.penaltyTimeStr || '00:30'}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveTab('settings')}
                        className="text-indigo-650 hover:text-indigo-850 hover:underline font-black uppercase text-[10px]"
                      >
                        Adjust Standards &rarr;
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">
                    
                    {/* KPI 1: Headcount */}
                    <div className="bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
                      <div className="absolute right-2.5 top-2.5 text-slate-100 pointer-events-none">
                        <Users className="w-12 h-12 opacity-80" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PERSONNEL ANALYZED</span>
                      <div className="text-3xl font-black text-slate-950 mt-1 font-mono tracking-tight">{metrics.processed} EMP</div>
                      <p className="text-[10px] text-slate-400 mt-2 font-semibold">Active staff in current register ledger</p>
                    </div>

                    {/* KPI 2: Attendance Quotient */}
                    <div className="bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
                      <div className="absolute right-2.5 top-2.5 text-slate-100 pointer-events-none">
                        <Calendar className="w-12 h-12 opacity-80" />
                      </div>
                      <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block">ATTENDANCE RATE</span>
                      <div className="text-3xl font-black text-slate-950 mt-1 font-mono tracking-tight">{metrics.avgAttendance}% AVG</div>
                      <div className="h-2 w-full bg-slate-100 border border-slate-900 mt-2.5 overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${metrics.avgAttendance}%` }}></div>
                      </div>
                    </div>

                    {/* KPI 3: Monthly Absences */}
                    <div className="bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden text-left">
                      <div className="absolute right-2.5 top-2.5 text-slate-100 pointer-events-none">
                        <Briefcase className="w-12 h-12 opacity-80" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        {viewMode === 'consolidated' ? 'TOTAL SHIFT DAYS' : 'AVG SHIFT DAYS'}
                      </span>
                      <div className="text-2xl font-black text-slate-950 mt-1 font-mono tracking-tight text-left">
                        {metrics.presentCount} {viewMode === 'consolidated' ? 'Days' : 'Days / Month'}
                      </div>
                      <p className="text-[10px] text-rose-600 mt-2 font-bold uppercase tracking-wider text-left font-mono">
                        ▲ {metrics.absentCount} {viewMode === 'consolidated' ? 'absolute absences total' : 'absolute absences avg'}
                      </p>
                    </div>

                    {/* KPI 4: Attendance Exceptions */}
                    <div 
                      onClick={() => setActiveTab('exceptions')}
                      className="bg-amber-100 border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden cursor-pointer hover:bg-amber-200 transition-colors"
                    >
                      <div className="absolute right-2.5 top-2.5 text-amber-200 pointer-events-none">
                        <AlertOctagon className="w-12 h-12 opacity-80" />
                      </div>
                      {metrics.invalidCount > 0 ? (
                        <>
                          <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest block">PENDING EXCEPTIONS</span>
                          <div className="text-3xl font-black text-slate-950 mt-1 font-mono tracking-tight">{metrics.invalidCount}</div>
                          <p className="text-[10px] text-amber-800 mt-2 font-bold uppercase tracking-wider">Requires Manual Review</p>
                        </>
                      ) : metrics.approvedCount > 0 ? (
                        <>
                          <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest block">APPROVED EXCEPTIONS</span>
                          <div className="text-3xl font-black text-emerald-800 mt-1 font-mono tracking-tight">{metrics.approvedCount}</div>
                          <p className="text-[10px] text-amber-800 mt-2 font-bold uppercase tracking-wider">All exceptions resolved</p>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest block">ATTENDANCE EXCEPTIONS</span>
                          <div className="text-3xl font-black text-emerald-800 mt-1 font-mono tracking-tight">0</div>
                          <p className="text-[10px] text-amber-800 mt-2 font-bold uppercase tracking-wider">No anomalies found</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Display active tab subview layout */}
              <div className="transition-all animate-in fade-in duration-200">
                {activeTab === 'directory' && (
                  viewMode === 'consolidated' ? (
                    <div className="space-y-6">
                      
                      {/* Sub-Report Tabs Selector Bar */}
                      <div className="flex border-b-2 border-slate-300 pb-0.5 gap-2 select-none">
                        <button
                          onClick={() => setConsolidatedReportTab('employees')}
                          className={`px-4 py-2 border-b-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            consolidatedReportTab === 'employees'
                              ? 'border-indigo-600 text-indigo-950 font-black'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          📋 Consolidated Employee Report
                        </button>
                        <button
                          onClick={() => setConsolidatedReportTab('workforce')}
                          className={`px-4 py-2 border-b-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            consolidatedReportTab === 'workforce'
                              ? 'border-indigo-600 text-indigo-950 font-black'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          👥 Consolidated Workforce Report
                        </button>
                        <button
                          onClick={() => setConsolidatedReportTab('attendance')}
                          className={`px-4 py-2 border-b-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            consolidatedReportTab === 'attendance'
                              ? 'border-indigo-600 text-indigo-950 font-black'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          📅 Consolidated Attendance Summary
                        </button>
                        <button
                          onClick={() => setConsolidatedReportTab('exceptions')}
                          className={`px-4 py-2 border-b-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            consolidatedReportTab === 'exceptions'
                              ? 'border-indigo-600 text-indigo-950 font-black'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          🚨 Consolidated Exception Summary
                        </button>
                      </div>

                      {/* Content Panels */}
                      {consolidatedReportTab === 'employees' && (
                        <EmployeeList
                          employees={consolidatedData.employees}
                          onSelectEmployee={(emp) => {
                            setSelectedEmployee(emp);
                            setSelectedEmpId(emp.id);
                            setActiveTab('individual');
                          }}
                        />
                      )}

                      {consolidatedReportTab === 'workforce' && (
                        <div className="bg-white border-3 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-6">
                          <div>
                            <h4 className="text-sm font-black text-slate-950 uppercase">👥 Consolidated Workforce Intelligence Report</h4>
                            <p className="text-xs text-slate-400 font-bold">Dynamic workforce and workload utilization summary index</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Panel A: Productivity Summary */}
                            <div className="border-2 border-slate-200 p-4 space-y-4">
                              <h5 className="text-xs font-black text-indigo-900 uppercase">⚡ Attendance & Performance Distribution</h5>
                              <div className="space-y-3 font-semibold text-xs text-slate-700">
                                <div className="flex justify-between border-b pb-1">
                                  <span>Total Logged Days:</span>
                                  <span className="font-mono text-slate-900 font-bold">{consolidatedData.totalPresentDays + consolidatedData.totalAbsentDays} Days</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                  <span>Active Headcount:</span>
                                  <span className="font-mono text-slate-900 font-bold">{consolidatedData.employees.length} Staff members</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                  <span>Consolidated Attendance Average:</span>
                                  <span className="font-mono text-slate-900 font-bold">{consolidatedData.attendancePercentage}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Avg Roster Net Hours / Employee:</span>
                                  <span className="font-mono text-slate-900 font-bold">{consolidatedData.averageNetHours} Hours</span>
                                </div>
                              </div>
                            </div>

                            {/* Panel B: Productivity & Penalty Breakdown */}
                            <div className="border-2 border-slate-200 p-4 space-y-4">
                              <h5 className="text-xs font-black text-amber-900 uppercase">📉 Tardiness Hours Loss Matrix</h5>
                              <div className="space-y-3 font-semibold text-xs text-slate-700">
                                <div className="flex justify-between border-b pb-1">
                                  <span>Working Hours Penalty Standard:</span>
                                  <span className="font-mono text-slate-900 font-bold">-{config.penaltyTimeStr || '00:30'} Hrs per Day</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                  <span>Late Penalty Transactions Incurred:</span>
                                  <span className="font-mono text-slate-900 font-bold">{consolidatedData.totalLateSlabs} Slabs ({consolidatedData.totalLateSlabs * 0.5} hours deduction penalty)</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                  <span>Gross Work Hours Logged:</span>
                                  <span className="font-mono text-slate-900 font-bold">{consolidatedData.totalActualHours} Hours</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Net Billable Work Hours Paid:</span>
                                  <span className="font-mono text-indigo-700 font-black">{consolidatedData.totalNetHours} Hours</span>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}

                      {consolidatedReportTab === 'attendance' && (
                        <div className="bg-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-b-2 border-slate-950">
                                <th className="p-4">Roster Month Sheet</th>
                                <th className="p-4">Staff Count</th>
                                <th className="p-4">Present Days</th>
                                <th className="p-4">Absent Days</th>
                                <th className="p-4">Weekly Offs</th>
                                <th className="p-4">Late Slabs Incurred</th>
                                <th className="p-4">Attendance Average %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs font-bold text-slate-800">
                              {reports
                                .filter(r => consolidationFilter.selectedMonths.includes(r.monthName))
                                .map((rep) => {
                                  let present = 0;
                                  let absent = 0;
                                  let wo = 0;
                                  let ratesSum = 0;
                                  let slabs = 0;

                                  rep.employees.forEach(e => {
                                    present += e.presentDays ?? 0;
                                    absent += e.absentDays ?? 0;
                                    wo += e.weeklyOffDays ?? 0;
                                    ratesSum += e.attendancePercentage ?? 0;
                                    slabs += e.totalLateSlabs ?? 0;
                                  });

                                  const avgRate = rep.employees.length > 0 ? (ratesSum / rep.employees.length).toFixed(1) : '0';

                                  return (
                                    <tr key={rep.monthName} className="hover:bg-slate-50">
                                      <td className="p-4 font-black text-slate-950 uppercase">{rep.monthName}</td>
                                      <td className="p-4 font-mono">{rep.employees.length} Staff</td>
                                      <td className="p-4 font-mono text-emerald-600">{present} Days</td>
                                      <td className="p-4 font-mono text-rose-600">{absent} Days</td>
                                      <td className="p-4 font-mono text-indigo-650">{wo} Days</td>
                                      <td className="p-4 font-mono text-amber-700">{slabs} Slabs</td>
                                      <td className="p-4 font-mono text-slate-950 text-right pr-6">{avgRate}% Rate</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {consolidatedReportTab === 'exceptions' && (
                        <div className="bg-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-b-2 border-slate-950">
                                <th className="p-4">Roster Month Sheet</th>
                                <th className="p-4">Total Biometrics Alerts</th>
                                <th className="p-4">Pending Exceptions Audit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs font-bold text-slate-800">
                              {reports
                                .filter(r => consolidationFilter.selectedMonths.includes(r.monthName))
                                .map((rep) => {
                                  const pending = rep.anomalies.filter(a => {
                                    if (a.type === 'Work Hours Reconciliation') {
                                      try {
                                        const parsed = JSON.parse(a.value);
                                        return parsed.status === 'Pending Reconciliation';
                                      } catch (_) {
                                        return true;
                                      }
                                    }
                                    return a.type === 'Invalid Punch' || a.type === 'Incomplete Punch' || a.type === 'After-Hours Attendance';
                                  }).length;

                                  return (
                                    <tr key={rep.monthName} className="hover:bg-slate-50">
                                      <td className="p-4 font-black text-slate-950 uppercase">{rep.monthName}</td>
                                      <td className="p-4 font-mono">{rep.anomalies.length} Alerts</td>
                                      <td className="p-4 font-mono">
                                        <span className={`px-2 py-1 border text-[10px] font-black uppercase ${
                                          pending > 0 
                                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        }`}>
                                          {pending > 0 ? `🚨 ${pending} PENDING REVIEW` : '✔️ ALL RESOLVED'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  ) : (
                    <EmployeeList
                      employees={currentReport.employees}
                      onSelectEmployee={(emp) => {
                        setSelectedEmployee(emp);
                        setSelectedEmpId(emp.id);
                        setActiveTab('individual');
                        setIsDetailModalOpen(true);
                      }}
                    />
                  )
                )}

                {activeTab === 'individual' && (
                  <EmployeeDashboard
                    employees={activeEmployeesList}
                    selectedEmpId={selectedEmpId}
                    onSelectEmpId={setSelectedEmpId}
                    onOpenDetail={(emp) => {
                      setSelectedEmployee(emp);
                      setSelectedEmpId(emp.id);
                      setIsDetailModalOpen(true);
                    }}
                    isConsolidated={viewMode === 'consolidated'}
                    allReports={reports.filter(r => consolidationFilter.selectedMonths.includes(r.monthName))}
                  />
                )}

                {activeTab === 'charts' && (
                  <ChartsAnalytics
                    employees={activeEmployeesList}
                    isConsolidated={viewMode === 'consolidated'}
                    allReports={reports}
                    selectedMonths={consolidationFilter.selectedMonths}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsPanel
                    config={config}
                    onUpdateConfig={handleUpdateConfig}
                  />
                )}

                {activeTab === 'exceptions' && (
                  <AttendanceExceptionsReview
                    anomalies={viewMode === 'consolidated' ? consolidatedData.anomalies : currentReport.anomalies}
                    overrides={config.overrides || {}}
                    reconciliations={config.reconciliations || {}}
                    matchReviews={viewMode === 'consolidated' ? consolidatedData.matchReviews : []}
                    onApproveMatch={(fromId, toId) => {
                      const newMatches = { ...(config.employeeMatches || {}), [fromId]: toId };
                      const newRejected = (config.rejectedMatches || []).filter(item => item !== `${fromId}_to_${toId}`);
                      handleUpdateConfig({
                        ...config,
                        employeeMatches: newMatches,
                        rejectedMatches: newRejected
                      }, "✓ Employee Match Approved\n✓ Dashboards Recalculated");
                    }}
                    onRejectMatch={(fromId, toId) => {
                      const newMatches = { ...(config.employeeMatches || {}) };
                      delete newMatches[fromId];
                      
                      const pairId = `${fromId}_to_${toId}`;
                      const currentRejected = config.rejectedMatches || [];
                      const newRejected = currentRejected.includes(pairId) ? currentRejected : [...currentRejected, pairId];
                      
                      handleUpdateConfig({
                        ...config,
                        employeeMatches: newMatches,
                        rejectedMatches: newRejected
                      }, "✓ Match Rejected\n✓ Employee Isolated");
                    }}
                    onApplyOverride={(anomaly, override) => {
                      const baseId = anomaly.id.replace('_inv', '').replace('_inc', '').replace('_man', '').replace('_aft', '');
                      const newOverrides = { ...config.overrides, [baseId]: override };
                      handleUpdateConfig({ ...config, overrides: newOverrides }, "✓ Exception Approved\n✓ Dashboard Updated");
                    }}
                    onClearOverride={(anomalyId) => {
                      const baseId = anomalyId.replace('_inv', '').replace('_inc', '').replace('_man', '').replace('_aft', '');
                      const newOverrides = { ...config.overrides };
                      delete newOverrides[baseId];
                      handleUpdateConfig({ ...config, overrides: newOverrides });
                    }}
                    onApplyReconciliation={(key, recon) => {
                      const newRecons = { ...config.reconciliations, [key]: recon };
                      handleUpdateConfig({ ...config, reconciliations: newRecons }, "✓ Exception Approved\n✓ Dashboard Updated");
                    }}
                    onClearReconciliation={(key) => {
                      const newRecons = { ...config.reconciliations };
                      delete newRecons[key];
                      handleUpdateConfig({ ...config, reconciliations: newRecons });
                    }}
                  />
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Detail Modal drill-down */}
      <EmployeeDetailModal
        employee={isDetailModalOpen ? selectedEmployee : null}
        onClose={() => setIsDetailModalOpen(false)}
      />

      {/* Bottom Footer Status */}
      <footer className="bg-slate-50 text-slate-500 border-t border-slate-200 shrink-0 select-none py-4 px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold tracking-wide">
        <div className="text-left font-bold text-slate-600">A.O. Mittal & Associates</div>
        <div className="text-center font-medium text-slate-500">CA Akash Agarwal</div>
        <div className="text-right font-medium text-slate-400">Sarthak Jain</div>
      </footer>

    </div>
  );
}
