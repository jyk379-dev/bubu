const CONFIG = {
  SPREADSHEET_ID: '13sSjl2PfFaWduA-WIxROt03sAjJvdvIFxw4T05EJcIM',
  LEDGER_SHEET: '원장',
  SETTINGS_SHEET: '설정',
  HTML_FILE_CANDIDATES: ['Index', 'index'],
  DEFAULT_AUTHOR: '연근',
  DEFAULT_CATEGORIES: [
    '식비', '보험', '카페', '교통', '회비', '쇼핑', '통신',
    '생필품', '관리비', '구독서비스', '마트', '문화', '건강'
  ],
  DEFAULT_INCOME_CATEGORIES: [
    '급여', '상여/보너스', '용돈', '부수입', '이자/배당', '환급/캐시백', '기타수입'
  ],
  DEFAULT_PAYMENT_GROUPS: {
    '카드': ['우리카드'],
    '현금': ['농협체크']
  }
};

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getLedgerSheet_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(CONFIG.LEDGER_SHEET) || ss.getSheets()[0];
}

function getOrCreateSettingsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    sheet.getRange(1, 1, 1, 3).setValues([['type', 'group', 'value']]);
    const initialRows = [];
    CONFIG.DEFAULT_CATEGORIES.forEach(c => initialRows.push(['category', '', c]));
    CONFIG.DEFAULT_INCOME_CATEGORIES.forEach(c => initialRows.push(['incomeCategory', '', c]));
    Object.keys(CONFIG.DEFAULT_PAYMENT_GROUPS).forEach(grp => {
      (CONFIG.DEFAULT_PAYMENT_GROUPS[grp] || []).forEach(sub => {
        initialRows.push(['payment', grp, sub]);
      });
    });
    if (initialRows.length > 0) {
      sheet.getRange(2, 1, initialRows.length, 3).setValues(initialRows);
    }
  }
  return sheet;
}

function renderHtmlApp_() {
  let lastErr = null;
  for (let i = 0; i < CONFIG.HTML_FILE_CANDIDATES.length; i++) {
    const fileName = CONFIG.HTML_FILE_CANDIDATES[i];
    try {
      return HtmlService.createHtmlOutputFromFile(fileName)
        .setTitle('부부 가계부')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error('HTML 파일을 찾을 수 없습니다 (Index 또는 index 확인): ' + (lastErr ? lastErr.message : ''));
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action;

    if (!action || params.view === 'app') {
      return renderHtmlApp_();
    }
    if (action === 'init') {
      return jsonResponse_({
        ok: true,
        data: {
          expenses: getExpenses_(),
          settings: getSettings_()
        }
      });
    }
    if (action === 'list') {
      return jsonResponse_({ ok: true, data: getExpenses_() });
    }
    if (action === 'settings') {
      return jsonResponse_({ ok: true, data: getSettings_() });
    }
    return jsonResponse_({ ok: false, error: '지원하지 않는 GET 요청입니다.' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = body.action || 'add';

    if (action === 'add') {
      return jsonResponse_({ ok: true, data: addExpense_(body.item || {}) });
    }
    if (action === 'update') {
      return jsonResponse_({ ok: true, data: updateExpense_(body.item || {}) });
    }
    if (action === 'delete') {
      return jsonResponse_({ ok: true, data: deleteExpense_(body.id) });
    }
    if (action === 'saveSettings') {
      return jsonResponse_({ ok: true, data: saveSettings_(body.settings || {}) });
    }

    return jsonResponse_({ ok: false, error: '지원하지 않는 작업입니다.' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function getSettings_() {
  const sheet = getOrCreateSettingsSheet_();
  const values = sheet.getDataRange().getValues();
  const categories = [];
  const incomeCategories = [];
  const paymentGroups = { '카드': [], '현금': [] };
  let livingBudget = null;

  for (let i = 1; i < values.length; i++) {
    const type = String(values[i][0] || '').trim();
    const grp = String(values[i][1] || '').trim();
    const rawVal = values[i][2];
    const val = String(rawVal || '').trim();
    if (type === 'livingBudget') {
      const parsedBudget = rawVal === '' || rawVal === null ? NaN : Number(rawVal);
      if (Number.isFinite(parsedBudget) && parsedBudget >= 0) {
        livingBudget = parsedBudget;
      }
      continue;
    }
    if (!val) continue;

    if (type === 'category') {
      if (categories.indexOf(val) === -1) categories.push(val);
    } else if (type === 'incomeCategory') {
      if (incomeCategories.indexOf(val) === -1) incomeCategories.push(val);
    } else if (type === 'payment') {
      const targetGroup = (grp === '현금') ? '현금' : '카드';
      if (paymentGroups[targetGroup].indexOf(val) === -1) {
        paymentGroups[targetGroup].push(val);
      }
    }
  }

  return {
    categories: categories.length > 0 ? categories : CONFIG.DEFAULT_CATEGORIES.slice(),
    incomeCategories: incomeCategories.length > 0 ? incomeCategories : CONFIG.DEFAULT_INCOME_CATEGORIES.slice(),
    paymentGroups: {
      '카드': paymentGroups['카드'].length > 0 ? paymentGroups['카드'] : CONFIG.DEFAULT_PAYMENT_GROUPS['카드'].slice(),
      '현금': paymentGroups['현금'].length > 0 ? paymentGroups['현금'] : CONFIG.DEFAULT_PAYMENT_GROUPS['현금'].slice()
    },
    livingBudget
  };
}

function saveSettings_(settings) {
  const sheet = getOrCreateSettingsSheet_();
  const currentSettings = getSettings_();
  let livingBudget = currentSettings.livingBudget;
  if (Object.prototype.hasOwnProperty.call(settings, 'livingBudget')) {
    const parsedBudget = Number(settings.livingBudget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      throw new Error('생활비 예산은 0원 이상이어야 합니다.');
    }
    livingBudget = parsedBudget;
  }

  const categories = Array.isArray(settings.categories) && settings.categories.length > 0
    ? settings.categories.map(v => String(v).trim()).filter(Boolean)
    : CONFIG.DEFAULT_CATEGORIES.slice();

  const incomeCategories = Array.isArray(settings.incomeCategories) && settings.incomeCategories.length > 0
    ? settings.incomeCategories.map(v => String(v).trim()).filter(Boolean)
    : CONFIG.DEFAULT_INCOME_CATEGORIES.slice();

  const rawGroups = settings.paymentGroups || {};
  const cardList = Array.isArray(rawGroups['카드']) && rawGroups['카드'].length > 0
    ? rawGroups['카드'].map(v => String(v).trim()).filter(Boolean)
    : CONFIG.DEFAULT_PAYMENT_GROUPS['카드'].slice();
  const cashList = Array.isArray(rawGroups['현금']) && rawGroups['현금'].length > 0
    ? rawGroups['현금'].map(v => String(v).trim()).filter(Boolean)
    : CONFIG.DEFAULT_PAYMENT_GROUPS['현금'].slice();

  const rows = [['type', 'group', 'value']];
  categories.forEach(c => rows.push(['category', '', c]));
  incomeCategories.forEach(c => rows.push(['incomeCategory', '', c]));
  cardList.forEach(p => rows.push(['payment', '카드', p]));
  cashList.forEach(p => rows.push(['payment', '현금', p]));
  if (livingBudget !== null) {
    rows.push(['livingBudget', '', livingBudget]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);

  return {
    categories,
    incomeCategories,
    paymentGroups: {
      '카드': cardList,
      '현금': cashList
    },
    livingBudget
  };
}

function getExpenses_() {
  const sheet = getLedgerSheet_();
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    rows.push({
      id: String(r[0]),
      date: formatDate_(r[1]),
      author: String(r[2] || CONFIG.DEFAULT_AUTHOR),
      category: String(r[3] || '기타'),
      merchant: String(r[4] || ''),
      amount: Number(r[5] || 0),
      payment: String(r[6] || ''),
      memo: String(r[7] || '')
    });
  }
  return rows;
}

function addExpense_(item) {
  const sheet = getLedgerSheet_();
  const id = String(Date.now());
  const cleanDate = String(item.date || '').slice(0, 10);
  const amount = Number(item.amount || 0);

  const row = [
    id,
    cleanDate,
    String(item.author || CONFIG.DEFAULT_AUTHOR),
    String(item.category || CONFIG.DEFAULT_CATEGORIES[0]),
    String(item.merchant || ''),
    amount,
    getPaymentValue_(item),
    String(item.memo || '')
  ];

  sheet.appendRow(row);

  return {
    id,
    date: cleanDate,
    author: row[2],
    category: row[3],
    merchant: row[4],
    amount: row[5],
    payment: row[6],
    memo: row[7]
  };
}

function updateExpense_(item) {
  const sheet = getLedgerSheet_();
  const values = sheet.getDataRange().getValues();
  const targetId = String(item.id);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === targetId) {
      const rowNum = i + 1;
      const cleanDate = String(item.date || '').slice(0, 10);
      const amount = Number(item.amount || 0);
      const updated = [
        targetId,
        cleanDate,
        String(item.author || CONFIG.DEFAULT_AUTHOR),
        String(item.category || CONFIG.DEFAULT_CATEGORIES[0]),
        String(item.merchant || ''),
        amount,
        getPaymentValue_(item),
        String(item.memo || '')
      ];
      sheet.getRange(rowNum, 1, 1, 8).setValues([updated]);
      return {
        id: targetId,
        date: cleanDate,
        author: updated[2],
        category: updated[3],
        merchant: updated[4],
        amount: updated[5],
        payment: updated[6],
        memo: updated[7]
      };
    }
  }
  throw new Error('수정할 항목을 찾을 수 없습니다.');
}

function getPaymentValue_(item) {
  const type = String(item.type || '').toLowerCase();
  return type === 'income' || type === '수입'
    ? String(item.payment || '')
    : String(item.payment || '카드');
}

function deleteExpense_(id) {
  const sheet = getLedgerSheet_();
  const values = sheet.getDataRange().getValues();
  const targetId = String(id);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === targetId) {
      sheet.deleteRow(i + 1);
      return { deletedId: targetId };
    }
  }
  throw new Error('삭제할 항목을 찾을 수 없습니다.');
}

function formatDate_(val) {
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val)) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val || '').slice(0, 10);
}