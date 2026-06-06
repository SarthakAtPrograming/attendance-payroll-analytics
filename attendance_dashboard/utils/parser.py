import pandas as pd
import numpy as np
from .calculations import calculate_late_minutes, calculate_overtime, calculate_regular_hours

def clean_attendance_data(val):
    """Clean values like --:-- and float NaNs to standard string representation"""
    if pd.isna(val) or val == '--:--' or str(val).strip() == '' or str(val).strip().lower() == 'nan':
        return '--:--'
    return str(val).strip()

def parse_attendance_sheet(file_path):
    """
    Parses biometric excel worksheets row-by-row.
    Maps employee summary, daily IN/OUT/WORK/OT/Status rows, and applies dynamic calculations.
    """
    # Load raw excel sheets as a 2D matrix. Use dtype=str to preserve exact cell formats like leading zeros in "0001"
    try:
        df = pd.read_excel(file_path, header=None, dtype=str)
    except Exception as e:
        raise ValueError(f"Failed to read file: {e}")
        
    records = []
    anomalies = []
    month_name = "Unknown Month"
    
    # Locate month name
    for r in range(min(15, len(df))):
        for c in range(df.shape[1]):
            val = str(df.iloc[r, c]).strip()
            if "Month" in val or "Report Month" in val:
                for search_c in range(c + 1, min(c + 5, df.shape[1])):
                    cell_val = str(df.iloc[r, search_c]).strip()
                    if cell_val and cell_val != 'nan':
                        month_name = cell_val
                        break
                        
    # Iterate through rows scanning row-by-row for "Empcode"
    r = 0
    while r < len(df):
        row_vals = [str(x).strip().lower() for x in df.iloc[r, :].fillna('')]
        
        # Check if "empcode" label is present in any cell of the row
        emp_col_idx = -1
        for c in range(len(row_vals)):
            if 'empcode' in row_vals[c] or 'emp code' in row_vals[c] or row_vals[c] == 'emp_code':
                emp_col_idx = c
                break
                
        if emp_col_idx != -1:
            # We found the beginning of an employee segment!
            emp_row = df.iloc[r, :]
            
            # Look downwards to locate the rest of the employee sub-rows dynamically
            day_nums_row = None
            day_names_row = None
            in_row = None
            out_row = None
            work_row = None
            ot_row = None
            status_row = None
            
            max_search_row_index = r
            
            for offset in range(1, 16):
                next_idx = r + offset
                if next_idx >= len(df):
                    break
                next_row = df.iloc[next_idx, :]
                
                # Stop if we hit another "Empcode" row
                next_row_vals = [str(x).strip().lower() for x in next_row.fillna('')]
                has_empcode = False
                for c_check in range(min(5, len(next_row_vals))):
                    if 'empcode' in next_row_vals[c_check] or 'emp code' in next_row_vals[c_check] or next_row_vals[c_check] == 'emp_code':
                        has_empcode = True
                        break
                if has_empcode:
                    break
                
                label0 = str(next_row.iloc[0]).strip().upper() if len(next_row) > 0 else ''
                label1 = str(next_row.iloc[1]).strip().upper() if len(next_row) > 1 else ''
                label2 = str(next_row.iloc[2]).strip().upper() if len(next_row) > 2 else ''
                
                if label0 == 'IN' or label1 == 'IN' or label2 == 'IN':
                    in_row = next_row
                    max_search_row_index = max(max_search_row_index, next_idx)
                elif label0 == 'OUT' or label1 == 'OUT' or label2 == 'OUT':
                    out_row = next_row
                    max_search_row_index = max(max_search_row_index, next_idx)
                elif label0 == 'WORK' or label1 == 'WORK' or label2 == 'WORK':
                    work_row = next_row
                    max_search_row_index = max(max_search_row_index, next_idx)
                elif label0 == 'OT' or label1 == 'OT' or label2 == 'OT':
                    ot_row = next_row
                    max_search_row_index = max(max_search_row_index, next_idx)
                elif label0 == 'STATUS' or label1 == 'STATUS' or label2 == 'STATUS':
                    status_row = next_row
                    max_search_row_index = max(max_search_row_index, next_idx)
                else:
                    # check if row contains calendar day number 1
                    has_number_1 = False
                    for c_check in range(min(10, len(next_row))):
                        val_cell_str = str(next_row.iloc[c_check]).strip().split('.')[0]
                        if val_cell_str in ['1', '01']:
                            has_number_1 = True
                            break
                    if has_number_1 and day_nums_row is None:
                        day_nums_row = next_row
                        max_search_row_index = max(max_search_row_index, next_idx)
                        
                        # Check immediately following row for day names
                        if next_idx + 1 < len(df):
                            possible_day_names = df.iloc[next_idx + 1, :]
                            test_lbl = str(possible_day_names.iloc[0] if len(possible_day_names) > 0 else possible_day_names.iloc[1] if len(possible_day_names) > 1 else '').strip().upper()
                            if test_lbl not in ['IN', 'OUT', 'WORK', 'OT', 'STATUS']:
                                day_names_row = possible_day_names
                                max_search_row_index = max(max_search_row_index, next_idx + 1)
            
            # Fallback to strict offsets if dynamic scanning fails to bind specific rows
            if day_nums_row is None and r+1 < len(df):
                day_nums_row = df.iloc[r+1, :]
            if day_names_row is None and r+2 < len(df):
                day_names_row = df.iloc[r+2, :]
            if in_row is None and r+3 < len(df):
                in_row = df.iloc[r+3, :]
            if out_row is None and r+4 < len(df):
                out_row = df.iloc[r+4, :]
            if work_row is None and r+5 < len(df):
                work_row = df.iloc[r+5, :]
            if ot_row is None and r+6 < len(df):
                ot_row = df.iloc[r+6, :]
            if status_row is None and r+7 < len(df):
                status_row = df.iloc[r+7, :]
                
            max_search_row_index = max(max_search_row_index, r + 7)
            
            if day_nums_row is None or in_row is None or out_row is None:
                r += 1
                continue
            
            # Map employee code and name
            emp_code = ""
            emp_name = ""
            
            for col_idx in range(len(emp_row)):
                cell_val = str(emp_row.iloc[col_idx]).strip()
                cell_val_lower = cell_val.lower()
                
                if 'empcode' in cell_val_lower or 'emp code' in cell_val_lower or cell_val_lower == 'emp_code':
                    if ':' in cell_val:
                        emp_code = cell_val.split(':', 1)[1].strip()
                    elif '=' in cell_val:
                        emp_code = cell_val.split('=', 1)[1].strip()
                    else:
                        for k in range(col_idx + 1, len(emp_row)):
                            next_val = str(emp_row.iloc[k]).strip()
                            next_val_lower = next_val.lower()
                            if next_val != '' and next_val_lower != 'nan':
                                if 'name' not in next_val_lower and 'present' not in next_val_lower and 'empcode' not in next_val_lower and 'emp code' not in next_val_lower:
                                    emp_code = next_val
                                    break
                
                if cell_val_lower in ['name', 'empname', 'emp name', 'employee name'] or cell_val_lower.startswith('name:') or cell_val_lower.startswith('name '):
                    if ':' in cell_val:
                        emp_name = cell_val.split(':', 1)[1].strip()
                    elif '=' in cell_val:
                        emp_name = cell_val.split('=', 1)[1].strip()
                    else:
                        for k in range(col_idx + 1, len(emp_row)):
                            next_val = str(emp_row.iloc[k]).strip()
                            next_val_lower = next_val.lower()
                            if next_val != '' and next_val_lower != 'nan':
                                if 'present' not in next_val_lower and 'wo' not in next_val_lower and 'hl' not in next_val_lower and 'absent' not in next_val_lower:
                                    emp_name = next_val
                                    break
            
            # Clean up emp_code and handle padding to guarantee string with leading zeros
            emp_code = emp_code.replace("'", "").replace('"', "").strip()
            if emp_code.isdigit():
                emp_code = emp_code.zfill(4)
                
            if not emp_code or emp_code.lower() == 'nan':
                emp_code = f"EMP_{np.random.randint(1000, 9999):04d}"
            if not emp_name or emp_name.lower() == 'nan':
                emp_name = f"Employee {emp_code}"
                
            # Map calendar columns starting with Day 1
            date_col_idx = -1
            day_map = {}
            
            for c_search in range(len(day_nums_row)):
                try:
                    val_cell_str = str(day_nums_row.iloc[c_search]).strip().split('.')[0]
                    val_cell = int(val_cell_str)
                    if val_cell == 1:
                        date_col_idx = c_search
                        day_map[1] = c_search
                        break
                except ValueError:
                    continue
                    
            if date_col_idx == -1:
                for c_search in range(len(day_nums_row)):
                    val_str = str(day_nums_row.iloc[c_search]).strip()
                    if val_str in ['1', '01', '1.0']:
                        date_col_idx = c_search
                        day_map[1] = c_search
                        break
                        
            if date_col_idx == -1:
                date_col_idx = 2
                day_map[1] = 2
                
            # Build day_map for Days 2 to 31
            for day in range(2, 32):
                col_exp = date_col_idx + (day - 1)
                found_col_idx = -1
                
                if col_exp < len(day_nums_row):
                    try:
                        val_cell_str = str(day_nums_row.iloc[col_exp]).strip().split('.')[0]
                        if int(val_cell_str) == day:
                            found_col_idx = col_exp
                    except ValueError:
                        pass
                
                if found_col_idx == -1:
                    for offset in range(-3, 4):
                        test_col = col_exp + offset
                        if 0 <= test_col < len(day_nums_row):
                            try:
                                val_cell_str = str(day_nums_row.iloc[test_col]).strip().split('.')[0]
                                if int(val_cell_str) == day:
                                    found_col_idx = test_col
                                    break
                            except ValueError:
                                pass
                
                day_map[day] = found_col_idx if found_col_idx != -1 else col_exp
                
            daily_records = []
            present_count = 0
            absent_count = 0
            wo_count = 0
            leave_count = 0
            
            tot_reg_hours = 0.0
            tot_ot_hours = 0.0
            tot_late_mins = 0
            
            for day, col_c in day_map.items():
                day_name = str(day_names_row.iloc[col_c]).strip() if day_names_row is not None and col_c < len(day_names_row) else ''
                
                in_time = clean_attendance_data(in_row.iloc[col_c]) if col_c < len(in_row) else '--:--'
                out_time = clean_attendance_data(out_row.iloc[col_c]) if col_c < len(out_row) else '--:--'
                work_time = clean_attendance_data(work_row.iloc[col_c]) if work_row is not None and col_c < len(work_row) else '00:00'
                ot_time = clean_attendance_data(ot_row.iloc[col_c]) if ot_row is not None and col_c < len(ot_row) else '00:00'
                status = str(status_row.iloc[col_c]).strip().upper() if status_row is not None and col_c < len(status_row) else ''
                
                # Fallback statuses
                if not status or status == 'NAN':
                    if in_time != '--:--' and out_time != '--:--':
                        status = 'P'
                    elif day_name.lower().startswith('m') and in_time == '--:--':
                        status = 'WO'
                    elif in_time == '--:--' and out_time == '--:--':
                        status = 'A'
                
                late_mins = calculate_late_minutes(in_time)
                ot_mins = calculate_overtime(out_time)
                reg_hrs = calculate_regular_hours(in_time, out_time, status, late_mins)
                
                tot_reg_hours += reg_hrs
                tot_ot_hours += (ot_mins / 60.0)
                tot_late_mins += late_mins
                
                if status == 'P':
                    present_count += 1
                elif status == 'A':
                    absent_count += 1
                elif status == 'WO':
                    wo_count += 1
                elif status in ['LV', 'HL']:
                    leave_count += 1
                    
                daily_records.append({
                    'day': day,
                    'day_name': day_name,
                    'in': in_time,
                    'out': out_time,
                    'work': work_time,
                    'ot': ot_time,
                    'status': status,
                    'late_mins': late_mins,
                    'ot_mins': ot_mins,
                    'reg_hrs': reg_hrs
                })
                
            attendance_percent = 100
            if (present_count + absent_count) > 0:
                attendance_percent = int((present_count / (present_count + absent_count)) * 100)
                
            records.append({
                'id': emp_code,
                'name': emp_name,
                'present': present_count,
                'absent': absent_count,
                'wo': wo_count,
                'leaves_holidays': leave_count,
                'total_regular_hours': round(tot_reg_hours, 2),
                'total_overtime_hours': round(tot_ot_hours, 2),
                'total_late_minutes': tot_late_mins,
                'total_work_hours': round(tot_reg_hours + tot_ot_hours, 2),
                'attendance_percent': attendance_percent,
                'daily_records': daily_records
            })
            
            # Skip rows processed in block
            r = max_search_row_index
            
        r += 1
        
    # Validation logging
    print(f"Detected Employees: {len(records)}")
    
    return {
        'month_name': month_name,
        'employees': records
    }
