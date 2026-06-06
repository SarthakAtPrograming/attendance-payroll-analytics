import math
from datetime import datetime

def parse_time_to_minutes(time_str):
    """
    Parses a 'HH:MM' string to integers representing minutes since midnight.
    Returns None if missing or invalid.
    """
    if not time_str or time_str == '--:--' or not isinstance(time_str, str):
        return None
    try:
        parts = time_str.strip().split(':')
        h, m = int(parts[0]), int(parts[1])
        return h * 60 + m
    except Exception:
        return None

def calculate_late_minutes(in_time_str, shift_start_str="09:00", grace_min=11):
    """
    Implements reusable dynamic late slab logic:
    If IN <= 9:11 -> late = 0
    Every extra 30-minute late slab increases late by 30 minutes.
    """
    in_mins = parse_time_to_minutes(in_time_str)
    if in_mins is None:
        return 0
        
    start_mins = parse_time_to_minutes(shift_start_str) or 540 # 9:00 AM
    cutoff_mins = start_mins + grace_min # 9:11 AM
    
    if in_mins <= cutoff_mins:
        return 0
        
    diff = in_mins - start_mins # total minutes late
    # Math.ceil division of slabs (every 30 mins)
    slabs = math.ceil((diff - grace_min) / 30.0)
    return int(slabs * 30)

def calculate_overtime(out_time_str, shift_end_str="17:30", grace_min=11):
    """
    Implements reusable dynamic overtime slab logic:
    If OUT <= 5:41 PM -> overtime = 0
    Every extra 30-minute OT slab increases OT by 30 minutes.
    """
    out_mins = parse_time_to_minutes(out_time_str)
    if out_mins is None:
        return 0
        
    end_mins = parse_time_to_minutes(shift_end_str) or 1050 # 17:30 (5:30 PM)
    grace_cutoff = end_mins + grace_min # 17:41
    
    if out_mins <= grace_cutoff:
        return 0
        
    diff = out_mins - end_mins # minutes past shift end
    slabs = math.ceil((diff - grace_min) / 30.0)
    return int(slabs * 30)

def calculate_regular_hours(in_time_str, out_time_str, status, late_mins):
    """
    Net payable regular shift is 8.0 hours.
    Deducts late arrival minutes and early departure penalty hours proportionally.
    """
    if status != 'P' and status != 'p':
        return 0.0
        
    in_mins = parse_time_to_minutes(in_time_str)
    out_mins = parse_time_to_minutes(out_time_str)
    
    if in_mins is None or out_mins is None:
        return 0.0
        
    # Standard baseline
    reg_hrs = 8.0 - (late_mins / 60.0)
    
    # Early departure penalty (before 5:30 PM, i.e., 1050 minutes)
    if out_mins < 1050:
        early_departure_mins = 1050 - out_mins
        reg_hrs -= (early_departure_mins / 60.0)
        
    return max(0.0, round(reg_hrs, 2))
