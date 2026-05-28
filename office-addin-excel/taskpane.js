/* global Office, Excel */

const logEl = () => document.getElementById('log');

function log(message) {
  const now = new Date().toLocaleTimeString();
  logEl().textContent = `[${now}] ${message}\n` + logEl().textContent;
}

function scoreRow(record) {
  const readiness = String(record.readiness || '').toLowerCase();
  const missing = Number(record.missingItems || 0) || 0;
  let base = 55;
  if (readiness === 'ready') base = 15;
  if (readiness === 'conditional') base = 60;
  if (readiness === 'disqualified') base = 95;
  if (readiness === 'pending' || readiness === 'intake') base = 75;

  const laneBump = String(record.lane || '').toLowerCase() === 'both' ? 10 : 0;
  const score = Math.max(0, Math.min(100, Math.round(base + (missing * 8) + laneBump)));

  let action = 'Maintain cadence';
  if (score >= 80) action = 'Escalate and clear blockers today';
  else if (score >= 60) action = 'Prioritize next follow-up';
  else if (score >= 40) action = 'Advance packet quality this week';
  else if (readiness === 'ready') action = 'Move to underwriter handoff';

  return { score, action };
}

async function readSelectedRows() {
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load(['address', 'values']);
    await context.sync();

    const values = range.values || [];
    if (!values.length) return { address: range.address, rows: [] };

    const rows = values.slice(1).map((cells, idx) => ({
      rowIndex: idx + 2,
      submissionId: cells[0] || '',
      company: cells[1] || '',
      lane: cells[2] || '',
      missingItems: cells[3] || 0,
      readiness: cells[4] || '',
      owner: cells[5] || '',
      nextFollowUp: cells[6] || '',
      notes: cells[7] || '',
    }));

    return { address: range.address, rows };
  });
}

async function scoreAndWriteBack() {
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load(['rowIndex', 'columnIndex', 'rowCount', 'values']);
    await context.sync();

    const values = range.values || [];
    if (values.length < 2) {
      throw new Error('Select header + at least one data row before write-back.');
    }

    const scored = values.slice(1).map((cells) => {
      const record = {
        lane: cells[2],
        missingItems: cells[3],
        readiness: cells[4],
      };
      const { score, action } = scoreRow(record);
      return [score, action];
    });

    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const startRow = range.rowIndex + 1; // skip header row
    const writeCol = range.columnIndex + 8; // write to cols immediately right of "Notes"
    const writeRange = sheet.getRangeByIndexes(startRow, writeCol, scored.length, 2);
    writeRange.values = scored;

    const headerRange = sheet.getRangeByIndexes(range.rowIndex, writeCol, 1, 2);
    headerRange.values = [['Priority Score', 'Recommended Action']];

    await context.sync();
    return scored.length;
  });
}

Office.onReady(() => {
  const readBtn = document.getElementById('readSelection');
  const writeBtn = document.getElementById('scoreAndWrite');

  readBtn.addEventListener('click', async () => {
    try {
      const { address, rows } = await readSelectedRows();
      log(`Selection ${address} loaded: ${rows.length} data row(s).`);
      if (rows[0]) {
        log(`Top row: ${rows[0].submissionId || 'N/A'} | ${rows[0].company || 'N/A'}`);
      }
    } catch (err) {
      log(`Read failed: ${err.message}`);
    }
  });

  writeBtn.addEventListener('click', async () => {
    try {
      const count = await scoreAndWriteBack();
      log(`Scored + wrote back ${count} row(s).`);
    } catch (err) {
      log(`Write-back failed: ${err.message}`);
    }
  });
});
