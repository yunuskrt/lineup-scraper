---
name: research
description: Run a research task to generate documentation
argument-hint: <prompt-name>
---

## Task

Execute research task: $ARGUMENTS

---

### Instructions

1. If no argument provided, error: "Usage: /research <prompt-name>"
2. Look for prompt file at `context/research/{$ARGUMENTS}.md`
3. If not found, error: "Prompt file not found at context/research/{$ARGUMENTS}.md"
4. Read the prompt file which should contain:
   - **Output**: Where to write results (e.g., `context/docs/source-trial.md`)
   - **Research**: What to investigate
   - **Include**: Specific details to capture
   - **Sources**: What files/tools to use
5. Execute the research using appropriate tools:
   - Read files (the schema copy, `context/docs/data-contract.md`, saved source pages)
   - Read a source's terms of use and `robots.txt` before looking at its data pages
   - Fetch only a handful of pages by hand, slowly; never crawl
   - Query database via Neon MCP if needed (read-only)
   - Search codebase for patterns
6. Write findings to the specified output location
7. Summarize what was discovered

---

### Rules

- This command produces DOCUMENTATION only
- Do NOT modify source code files
- Do NOT create branches or commits
- Never use an LLM's own knowledge as data: every lineup, date or name in a report cites the page it came from
- Output should go to `context/docs/` unless otherwise specified
- Use subagents for thorough exploration if needed
