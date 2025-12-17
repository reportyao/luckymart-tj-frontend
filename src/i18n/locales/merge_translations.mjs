import fs from 'fs';

const newKeys = JSON.parse(fs.readFileSync('new_keys.json', 'utf8'));

['zh', 'ru', 'tg'].forEach(lang => {
  const filename = `${lang}.json`;
  const existing = JSON.parse(fs.readFileSync(filename, 'utf8'));
  
  // Merge new keys
  const merged = {
    ...existing,
    ...newKeys[lang],
    // Preserve any existing keys that might be newer
    ...existing
  };
  
  // Write back
  fs.writeFileSync(filename, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`✅ Updated ${filename}`);
});

console.log('\nAll translation files updated!');
