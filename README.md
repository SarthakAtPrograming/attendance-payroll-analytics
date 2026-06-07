 Biometric Attendance & Payroll Analytics Platform

A workforce analytics and attendance intelligence platform designed to process biometric attendance exports, automate attendance calculations, manage exceptions, and generate management-ready workforce reports.

---

## Overview

This application transforms raw biometric attendance machine exports into structured workforce analytics, attendance summaries, compliance insights, and executive reports.

The system supports both monthly and consolidated multi-month analysis while maintaining configurable attendance policies and exception handling workflows.

---

## Key Features

### Attendance Processing Engine

- Excel attendance sheet ingestion
- Multi-sheet upload support
- Automatic employee detection
- Attendance normalization
- Cross-month employee matching
- Configurable attendance policies

### Attendance Calculation Engine

- Configurable IN-time buffer
- Configurable OUT-time buffer
- Automatic time rounding
- Actual Work Hour calculation
- Net Work Hour calculation
- Late arrival analysis
- Slab calculation engine

### Exception Management Engine

- Missing OUT punch detection
- Missing attendance record detection
- Work-hour mismatch detection
- Manual reconciliation workflow
- Attendance override controls
- Exception tracking dashboard

### Workforce Analytics

- Attendance rate analysis
- Present / Absent tracking
- Late arrival trends
- Work-hour analytics
- Compliance monitoring
- Employee-level performance insights

### Reporting Engine

- Monthly workforce reports
- Consolidated workforce reports
- Employee drill-down reports
- Executive summary generation
- PDF export
- Excel export
- CSV export

### Multi-Month Consolidation

- Multiple attendance sheet uploads
- Cross-sheet employee matching
- Consolidated workforce dashboard
- Consolidated exports
- Consolidated reporting

---

## Business Rules

### Time Rounding

#### IN Time

| Actual Time | Rounded Time |
|------------|-------------|
| Before 09:00 | 09:00 |
| 09:00 - 09:11 | 09:00 |
| 09:12 - 09:41 | 09:30 |
| 10:00 - 10:11 | 10:00 |
| 10:12 - 10:41 | 10:30 |

Configurable through Settings.

---

#### OUT Time

| Actual Time | Rounded Time |
|------------|-------------|
| 17:00 - 17:15 | 17:00 |
| 17:16 - 17:45 | 17:30 |
| 17:46 - 18:15 | 18:00 |
| 18:16 - 18:45 | 18:30 |

Configurable through Settings.

---

### Work Hour Logic

Actual Work Hours:

```text
Rounded OUT Time
-
Rounded IN Time
```

Net Work Hours:

```text
If Actual Work Hours >= Minimum Work Hours

Net Work Hours = Actual Work Hours

Else

Net Work Hours =
Actual Work Hours - Penalty Time
```

Default:

```text
Minimum Work Hours = 08:30

Penalty Time = 00:30
```

All dashboards, reports, exports, charts, and analytics use Net Work Hours as the single source of truth.

---

## Exception Detection

The platform automatically isolates attendance records requiring manual review.

### Supported Exception Types

- Missing OUT Time
- Missing IN Time
- Invalid Punch Sequences
- Work Hour Mismatch
- Attendance Extraction Failures
- Employee Matching Issues

### Manual Review Options

- Approve Attendance
- Override IN Time
- Override OUT Time
- Mark Absent
- Ignore Invalid Record
- Consider 05:30 PM as OUT Time

---

## Employee Matching Engine

Supports employee matching across:

- Monthly uploads
- Multi-month uploads
- Consolidated reporting

Matching uses:

- Employee ID
- Employee Name
- Attendance pattern validation

Employee status:

```text
✓ Auto Matched

⚠ Needs Review
```

---

## Weekly Off Logic

Weekly Off day is configurable.

Default:

```text
Monday
```

Rules:

- Absence on weekly off day is ignored.
- Presence on weekly off day is counted as a normal working day.
- Weekly off attendance can be validated using OT values when applicable.

---

## Analytics Modules

### Personnel Directory

- Employee attendance summary
- Present / Absent statistics
- Net work hours
- Attendance percentage
- Late slab tracking

### Employee Dashboard

- Daily attendance timeline
- Work hour trends
- Attendance calendar
- Compliance tracking
- Slab distribution

### Workforce Trends

- Attendance rate trends
- Productivity analysis
- Late-coming analysis
- Workforce compliance metrics

### Exception Dashboard

- Pending reviews
- Approved exceptions
- Attendance corrections
- Reconciliation tracking

---

## Export Formats

### CSV Export

- Monthly CSV
- Consolidated CSV

### Excel Export

- Monthly Excel
- Consolidated Excel

### PDF Export

- Executive Summary
- Workforce Insights
- Attendance Analytics
- Employee Summaries

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite

### Data Processing

- XLSX
- Custom Attendance Engine

### Reporting

- PDF Generation
- CSV Export
- Excel Export

### Visualization

- Recharts
- Interactive Dashboards

---

## Future Enhancements

- Client-specific configuration profiles
- Multi-tenant architecture
- Login & access control
- Advanced anomaly detection
- Workforce forecasting
- AI-assisted attendance review
- Audit trail engine
- Investigation analytics modules

---

## Author

**Sarthak Jain**

BBA-MBA (Forensic Accounting & Fraud Investigation)

Focused on analytics, automation, workforce intelligence, process controls, and investigation-oriented technology solutions.
