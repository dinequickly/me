---
name: file-explorer
description: Browse, search, and read files on the user's computer. Use when the user asks to list, find, open, inspect, or explore files and directories.
---

# File Explorer

When the user asks to explore the filesystem:

## Listing directories
```bash
ls -la <path>
```
Use `ls -lah` for human-readable sizes. Use `tree <path> -L 2` to show structure (if available).

## Finding files
```bash
find <path> -name "*.ext" -type f
find <path> -name "filename" 2>/dev/null
```

## Reading files
Use the `readFile` tool for file contents. For large files, use bash to read a portion:
```bash
head -50 <path>
tail -50 <path>
wc -l <path>
```

## Searching inside files
```bash
grep -r "pattern" <path> --include="*.ext"
grep -n "pattern" <file>
```

## Tips

- Always resolve `~` to the home directory before using bash.
- Show file sizes and modification dates when listing.
- For large files, read the first 100 lines and ask if they want more.
- Summarise directory structure clearly — don't dump raw output.
