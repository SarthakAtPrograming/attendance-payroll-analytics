import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmployeeSummary, AttendanceAnomaly, MonthlyReport } from '../types';
import { LOGO_DATA_URI } from './logo';

export function generateExecutivePDF(report: MonthlyReport, customPeriod?: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297

  // Premium Corporate Color Board (Deloitte/EY Inspired Palette)
  const cPrimaryNavy: [number, number, number] = [24, 30, 48];     // Deep Corporate Navy
  const cSecondarySlate: [number, number, number] = [71, 85, 105]; // Slate Gray
  const cAccentBlue: [number, number, number] = [30, 64, 175];     // Subdued Indigo / Accent Blue
  const cLightBg: [number, number, number] = [248, 250, 252];       // Ice Slate (Cards Background)
  const cBorderGray: [number, number, number] = [226, 232, 240];   // Light Border Gray
  const cTextDark: [number, number, number] = [15, 23, 42];        // Near Black Headings
  const cTextMuted: [number, number, number] = [100, 116, 139];    // Lead Muted Text
  const cGoldAccent: [number, number, number] = [180, 130, 40];    // Executive Gold Line Accent

  // Gather dataset variables for automatic summaries
  const totalEmployees = report.employees.length;
  let totalRegularHrs = 0;
  let totalLateDays = 0;
  let totalLateSlabs = 0;
  let avgAttendanceAcc = 0;
  let totalWO = 0;
  let totalLeaveDays = 0;

  report.employees.forEach(emp => {
    avgAttendanceAcc += emp.attendancePercentage;
    totalRegularHrs += emp.totalRegularHours;
    totalLateDays += emp.totalLateDays;
    totalLateSlabs += emp.totalLateSlabs;
    totalWO += emp.weeklyOffDays;
    totalLeaveDays += emp.leaveDays;
  });

  const avgAttnPercent = totalEmployees > 0 ? Math.round(avgAttendanceAcc / totalEmployees) : 100;
  const totRegularHrs = totalRegularHrs;
  const avgLateTimePerEmp = totalEmployees > 0 ? Math.round(totalLateDays / totalEmployees) : 0;

  const monthLabel = customPeriod ? customPeriod : (report.monthName || "Roster Period");

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  
  // Left border accent strip (Deloitte Style)
  doc.setFillColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.rect(0, 0, 12, pageHeight, 'F');

  // Subtle separator line next to left accent strip
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(12, 0, 1.5, pageHeight, 'F');

  // Add Company Logo Icon (Handcrafted crisp vector)
  try {
    doc.addImage(LOGO_DATA_URI, 'SVG', 30, 20, 22, 22);
  } catch (error) {
    console.error("Error drawing logo on cover page:", error);
  }

  // Document Scope Identifier
  doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CORPORATE ADVISORY DIVISION', 30, 55);

  // Decorative Accent Block
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(30, 59, 20, 1.5, 'F');

  // Primary Document Title
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Attendance &', 30, 78);
  doc.text('Workforce Analytics', 30, 90);
  doc.text('Report', 30, 102);

  // Subtitle
  doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Monthly Attendance & Productivity Summary', 30, 114);

  // Report Month Banner
  doc.setFillColor(cLightBg[0], cLightBg[1], cLightBg[2]);
  doc.rect(30, 128, 95, 14, 'F');
  doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
  doc.setLineWidth(0.4);
  doc.rect(30, 128, 95, 14, 'D');

  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`REPORTING PERIOD: ${monthLabel.toUpperCase()}`, 36, 137);

  // Metadata Table Block
  const xMeta = 30;
  const yMetaStart = 175;

  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REPORT CONTEXT & SIGN-OFF METADATA', xMeta, yMetaStart - 8);
  doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
  doc.line(xMeta, yMetaStart - 5, pageWidth - 20, yMetaStart - 5);

  const metaFields = [
    { label: "Entity Profile", val: "Eco Safe Containers" },
    { label: "Registered Month", val: monthLabel },
    { label: "Prepared & Filed By", val: "A.O. Mittal & Associates, Chartered Accountants" },
    { label: "Auditor Signatory", val: "CA Akash Agarwal" },
    { label: "Development Lead", val: "Sarthak Jain" }
  ];

  metaFields.forEach((item, idx) => {
    const yRow = yMetaStart + idx * 10;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
    doc.text(item.label, xMeta, yRow);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
    doc.text(item.val, xMeta + 42, yRow);

    if (idx < metaFields.length - 1) {
      doc.setDrawColor(241, 245, 249);
      doc.line(xMeta, yRow + 4, pageWidth - 20, yRow + 4);
    }
  });

  // Cover Page Footer Statement
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
  doc.text("CONFIDENTIAL INTERNAL MANAGEMENT REPORT", (pageWidth + 12) / 2, pageHeight - 20, { align: 'center' });


  // ==========================================
  // PAGE 2: EXECUTIVE SUMMARY & COMMENTARY
  // ==========================================
  doc.addPage();
  let yPos = 30;

  // Header Title
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("I. EXECUTIVE SUMMARY", 15, yPos);
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(15, yPos + 2.5, 30, 1.2, 'F');

  doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  
  const introText = `This report provides a monthly overview of employee attendance, punctuality, and workforce trends based on attendance records.`;
  const introLines = doc.splitTextToSize(introText, pageWidth - 30);
  doc.text(introLines, 15, yPos + 10);

  yPos += 14 + introLines.length * 4.8;

  // KPI Subtitle
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("KEY WORKFORCE METRICS", 15, yPos);

  yPos += 6;

  // Draw 6 grid cells for KPI Metrics
  const cardWidth = (pageWidth - 36) / 2; // 87 each
  const cardHeight = 18;
  const kpiItems = [
    { label: "Active Employee Headcount", val: `${totalEmployees} Employees` },
    { label: "Average Attendance Rate", val: `${avgAttnPercent}%` },
    { label: "Total Regular Hours Worked", val: `${totRegularHrs.toFixed(1)} Hours` },
    { label: "Average Daily Attendance", val: `${Math.round(totalEmployees * (avgAttnPercent / 100))} Staff / Day` },
    { label: "Total Late Days / Slabs", val: `${totalLateDays} / ${totalLateSlabs} Slabs` }
  ];

  kpiItems.forEach((kpi, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const xCard = 15 + col * (cardWidth + 6);
    const yCard = yPos + row * (cardHeight + 4);

    // Render Box Container
    doc.setFillColor(cLightBg[0], cLightBg[1], cLightBg[2]);
    doc.rect(xCard, yCard, cardWidth, cardHeight, 'F');
    doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
    doc.rect(xCard, yCard, cardWidth, cardHeight, 'D');

    // Accent line on cards
    doc.setFillColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
    doc.rect(xCard, yCard, 1.5, cardHeight, 'F');

    // Inside Box Details
    doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(kpi.label, xCard + 5, yCard + 5.5);

    doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text(kpi.val, xCard + 5, yCard + 13.5);
  });

  yPos += 3 * (cardHeight + 4) + 12;

  // Management Commentary & CA Advice Section
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("MANAGEMENT OBSERVATIONS & RECOMMENDATIONS", 15, yPos);
  doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
  doc.line(15, yPos + 2.5, pageWidth - 15, yPos + 2.5);

  yPos += 8;

  // Top contributors calculation for automated analytical feedback
  const comments = [
    `1.  Workforce attendance average reached ${avgAttnPercent}%. Overall attendance is consistent, showing regular schedule compliance with standard shift expectations across the team.`,
    `2.  Late arrivals totaled ${totalLateSlabs} slabs across all registered profiles, averaging about ${avgLateTimePerEmp} late days per employee. Punctuality aligns closely with general promptness, with minor delays occurring during peak operational days.`
  ];

  comments.forEach((comment) => {
    doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    
    const lines = doc.splitTextToSize(comment, pageWidth - 30);
    doc.text(lines, 15, yPos);
    yPos += lines.length * 4.4 + 4;
  });


  // ==========================================
  // PAGE 3: WORKFORCE ANALYTICS & TRENDS
  // ==========================================
  doc.addPage();
  yPos = 30;

  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("II. WORKFORCE INSIGHTS & INTUITIVE TRENDS", 15, yPos);
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(15, yPos + 2.5, 30, 1.2, 'F');

  yPos += 10;

  // Vector Chart 1: Daily Operational Presence (Wide Line Plot)
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text("1. DAILY WORKFORCE ATTENDANCE LEVEL TREND (%)", 15, yPos);

  const plotX = 15;
  const plotY = yPos + 4;
  const plotW = 180;
  const plotH = 40;

  // Background box
  doc.setFillColor(cLightBg[0], cLightBg[1], cLightBg[2]);
  doc.rect(plotX, plotY, plotW, plotH, 'F');
  doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
  doc.rect(plotX, plotY, plotW, plotH, 'D');

  // Compute Daily Attendance Presence Rates
  const maxDays = Math.max(...report.employees.flatMap(e => e.dailyRecords.map(r => r.dayNum)), 28);
  const presenceRates: number[] = [];
  for (let d = 1; d <= maxDays; d++) {
    let presentCount = 0;
    let activeCount = 0;
    report.employees.forEach(emp => {
      const rec = emp.dailyRecords.find(r => r.dayNum === d);
      if (rec) {
        if (rec.status === 'P' || rec.status === 'APPROVED_EXCEPTION' || rec.status === 'MANUAL_ENTRY') {
          presentCount++;
          activeCount++;
        } else if (rec.status === 'A') {
          activeCount++;
        }
      }
    });
    const rBase = activeCount > 0 ? (presentCount / activeCount) * 100 : 0;
    presenceRates.push(rBase > 0 ? rBase : 0);
  }

  // Draw Grid Lines inside Line Chart
  doc.setDrawColor(241, 150, 150); // Muted red reference line (e.g. 80% mark)
  doc.setLineWidth(0.3);
  doc.line(plotX, plotY + plotH * 0.2, plotX + plotW, plotY + plotH * 0.2); // 80% line
  
  doc.setTextColor(185, 28, 28);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text("80% Baseline Compliance Limit", plotX + 2, plotY + plotH * 0.2 - 1.5);

  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.2);
  const yGrids = [0.25, 0.5, 0.75, 1.0];
  yGrids.forEach(g => {
    const gy = plotY + plotH - g * plotH;
    doc.line(plotX, gy, plotX + plotW, gy);
  });

  // Plot Data Trend Sparkline
  doc.setDrawColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setLineWidth(0.8);
  
  const innerMarginX = 8;
  const innerMarginY = 4;
  const drawW = plotW - innerMarginX * 2;
  const drawH = plotH - innerMarginY * 2;

  let prevCoords: { x: number, y: number } | null = null;

  presenceRates.forEach((rate, idx) => {
    const xCoord = plotX + innerMarginX + (idx / Math.max(1, maxDays - 1)) * drawW;
    // Scale rate (typically ranges 60% to 100% in operational datasets)
    // We bind 0% presence to bottom, 100% presence to top
    const scaledRate = Math.max(0, Math.min(100, rate));
    const yCoord = plotY + plotH - innerMarginY - (scaledRate / 100) * drawH;

    // Draw little connector line
    if (prevCoords) {
      doc.setDrawColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
      doc.setLineWidth(0.8);
      doc.line(prevCoords.x, prevCoords.y, xCoord, yCoord);
    }

    // Paint data circles
    doc.setFillColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
    doc.circle(xCoord, yCoord, 0.75, 'F');

    prevCoords = { x: xCoord, y: yCoord };
  });

  // X Axis Indices
  doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  const keyDays = [1, Math.round(maxDays / 3), Math.round(maxDays * 2 / 3), maxDays];
  keyDays.forEach(day => {
    const kx = plotX + innerMarginX + ((day - 1) / Math.max(1, maxDays - 1)) * drawW;
    doc.text(`Day ${day}`, kx, plotY + plotH + 4, { align: 'center' });
  });

  yPos += plotH + 18;

  // Split Column Layout: Heatmap (Left) and Tardiness Gauge (Right)
  const leftX = 15;
  const rightX = 110;
  const halfW = 85;
  const spH = 46;

  // Title for columns
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text("2. WEEKLY ROSTER DENSITY GRID", leftX, yPos);
  doc.text("3. TIMELINESS & Tardiness RANGE ANALYSIS", rightX, yPos);

  // Left side: Attendance Heatmap Grid
  const gridY = yPos + 4;
  const boxW = 10;
  const boxH = 5.5;
  const gapCell = 1.2;

  // Grid start point
  const firstDayNameLower = report.employees[0]?.dailyRecords[0]?.dayName?.toLowerCase() || 'monday';
  const dayOfWeekMap: { [key: string]: number } = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  let startColIdx = 0;
  Object.keys(dayOfWeekMap).forEach((key) => {
    if (firstDayNameLower.startsWith(key)) {
      startColIdx = dayOfWeekMap[key];
    }
  });

  // Labels for days of week
  const dowLabels = ["M", "T", "W", "T", "F", "S", "S"];
  dowLabels.forEach((lbl, colIdx) => {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
    doc.text(lbl, leftX + colIdx * (boxW + gapCell) + boxW / 2, gridY + 3.5, { align: 'center' });
  });

  // Paint Days heat highlights
  const maxWeeks = 5;
  for (let w = 0; w < maxWeeks; w++) {
    const yRow = gridY + 6 + w * (boxH + gapCell);
    for (let d = 0; d < 7; d++) {
      const dayNum = w * 7 + d - startColIdx + 1;
      const xCol = leftX + d * (boxW + gapCell);

      if (dayNum > 0 && dayNum <= maxDays) {
        // Collect workforce presence
        const rate = presenceRates[dayNum - 1] || 0;
        let cCell = [241, 245, 249]; // Gray empty/rest
        let isDark = false;

        if (rate >= 88) {
          cCell = cPrimaryNavy;
          isDark = true;
        } else if (rate >= 68) {
          cCell = cSecondarySlate;
          isDark = true;
        } else if (rate > 0) {
          cCell = [186, 230, 253]; // Soft cyan
        }

        doc.setFillColor(cCell[0], cCell[1], cCell[2]);
        doc.rect(xCol, yRow, boxW, boxH, 'F');

        // Draw tiny day index in box
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6);
        if (isDark) {
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
        }
        doc.text(String(dayNum), xCol + boxW / 2, yRow + 4, { align: 'center' });
      } else {
        // Draw empty box outline
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.rect(xCol, yRow, boxW, boxH, 'D');
      }
    }
  }

  // Draw Heatmap Legend
  const legY = gridY + 6 + maxWeeks * (boxH + gapCell) + 4;
  const legSteps = [
    { label: "Optimal (>=88%)", color: cPrimaryNavy },
    { label: "Moderate (>=68%)", color: cSecondarySlate },
    { label: "Alert (<68%)", color: [186, 230, 253] }
  ];

  legSteps.forEach((step, sIdx) => {
    const sx = leftX + sIdx * 28;
    doc.setFillColor(step.color[0], step.color[1], step.color[2]);
    doc.rect(sx, legY, 3, 3, 'F');

    doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(step.label, sx + 4, legY + 2.5);
  });

  // Right Side: Punctuality Brackets Chart
  const gpY = yPos + 6;
  const bracketData = [
    { label: "Tier A+: Completely Punctual (0 Late Slabs)", count: report.employees.filter(e => e.totalLateSlabs === 0).length, max: totalEmployees },
    { label: "Tier A: Standard Grace Range (1-3 Slabs)", count: report.employees.filter(e => e.totalLateSlabs > 0 && e.totalLateSlabs <= 3).length, max: totalEmployees },
    { label: "Tier B: Advisory Check Needed (4-8 Slabs)", count: report.employees.filter(e => e.totalLateSlabs > 3 && e.totalLateSlabs <= 8).length, max: totalEmployees },
    { label: "Tier C: Critical Compliance Action (>8 Slabs)", count: report.employees.filter(e => e.totalLateSlabs > 8).length, max: totalEmployees }
  ];

  bracketData.forEach((brItem, brIdx) => {
    const itemY = gpY + brIdx * 9.5;
    
    // Label
    doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`${brItem.label}`, rightX, itemY);

    // Progress bar components
    const barW = 60;
    const barH = 2.8;
    const progressPct = brItem.max > 0 ? (brItem.count / brItem.max) : 0;

    // Track
    doc.setFillColor(241, 245, 249);
    doc.rect(rightX, itemY + 1.2, barW, barH, 'F');

    // Fill Pill
    const fillColor = brIdx === 3 && brItem.count > 0 ? [185, 28, 28] : cPrimaryNavy; // Red highlight if critical late count exists
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.rect(rightX, itemY + 1.2, Math.max(1, barW * progressPct), barH, 'F');

    // Count value annotation
    doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${brItem.count} Staff`, rightX + barW + 3, itemY + 3.2);
  });

  yPos += spH + 16;

  // Metric Section 4: Workforce Attendance Bracket Overview (Horizontal Cards)
  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text("4. ACCUMULATIVE STANDING BRACKETS OVERVIEW", 15, yPos);

  const bracketCardsY = yPos + 4;
  const bcWidth = (pageWidth - 42) / 4; // 42mm each
  const bcHeight = 15;

  const scoreBrackets = [
    { range: ">= 95% (Perfect)", count: report.employees.filter(e => e.attendancePercentage >= 95).length, label: "Compliance Grade A+" },
    { range: "85% - 94% (Target)", count: report.employees.filter(e => e.attendancePercentage >= 85 && e.attendancePercentage < 95).length, label: "Operational Grade A" },
    { range: "75% - 84% (Moderate)", count: report.employees.filter(e => e.attendancePercentage >= 75 && e.attendancePercentage < 85).length, label: "Review Recommended" },
    { range: "< 75% (Suboptimal)", count: report.employees.filter(e => e.attendancePercentage < 75).length, label: "Review Trigger Threshold" }
  ];

  scoreBrackets.forEach((cItem, cIdx) => {
    const cx = 15 + cIdx * (bcWidth + 4);

    doc.setFillColor(cLightBg[0], cLightBg[1], cLightBg[2]);
    doc.rect(cx, bracketCardsY, bcWidth, bcHeight, 'F');
    doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
    doc.rect(cx, bracketCardsY, bcWidth, bcHeight, 'D');

    // Label detail
    doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(cItem.range, cx + 3, bracketCardsY + 4.2);

    // Value large count
    if (cItem.count > 0 && cIdx === 3) {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${cItem.count} Personnel`, cx + 3, bracketCardsY + 9.5);

    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(cItem.label, cx + 3, bracketCardsY + 13.2);
  });


  // ==========================================
  // PAGE 4: PERFORMANCE LEADERBOARDS (TALENT ENGAGEMENT)
  // ==========================================
  doc.addPage();
  yPos = 30;

  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("III. TALENT ENGAGEMENT & RECOGNITION PANEL", 15, yPos);
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(15, yPos + 2.5, 30, 1.2, 'F');

  doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text("A strategic look into leadership profiles, depicting consistency stars, committed logistics workhours and punctuality.", 15, yPos + 10);

  yPos += 18;

  const colCardW = 56;
  const colCardH = 100;
  const gapLeader = 6;

  // Sort Leader Arrays
  const sortedByAttn = [...report.employees].sort((a,b) => b.attendancePercentage - a.attendancePercentage || b.totalRegularHours - a.totalRegularHours).slice(0, 5);
  const sortedByPunctual = [...report.employees].sort((a,b) => a.totalLateSlabs - b.totalLateSlabs || b.attendancePercentage - a.attendancePercentage).slice(0, 5);

  const leaderboards = [
    {
      title: "TOP CONSISTENCY",
      subtitle: "Highest Attendance Levels",
      data: sortedByAttn.map(e => ({ name: e.name, id: e.id, stat: `${e.attendancePercentage}%` })),
      color: cPrimaryNavy
    },
    {
      title: "PUNCTUAL ACCREDITATION",
      subtitle: "Minimal Delay Sign-Ins",
      data: sortedByPunctual.map(e => ({ name: e.name, id: e.id, stat: `${e.totalLateDays}d / ${e.totalLateSlabs}sl` })),
      color: cAccentBlue
    }
  ];

  leaderboards.forEach((board, bIdx) => {
    const xCol = 15 + bIdx * (colCardW + gapLeader);

    // Frame Draw
    doc.setFillColor(cLightBg[0], cLightBg[1], cLightBg[2]);
    doc.rect(xCol, yPos, colCardW, colCardH, 'F');
    doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
    doc.rect(xCol, yPos, colCardW, colCardH, 'D');

    // Board Header Banner Accent
    doc.setFillColor(board.color[0], board.color[1], board.color[2]);
    doc.rect(xCol, yPos, colCardW, 11, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(board.title, xCol + colCardW / 2, yPos + 7, { align: 'center' });

    // Subtitle just below header banner
    doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(board.subtitle, xCol + colCardW / 2, yPos + 16, { align: 'center' });

    // Separator line
    doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
    doc.line(xCol + 4, yPos + 18, xCol + colCardW - 4, yPos + 18);

    // Render ranks 1 to 5
    board.data.forEach((rowItem, rIdx) => {
      const yRow = yPos + 26 + rIdx * 14.5;

      // Circle Number Badge
      doc.setFillColor(board.color[0], board.color[1], board.color[2]);
      doc.circle(xCol + 8, yRow - 2, 2.5, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(String(rIdx + 1), xCol + 8, yRow - 0.7, { align: 'center' });

      // Employee details
      doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      // Compact wide names safely
      const shortName = rowItem.name.length > 14 ? rowItem.name.substring(0, 13) + ".." : rowItem.name;
      doc.text(shortName, xCol + 15, yRow - 3.5);

      doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`ID Reference: ${rowItem.id}`, xCol + 15, yRow - 0.5);

      // Stat Display
      doc.setTextColor(board.color[0], board.color[1], board.color[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(rowItem.stat, xCol + colCardW - 5, yRow - 2, { align: 'right' });

      if (rIdx < 4) {
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(xCol + 4, yRow + 3.8, xCol + colCardW - 4, yRow + 3.8);
      }
    });
  });


  // ==========================================
  // PAGE 5+: PERSONNEL DIRECTORY & LEDGER
  // ==========================================
  doc.addPage();
  yPos = 30;

  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("IV. COMPREHENSIVE PERSONNEL OPERATION LEDGER", 15, yPos);
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(15, yPos + 2.5, 30, 1.2, 'F');

  // Directory Table headers
  const ledgerHeaders = [
    ['Emp ID', 'Employee Name', 'Present', 'Absent', 'WO', 'Work (H)', 'Late Days / Slabs', 'Attn %']
  ];

  const ledgerBody = report.employees.map(emp => [
    emp.id,
    emp.name,
    emp.presentDays,
    emp.absentDays,
    emp.weeklyOffDays,
    emp.totalRegularHours.toFixed(1),
    `${emp.totalLateDays} / ${emp.totalLateSlabs}`,
    `${emp.attendancePercentage}%`
  ]);

  autoTable(doc, {
    startY: yPos + 8,
    head: ledgerHeaders,
    body: ledgerBody,
    theme: 'striped',
    headStyles: {
      fillColor: cPrimaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: cTextDark },
      1: { fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'center', fontStyle: 'bold', textColor: cAccentBlue }
    },
    margin: { top: 22, bottom: 20, left: 15, right: 15 },
    pageBreak: 'auto'
  });


  // ==========================================
  // LAST PAGE: EXPORT EXCEPTIONS & COMPLIANCE ACTIONS
  // ==========================================
  doc.addPage();
  yPos = 30;

  doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("V. ATTENDANCE INSIGHTS & REGISTRY EXCEPTIONS", 15, yPos);
  doc.setFillColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
  doc.rect(15, yPos + 2.5, 30, 1.2, 'F');

  doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text("The following list represents identified scheduling exceptions requiring HR verification, supervisory checks, or manual stamp audits.", 15, yPos + 10);

  // Remap anomalies definitions to professional corporate alternatives
  const mapExceptionType = (type: string): string => {
    switch (type) {
      case 'Incomplete Punch':
        return 'Missing Punch Exception';
      case 'Extreme Late Arrival':
        return 'Significant Late Sign-In';
      case 'Impossible Timings':
        return 'Unnatural Shift Duration';
      case 'Status Conflict':
        return 'Scheduled Roster Conflict';
      default:
        return 'Attendance Discrepancy';
    }
  };

  const mapExceptionPriority = (sev: string): string => {
    switch (sev) {
      case 'high':
        return 'CRITICAL ATTENTION';
      case 'medium':
        return 'SUPERVISORY CHECK';
      case 'low':
        return 'SCHEDULING ADVISORY';
      default:
        return 'STANDARD REVIEW';
    }
  };

  const mapExceptionAction = (type: string): string => {
    switch (type) {
      case 'Incomplete Punch':
        return 'Acquire physical shift log; request manual punch stamp validation.';
      case 'Extreme Late Arrival':
        return 'Assess delay log; confirm if offsite work or leave offset applies.';
      case 'Impossible Timings':
        return 'Biometric machine error checks required; verify physical present state.';
      case 'Status Conflict':
        return 'Check if holiday swap roster applies; update HR database entry.';
      default:
        return 'Standard attendance audit checklist verification.';
    }
  };

  if (report.anomalies.length === 0) {
    // Elegant Success Banner
    doc.setFillColor(240, 253, 244); // light green
    doc.rect(15, yPos + 16, pageWidth - 30, 24, 'F');
    doc.setDrawColor(22, 163, 74); // green
    doc.rect(15, yPos + 16, pageWidth - 30, 24, 'D');

    doc.setTextColor(21, 128, 61);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("✔️ PERFECT COMPLIANCE RECORDED", 20, yPos + 24);

    doc.setTextColor(cTextDark[0], cTextDark[1], cTextDark[2]);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text("All attendance logs strictly conform to target corporate policy metrics. No exceptions require manual correction.", 20, yPos + 31);
  } else {
    const excHeaders = [['Emp ID', 'Employee Name', 'Ref Date', 'Exception Classification', 'Priority Level', 'Logged Punches']];
    const excBody = report.anomalies.map(ano => [
      ano.empCode,
      ano.empName,
      `Day ${ano.dayNum}`,
      mapExceptionType(ano.type),
      mapExceptionPriority(ano.severity),
      ano.value
    ]);

    autoTable(doc, {
      startY: yPos + 16,
      head: excHeaders,
      body: excBody,
      theme: 'grid',
      headStyles: {
        fillColor: cPrimaryNavy,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: cTextDark },
        1: { fontStyle: 'bold' },
        3: { textColor: cAccentBlue, fontStyle: 'bold' },
        4: { fontStyle: 'bold' }
      },
      bodyStyles: {
        fontSize: 7.8,
        textColor: [51, 65, 85],
      },
      margin: { top: 22, bottom: 20, left: 15, right: 15 },
      didParseCell: (data: any) => {
        // Red and Amber coloring for severity highlights
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw);
          if (val.includes('CRITICAL')) {
            data.cell.styles.textColor = [185, 28, 28]; // Muted Red
          } else if (val.includes('SUPERVISORY')) {
            data.cell.styles.textColor = [217, 119, 6]; // Amber/Orange
          } else {
            data.cell.styles.textColor = [79, 70, 229]; // Indigo Indigo
          }
        }
      },
      pageBreak: 'auto'
    });

    const currentY = (doc as any).lastAutoTable.finalY + 12;

    if (currentY + 35 < pageHeight - 20) {
      // Draw small compliance action advice note
      doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("REMEDIAL COMPLIANCE COMPASS", 15, currentY);
      doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
      doc.line(15, currentY + 2.5, pageWidth - 15, currentY + 2.5);

      const bulletPoints = [
        "• Missing Punches: Operational managers must verify physical presence timesheets prior to payroll lock.",
        "• Conflict Alignments: Resolve status variances on weekends/holidays with supervisor override swap forms."
      ];

      bulletPoints.forEach((bp, bpIdx) => {
        doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.text(bp, 15, currentY + 7 + bpIdx * 5);
      });
    }
  }


  // ==========================================
  // GLOBAL STAMPING LOOP: HEADER & FOOTER
  // ==========================================
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    if (i === 1) {
      // Draw custom elegance borders on cover page
      doc.setDrawColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
      doc.setLineWidth(0.8);
      doc.rect(6, 6, pageWidth - 12, pageHeight - 12, 'D');

      doc.setDrawColor(cGoldAccent[0], cGoldAccent[1], cGoldAccent[2]);
      doc.setLineWidth(0.3);
      doc.rect(7, 7, pageWidth - 14, pageHeight - 14, 'D');
      continue;
    }

    // --- STANDARD PAGE HEADER (COMPLETED POST-COVER) ---
    // Add tiny page header logo
    try {
      doc.addImage(LOGO_DATA_URI, 'SVG', 15, 9, 6.5, 6.5);
    } catch (e) {}

    // Company typographical seal logo
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(cPrimaryNavy[0], cPrimaryNavy[1], cPrimaryNavy[2]);
    doc.text("ECO SAFE CONTAINERS", 23.5, 13.5);

    doc.setFont('Helvetica', 'normal');
    // Sub-header details
    doc.setFontSize(7.5);
    doc.setTextColor(cSecondarySlate[0], cSecondarySlate[1], cSecondarySlate[2]);
    doc.text(`   |   EXECUTIVE REPORT: ${monthLabel.toUpperCase()}`, 58, 13.5);

    // Auditor stamp text (Right aligned)
    doc.setFont('Helvetica', 'bold');
    doc.text("A.O. MITTAL & ASSOCIATES (CHARTERED ACCOUNTANTS)", pageWidth - 15, 14, { align: 'right' });

    // Underline divider
    doc.setDrawColor(cBorderGray[0], cBorderGray[1], cBorderGray[2]);
    doc.setLineWidth(0.4);
    doc.line(15, 17, pageWidth - 15, 17);

    // --- STANDARD PAGE FOOTER ---
    doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

    // Left Footer Stamp
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text("A.O. Mittal & Associates", 15, pageHeight - 10);

    // Center Footer Signatory
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text("CA Akash Agarwal", pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Right Page Count and Author
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(cTextMuted[0], cTextMuted[1], cTextMuted[2]);
    doc.text(`Sarthak Jain  |  Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
  }

  // File download naming template
  const cleanMonthName = monthLabel.replace(/[\s/\\?%*:|"<>\s]+/g, '_');
  doc.save(`Executive_Workforce_Report_${cleanMonthName}.pdf`);
}
