import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import os
from utils.parser import parse_attendance_sheet
from utils.anomaly_detection import detect_anomalies
from utils.pdf_export import generate_pdf_report

st.set_page_config(
    page_title="Biometric Attendance & Payroll Audit Analyzer",
    page_icon="📋",
    layout="wide"
)

# App Styles override
st.markdown("""
<style>
    .kpi-title { font-size:0.8rem; color:#64748b; font-weight:bold; text-transform:uppercase; margin-bottom:4px; }
    .kpi-value { font-size:1.8rem; font-weight:800; color:#1e293b; line-height:1; }
</style>
""", unsafe_allow_html=True)

st.title("📋 BIOMETRIC ATTENDANCE & PAYROLL AUDITING SYSTEM")
st.caption("CA-Firm Ready Biometric sheet parser, Dynamic overtime and late slab calculators, and Forensic auditing pipelines.")

# Sidebar Configurations
st.sidebar.title("Work Scheduling Rules")
st.sidebar.caption("Override dynamic hr calculations")

shift_start = st.sidebar.time_input("Shift Start (grace counting reference)", value=pd.to_datetime("09:00").time())
shift_end = st.sidebar.time_input("Official End Shift (for OT reference)", value=pd.to_datetime("17:30").time())
grace_late = st.sidebar.number_input("Late grace minutes (Standard: 11)", value=11, min_value=0)
grace_ot = st.sidebar.number_input("OT grace minutes (Standard: 11)", value=11, min_value=0)

uploaded_files = st.file_uploader(
    "Upload raw machine exported biometric worksheets (.xls, .xlsx)",
    type=['xls', 'xlsx'],
    accept_multiple_files=True
)

# Master database
monthly_db = {}
reports_list = []

if uploaded_files:
    for file in uploaded_files:
        try:
            report = parse_attendance_sheet(file)
            anomalies = detect_anomalies(report['employees'], report['month_name'])
            report['anomalies'] = anomalies
            monthly_db[report['month_name']] = report
            reports_list.append(report['month_name'])
        except Exception as e:
            st.error(f"Failed to parse file: {file.name}. Error: {e}")

if monthly_db:
    # Top selector for loaded reports month
    selected_month = st.selectbox("Select Active Monthly Report Workspace", reports_list)
    active_report = monthly_db[selected_month]
    
    # KPIs summary bar
    st.subheader("Roster High-level KPIs Metrics")
    
    col1, col2, col3, col4 = st.columns(4)
    
    total_emps = len(active_report['employees'])
    tot_hrs = sum(e['total_regular_hours'] for e in active_report['employees'])
    tot_ot = sum(e['total_overtime_hours'] for e in active_report['employees'])
    avg_attn = int(sum(e['attendance_percent'] for e in active_report['employees']) / max(1, total_emps))
    
    with col1:
        st.markdown('<div class="kpi-title">Total Employees</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{total_emps} Personnel</div>', unsafe_allow_html=True)
    with col2:
        st.markdown('<div class="kpi-title">Roster Attendance Quotient</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{avg_attn}% Avg</div>', unsafe_allow_html=True)
    with col3:
        st.markdown('<div class="kpi-title">Overtime hours worked</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">+{tot_ot:.1f} Hours</div>', unsafe_allow_html=True)
    with col4:
        st.markdown('<div class="kpi-title">Consolidated regular pay</div>', unsafe_allow_html=True)
        st.markdown(f'<div class="kpi-value">{tot_hrs:.1f} Hours</div>', unsafe_allow_html=True)
        
    st.write("---")
    
    # Drill-down Tabs
    tab1, tab2, tab3 = st.tabs(["Personnel Summary Directory", "Visual trends & charts", "Biometric risk & anomalies"])
    
    with tab1:
        st.subheader("Processed personnel sheets summary")
        st.caption("Search, filter, or download the calculated roster summaries directly")
        
        # Search query
        search_query = st.text_input("Search personnel roster by name or code", "")
        
        df_emps = pd.DataFrame(active_report['employees'])
        df_display = df_emps.drop(columns=['daily_records'])
        
        if search_query:
            df_display = df_display[df_display['name'].str.contains(search_query, case=False) | df_display['id'].str.contains(search_query, case=False)]
            
        st.dataframe(df_display, use_container_width=True)
        
        # Download ledger PDF button
        pdf_filename = f"Biometric_Executive_Audit_{selected_month}.pdf"
        if st.button("Generate Audit-Firm Raw PDF Ledger"):
            generate_pdf_report(active_report, active_report['anomalies'], pdf_filename)
            st.success(f"PDF Successfully generated! Saved locally to {pdf_filename}")
            
    with tab2:
        st.subheader("Statistical operational charts")
        c1, c2 = st.columns(2)
        
        with c1:
            # Overtime leaderboard
            df_ot = df_display[df_display['total_overtime_hours'] > 0].sort_values(by="total_overtime_hours", ascending=False)
            if not df_ot.empty:
                fig = px.bar(df_ot, x="name", y="total_overtime_hours", title="Personnel active overtime rankings (Hrs)")
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No active OT recorded in selected month sheet.")
                
        with c2:
            # Absent distributions
            fig_abs = px.pie(df_display, names="name", values="absent", title="Proportional absences distributions")
            st.plotly_chart(fig_abs, use_container_width=True)
            
    with tab3:
        st.subheader("Forensic scanning anomalies log")
        
        if active_report['anomalies']:
            df_ano = pd.DataFrame(active_report['anomalies'])
            st.warning(f"Critical risk flags discovered! ({len(active_report['anomalies'])} warning indexes flagged)")
            st.dataframe(df_ano, use_container_width=True)
        else:
            st.success("Roster completely clear of critical biometric mismatch trends!")
else:
    st.info("Biometric spreadsheet database empty. Drop raw xls/xlsx files above to begin!")
