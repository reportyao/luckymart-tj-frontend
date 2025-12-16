#!/usr/bin/env python3
import re
import os
import sys

# Regex to find Chinese characters in string literals
chinese_pattern = re.compile(r'[\'"`]([^\'"` ]*[\u4e00-\u9fff]+[^\'"`]*)[\'"`]')

def find_chinese_in_file(filepath):
    results = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                # Skip comments
                if line.strip().startswith('//') or line.strip().startswith('*'):
                    continue
                
                # Find all Chinese string literals
                matches = chinese_pattern.findall(line)
                for match in matches:
                    # Filter out imports and type definitions
                    if not any(keyword in line for keyword in ['import', 'from', 'interface', 'type', 'export']):
                        results.append((line_num, match, line.strip()))
    except Exception as e:
        pass
    return results

def main():
    src_dirs = ['src/pages', 'src/contexts', 'src/components']
    
    print("=== Hardcoded Chinese Strings ===\n")
    
    for src_dir in src_dirs:
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                    filepath = os.path.join(root, file)
                    results = find_chinese_in_file(filepath)
                    
                    if results:
                        print(f"\n📄 {filepath}")
                        for line_num, chinese_text, full_line in results[:10]:  # Limit to 10 per file
                            print(f"  Line {line_num}: {chinese_text}")
                        if len(results) > 10:
                            print(f"  ... and {len(results) - 10} more")

if __name__ == '__main__':
    main()
