import sys
import io
import json
import re
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import openpyxl

wb = openpyxl.load_workbook('2026_[MEDIA - TASKS TRACKER].xlsx')
ws = wb['All Task']

def extract_computed(val):
    """Extract computed value from IFERROR formula strings"""
    if val is None:
        return None
    val = str(val)
    # Match pattern like: COMPUTED_VALUE"),\"SomeValue")
    m = re.search(r'COMPUTED_VALUE[^,]*,\"(.*?)\"\)', val)
    if m:
        return m.group(1)
    return val

# Extract all rows
data = []
for row in ws.iter_rows(values_only=True):
    row_data = []
    for cell in row:
        if isinstance(cell, datetime):
            row_data.append(cell.strftime('%Y-%m-%d'))
        elif cell is None:
            row_data.append(None)
        else:
            val = str(cell)
            if 'COMPUTED_VALUE' in val or 'IFERROR' in val:
                val = extract_computed(val)
            row_data.append(val)
    data.append(row_data)

# Print first 30 rows
for i, row in enumerate(data[:30]):
    print(f"Row {i}: {row}")
