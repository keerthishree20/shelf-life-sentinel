import sys
from pathlib import Path

# Tests import `services.*` the same way the app does, so the backend
# directory has to be on the path however pytest was invoked.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
