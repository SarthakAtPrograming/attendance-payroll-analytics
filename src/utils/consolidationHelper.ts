import { MonthlyReport, EmployeeSummary, DailyRecord, AttendanceAnomaly, EmployeeMatchReview, Configuration } from '../types';

/**
 * Gets a standardized ISO string "YYYY-MM-DD" from a Month name string and a day number.
 * Example input: "April-2026", 15
 * Output: "2026-04-15"
 */
export function getISOStringFromMonthDay(monthName: string, dayNum: number): string {
  const clean = monthName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  let year = 2026;
  
  // Look for a 4-digit year in the month string
  const yearMatch = monthName.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }
  
  // Detect month indexing
  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];
  let monthIdx = 0; // default January
  for (let i = 0; i < 12; i++) {
    if (clean.includes(months[i])) {
      monthIdx = i;
      break;
    }
  }
  
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(dayNum).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Normalizes user filter dates "01-Jan-2026" or "YYYY-MM-DD" into a clean "YYYY-MM-DD" string.
 */
export function normalizeDateInput(dateStr: string): string {
  if (!dateStr) return '';
  
  // If it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try to parse format text like "01-Jan-2026"
  const parts = dateStr.replace(/-/g, ' ').split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const monthWord = parts[1].toLowerCase();
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    
    const months = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec"
    ];
    let monthIdx = 0;
    for (let i = 0; i < 12; i++) {
      if (months[i].startsWith(monthWord.slice(0, 3))) {
        monthIdx = i;
        break;
      }
    }
    const mm = String(monthIdx + 1).padStart(2, '0');
    return `${year}-${mm}-${day}`;
  }
  
  // Fallback to JS Date parser
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (_) {}
  
  return dateStr;
}

export interface ConsolidationFilter {
  selectedMonths: string[]; // e.g. ["April-2026", "May-2026"]
}

/**
 * Consolidates multiple MonthlyReports into a single Consolidated dataset.
 */
export interface ConsolidatedData {
  employees: EmployeeSummary[];
  anomalies: AttendanceAnomaly[];
  matchReviews: EmployeeMatchReview[];
  
  // Consolidated aggregate KPIs
  totalPresentDays: number;
  totalAbsentDays: number;
  totalWeeklyOffDays: number;
  totalLateDays: number;
  totalLateSlabs: number;
  totalActualHours: number;
  totalNetHours: number;
  attendancePercentage: number;
  averageNetHours: number;
  totalExceptions: number;
  approvedExceptions: number;
  pendingExceptions: number;
}

export function consolidateReports(
  reports: MonthlyReport[],
  filter: ConsolidationFilter,
  config?: Configuration
): ConsolidatedData {
  if (reports.length === 0) {
    return {
      employees: [],
      anomalies: [],
      matchReviews: [],
      totalPresentDays: 0,
      totalAbsentDays: 0,
      totalWeeklyOffDays: 0,
      totalLateDays: 0,
      totalLateSlabs: 0,
      totalActualHours: 0,
      totalNetHours: 0,
      attendancePercentage: 0,
      averageNetHours: 0,
      totalExceptions: 0,
      approvedExceptions: 0,
      pendingExceptions: 0
    };
  }

  // 1. Filter reports based on selected months
  const filteredReports = reports.filter(r => filter.selectedMonths.includes(r.monthName));

  // Collect raw employees
  const rawEmployees: { id: string; name: string; department: string; originMonth: string; dailyRecords: DailyRecord[] }[] = [];
  filteredReports.forEach(report => {
    report.employees.forEach(emp => {
      rawEmployees.push({
        id: emp.id,
        name: emp.name,
        department: emp.department || 'General',
        originMonth: report.monthName,
        dailyRecords: emp.dailyRecords
      });
    });
  });

  // Calculate match reviews
  const matchReviews: EmployeeMatchReview[] = [];
  const empIdList = Array.from(new Set(rawEmployees.map(e => e.id)));
  const tempIds = empIdList.filter(id => id.startsWith('EMP_'));
  const masterIds = empIdList.filter(id => !id.startsWith('EMP_'));

  tempIds.forEach(tempId => {
    const tempEmps = rawEmployees.filter(e => e.id === tempId);
    if (tempEmps.length === 0) return;
    const tempEmp = tempEmps[0];

    // Look for candidates to merge into in master ids list
    let bestMatchId = '';
    let bestMatchName = '';
    let bestMatchDept = '';
    let conflictType = 'Missing Employee ID & Name Variation';

    // 1. First look for exact / high confidence name + department matches
    const exactMatch = rawEmployees.find(other => 
      !other.id.startsWith('EMP_') && 
      other.name.toLowerCase().trim() === tempEmp.name.toLowerCase().trim() && 
      other.department.toLowerCase().trim() === tempEmp.department.toLowerCase().trim()
    );

    if (exactMatch) {
      bestMatchId = exactMatch.id;
      bestMatchName = exactMatch.name;
      bestMatchDept = exactMatch.department;
      conflictType = 'Missing Employee ID (Found exact Name & Department master match)';
    } else {
      // 2. Look for high similarity names in the same department
      const simMatch = rawEmployees.find(other => 
        !other.id.startsWith('EMP_') && 
        other.department.toLowerCase().trim() === tempEmp.department.toLowerCase().trim() && 
        (other.name.toLowerCase().includes(tempEmp.name.toLowerCase()) || tempEmp.name.toLowerCase().includes(other.name.toLowerCase()))
      );

      if (simMatch) {
        bestMatchId = simMatch.id;
        bestMatchName = simMatch.name;
        bestMatchDept = simMatch.department;
        conflictType = 'Missing Employee ID & Potential name variation match';
      } else {
        // 3. Look for name matches across any department
        const nameMatch = rawEmployees.find(other => 
          !other.id.startsWith('EMP_') && 
          (other.name.toLowerCase().includes(tempEmp.name.toLowerCase()) || tempEmp.name.toLowerCase().includes(other.name.toLowerCase()))
        );
        if (nameMatch) {
          bestMatchId = nameMatch.id;
          bestMatchName = nameMatch.name;
          bestMatchDept = nameMatch.department;
          conflictType = 'Missing Employee ID & Matching name under different Department';
        }
      }
    }

    if (bestMatchId) {
      const reviewId = `${tempId}_to_${bestMatchId}`;
      const isApproved = config?.employeeMatches?.[tempId] === bestMatchId;
      const isRejected = config?.rejectedMatches?.includes(reviewId);
      matchReviews.push({
        id: reviewId,
        fromId: tempId,
        fromName: tempEmp.name,
        fromDept: tempEmp.department,
        toId: bestMatchId,
        toName: bestMatchName,
        toDept: bestMatchDept,
        conflictType: conflictType,
        status: isApproved ? 'Approved' : (isRejected ? 'Rejected' : 'Pending')
      });
    } else {
      // Missing ID with no clear suggestion
      matchReviews.push({
        id: `${tempId}_no_match`,
        fromId: tempId,
        fromName: tempEmp.name,
        fromDept: tempEmp.department,
        toId: '',
        toName: '',
        toDept: '',
        conflictType: 'Missing Employee ID (No suggested master found)',
        status: 'Pending'
      });
    }
  });

  // Check for duplicate master IDs with name or department conflicts
  masterIds.forEach(mId => {
    const list = rawEmployees.filter(e => e.id === mId);
    if (list.length > 1) {
      const uniqueNames = Array.from(new Set(list.map(e => e.name)));
      const uniqueDepts = Array.from(new Set(list.map(e => e.department)));

      if (uniqueNames.length > 1) {
        matchReviews.push({
          id: `${mId}_name_conflict`,
          fromId: mId,
          fromName: uniqueNames[0],
          fromDept: uniqueDepts[0],
          toId: mId,
          toName: uniqueNames[1],
          toDept: uniqueDepts[0],
          conflictType: 'Conflicting Name variations for identical Employee ID',
          status: 'Pending'
        });
      } else if (uniqueDepts.length > 1) {
        matchReviews.push({
          id: `${mId}_dept_conflict`,
          fromId: mId,
          fromName: uniqueNames[0],
          fromDept: uniqueDepts[0],
          toId: mId,
          toName: uniqueNames[0],
          toDept: uniqueDepts[1],
          conflictType: 'Conflicting Departments recorded for identical Employee ID',
          status: 'Pending'
        });
      }
    }
  });

  // Group employee records chronologically by their final merged Employee ID
  const empGroup = new Map<string, { id: string; name: string; department: string; dailyRecordsWithMonth: (DailyRecord & { monthName: string; isoDate: string })[] }>();

  filteredReports.forEach(report => {
    report.employees.forEach(emp => {
      // Find final ID (either itself or approved master ID)
      const targetId = config?.employeeMatches?.[emp.id] || emp.id;

      if (!empGroup.has(targetId)) {
        empGroup.set(targetId, {
          id: targetId,
          name: emp.name,
          department: emp.department || 'General',
          dailyRecordsWithMonth: []
        });
      }

      const grp = empGroup.get(targetId)!;
      
      // Fulfill rule: "Employee ID always wins". If the master ID is a real code, use master name & dept
      if (emp.id === targetId || !grp.name || (grp.id.startsWith('EMP_') && !emp.id.startsWith('EMP_'))) {
        grp.name = emp.name;
        grp.department = emp.department || 'General';
      }

      // Inject month & ISO date info to dailyRecords
      emp.dailyRecords.forEach(rec => {
        const isoDate = getISOStringFromMonthDay(report.monthName, rec.dayNum);
        
        grp.dailyRecordsWithMonth.push({
          ...rec,
          monthName: report.monthName,
          isoDate
        });
      });
    });
  });

  // Perform aggregate calculations for consolidated employees
  const consolidatedEmployees: EmployeeSummary[] = [];

  empGroup.forEach((val, empCode) => {
    let presentDays = 0;
    let absentDays = 0;
    let weeklyOffDays = 0;
    let leaveDays = 0;
    let holidayDays = 0;
    let totalLateDays = 0;
    let totalLateSlabs = 0;
    let totalActualHours = 0;
    let totalNetHours = 0;

    const sortedRecords = [...val.dailyRecordsWithMonth].sort((a, b) => a.isoDate.localeCompare(b.isoDate));

    sortedRecords.forEach(rec => {
      totalActualHours += rec.actualWorkHrs || 0;
      totalNetHours += rec.netWorkHrs || 0;
      
      if (rec.calculatedLateMins > 0) {
        totalLateDays++;
        totalLateSlabs += Math.ceil(rec.calculatedLateMins / 30);
      }

      if (rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') {
        presentDays++;
      } else if (rec.status === 'A') {
        absentDays++;
      } else if (rec.status === 'WO') {
        weeklyOffDays++;
      } else if (rec.status === 'LV') {
        leaveDays++;
      } else if (rec.status === 'HL') {
        holidayDays++;
      }
    });

    const workingDaysCount = presentDays + absentDays;
    const attendancePercentage = workingDaysCount > 0 
      ? parseFloat(((presentDays / workingDaysCount) * 100).toFixed(1))
      : 0;

    consolidatedEmployees.push({
      id: empCode,
      name: val.name,
      department: val.department,
      presentDays,
      absentDays,
      weeklyOffDays,
      leaveDays,
      holidayDays,
      totalRegularHours: parseFloat(totalNetHours.toFixed(1)),
      totalWorkHours: parseFloat(totalNetHours.toFixed(1)),
      totalActualHours: parseFloat(totalActualHours.toFixed(1)),
      totalNetHours: parseFloat(totalNetHours.toFixed(1)),
      totalLateDays,
      totalLateSlabs: parseFloat(totalLateSlabs.toFixed(1)),
      attendancePercentage,
      dailyRecords: sortedRecords,
      validationDiscrepancy: false,
      validationErrors: []
    });
  });

  // Calculate and filter Anomalies/Exceptions
  const consolidatedAnomalies: AttendanceAnomaly[] = [];

  filteredReports.forEach(report => {
    report.anomalies.forEach(anomaly => {
      // Track original/approved target ID if it has been matched
      const mappedAnomalyEmpCode = config?.employeeMatches?.[anomaly.empCode] || anomaly.empCode;
      
      consolidatedAnomalies.push({
        ...anomaly,
        empCode: mappedAnomalyEmpCode,
        dateStr: `${anomaly.dateStr} (${report.monthName})`
      });
    });
  });

  let totalPresentDays = 0;
  let totalAbsentDays = 0;
  let totalWeeklyOffDays = 0;
  let totalLateDays = 0;
  let totalLateSlabs = 0;
  let totalActualHours = 0;
  let totalNetHours = 0;
  
  consolidatedEmployees.forEach(emp => {
    totalPresentDays += emp.presentDays;
    totalAbsentDays += emp.absentDays;
    totalWeeklyOffDays += emp.weeklyOffDays;
    totalLateDays += emp.totalLateDays;
    totalLateSlabs += emp.totalLateSlabs;
    totalActualHours += emp.totalActualHours;
    totalNetHours += emp.totalNetHours;
  });

  const totalEmpCount = consolidatedEmployees.length;
  const averageNetHours = totalEmpCount > 0 ? parseFloat((totalNetHours / totalEmpCount).toFixed(1)) : 0;
  
  const allWorkingDays = totalPresentDays + totalAbsentDays;
  const attendancePercentage = allWorkingDays > 0
    ? parseFloat(((totalPresentDays / allWorkingDays) * 100).toFixed(1))
    : 0;

  const isPendingAnomaly = (a: AttendanceAnomaly) => {
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

  const isApprovedAnomaly = (a: AttendanceAnomaly) => {
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

  const totalExceptions = consolidatedAnomalies.length;
  const pendingExceptions = consolidatedAnomalies.filter(isPendingAnomaly).length;
  const approvedExceptions = consolidatedAnomalies.filter(isApprovedAnomaly).length;

  return {
    employees: consolidatedEmployees,
    anomalies: consolidatedAnomalies,
    matchReviews,
    totalPresentDays,
    totalAbsentDays,
    totalWeeklyOffDays,
    totalLateDays,
    totalLateSlabs: parseFloat(totalLateSlabs.toFixed(1)),
    totalActualHours: parseFloat(totalActualHours.toFixed(1)),
    totalNetHours: parseFloat(totalNetHours.toFixed(1)),
    attendancePercentage,
    averageNetHours,
    totalExceptions,
    approvedExceptions,
    pendingExceptions
  };
}

/**
 * Triggers download of the Combined Attendance Report in CSV format.
 */
export function exportCombinedAttendanceReport(reports: MonthlyReport[], filter: ConsolidationFilter) {
  const headers = 'Month,Employee ID,Employee Name,Present Days,Absent Days,Weekly Off,Leaves,Actual Work Hours,Net Work Hours,Late Days,Late Slabs,Exceptions\n';
  
  const filteredReports = reports.filter(r => filter.selectedMonths.includes(r.monthName));
  const lines: string[] = [];
  let mappingError = false;
  
  filteredReports.forEach(report => {
    report.employees.forEach(emp => {
      // Find matching exceptions for this employee in this report
      const empExceptions = report.anomalies.filter(a => a.empCode === emp.id).length;
      
      const lateDays = emp.totalLateDays;
      const lateSlabs = emp.totalLateSlabs;

      // Validate: Late Days column contains integer values only. Late Slabs column contains integer values only.
      if (typeof lateDays !== 'number' || isNaN(lateDays) || !Number.isFinite(lateDays) || !Number.isInteger(lateDays) ||
          typeof lateSlabs !== 'number' || isNaN(lateSlabs) || !Number.isFinite(lateSlabs) || !Number.isInteger(lateSlabs)) {
        mappingError = true;
      }
      
      lines.push(
        `"${report.monthName}","${emp.id}","${emp.name}",${emp.presentDays},${emp.absentDays},${emp.weeklyOffDays},${emp.leaveDays || 0},${(emp.totalActualHours ?? emp.totalWorkHours).toFixed(1)},${(emp.totalNetHours ?? emp.totalWorkHours).toFixed(1)},${lateDays},${lateSlabs},${empExceptions}`
      );
    });
  });
  
  if (mappingError) {
    alert("CSV EXPORT DATA MAPPING ERROR: Detected corrupt, non-numeric, or non-integer values inside Late Days or Late Slabs columns.");
    throw new Error("CSV EXPORT DATA MAPPING ERROR");
  }

  const blob = new Blob([headers + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Combined_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

