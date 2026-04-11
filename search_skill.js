const fs = require('fs');
const content = fs.readFileSync('/skills/system_skills/gemini_api/SKILL.md', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('gemini-2.0-flash-exp')) {
    console.log(`Line ${i+1}: ${lines[i]}`);
  }
}
