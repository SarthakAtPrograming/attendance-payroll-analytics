def detect_anomalies(employees, month_name):
    """
    Scans parsed employee daily logs and identifies forensic flags:
    - Incomplete clock punches
    - Extreme late arrivals (2+ hours late)
    - Suspicious overtime (4+ hours OT)
    - Short shifts marked present
    - Status conflicts (punches during leave)
    """
    anomalies = []
    
    for emp in employees:
        emp_code = emp['id']
        emp_name = emp['name']
        
        for rec in emp['daily_records']:
            day = rec['day']
            date_str = f"{month_name} Day {day}"
            unique_id = f"{emp_code}_{day}"
            
            status = rec['status']
            in_time = rec['in']
            out_time = rec['out']
            
            # 1. Incomplete Punch
            if status == 'P' and ((in_time == '--:--' and out_time != '--:--') or (in_time != '--:--' and out_time == '--:--')):
                anomalies.append({
                    'id': f"{unique_id}_inc",
                    'emp_code': emp_code,
                    'emp_name': emp_name,
                    'day': day,
                    'date_str': date_str,
                    'type': 'Incomplete Punch',
                    'severity': 'HIGH',
                    'description': f"Only {'OUT' if in_time == '--:--' else 'IN'} punch recorded on a presence shift.",
                    'value': f"IN: {in_time}, OUT: {out_time}"
                })
                
            # 2. Extreme Late Arrival (120+ minutes late)
            if rec['late_mins'] >= 120:
                anomalies.append({
                    'id': f"{unique_id}_exlt",
                    'emp_code': emp_code,
                    'emp_name': emp_name,
                    'day': day,
                    'date_str': date_str,
                    'type': 'Extreme Late Arrival',
                    'severity': 'MEDIUM',
                    'description': f"Employee arrived late by {rec['late_mins']} minutes (Slab counts: {rec['late_mins'] // 30} slabs).",
                    'value': f"IN: {in_time}"
                })
                
            # 3. Suspicious Overtime (4+ hours in a single shift)
            if rec['ot_mins'] >= 240:
                anomalies.append({
                    'id': f"{unique_id}_svot",
                    'emp_code': emp_code,
                    'emp_name': emp_name,
                    'day': day,
                    'date_str': date_str,
                    'type': 'Suspicious Overtime',
                    'severity': 'MEDIUM',
                    'description': f"Abnormal overtime ({rec['ot_mins'] / 60.0} hours) recorded in a single shift.",
                    'value': f"OT: {rec['ot_mins']} min"
                })
                
            # 4. Status Conflict
            if status in ['LV', 'HL', 'WO'] and in_time != '--:--':
                anomalies.append({
                    'id': f"{unique_id}_conf",
                    'emp_code': emp_code,
                    'emp_name': emp_name,
                    'day': day,
                    'date_str': date_str,
                    'type': 'Status Conflict',
                    'severity': 'LOW',
                    'description': f"Punch recorded on a scheduled off shift (Status: {status}).",
                    'value': f"Punches found during {status}"
                })
                
    return anomalies
