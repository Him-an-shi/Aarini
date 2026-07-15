def normalize_cycles(cycles):
    if not cycles:
        return []
        
    normalized = []
    for cycle in cycles:
        try:
            start = parse_date(cycle.get("startDate"))
            end = parse_date(cycle.get("endDate")) if cycle.get("endDate") else None
        except (TypeError, ValueError, AttributeError):
            continue
        if end and end < start:
            continue
        normalized.append({"start": start, "end": end})
        
    sorted_cycles = sorted(normalized, key=lambda cycle: cycle["start"])
    
    # 🛠️ FIX: Robust overlap detection and merging
    valid_cycles = []
    for cycle in sorted_cycles:
        if not valid_cycles:
            valid_cycles.append(cycle)
            continue
            
        prev = valid_cycles[-1]
        
        # Check 1: Does it start on or before the previous cycle actually ended?
        overlaps_end_date = prev["end"] and cycle["start"] <= prev["end"]
        
        # Check 2: Does it start impossibly soon after the previous cycle began?
        # (It is biologically impossible to start a new cycle within MIN_CYCLE_LENGTH)
        overlaps_start_date = (cycle["start"] - prev["start"]).days < MIN_CYCLE_LENGTH
        
        if overlaps_end_date or overlaps_start_date:
            # If they overlap, gracefully merge the end dates so we don't lose data
            if cycle["end"]:
                if not prev["end"] or cycle["end"] > prev["end"]:
                    prev["end"] = cycle["end"]
            continue
            
        valid_cycles.append(cycle)
        
    return valid_cycles
