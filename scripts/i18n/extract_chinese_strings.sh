#!/bin/bash

echo "=== Extracting Hardcoded Chinese Strings ==="
echo ""

# Find all TypeScript/TSX files with Chinese characters
FILES=$(find src -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v ".test.")

for file in $FILES; do
  # Extract lines with Chinese characters, excluding comments
  CHINESE_LINES=$(grep -n "[\u4e00-\u9fff]" "$file" | grep -v "^[[:space:]]*\/\/" | grep -v "^[[:space:]]*\*")
  
  if [ ! -z "$CHINESE_LINES" ]; then
    echo "📄 $file"
    echo "$CHINESE_LINES" | while IFS= read -r line; do
      # Extract just the Chinese part
      LINE_NUM=$(echo "$line" | cut -d: -f1)
      CONTENT=$(echo "$line" | cut -d: -f2-)
      # Check if it's actually a string literal (not import or type)
      if echo "$CONTENT" | grep -q "[\'\"\`].*[\u4e00-\u9fff].*[\'\"\`]"; then
        echo "  Line $LINE_NUM: $CONTENT"
      fi
    done
    echo ""
  fi
done

echo "=== Extraction Complete ==="
