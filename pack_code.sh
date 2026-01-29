#!/bin/bash

OUTPUT_FILE="app_code_dump.txt"
echo "Generating $OUTPUT_FILE..."

# Clear the output file
> "$OUTPUT_FILE"

# 1. Look inside 'app' folder
# 2. Prune (ignore) 'node_modules' directories entirely
# 3. Find files ending in .ts, .tsx, or .css
find app -type d -name "node_modules" -prune -o -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -print | sort | while read -r file; do
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "FILE: $file" >> "$OUTPUT_FILE"
    echo "================================================================================" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo -e "\n\n" >> "$OUTPUT_FILE"
done

echo "Done! You can now upload '$OUTPUT_FILE'."