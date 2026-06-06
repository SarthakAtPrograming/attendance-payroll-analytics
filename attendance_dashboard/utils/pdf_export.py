import os
from datetime import datetime
from reportlab.lib.pagesizes import letter, portrait
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_report(report_data, anomalies, output_path):
    """
    Generates are executive-ready CA and Audit firm styled ReportLab PDF
    containing executive dashboards, employee metrics, and flagged anomalies.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=30,
        bottomMargin=30
    )
    
    story = []
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e293b'), # Slate 800
        spaceAfter=4,
        fontName='Helvetica-Bold'
    )
    
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#64748b'), # Slate 500
        spaceAfter=15,
        fontName='Helvetica'
    )
    
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=5,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'MainBody',
        parent=styles['BodyText'],
        fontSize=8.5,
        textColor=colors.HexColor('#334155'),
        leading=12,
        spaceAfter=10
    )

    # 1. Document Title
    story.append(Paragraph("EXECUTIVE ATTENDANCE & PAYROLL SUMMARY", title_style))
    story.append(Paragraph(f"Biometric automated machine audit run  |  Report Month: {report_data['month_name']}  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", sub_style))
    
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1'), spaceAfter=15))
    
    # 2. Summary stats
    tot_hrs = sum(emp['total_regular_hours'] for emp in report_data['employees'])
    tot_ot = sum(emp['total_overtime_hours'] for emp in report_data['employees'])
    avg_attn = int(sum(emp['attendance_percent'] for emp in report_data['employees']) / max(1, len(report_data['employees'])))
    
    brief_text = f"This report logs audit-firm qualified payroll data for {len(report_data['employees'])} processed employees. Aggregate paid hours count totals {tot_hrs:.1f} hours alongside {tot_ot:.1f} hours of overtime logged via biometric slabs. The collective attendance quotient is {avg_attn:.1f}% across regular schedules (excluding weekly offs). A total of {len(anomalies)} critical anomaly indices were cataloged by automatic risk triggers."
    story.append(Paragraph(brief_text, body_style))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Employee Timesheet Metrics", h2_style))
    
    # 3. Main Data Table
    table_rows = [['Emp ID', 'Employee Name', 'Present', 'Absent', 'WO', 'Reg Hrs', 'OT Hrs', 'Late Mins', 'Attn %']]
    for emp in report_data['employees']:
        table_rows.append([
            emp['id'],
            emp['name'],
            str(emp['present']),
            str(emp['absent']),
            str(emp['wo']),
            f"{emp['total_regular_hours']:.1f}",
            f"{emp['total_overtime_hours']:.1f}",
            str(emp['total_late_minutes']),
            f"{emp['attendance_percent']}%"
        ])
        
    t = Table(table_rows, colWidths=[45, 110, 40, 40, 30, 45, 45, 45, 40])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    
    story.append(t)
    
    # 4. Forensic anomalies
    if anomalies:
        story.append(Spacer(1, 15))
        story.append(Paragraph("Biometric Risk & Forensics Logs", h2_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#ef4444'), spaceAfter=10))
        
        ano_rows = [['Emp ID', 'Name', 'Day', 'Type', 'Risk', 'Details Trigger']]
        for ano in anomalies[:10]: # Cap to first 10 for pagination safety
            ano_rows.append([
                ano['emp_code'],
                ano['emp_name'],
                f"Day {ano['day']}",
                ano['type'],
                ano['severity'],
                ano['description']
            ])
            
        t_ano = Table(ano_rows, colWidths=[45, 100, 35, 90, 40, 200])
        t_ano.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#991b1b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#fca5a5')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fff5f5')]),
        ]))
        story.append(t_ano)
        
    doc.build(story)
