const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, 'src/database/migrations/Migration20260823164321.ts');
const outputPath = path.join(__dirname, 'assets/generated.sql');

const source = fs.readFileSync(migrationPath, 'utf8');

const upMatch = source.match(/override up\(\)[^{]*\{([\s\S]*?)override down/);
if (!upMatch) {
  console.error('Could not find up() method in migration file');
  process.exit(1);
}

const upBody = upMatch[1];
const sqlStatements = [];
const addSqlRegex = /this\.addSql\(`((?:\\`|[^`])*)`\)/g;
let match;
while ((match = addSqlRegex.exec(upBody)) !== null) {
  sqlStatements.push(match[1].replace(/\\`/g, '`'));
}

if (sqlStatements.length === 0) {
  console.error('No SQL statements found');
  process.exit(1);
}

fs.writeFileSync(outputPath, sqlStatements.join('\n') + '\n');
console.log(`Written ${sqlStatements.length} SQL statements to ${outputPath}`);
