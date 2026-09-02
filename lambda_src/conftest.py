import os
import sys

# 各 Lambda は retry.py と同一ディレクトリに展開されるため、
# テストでも lambda_src 直下を import パスに含める。
sys.path.insert(0, os.path.dirname(__file__))
