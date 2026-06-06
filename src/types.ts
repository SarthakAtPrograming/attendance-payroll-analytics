export interface DailyRecord {
  dayNum: number;
  dayName: string;
  inTime: string; // "09:02" or "--:--"
  outTime: string; // "18:38" or "--:--"
  workTime: string; // Raw work hour string e.g. "09:43"
  status: string; // "P", "WO", "A", "HL", "LV"
  
  // Calculated values
  parsedInMin: number | null; // minutes since midnight
  parsedOutMin: number | null;
  calculatedLateMins: number; // slab-based
  calculatedRegularHrs: number; // net regular work hours
  calculatedTotalWorkHrs: number; // reg + ot

  actualWorkHrs: number;
  netWorkHrs: number;

  uploadedWorkHrs?: number;
  uploadedOtHrs?: number;
  reconciliationSource?: 'WORK' | 'OT';
  workHoursDifference?: number;
  reconciliationStatus?: 'Pending Reconciliation' | 'Approved Reconciliation' | 'Rejected Reconciliation';
  reconciliationPenaltyApplied?: number;
  reconciliationAdjustedHrs?: number;
  reconciliationReason?: string;
  reconciliationReviewer?: string;
  reconciliationTimestamp?: string;
}

export interface EmployeeSummary {
  id: string; // Empcode
  name: string;
  department?: string;
  presentDays: number;
  absentDays: number;
  weeklyOffDays: number;
  leaveDays: number;
  holidayDays: number;
  
  totalRegularHours: number;
  totalWorkHours: number;
  totalActualHours: number;
  totalNetHours: number;
  totalLateDays: number;
  totalLateSlabs: number;
  attendancePercentage: number;
  
  dailyRecords: DailyRecord[];

  // Original biometric values read directly from Row 1
  originalPresent?: number;
  originalWO?: number;
  originalHL?: number;
  originalLV?: number;
  originalAbsent?: number;
  originalTotWorkStr?: string; // e.g. "187:30"

  // Validation feedback
  validationDiscrepancy: boolean;
  validationErrors: string[];
  isNameInvalid?: boolean;
  rawDetectedName?: string;
}

export interface WorkHoursReconciliation {
  empCode: string;
  dayNum: number;
  penaltyHours: number;
  penaltyMinutes: number;
  reason: string;
  status: 'Pending Reconciliation' | 'Approved Reconciliation' | 'Rejected Reconciliation';
  originalSystemHours: number;
  uploadedSheetHours: number;
  difference: number;
  penaltyApplied: number;
  adjustedHours: number;
  reviewer: string;
  timestamp: string;
}

export interface AttendanceAnomaly {
  id: string;
  empCode: string;
  empName: string;
  dayNum: number;
  dateStr: string;
  type: 'Incomplete Punch' | 'Extreme Late Arrival' | 'Impossible Timings' | 'Status Conflict' | 'Invalid Punch' | 'Manual Entry' | 'Approved Exception' | 'After-Hours Attendance' | 'Work Hours Reconciliation';
  severity: 'high' | 'medium' | 'low';
  description: string;
  value: string;
}

export interface MonthlyReport {
  fileName: string;
  monthName: string; // e.g. "April-2026"
  employees: EmployeeSummary[];
  anomalies: AttendanceAnomaly[];
  rawWorkbook?: any;
  
  // High-level validation aggregates
  hasValidationDiscrepancies: boolean;
  totalErrorsCount: number;
}

export interface PunchOverride {
  inTime?: string;
  outTime?: string;
  status?: string;
  ignore?: boolean;
  reason?: string;
}

export type OverridesMap = Record<string, PunchOverride>; // key: `${empCode}_${dayNum}`

export interface PolicyAuditLogEntry {
  prevMinWorkHours: string;
  prevPenaltyTime: string;
  newMinWorkHours: string;
  newPenaltyTime: string;
  changedBy: string;
  timestamp: string;
}

export interface EmployeeMatchReview {
  id: string;
  fromId: string;
  fromName: string;
  fromDept?: string;
  toId: string;
  toName: string;
  toDept?: string;
  conflictType: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface Configuration {
  shiftStart: string; // "09:00"
  shiftEnd: string; // "17:30"
  graceLateMin: number; // 11
  excludeWeeklyOffFromAbsent: boolean;
  overrides?: OverridesMap;
  inTimeBuffer?: number;
  outTimeBuffer?: number;
  reconciliations?: Record<string, WorkHoursReconciliation>; // key: `${empCode}_${dayNum}`
  minWorkHoursStr?: string; // e.g. "08:30"
  penaltyTimeStr?: string; // e.g. "00:30"
  policyAuditLog?: PolicyAuditLogEntry[];
  weeklyOffDay?: string; // "Monday", "Tuesday", etc.
  numWeeklyOffDays?: number; // 1 or 2
  weeklyOffDay2?: string; // optional second day
  employeeMatches?: Record<string, string>; // key: source EMP_..., value: target real ID
  rejectedMatches?: string[]; // array of source EMP_... to remember rejected matches
  employeeNames?: Record<string, string>; // key: empCode, value: corrected real name
}
