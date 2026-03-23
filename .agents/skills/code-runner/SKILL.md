---
name: code-runner
description: Write and execute code in any language. Use when the user asks to run, test, or execute a script, or wants to see live code output.
---

# Code Runner

When the user asks to run, test, or execute code:

1. Write the code to a temp file using bash:
   - Python: `cat > /tmp/script.py << 'EOF'\n...\nEOF`
   - JavaScript: `cat > /tmp/script.js << 'EOF'\n...\nEOF`
   - Bash: write to `/tmp/script.sh` and `chmod +x`

2. Execute with the appropriate runtime:
   - Python: `python3 /tmp/script.py`
   - JavaScript/Node.js: `node /tmp/script.js`
   - TypeScript: `npx ts-node /tmp/script.ts` (if available) or compile first
   - Bash: `bash /tmp/script.sh`
   - Ruby: `ruby /tmp/script.rb`

3. Show output and explain errors clearly.

4. Clean up after: `rm /tmp/script.*`

## Tips

- If a runtime isn't available, say so and offer to use a different language.
- For interactive scripts, adapt them to be non-interactive (e.g. use hardcoded input).
- If the user wants to iterate on code, re-write the full file each time rather than patching.
