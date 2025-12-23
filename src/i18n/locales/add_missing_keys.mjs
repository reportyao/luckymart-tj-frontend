import fs from 'fs';

const additionalKeys = {
  zh: {
    common: {
      ...JSON.parse(fs.readFileSync('zh.json', 'utf8')).common,
      unknown: "未知"
    },
    invite: {
      linkCopied: "邀请链接已复制到剪贴板",
      codeCopied: "邀请码已复制到剪贴板"
    }
  },
  ru: {
    common: {
      ...JSON.parse(fs.readFileSync('ru.json', 'utf8')).common,
      unknown: "Неизвестно"
    },
    invite: {
      linkCopied: "Ссылка скопирована в буфер обмена",
      codeCopied: "Код приглашения скопирован"
    }
  },
  tg: {
    common: {
      ...JSON.parse(fs.readFileSync('tg.json', 'utf8')).common,
      unknown: "Номаълум"
    },
    invite: {
      linkCopied: "Пайванд дар буфери мубодила нусхабардорӣ шуд",
      codeCopied: "Коди даъват нусхабардорӣ шуд"
    }
  }
};

['zh', 'ru', 'tg'].forEach(lang => {
  const filename = `${lang}.json`;
  const existing = JSON.parse(fs.readFileSync(filename, 'utf8'));
  
  const updated = {
    ...existing,
    common: additionalKeys[lang].common,
    invite: {
      ...(existing.invite || {}),
      ...additionalKeys[lang].invite
    }
  };
  
  fs.writeFileSync(filename, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`✅ Updated ${filename} with missing keys`);
});

console.log('\n✅ All translation files updated!');
