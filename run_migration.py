#!/usr/bin/env python3
import subprocess
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Try different python executables
python_paths = [
    'python3',
    'python',
    'py',
]

for python_cmd in python_paths:
    try:
        result = subprocess.run([python_cmd, 'scripts/execute_migration.py'], cwd=os.getcwd())
        sys.exit(result.returncode)
    except FileNotFoundError:
        continue

print("No Python interpreter found!")
sys.exit(1)
