import * as XLSX from 'xlsx';
import { EmployeeSummary, DailyRecord, AttendanceAnomaly, MonthlyReport, Configuration } from '../types';

// Fast parser helper for "HH:MM"
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr === '--:--' || timeStr.trim() === '') return null;
  const trimmed = timeStr.trim();
  
  // If it's a decimal number of hours (e.g., "0.29" or "0.29hr" or "0.5")
  if (trimmed.includes('.') && !trimmed.includes(':')) {
    const numericPart = trimmed.replace(/[^\d.]/g, '');
    const hrs = parseFloat(numericPart);
    if (!isNaN(hrs)) {
      return Math.round(hrs * 60);
    }
  }

  // Standard "HH:MM" format
  const cleanStr = trimmed.replace(/[^\d:]/g, '');
  const parts = cleanStr.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
  }

  // Fallback if it's a simple number of minutes/hours without colons, e.g. "45" or "45m"
  if (/^\d+$/.test(cleanStr)) {
    const val = parseInt(cleanStr, 10);
    return val;
  }

  return null;
}

// Convert minutes past midnight back to "HH:MM"
export function minutesToTimeStr(mins: number | null): string {
  if (mins === null) return '--:--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Format fractional hours to "Hh Mm" or similar readable format
export function formatHoursReadable(hrs: number): string {
  const totMins = Math.round(hrs * 60);
  const h = Math.floor(totMins / 60);
  const m = totMins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Late coming dynamic slabs
export function calculateLateMinutes(inTimeStr: string, shiftStartStr: string = "09:00", graceMin: number = 11): number {
  const inMin = parseTimeToMinutes(inTimeStr);
  if (inMin === null) return 0;
  
  const startMin = parseTimeToMinutes(shiftStartStr) || ClassConstants.SHIFT_START_MIN;
  const cutoffMin = startMin + graceMin; // 9:11
  
  if (inMin <= cutoffMin) {
    return 0; // within grace time
  }
  
  // Every additional 30-minute late slab increases late time by 30 minutes
  const diff = inMin - startMin; // minutes late from official start
  const slabs = Math.ceil((diff - graceMin) / 30);
  return slabs * 30;
}

const ClassConstants = {
  SHIFT_START_MIN: 9 * 60, // 540
  SHIFT_END_MIN: 17 * 60 + 30, // 1050
};

export function roundInTimeMin(inMin: number, startMin: number = 9 * 60, inBuffer: number = 11): number {
  if (inMin <= startMin) {
    return startMin;
  }
  const diff = inMin - startMin;
  if (diff <= inBuffer) {
    return startMin;
  }
  const slabs = Math.floor((diff - inBuffer - 1) / 30) + 1;
  return startMin + slabs * 30;
}

export function roundOutTimeMin(outMin: number, outBuffer: number = 15): number {
  if (outBuffer <= 0) {
    return Math.floor(outMin / 30) * 30;
  }
  return Math.floor((outMin + (outBuffer - 1)) / 30) * 30;
}

export interface ComputedDay {
  inTime: string;
  outTime: string;
  status: string;
  inMin: number | null;
  outMin: number | null;
  roundedInMin: number | null;
  roundedOutMin: number | null;
  dailyWorkMins: number;
  actualWorkHrs: number;
  netWorkHrs: number;
  calculatedLateMins: number;
  wouldBeInvalid: boolean;
  isAfterHours: boolean;
  originalError: string;
}

export function isSameDayOfWeek(dayName: string, configDay: string): boolean {
  if (!dayName || !configDay) return false;
  const d = dayName.toLowerCase().trim();
  const c = configDay.toLowerCase().trim();
  
  if (d === c) return true;
  if (c.startsWith(d) && d.length >= 2) return true;
  if (d.startsWith(c) && c.length >= 2) return true;
  
  const abs = d.substring(0, 3);
  const cAbs = c.substring(0, 3);
  return abs === cAbs;
}

export function computeDayAttendance(
  rawInValStr: string,
  rawOutValStr: string,
  rawStatus: string,
  dayName: string,
  override: any,
  startMin: number = 9 * 60,
  endMin: number = 17 * 60 + 30,
  shiftStartStr: string = "09:00",
  shiftEndStr: string = "17:30",
  excludeWO: boolean = true,
  inBuffer: number = 11,
  outBuffer: number = 15,
  minWorkHoursStr: string = "08:30",
  penaltyTimeStr: string = "00:30",
  weeklyOffDay: string = "Monday",
  numWeeklyOffDays: number = 1,
  weeklyOffDay2: string = "Sunday"
): ComputedDay {
  let inTime = override?.inTime !== undefined ? override.inTime : rawInValStr;
  let outTime = override?.outTime !== undefined ? override.outTime : rawOutValStr;
  let status = override?.status !== undefined ? override.status : rawStatus;

  if (status) {
    status = status.toUpperCase().trim();
    if (status === 'P' || status.startsWith('P')) {
      status = 'P';
    } else if (status === 'A' || status.startsWith('A')) {
      status = 'A';
    } else if (status === 'WO' || status === 'W.O' || status === 'W/O' || status === 'OFF') {
      status = 'WO';
    } else if (status === 'HL' || status === 'H' || status.startsWith('HOL')) {
      status = 'HL';
    } else if (status === 'LV' || status === 'L' || status.startsWith('LV') || ['CL', 'EL', 'SL', 'PL'].includes(status)) {
      status = 'LV';
    }
  }

  let inMin = parseTimeToMinutes(inTime);
  let outMin = parseTimeToMinutes(outTime);

  const hasArrival = inMin !== null && inTime !== '--:--' && inTime !== '00:00' && inTime !== '';
  let hasDeparture = outMin !== null && outTime !== '--:--' && outTime !== '00:00' && outTime !== '';

  const roundedInMin = (hasArrival && inMin !== null) ? roundInTimeMin(inMin, startMin, inBuffer) : null;
  const roundedOutMin = (hasDeparture && outMin !== null) ? roundOutTimeMin(outMin, outBuffer) : null;

  let wouldBeInvalid = false;
  let originalError = '';
  let isAfterHours = false;

  if (inMin !== null && inMin > endMin) {
    isAfterHours = true;
  }

  let isOvernightShift = false;

  if (hasArrival && !hasDeparture) {
    wouldBeInvalid = true;
    isAfterHours = false;
    originalError = `Missing OUT Time`;
  } else if (!hasArrival && hasDeparture) {
    wouldBeInvalid = true;
    originalError = `Missing IN punch with OUT punch (${outTime}).`;
  } else if (hasArrival && hasDeparture && outMin !== null && inMin !== null && outMin < inMin) {
    isOvernightShift = true;
  }

  const isWO1 = isSameDayOfWeek(dayName, weeklyOffDay);
  const isWO2 = numWeeklyOffDays === 2 && isSameDayOfWeek(dayName, weeklyOffDay2);
  const isWeeklyOffDay = isWO1 || isWO2;

  if (wouldBeInvalid) {
    status = 'INVALID_PUNCH';
  } else {
    if (hasArrival && hasDeparture) {
      status = 'P';
    } else if (!hasArrival && !hasDeparture) {
      let cleanStatus = '';
      if (rawStatus) {
        const u = rawStatus.toUpperCase().trim();
        if (u === 'HL' || u === 'H' || u.startsWith('HOL')) {
          cleanStatus = 'HL';
        } else if (u === 'LV' || u === 'L' || u.startsWith('LV') || ['CL', 'EL', 'SL', 'PL'].includes(u)) {
          cleanStatus = 'LV';
        }
      }
      
      if (override?.status) {
        status = override.status;
      } else if (cleanStatus === 'HL' || cleanStatus === 'LV') {
        status = cleanStatus;
      } else if (isWeeklyOffDay) {
        status = 'WO';
      } else {
        status = 'A';
      }
    } else {
      status = 'INVALID_PUNCH';
    }
  }

  let actualWorkHrs = 0;
  let netWorkHrs = 0;

  if (hasArrival && hasDeparture && !wouldBeInvalid && roundedInMin !== null && roundedOutMin !== null) {
    let elapsed = 0;
    if (isOvernightShift) {
      elapsed = (1440 - roundedInMin) + roundedOutMin;
    } else {
      elapsed = roundedOutMin - roundedInMin;
    }
    if (elapsed < 0) {
      elapsed = 0;
      wouldBeInvalid = true;
      originalError = `Negative work duration or invalid overnight crossing.`;
    }
    actualWorkHrs = Math.max(0, elapsed / 60);
    
    let minWorkHrsVal = 8.5; // default 08:30
    if (minWorkHoursStr && minWorkHoursStr.includes(':')) {
      const parts = minWorkHoursStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      minWorkHrsVal = h + (m / 60);
    }
    
    let penaltyTimeVal = 0.5; // default 00:30
    if (penaltyTimeStr && penaltyTimeStr.includes(':')) {
      const parts = penaltyTimeStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      penaltyTimeVal = h + (m / 60);
    }

    if (actualWorkHrs > 0) {
      if (actualWorkHrs >= minWorkHrsVal) {
        netWorkHrs = actualWorkHrs;
      } else {
        netWorkHrs = Math.max(0, actualWorkHrs - penaltyTimeVal);
      }
    }
  }

  const dailyWorkMins = netWorkHrs * 60;

  if (dailyWorkMins > 0 && status !== 'P' && status !== 'INVALID_PUNCH') {
    status = 'P';
  }

  if (override && !override.ignore && status === 'P') {
    if (wouldBeInvalid || rawStatus === 'INVALID_PUNCH' || rawStatus === 'INVALID') {
      status = 'APPROVED_EXCEPTION';
    } else {
      status = 'MANUAL_ENTRY';
    }
  }

  let calculatedLateMins = 0;
  if (hasArrival && roundedInMin !== null && !isAfterHours && hasDeparture) {
    calculatedLateMins = Math.max(0, roundedInMin - startMin);
  }

  return {
    inTime,
    outTime,
    status,
    inMin,
    outMin,
    roundedInMin,
    roundedOutMin,
    dailyWorkMins,
    actualWorkHrs,
    netWorkHrs,
    calculatedLateMins,
    wouldBeInvalid,
    isAfterHours,
    originalError
  };
}

export function parseCumulativeTimeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr.trim() === '' || timeStr === '--:--' || timeStr === '00:00' || timeStr === '—') return 0;
  const trimmed = timeStr.trim();
  
  // If it's a decimal number of hours (e.g. "12.5" or "12.5h")
  if (trimmed.includes('.') && !trimmed.includes(':')) {
    const numericPart = trimmed.replace(/[^\d.]/g, '');
    const hrs = parseFloat(numericPart);
    if (!isNaN(hrs)) {
      return Math.round(hrs * 60);
    }
  }

  const cleanStr = trimmed.replace(/[^\d:]/g, '');
  const parts = cleanStr.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
  }

  // Fallback: raw minutes format or direct number
  if (/^\d+$/.test(cleanStr)) {
    const val = parseInt(cleanStr, 10);
    return val;
  }

  return 0;
}

export function isInvalidEmployeeName(name: string): boolean {
  if (!name) return true;
  const t = name.trim();
  if (t === "") return true;

  // 1. If it parses directly to a number (integer/decimal)
  if (!isNaN(Number(t))) return true;

  // 2. If it contains a percentage indicator (e.g. "95%", "95.5%")
  if (t.includes('%')) return true;

  // 3. If it contains work hour pattern words or days (e.g. "17.25 hrs", "15 hours", "12 days")
  if (/\b(hrs|hours|mins|minutes|days)\b/i.test(t)) return true;

  // 4. If it is purely numbers with some characters/symbols e.g. "17.00", "+12.5"
  if (/^[\d\s.,\-+/]+$/.test(t)) return true;

  // 5. Case-insensitive checks for other typical metric words or table cells that might be read
  const lower = t.toLowerCase();
  if (
    lower === 'attendance' ||
    lower === 'present' ||
    lower === 'absent' ||
    lower === 'leave' ||
    lower === 'l' ||
    lower === 'p' ||
    lower === 'a' ||
    lower === 'wo' ||
    lower === 'holiday' ||
    lower === 'hl' ||
    lower === 'work hours' ||
    lower === 'total hours' ||
    lower === 'overtime' ||
    lower === 'ot'
  ) {
    return true;
  }

  return false;
}

export function minutesToCumulativeTimeStr(mins: number | null): string {
  if (mins === null || isNaN(mins) || mins < 0) return '00:00';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseAttendanceSheet(sheet: XLSX.WorkSheet, fileName: string, config?: Configuration): MonthlyReport {
  // Convert sheet to 2D cell array. Use raw: false to ensure all cell values are formatted as strings where available.
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
  
  const employees: EmployeeSummary[] = [];
  const anomalies: AttendanceAnomaly[] = [];
  
  let currentMonthName = "Unknown Month";
  
  // Let's first search if there is a report month identifier listed
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c]).trim();
      // Try to find "April-2026" or similar month text
      if (val.includes("Month") || val.includes("Report Month")) {
        // Look in surrounding columns
        for (let searchC = c + 1; searchC < Math.min(c + 5, row.length); searchC++) {
          if (row[searchC]) {
            currentMonthName = String(row[searchC]).trim();
            break;
          }
        }
      }
    }
  }
  
  // Scans row-by-row
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    
    // Find "Empcode" label cell
    let empCodeColIdx = -1;
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').toLowerCase().trim();
      if (cellVal.includes('empcode') || cellVal.includes('emp code') || cellVal.startsWith('empcode') || cellVal === 'emp_code') {
        empCodeColIdx = c;
        break;
      }
    }
    
    if (empCodeColIdx !== -1) {
      // Detected start of Employee row!
      const empRow = row;
      
      // Look downwards to locate the rest of the employee sub-rows dynamically
      let dayNumsRow: any[] | null = null;
      let dayNamesRow: any[] | null = null;
      let inRow: any[] | null = null;
      let outRow: any[] | null = null;
      let workRow: any[] | null = null;
      let otRow: any[] | null = null;
      let statusRow: any[] | null = null;
      
      let maxSearchRowIndex = r;
      
      for (let offset = 1; offset <= 15; offset++) {
        const nextIdx = r + offset;
        if (nextIdx >= rows.length) break;
        const nextRow = rows[nextIdx];
        if (!nextRow || nextRow.length === 0) continue;
        
        // Stop checking if we hit another "Empcode" row
        let hasEmpcode = false;
        for (let c = 0; c < Math.min(5, nextRow.length); c++) {
          const val = String(nextRow[c] || '').toLowerCase().trim();
          if (val === 'empcode' || val === 'emp code' || val.startsWith('empcode') || val === 'emp_code') {
            hasEmpcode = true;
            break;
          }
        }
        if (hasEmpcode) {
          break;
        }
        
        const label0 = String(nextRow[0] || '').trim().toUpperCase();
        const label1 = String(nextRow[1] || '').trim().toUpperCase();
        const label2 = String(nextRow[2] || '').trim().toUpperCase();
        
        if (label0 === 'IN' || label1 === 'IN' || label2 === 'IN') {
          inRow = nextRow;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'OUT' || label1 === 'OUT' || label2 === 'OUT') {
          outRow = nextRow;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'WORK' || label1 === 'WORK' || label2 === 'WORK') {
          workRow = nextRow;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'OT' || label1 === 'OT' || label2 === 'OT') {
          otRow = nextRow;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'STATUS' || label1 === 'STATUS' || label2 === 'STATUS') {
          statusRow = nextRow;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else {
          // If not one of those, check if it contains number 1
          let hasNumber1 = false;
          for (let c = 0; c < Math.min(10, nextRow.length); c++) {
            const val = String(nextRow[c] || '').trim();
            if (val === '1' || val === '01') {
              hasNumber1 = true;
              break;
            }
          }
          if (hasNumber1 && !dayNumsRow) {
            dayNumsRow = nextRow;
            maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
            
            // Check immediately following row for dayNamesRow
            const possibleDayNamesRow = rows[nextIdx + 1];
            if (possibleDayNamesRow && possibleDayNamesRow.length > 0) {
              const testLabel = String(possibleDayNamesRow[0] || possibleDayNamesRow[1] || '').trim().toUpperCase();
              if (testLabel !== 'IN' && testLabel !== 'OUT' && testLabel !== 'WORK' && testLabel !== 'OT' && testLabel !== 'STATUS') {
                dayNamesRow = possibleDayNamesRow;
                maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx + 1);
              }
            }
          }
        }
      }
      
      // Fallback to absolute positions if dynamic scanning fails for specific rows
      if (!dayNumsRow) dayNumsRow = rows[r + 1];
      if (!dayNamesRow) dayNamesRow = rows[r + 2];
      if (!inRow) inRow = rows[r + 3];
      if (!outRow) outRow = rows[r + 4];
      if (!workRow) workRow = rows[r + 5];
      if (!otRow) otRow = rows[r + 6];
      if (!statusRow) statusRow = rows[r + 7];
      
      maxSearchRowIndex = Math.max(maxSearchRowIndex, r + 7);
      
      if (!dayNumsRow || !inRow || !outRow) {
        continue;
      }
      
      // Parse Employee Code, Name and Department
      let empCode = '';
      let empName = '';
      let department = '';
      
      for (let c = 0; c < empRow.length; c++) {
        const rawVal = String(empRow[c] || '').trim();
        const valLower = rawVal.toLowerCase();
        
        if (valLower.includes('empcode') || valLower.includes('emp code') || valLower.includes('emp_code')) {
          if (rawVal.includes(':')) {
            empCode = rawVal.split(':')[1].trim();
          } else if (rawVal.includes('=')) {
            empCode = rawVal.split('=')[1].trim();
          } else {
            // Find next non-empty cell
            for (let k = c + 1; k < empRow.length; k++) {
              const nextVal = String(empRow[k] || '').trim();
              if (nextVal !== '') {
                const nextValL = nextVal.toLowerCase();
                if (!nextValL.includes('name') && !nextValL.includes('present') && !nextValL.includes('empcode') && !nextValL.includes('emp code')) {
                  empCode = nextVal;
                  break;
                }
              }
            }
          }
        }
        
        if (valLower === 'name' || valLower === 'empname' || valLower === 'emp name' || valLower.startsWith('name:') || valLower.startsWith('name ') || valLower.includes('employee name')) {
          if (rawVal.includes(':')) {
            empName = rawVal.split(':')[1].trim();
          } else if (rawVal.includes('=')) {
            empName = rawVal.split('=')[1].trim();
          } else {
            // Find next non-empty cell
            for (let k = c + 1; k < empRow.length; k++) {
              const nextVal = String(empRow[k] || '').trim();
              if (nextVal !== '') {
                const nextValL = nextVal.toLowerCase();
                if (!nextValL.includes('present') && !nextValL.includes('wo') && !nextValL.includes('hl') && !nextValL.includes('absent')) {
                  empName = nextVal;
                  break;
                }
              }
            }
          }
        }

        if (valLower.includes('dept') || valLower.includes('department') || valLower.includes('section') || valLower.includes('category') || valLower.startsWith('dept:') || valLower.startsWith('department:')) {
          if (rawVal.includes(':')) {
            department = rawVal.split(':')[1].trim();
          } else if (rawVal.includes('=')) {
            department = rawVal.split('=')[1].trim();
          } else {
            for (let k = c + 1; k < empRow.length; k++) {
              const nextVal = String(empRow[k] || '').trim();
              if (nextVal !== '') {
                const nextValL = nextVal.toLowerCase();
                if (!nextValL.includes('present') && !nextValL.includes('wo') && !nextValL.includes('hl') && !nextValL.includes('absent') && !nextValL.includes('name') && !nextValL.includes('empcode')) {
                  department = nextVal;
                  break;
                }
              }
            }
          }
        }
      }
      
      // Clean up empCode
      empCode = empCode.replace(/^['"#\s]+|['"#\s]+$/g, '');
      if (/^\d+$/.test(empCode)) {
        empCode = empCode.padStart(4, '0');
      }
      
      if (!empCode) {
        empCode = `EMP_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      }
      if (!empName) {
        empName = `Employee ${empCode}`;
      }

      const rawDetectedName = empName;
      let isNameInvalid = isInvalidEmployeeName(empName);

      if (config?.employeeNames && config.employeeNames[empCode]) {
        empName = config.employeeNames[empCode];
        isNameInvalid = false;
      } else if (isNameInvalid) {
        empName = "UNKNOWN EMPLOYEE";
      }

      // Parse Original Totals from Row 1
      let originalPresent: number | undefined = undefined;
      let originalWO: number | undefined = undefined;
      let originalHL: number | undefined = undefined;
      let originalLV: number | undefined = undefined;
      let originalAbsent: number | undefined = undefined;
      let originalTotWorkStr: string | undefined = undefined;
      let originalTotalOTStr: string | undefined = undefined;

      for (let c = 0; c < empRow.length; c++) {
        const valStr = String(empRow[c] || '').trim();
        const valLower = valStr.toLowerCase();
        
        if (valLower === 'present' && c + 1 < empRow.length) {
          originalPresent = parseFloat(String(empRow[c + 1] || '').trim()) || 0;
        } else if (valLower === 'wo' && c + 1 < empRow.length) {
          originalWO = parseFloat(String(empRow[c + 1] || '').trim()) || 0;
        } else if (valLower === 'hl' && c + 1 < empRow.length) {
          originalHL = parseFloat(String(empRow[c + 1] || '').trim()) || 0;
        } else if (valLower === 'lv' && c + 1 < empRow.length) {
          originalLV = parseFloat(String(empRow[c + 1] || '').trim()) || 0;
        } else if (valLower === 'absent' && c + 1 < empRow.length) {
          originalAbsent = parseFloat(String(empRow[c + 1] || '').trim()) || 0;
        } else if ((valLower === 'tot. work+ot' || valLower.includes('work+ot') || valLower.includes('work + ot')) && c + 1 < empRow.length) {
          originalTotWorkStr = String(empRow[c + 1] || '').trim();
        }
      }
      
      // Find the starting column for actual dates (Days 1 to 31)
      let dateStartColIdx = -1;
      const dayColMap: { [day: number]: number } = {}; // day number -> col index
      
      for (let c = 0; c < dayNumsRow.length; c++) {
        const valStr = String(dayNumsRow[c] || '').trim();
        const cellVal = parseInt(valStr, 10);
        if (cellVal === 1) {
          dateStartColIdx = c;
          dayColMap[1] = c;
          break;
        }
      }
      
      if (dateStartColIdx === -1) {
        for (let c = 0; c < dayNumsRow.length; c++) {
          const valStr = String(dayNumsRow[c] || '').trim();
          if (/^0*1$/.test(valStr)) {
            dateStartColIdx = c;
            dayColMap[1] = c;
            break;
          }
        }
      }
      
      if (dateStartColIdx === -1) {
        // Fallback to scanning day numbers sequentially after column 2
        dateStartColIdx = 2;
        dayColMap[1] = 2;
      }
      
      for (let day = 2; day <= 31; day++) {
        const expectedColIdx = dateStartColIdx + (day - 1);
        let foundColIdx = -1;
        
        if (expectedColIdx < dayNumsRow.length) {
          const cellValStr = String(dayNumsRow[expectedColIdx] || '').trim();
          const dVal = parseInt(cellValStr, 10);
          if (dVal === day) {
            foundColIdx = expectedColIdx;
          }
        }
        
        if (foundColIdx === -1) {
          for (let offset = -3; offset <= 3; offset++) {
            const testCol = expectedColIdx + offset;
            if (testCol >= 0 && testCol < dayNumsRow.length) {
              const cellValStr = String(dayNumsRow[testCol] || '').trim();
              const dVal = parseInt(cellValStr, 10);
              if (dVal === day) {
                foundColIdx = testCol;
                break;
              }
            }
          }
        }
        
        dayColMap[day] = foundColIdx !== -1 ? foundColIdx : expectedColIdx;
      }
      
      // Compute standard lunch shift constraints from active configuration
      const shiftStartStr = config?.shiftStart || "09:00";
      const shiftEndStr = config?.shiftEnd || "17:30";
      const graceLateMin = config?.graceLateMin !== undefined ? config.graceLateMin : 11;
      const excludeWO = config?.excludeWeeklyOffFromAbsent !== undefined ? config.excludeWeeklyOffFromAbsent : true;

      const startMin = parseTimeToMinutes(shiftStartStr) || (9 * 60);
      const endMin = parseTimeToMinutes(shiftEndStr) || (17 * 60 + 30);
      const stdWorkDayMins = Math.max(0, endMin - startMin); // Standard work minutes

      const minWorkHoursStr = config?.minWorkHoursStr || '08:30';
      const penaltyTimeStr = config?.penaltyTimeStr || '00:30';

      let minWorkHrsVal = 8.5; // default 08:30
      if (minWorkHoursStr && minWorkHoursStr.includes(':')) {
        const parts = minWorkHoursStr.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        minWorkHrsVal = h + (m / 60);
      }
      
      let penaltyTimeVal = 0.5; // default 00:30
      if (penaltyTimeStr && penaltyTimeStr.includes(':')) {
        const parts = penaltyTimeStr.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        penaltyTimeVal = h + (m / 60);
      }

      // Construct daily records
      const dailyRecords: DailyRecord[] = [];
      const daysList = Object.keys(dayColMap).map(Number).sort((a,b)=>a-b);
      
      daysList.forEach(day => {
        const colIdx = dayColMap[day];
        const dayName = dayNamesRow && dayNamesRow[colIdx] ? String(dayNamesRow[colIdx]).trim() : '';
        
        const uniqueId = `${empCode}_${day}`;
        const override = config?.overrides?.[uniqueId];
        
        const rawInValStr = inRow && inRow[colIdx] ? String(inRow[colIdx]).trim() : '--:--';
        const rawOutValStr = outRow && outRow[colIdx] ? String(outRow[colIdx]).trim() : '--:--';
        const rawStatus = statusRow && statusRow[colIdx] ? String(statusRow[colIdx]).trim() : '';
        
        const comp = computeDayAttendance(
          rawInValStr,
          rawOutValStr,
          rawStatus,
          dayName,
          override,
          startMin,
          endMin,
          shiftStartStr,
          shiftEndStr,
          excludeWO,
          config?.inTimeBuffer !== undefined ? config.inTimeBuffer : 11,
          config?.outTimeBuffer !== undefined ? config.outTimeBuffer : 15,
          minWorkHoursStr,
          penaltyTimeStr,
          config?.weeklyOffDay || 'Monday',
          config?.numWeeklyOffDays !== undefined ? config.numWeeklyOffDays : 1,
          config?.weeklyOffDay2 || 'Sunday'
        );

        const isMissingOut = (comp.inTime !== '--:--' && comp.inTime !== '00:00' && (comp.outTime === '--:--' || comp.outTime === '00:00'));

        const workTimeStr = workRow && workRow[colIdx] ? String(workRow[colIdx]).trim() : '00:00';
        const workMins = parseTimeToMinutes(workTimeStr) || 0;
        const uploadedWorkHrs = workMins / 60;

        const isWO1 = isSameDayOfWeek(dayName, config?.weeklyOffDay || 'Monday');
        const isWO2 = (config?.numWeeklyOffDays !== undefined ? config.numWeeklyOffDays : 1) === 2 && isSameDayOfWeek(dayName, config?.weeklyOffDay2 || 'Sunday');
        const isWeeklyOffDay = isWO1 || isWO2;

        const otTimeStr = otRow && otRow[colIdx] ? String(otRow[colIdx]).trim() : '00:00';
        const otMins = parseTimeToMinutes(otTimeStr) || 0;
        const uploadedOtHrs = otMins / 60;

        const reconciliationSource: 'WORK' | 'OT' = isWeeklyOffDay ? 'OT' : 'WORK';
        const targetUploadedHrs = isWeeklyOffDay ? uploadedOtHrs : uploadedWorkHrs;

        let rawActualWorkHrs = comp.actualWorkHrs;
        let difference = 0;
        if (!isMissingOut) {
          difference = rawActualWorkHrs - targetUploadedHrs;
        }

        let reconStatus: 'Pending Reconciliation' | 'Approved Reconciliation' | 'Rejected Reconciliation' | undefined = undefined;
        let reconReason: string | undefined = undefined;
        let reconReviewer: string | undefined = undefined;
        let reconTimestamp: string | undefined = undefined;
        let reconPenaltyApplied: number | undefined = undefined;
        let reconAdjustedHrs: number | undefined = undefined;

        let finalActual = comp.actualWorkHrs;
        let finalNet = comp.netWorkHrs;

        if (isMissingOut) {
          finalActual = 0;
          finalNet = 0;
        } else if (difference > 1.0) {
          const recon = config?.reconciliations?.[uniqueId];
          if (recon) {
            reconStatus = recon.status;
            reconReason = recon.reason;
            reconReviewer = recon.reviewer;
            reconTimestamp = recon.timestamp;
            reconPenaltyApplied = (recon.penaltyHours || 0) + (recon.penaltyMinutes || 0) / 60;
            reconAdjustedHrs = recon.adjustedHours;

            if (recon.status === 'Approved Reconciliation') {
              finalActual = recon.adjustedHours;
              if (finalActual > 0) {
                if (finalActual >= minWorkHrsVal) {
                  finalNet = finalActual;
                } else {
                  finalNet = Math.max(0, finalActual - penaltyTimeVal);
                }
              } else {
                finalNet = 0;
              }
            }
          } else {
            reconStatus = 'Pending Reconciliation';
          }
        }

        const calculatedRegularHrs = parseFloat(finalNet.toFixed(1));

        dailyRecords.push({
          dayNum: day,
          dayName,
          inTime: comp.inTime,
          outTime: comp.outTime,
          workTime: workTimeStr,
          status: comp.status,
          parsedInMin: comp.inMin,
          parsedOutMin: comp.outMin,
          calculatedLateMins: comp.calculatedLateMins,
          calculatedRegularHrs,
          calculatedTotalWorkHrs: calculatedRegularHrs,
          actualWorkHrs: finalActual,
          netWorkHrs: finalNet,
          uploadedWorkHrs,
          uploadedOtHrs,
          reconciliationSource,
          workHoursDifference: difference,
          reconciliationStatus: reconStatus,
          reconciliationReason: reconReason,
          reconciliationReviewer: reconReviewer,
          reconciliationTimestamp: reconTimestamp,
          reconciliationPenaltyApplied: reconPenaltyApplied,
          reconciliationAdjustedHrs: reconAdjustedHrs
        });
      });
      
      let presentDays = 0;
      let absentDays = 0;
      let weeklyOffDays = 0;
      let leaveDays = 0;
      let holidayDays = 0;
      
      let totWorkMinsFromPunches = 0;
      let totLateDays = 0;
      let totLateSlabs = 0;
      let totActualHrs = 0;
      let totNetHrs = 0;
      
      dailyRecords.forEach(rec => {
        if (rec.calculatedLateMins > 0) {
          totLateDays++;
          totLateSlabs += Math.ceil(rec.calculatedLateMins / 30);
        }
        
        totActualHrs += rec.actualWorkHrs;
        totNetHrs += rec.netWorkHrs;
        
        // Ensure that records with work time aggregate even if their status remained non-P internally
        let dailyW = rec.calculatedRegularHrs * 60; // We already computed it above!

        if (dailyW > 0) {
          totWorkMinsFromPunches += dailyW;
          
          if (rec.status !== 'P' && rec.status !== 'APPROVED_EXCEPTION' && rec.status !== 'MANUAL_ENTRY') {
            rec.status = 'P';
          }
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
      
      // Calculate decimal values
      const totRegHrs = totWorkMinsFromPunches / 60;
      const totWorkHrs = totWorkMinsFromPunches / 60;
      
      const finalPresent = presentDays;
      const finalAbsent = absentDays;
      const finalWO = weeklyOffDays;
      const finalHL = holidayDays;
      const finalLV = leaveDays;
      
      const workingDaysCount = presentDays + absentDays;
      const attendancePercentage = workingDaysCount > 0 
        ? parseFloat(((presentDays / workingDaysCount) * 100).toFixed(1))
        : 0;


      // Forensics & Mismatches validation checks with integer minutes
      const validationErrors: string[] = [];
      let validationDiscrepancy = false;

      if (originalPresent !== undefined && presentDays !== originalPresent) {
        validationErrors.push(`Present mismatch: Calculated ${presentDays}, Sheet has ${originalPresent}`);
        validationDiscrepancy = true;
      }
      if (originalWO !== undefined && weeklyOffDays !== originalWO) {
        validationErrors.push(`WO mismatch: Calculated ${weeklyOffDays}, Sheet has ${originalWO}`);
        validationDiscrepancy = true;
      }
      if (originalHL !== undefined && holidayDays !== originalHL) {
        validationErrors.push(`HL mismatch: Calculated ${holidayDays}, Sheet has ${originalHL}`);
        validationDiscrepancy = true;
      }
      if (originalLV !== undefined && leaveDays !== originalLV) {
        validationErrors.push(`LV mismatch: Calculated ${leaveDays}, Sheet has ${originalLV}`);
        validationDiscrepancy = true;
      }
      if (originalAbsent !== undefined && absentDays !== originalAbsent) {
        validationErrors.push(`Absent mismatch: Calculated ${absentDays}, Sheet has ${originalAbsent}`);
        validationDiscrepancy = true;
      }

      const calcCombinedMinSum = totWorkMinsFromPunches;
      const originalCombinedMinSum = originalTotWorkStr ? parseCumulativeTimeToMinutes(originalTotWorkStr) : 0;

      const calcCombinedStr = minutesToCumulativeTimeStr(calcCombinedMinSum);

      if (originalTotWorkStr !== undefined && Math.abs(calcCombinedMinSum - originalCombinedMinSum) > 5) {
        validationErrors.push(`Total Work hours mismatch: Calculated ${calcCombinedStr}, Sheet has ${originalTotWorkStr}`);
        validationDiscrepancy = true;
      }

      // Check daily row discrepancies for trace forensics
      dailyRecords.forEach(rec => {
        let dailyWMin = rec.calculatedRegularHrs * 60; // Use exactly what we calculated

        if (Math.abs(dailyWMin - (parseTimeToMinutes(rec.workTime) || 0)) > 5 && (parseTimeToMinutes(rec.workTime) || 0) > 0) {
          validationErrors.push(`Day ${rec.dayNum}: Punch discrepancy. Calc WORK ${minutesToCumulativeTimeStr(dailyWMin)}, but Sheet has WORK ${rec.workTime}`);
        }
      });

      const summary: EmployeeSummary = {
        id: empCode,
        name: empName,
        isNameInvalid,
        rawDetectedName,
        department: department || 'General',
        presentDays: finalPresent,
        absentDays: finalAbsent,
        weeklyOffDays: finalWO,
        leaveDays: finalLV,
        holidayDays: finalHL,
        totalRegularHours: parseFloat(totNetHrs.toFixed(1)),
        totalWorkHours: parseFloat(totNetHrs.toFixed(1)),
        totalActualHours: parseFloat(totActualHrs.toFixed(1)),
        totalNetHours: parseFloat(totNetHrs.toFixed(1)),
        totalLateDays: totLateDays,
        totalLateSlabs: totLateSlabs,
        attendancePercentage,
        dailyRecords,
        
        originalPresent,
        originalWO,
        originalHL,
        originalLV,
        originalAbsent,
        originalTotWorkStr,
        validationDiscrepancy,
        validationErrors
      };
      
      employees.push(summary);
      
      // Run ATTENDANCE EXCEPTION CHECK for anomalies
      dailyRecords.forEach(rec => {
        const dateStr = `${currentMonthName} Day ${rec.dayNum}`;
        const uniqueId = `${empCode}_${rec.dayNum}`;
        const override = config?.overrides?.[uniqueId];
        
        const colIdx = dayColMap[rec.dayNum];
        const rawInValStr = inRow && inRow[colIdx] ? String(inRow[colIdx]).trim() : '--:--';
        const rawOutValStr = outRow && outRow[colIdx] ? String(outRow[colIdx]).trim() : '--:--';
        const rawStatus = statusRow && statusRow[colIdx] ? String(statusRow[colIdx]).trim() : '';

        const comp = computeDayAttendance(
          rawInValStr,
          rawOutValStr,
          rawStatus,
          rec.dayName,
          override,
          startMin,
          endMin,
          shiftStartStr,
          shiftEndStr,
          excludeWO,
          config?.inTimeBuffer !== undefined ? config.inTimeBuffer : 11,
          config?.outTimeBuffer !== undefined ? config.outTimeBuffer : 15,
          config?.minWorkHoursStr || '08:30',
          config?.penaltyTimeStr || '00:30',
          config?.weeklyOffDay || 'Monday',
          config?.numWeeklyOffDays !== undefined ? config.numWeeklyOffDays : 1,
          config?.weeklyOffDay2 || 'Sunday'
        );

        const isMissingOut = (comp.inTime !== '--:--' && comp.inTime !== '00:00' && (comp.outTime === '--:--' || comp.outTime === '00:00'));

        if (isMissingOut) {
          if (override && !override.ignore && override.status === 'A') {
            anomalies.push({
              id: `${uniqueId}_inv`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Approved Exception',
              severity: 'low',
              description: `Corrected Missing OUT Time: Marked Absent`,
              value: `RAW IN: ${rawInValStr}, OUT: ${rawOutValStr}`
            });
          } else if (override && override.ignore) {
            anomalies.push({
              id: `${uniqueId}_inv`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Approved Exception',
              severity: 'low',
              description: `Corrected Missing OUT Time: Ignored`,
              value: `RAW IN: ${rawInValStr}, OUT: ${rawOutValStr}`
            });
          } else if (override && !override.ignore && override.inTime) {
            // Overridden but maybe only inTime overridden? If OUT remains missing, stay as missing outer.
            anomalies.push({
              id: `${uniqueId}_inc`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Incomplete Punch',
              severity: 'high',
              description: `Missing OUT Time`,
              value: `IN: ${comp.inTime}, OUT: ${comp.outTime}`
            });
          } else {
            anomalies.push({
              id: `${uniqueId}_inc`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Incomplete Punch',
              severity: 'high',
              description: `Missing OUT Time`,
              value: `IN: ${comp.inTime}, OUT: ${comp.outTime}`
            });
          }
          return; // STOP processing this day's forensics/anomalies!
        }

        if (comp.wouldBeInvalid || rec.status === 'INVALID_PUNCH') {
          if (override && !override.ignore) {
            anomalies.push({
              id: `${uniqueId}_inv`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Approved Exception',
              severity: 'low',
              description: `Corrected. Original Error: ${comp.originalError || 'Missing or Corrupt Data'}`,
              value: `RAW IN: ${rawInValStr}, OUT: ${rawOutValStr}`
            });
          } else if (override && override.ignore) {
            anomalies.push({
              id: `${uniqueId}_inv`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Approved Exception',
              severity: 'low',
              description: `Explicitly Ignored. Original Error: ${comp.originalError || 'Missing or Corrupt Data'}`,
              value: `RAW IN: ${rawInValStr}, OUT: ${rawOutValStr}`
            });
          } else {
             anomalies.push({
              id: `${uniqueId}_inv`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Invalid Punch',
              severity: 'high',
              description: comp.originalError || `Unrecognized invalid pattern. Requires manual review.`,
              value: `IN: ${rawInValStr}, OUT: ${rawOutValStr}`
            });
          }
        } else if (override && !comp.wouldBeInvalid) {
          anomalies.push({
             id: `${uniqueId}_man`,
             empCode,
             empName,
             dayNum: rec.dayNum,
             dateStr,
             type: 'Manual Entry',
             severity: 'low',
             description: `Manually corrected standard punch.`,
             value: `RAW IN: ${rawInValStr}, OUT: ${rawOutValStr}`
          });
        }
        
        if (comp.isAfterHours && !comp.wouldBeInvalid && rec.status !== 'INVALID_PUNCH') {
          if (override && !override.ignore) {
            anomalies.push({
              id: `${uniqueId}_aft`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Approved Exception',
              severity: 'low',
              description: `Approved After-Hours Work.`,
              value: `RAW IN: ${rawInValStr}, OUT: ${rawOutValStr}`
            });
          } else if (!override) {
            anomalies.push({
              id: `${uniqueId}_aft`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'After-Hours Attendance',
              severity: 'high',
              description: `Clock-in occurred after shift end. Needs approval.`,
              value: `IN: ${rec.inTime}, OUT: ${rec.outTime}`
            });
          }
        }

        const isIncomplete = (rec.inTime !== '--:--' && rec.inTime !== '00:00' && (rec.outTime === '--:--' || rec.outTime === '00:00') && rec.status !== 'INVALID_PUNCH') ||
          ((rec.inTime === '--:--' || rec.inTime === '00:00') && rec.outTime !== '--:--' && rec.outTime !== '00:00' && rec.status !== 'INVALID_PUNCH');

        if (isIncomplete && !comp.wouldBeInvalid && rec.status !== 'INVALID_PUNCH') {
          anomalies.push({
            id: `${uniqueId}_inc`,
            empCode,
            empName,
            dayNum: rec.dayNum,
            dateStr,
            type: 'Incomplete Punch',
            severity: 'high',
            description: `Only ${rec.inTime === '--:--' || rec.inTime === '00:00' ? 'OUT' : 'IN'} punch recorded on some shift punches.`,
            value: `IN: ${rec.inTime}, OUT: ${rec.outTime}`
          });
        }
        
        if (rec.calculatedLateMins >= 120) {
          anomalies.push({
            id: `${uniqueId}_exlt`,
            empCode,
            empName,
            dayNum: rec.dayNum,
            dateStr,
            type: 'Extreme Late Arrival',
            severity: 'medium',
            description: `Employee arrived late by ${Math.ceil(rec.calculatedLateMins / 30)} slabs past scheduled shift.`,
            value: `IN: ${rec.inTime}`
          });
        }
        
        if (rec.parsedInMin !== null && rec.parsedOutMin !== null) {
          let shiftLength = rec.parsedOutMin - rec.parsedInMin;
          if (shiftLength < 0) shiftLength += 1440;
          if (shiftLength > 0 && shiftLength < 120 && rec.status === 'P') {
            anomalies.push({
              id: `${uniqueId}_impt`,
              empCode,
              empName,
              dayNum: rec.dayNum,
              dateStr,
              type: 'Impossible Timings',
              severity: 'high',
              description: `Extremely short shift duration (${Math.round(shiftLength)} minutes) tagged as fully present.`,
              value: `Shift: ${Math.round(shiftLength)}m`
            });
          }
        }
        
        if ((rec.status === 'LV' || rec.status === 'WO' || rec.status === 'HL') && rec.parsedInMin !== null) {
          anomalies.push({
            id: `${uniqueId}_conf`,
            empCode,
            empName,
            dayNum: rec.dayNum,
            dateStr,
            type: 'Status Conflict',
            severity: 'low',
            description: `Punch records detected during designated leave, holiday, or scheduled weekly off day.`,
            value: `Status: ${rec.status} with punch`
          });
        }

        if (rec.workHoursDifference !== undefined && rec.workHoursDifference > 1.0) {
          const recon = config?.reconciliations?.[uniqueId];
          const status = recon?.status || 'Pending Reconciliation';
          const originalSystem = (recon && recon.status === 'Approved Reconciliation') ? rec.actualWorkHrs + recon.penaltyApplied : rec.actualWorkHrs;
          const sheetHoursVal = rec.reconciliationSource === 'OT' ? rec.uploadedOtHrs || 0 : rec.uploadedWorkHrs || 0;

          anomalies.push({
            id: `${uniqueId}_rec`,
            empCode,
            empName,
            dayNum: rec.dayNum,
            dateStr,
            type: 'Work Hours Reconciliation',
            severity: status === 'Pending Reconciliation' ? 'high' : 'low',
            description: `Work Hours discrepancy of ${rec.workHoursDifference.toFixed(1)} hours detected. System: ${originalSystem.toFixed(1)}h, Sheet (${rec.reconciliationSource || 'WORK'} column): ${sheetHoursVal.toFixed(1)}h.`,
            value: JSON.stringify({
              rawIn: rawInValStr,
              rawOut: rawOutValStr,
              roundedIn: minutesToTimeStr(comp.roundedInMin),
              roundedOut: minutesToTimeStr(comp.roundedOutMin),
              systemActual: originalSystem,
              uploadedHours: sheetHoursVal,
              reconciliationSource: rec.reconciliationSource || 'WORK',
              difference: rec.workHoursDifference,
              status: status,
              penaltyApplied: recon?.penaltyApplied || 0,
              adjustedHours: rec.actualWorkHrs,
              reason: recon?.reason || '',
              reviewer: recon?.reviewer || '',
              timestamp: recon?.timestamp || ''
            })
          });
        }
      });
      
      // Advance row index past parsed block elements
      r = maxSearchRowIndex;
    }
  }
  
  if (currentMonthName === "Unknown Month") {
    currentMonthName = fileName.replace(/\.[^/.]+$/, "").replace(/report|attendance/gi, "").trim() || "Month Profile";
  }
  
  let hasValidationDiscrepancies = false;
  let totalErrorsCount = 0;

  employees.forEach(emp => {
    if (emp.validationDiscrepancy) {
      hasValidationDiscrepancies = true;
      totalErrorsCount += emp.validationErrors.length;
    }
  });

  return {
    fileName,
    monthName: currentMonthName,
    employees,
    anomalies,
    hasValidationDiscrepancies,
    totalErrorsCount
  };
}

// Modifies the worksheet cell timings in-place according to configuration 
// while preserving all formatting, colors, merging, fonts, borders and layout.
export function modifyWorksheetTimings(worksheet: XLSX.WorkSheet, config: Configuration): void {
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '', raw: false });
  
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    
    let empCodeColIdx = -1;
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').toLowerCase().trim();
      if (cellVal.includes('empcode') || cellVal.includes('emp code') || cellVal.startsWith('empcode') || cellVal === 'emp_code') {
        empCodeColIdx = c;
        break;
      }
    }
    
    if (empCodeColIdx !== -1) {
      const empRowIdx = r;
      const empRow = row;
      let dayNumsRowIdx = -1;
      let dayNamesRowIdx = -1;
      let inRowIdx = -1;
      let outRowIdx = -1;
      let workRowIdx = -1;
      let otRowIdx = -1;
      let statusRowIdx = -1;
      
      let maxSearchRowIndex = r;
      
      let empCode = '';
      for (let c = 0; c < empRow.length; c++) {
        const rawVal = String(empRow[c] || '').trim();
        const valLower = rawVal.toLowerCase();
        
        if (valLower.includes('empcode') || valLower.includes('emp code') || valLower.includes('emp_code')) {
          if (rawVal.includes(':')) {
            empCode = rawVal.split(':')[1].trim();
          } else if (rawVal.includes('=')) {
            empCode = rawVal.split('=')[1].trim();
          } else {
            for (let k = c + 1; k < empRow.length; k++) {
              const nextVal = String(empRow[k] || '').trim();
              if (nextVal !== '') {
                const nextValL = nextVal.toLowerCase();
                if (!nextValL.includes('name') && !nextValL.includes('present') && !nextValL.includes('empcode') && !nextValL.includes('emp code')) {
                  empCode = nextVal;
                  break;
                }
              }
            }
          }
        }
      }
      empCode = empCode.replace(/^['"#\s]+|['"#\s]+$/g, '');
      if (/^\d+$/.test(empCode)) {
        empCode = parseInt(empCode, 10).toString();
      }
      
      for (let offset = 1; offset <= 15; offset++) {
        const nextIdx = r + offset;
        if (nextIdx >= rows.length) break;
        const nextRow = rows[nextIdx];
        if (!nextRow || nextRow.length === 0) continue;
        
        let hasEmpcode = false;
        for (let c = 0; c < Math.min(5, nextRow.length); c++) {
          const val = String(nextRow[c] || '').toLowerCase().trim();
          if (val === 'empcode' || val === 'emp code' || val.startsWith('empcode') || val === 'emp_code') {
            hasEmpcode = true;
            break;
          }
        }
        if (hasEmpcode) break;
        
        const label0 = String(nextRow[0] || '').trim().toUpperCase();
        const label1 = String(nextRow[1] || '').trim().toUpperCase();
        const label2 = String(nextRow[2] || '').trim().toUpperCase();
        
        if (label0 === 'IN' || label1 === 'IN' || label2 === 'IN') {
          inRowIdx = nextIdx;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'OUT' || label1 === 'OUT' || label2 === 'OUT') {
          outRowIdx = nextIdx;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'WORK' || label1 === 'WORK' || label2 === 'WORK') {
          workRowIdx = nextIdx;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'OT' || label1 === 'OT' || label2 === 'OT') {
          otRowIdx = nextIdx;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else if (label0 === 'STATUS' || label1 === 'STATUS' || label2 === 'STATUS') {
          statusRowIdx = nextIdx;
          maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
        } else {
          let hasNumber1 = false;
          for (let c = 0; c < Math.min(10, nextRow.length); c++) {
            const val = String(nextRow[c] || '').trim();
            if (val === '1' || val === '01') {
              hasNumber1 = true;
              break;
            }
          }
          if (hasNumber1 && dayNumsRowIdx === -1) {
            dayNumsRowIdx = nextIdx;
            maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx);
            
            const possibleDayNamesRow = rows[nextIdx + 1];
            if (possibleDayNamesRow && possibleDayNamesRow.length > 0) {
              const testLabel = String(possibleDayNamesRow[0] || possibleDayNamesRow[1] || '').trim().toUpperCase();
              if (testLabel !== 'IN' && testLabel !== 'OUT' && testLabel !== 'WORK' && testLabel !== 'OT' && testLabel !== 'STATUS') {
                dayNamesRowIdx = nextIdx + 1;
                maxSearchRowIndex = Math.max(maxSearchRowIndex, nextIdx + 1);
              }
            }
          }
        }
      }
      
      // Fallbacks
      if (dayNumsRowIdx === -1) dayNumsRowIdx = r + 1;
      if (dayNamesRowIdx === -1) dayNamesRowIdx = r + 2;
      if (inRowIdx === -1) inRowIdx = r + 3;
      if (outRowIdx === -1) outRowIdx = r + 4;
      if (workRowIdx === -1) workRowIdx = r + 5;
      if (otRowIdx === -1) otRowIdx = r + 6;
      if (statusRowIdx === -1) statusRowIdx = r + 7;
      
      maxSearchRowIndex = Math.max(maxSearchRowIndex, r + 7);
      
      const dayNumsRow = rows[dayNumsRowIdx];
      const dayNamesRow = rows[dayNamesRowIdx];
      const inRow = rows[inRowIdx];
      const outRow = rows[outRowIdx];
      const statusRow = rows[statusRowIdx];
      
      if (!dayNumsRow || !inRow || !outRow) {
        continue;
      }
      
      let dateStartColIdx = -1;
      const dayColMap: { [day: number]: number } = {};
      
      for (let c = 0; c < dayNumsRow.length; c++) {
        const valStr = String(dayNumsRow[c] || '').trim();
        const cellVal = parseInt(valStr, 10);
        if (cellVal === 1) {
          dateStartColIdx = c;
          dayColMap[1] = c;
          break;
        }
      }
      
      if (dateStartColIdx === -1) {
        for (let c = 0; c < dayNumsRow.length; c++) {
          const valStr = String(dayNumsRow[c] || '').trim();
          if (/^0*1$/.test(valStr)) {
            dateStartColIdx = c;
            dayColMap[1] = c;
            break;
          }
        }
      }
      
      if (dateStartColIdx === -1) {
        dateStartColIdx = 2;
        dayColMap[1] = 2;
      }
      
      for (let day = 2; day <= 31; day++) {
        const expectedColIdx = dateStartColIdx + (day - 1);
        let foundColIdx = -1;
        
        if (expectedColIdx < dayNumsRow.length) {
          const cellValStr = String(dayNumsRow[expectedColIdx] || '').trim();
          const dVal = parseInt(cellValStr, 10);
          if (dVal === day) {
            foundColIdx = expectedColIdx;
          }
        }
        
        if (foundColIdx === -1) {
          for (let offset = -3; offset <= 3; offset++) {
            const testCol = expectedColIdx + offset;
            if (testCol >= 0 && testCol < dayNumsRow.length) {
              const cellValStr = String(dayNumsRow[testCol] || '').trim();
              const dVal = parseInt(cellValStr, 10);
              if (dVal === day) {
                foundColIdx = testCol;
                break;
              }
            }
          }
        }
        
        dayColMap[day] = foundColIdx !== -1 ? foundColIdx : expectedColIdx;
      }
      
      // Identify label columns in Row 1 for updating totals
      let presentCol = -1;
      let woCol = -1;
      let hlCol = -1;
      let lvCol = -1;
      let absentCol = -1;
      let totWorkCol = -1;

      for (let c = 0; c < empRow.length; c++) {
        const valStr = String(empRow[c] || '').toLowerCase().trim();
        if (valStr === 'present') presentCol = c;
        else if (valStr === 'wo') woCol = c;
        else if (valStr === 'hl') hlCol = c;
        else if (valStr === 'lv') lvCol = c;
        else if (valStr === 'absent') absentCol = c;
        else if (valStr === 'tot. work+ot' || valStr.includes('work+ot') || valStr.includes('work + ot')) totWorkCol = c;
      }

      let newPresent = 0;
      let newWO = 0;
      let newHL = 0;
      let newLV = 0;
      let newAbsent = 0;
      let newTotWorkMins = 0;
      
      const startMin = parseTimeToMinutes(config?.shiftStart || "09:00") || (9 * 60);
      
      const writeCellLocal = (c: number, r: number, val: string) => {
        if (r !== -1 && c !== -1) {
          const ref = XLSX.utils.encode_cell({ r, c });
          const cell = worksheet[ref] || {};
          cell.v = val;
          cell.t = 's';
          if (cell.w) delete cell.w;
          worksheet[ref] = cell;
        }
      };

      const daysList = Object.keys(dayColMap).map(Number).sort((a,b)=>a-b);
      daysList.forEach(day => {
        const colIdx = dayColMap[day];
        const dayName = dayNamesRow && dayNamesRow[colIdx] ? String(dayNamesRow[colIdx]).trim() : '';
        
        const rawInValStr = inRow && inRow[colIdx] ? String(inRow[colIdx]).trim() : '--:--';
        const rawOutValStr = outRow && outRow[colIdx] ? String(outRow[colIdx]).trim() : '--:--';
        const rawStatus = statusRow && statusRow[colIdx] ? String(statusRow[colIdx]).trim() : '';
        
        const uniqueId = `${empCode}_${day}`;
        const override = config?.overrides?.[uniqueId];
        
        const comp = computeDayAttendance(
          rawInValStr,
          rawOutValStr,
          rawStatus,
          dayName,
          override,
          startMin,
          parseTimeToMinutes(config?.shiftEnd || "17:30") || (17 * 60 + 30),
          config?.shiftStart || "09:00",
          config?.shiftEnd || "17:30",
          config?.excludeWeeklyOffFromAbsent !== undefined ? config.excludeWeeklyOffFromAbsent : true,
          config?.inTimeBuffer !== undefined ? config.inTimeBuffer : 11,
          config?.outTimeBuffer !== undefined ? config.outTimeBuffer : 15,
          config?.minWorkHoursStr || '08:30',
          config?.penaltyTimeStr || '00:30',
          config?.weeklyOffDay || 'Monday',
          config?.numWeeklyOffDays !== undefined ? config.numWeeklyOffDays : 1,
          config?.weeklyOffDay2 || 'Sunday'
        );

        // Update the sheet values directly
        writeCellLocal(colIdx, inRowIdx, comp.inTime);
        writeCellLocal(colIdx, outRowIdx, comp.outTime);
        writeCellLocal(colIdx, statusRowIdx, comp.status);

        if (workRowIdx !== -1) {
          const workHrsStr = minutesToTimeStr(comp.dailyWorkMins);
          writeCellLocal(colIdx, workRowIdx, workHrsStr);
        }

        if (comp.status === 'P' || comp.status === 'APPROVED_EXCEPTION' || comp.status === 'MANUAL_ENTRY' || comp.dailyWorkMins > 0) {
          newPresent++;
          newTotWorkMins += comp.dailyWorkMins;
        } else {
          // Absent or scheduled off
          if (comp.status === 'WO') newWO++;
          else if (comp.status === 'HL') newHL++;
          else if (comp.status === 'LV') newLV++;
          else newAbsent++;
        }
      });
      
      // Write the recalculated counts back to Row 1 of the spreadsheet
      const fieldsConfig = [
        { col: presentCol, val: newPresent },
        { col: woCol, val: newWO },
        { col: hlCol, val: newHL },
        { col: lvCol, val: newLV },
        { col: absentCol, val: newAbsent },
        { col: totWorkCol, val: minutesToCumulativeTimeStr(newTotWorkMins) }
      ];

      fieldsConfig.forEach(f => {
        if (f.col !== -1 && f.col + 1 < empRow.length) {
          const cellRef = XLSX.utils.encode_cell({ r: empRowIdx, c: f.col + 1 });
          const cell = worksheet[cellRef] || {};
          cell.v = f.val;
          cell.t = typeof f.val === 'number' ? 'n' : 's';
          if (cell.w) delete cell.w;
          worksheet[cellRef] = cell;
        }
      });
      
      r = maxSearchRowIndex;
    }
  }
}
