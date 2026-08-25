/**
 * 代码确认管控表生成脚本（通用版）
 *
 * 纯 Node 实现，零第三方依赖（不依赖 exceljs / npm install）——
 * 可在任何安装 Node 的项目中运行，前端/后端、任何语言的项目均适用。
 *
 * 用法（任选其一）：
 *   1) node generate_code_confirm.cjs <路径1> <路径2> ...       路径作为命令行参数
 *   2) node generate_code_confirm.cjs < 路径列表.txt             路径从 stdin 传入，每行一条
 *   3) node generate_code_confirm.cjs --out-dir <目录> < 路径列表.txt
 *                                                             显式指定输出目录（跨项目/无工程根目录时用）
 *
 * 输出位置解析顺序：
 *   1. --out-dir 参数（或环境变量 CODE_CONFIRM_OUT_DIR）
 *   2. 当前 git 仓库根目录（git rev-parse --show-toplevel）
 *   3. 从当前目录向上找最近的工程标记目录（package.json / pom.xml / go.mod / Cargo.toml / ...）
 *   4. 以上都没有 → 输出 "NO_PROJECT_ROOT"，退出码 2，由调用方（Claude）询问用户保存位置
 *
 * 规则（与《代码确认管控》表格口径一致，均在下方 CONFIG 中可配置）：
 *   - 每个路径取前 N 条 git history（默认 3 条）
 *   - 前 N 条中有匹配 ticketPattern 的 commit，取最新那条，只提取编号（多条用顿号连接）
 *   - 前 N 条没有，取最新一次提交的完整 message
 *   - 提交人按 authorMap 规范化（默认 ly-pengjun -> 彭君）
 *   - 项目经理默认 defaultPM；确认日期为运行当天 yyyy/mm/dd
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ====================== 可配置常量（跨项目使用请按需修改此处） ======================
const CONFIG = {
  // 需求/TB/磐石问题号匹配规则。通用版默认仍匹配 NIPTV-xxxx；其它系统改成正则即可
  ticketPattern: /NIPTV-\d+/i,
  // 提交人名称规范化映射：git 作者名 -> 展示名（可增删）
  authorMap: { 'ly-pengjun': '彭君' },
  // 项目经理默认值
  defaultPM: '詹朝生',
  // 模块测试组长/测试主担默认值（默认空）
  defaultTestLead: '',
  // "是否属于当前版本"默认值
  defaultInCurrentVersion: '是',
  // 每个路径取的 git history 条数
  historyLimit: 3,
  // 输出文件名前缀（最终文件：<fileBase>_yyyyMMdd.xlsx）
  fileBase: '代码确认管控',
  // 表头列
  headers: [
    '路径',
    '是否属于当前版本',
    '代码对应的需求编号或磐石问题号或TB号(或增加改动原因）',
    '项目经理',
    '模块版本管控人',
    '模块测试组长/测试主担',
    '差异确认人',
    '确认日期'
  ],
  // 列宽
  colWidths: [85, 16, 70, 12, 14, 18, 12, 14]
};

// ====================== 纯 Node 最小 XLSX 生成器 ======================
// （无第三方依赖：直接手写 OOXML 包并用 zlib 打包为 zip，即 .xlsx）

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 打包 zip（xlsx 本质是 zip）。entries: [{ name, data: Buffer }]
function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff) || 0;
  const dosDate = ((((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff) || 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const comp = zlib.deflateRawSync(e.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 flag
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }

  const centralSize = central.reduce((a, b) => a + b.length, 0);
  chunks.push(...central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  chunks.push(eocd);
  return Buffer.concat(chunks);
}

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// rows: 二维数组（第一行为表头），colWidths 可选，boldHeaderRow 可选
function buildXlsx(sheetName, rows, colWidths, boldHeaderRow) {
  const headerStyle = boldHeaderRow ? ' s="1"' : '';
  let sheetData = '';
  rows.forEach((row, ri) => {
    const rn = ri + 1;
    let cells = '';
    row.forEach((val, ci) => {
      const ref = colLetter(ci) + rn;
      const style = ri === 0 && boldHeaderRow ? ' s="1"' : '';
      cells += `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`;
    });
    sheetData += `<row r="${rn}">${cells}</row>`;
  });

  let colsXml = '';
  if (colWidths && colWidths.length) {
    colsXml = '<cols>' + colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
  }
  const freeze = rows.length ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '';

  const sheetXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews>` +
    colsXml +
    `<sheetData>${sheetData}</sheetData></worksheet>`;

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const wbRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const coreXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:creator>ly-code-confirm skill</dc:creator>' +
    '<cp:lastModifiedBy>ly-code-confirm skill</cp:lastModifiedBy>' +
    '</cp:coreProperties>';

  const appXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>ly-code-confirm skill</Application>' +
    `<AppVersion>1.0</AppVersion></Properties>`;

  return makeZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'docProps/core.xml', data: Buffer.from(coreXml, 'utf8') },
    { name: 'docProps/app.xml', data: Buffer.from(appXml, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(stylesXml, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml, 'utf8') }
  ]);
}

// ====================== 工具函数 ======================

// 解析 --out-dir 参数，其余作为路径
function parseArgs(argv) {
  let outDir = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir') outDir = argv[++i];
    else if (argv[i].startsWith('--out-dir=')) outDir = argv[i].slice('--out-dir='.length);
    else rest.push(argv[i]);
  }
  return { outDir, paths: rest };
}

// 输出目录解析：--out-dir/环境变量 -> git 根 -> 最近的工程标记目录 -> null
function detectProjectRoot() {
  try {
    const r = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (r) return r;
  } catch (e) { /* 不在 git 仓库中，继续向下检测 */ }
  const markers = [
    'package.json', 'pom.xml', 'build.gradle', 'settings.gradle',
    'go.mod', 'Cargo.toml', 'pyproject.toml', 'setup.py', 'requirements.txt'
  ];
  let dir = process.cwd();
  const root = path.parse(dir).root;
  for (;;) {
    for (const m of markers) {
      if (fs.existsSync(path.join(dir, m))) return dir;
    }
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

function normalizeAuthor(name) {
  return CONFIG.authorMap[name] || name;
}

// 取前 N 条 history（N=CONFIG.historyLimit）；无 git 或路径不存在时返回 []
function getHistory(file, cwd) {
  try {
    const out = execSync(
      `git log -${CONFIG.historyLimit} --format="%H|%an|%ae|%s" -- "${file}"`,
      { cwd, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    if (!out) return [];
    return out.split('\n').map((line) => {
      const i1 = line.indexOf('|');
      const hash = line.slice(0, i1);
      const rest = line.slice(i1 + 1);
      const i2 = rest.indexOf('|');
      const author = rest.slice(0, i2);
      const rest2 = rest.slice(i2 + 1);
      const i3 = rest2.indexOf('|');
      const email = rest2.slice(0, i3);
      const message = rest2.slice(i3 + 1);
      return { hash, author, email, message };
    });
  } catch (e) {
    return [];
  }
}

// 需求编号规则：前 N 条有 ticketPattern 命中则取（最新那条）只提取编号（多条顿号连接）；否则取最新完整 message
function pickRequirement(history) {
  if (!history.length) return { value: '', author: '' };
  const hit = history.find((c) => CONFIG.ticketPattern.test(c.message));
  if (hit) {
    const codes = hit.message.match(/NIPTV-\d+/gi) || [];
    return { value: codes.join('、'), author: normalizeAuthor(hit.author) };
  }
  return { value: history[0].message, author: normalizeAuthor(history[0].author) };
}

// ====================== 主流程 ======================
function main() {
  const { outDir: outDirArg, paths: argPaths } = parseArgs(process.argv.slice(2));

  // 收集路径：参数 -> stdin（每行一条）
  let FILES = argPaths;
  if (!FILES.length) {
    FILES = fs.readFileSync(0, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  if (!FILES.length) {
    console.error('错误: 未提供任何组件路径。请通过命令行参数或 stdin 传入路径列表（每行一条）。');
    process.exit(1);
  }

  // 项目根（git log 工作目录）与输出目录分开解析：
  // git log 必须在项目根执行，否则非 git 的输出目录会导致 history 全空
  const projectRoot = detectProjectRoot();
  const gitCwd = projectRoot || process.cwd();

  let outDir = outDirArg || process.env.CODE_CONFIRM_OUT_DIR || projectRoot;
  if (!outDir) {
    console.error('NO_PROJECT_ROOT');
    console.error('无法检测到当前项目根目录（非 git 仓库，也未找到 package.json/pom.xml 等工程标记）。');
    console.error('请通过 --out-dir <目录> 指定输出位置。');
    process.exit(2);
  }
  outDir = path.resolve(outDir);
  if (!fs.existsSync(outDir)) {
    console.error('错误: 指定的输出目录不存在: ' + outDir);
    process.exit(1);
  }

  // 逐路径查 history、组行
  const TODAY = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const DATE_STR = `${TODAY.getFullYear()}/${pad(TODAY.getMonth() + 1)}/${pad(TODAY.getDate())}`;

  const rows = [[...CONFIG.headers]];
  let noHistory = 0;
  for (const file of FILES) {
    const history = getHistory(file, gitCwd);
    if (!history.length) noHistory++;
    const chosen = pickRequirement(history);
    rows.push([
      file,
      CONFIG.defaultInCurrentVersion,
      chosen.value,
      CONFIG.defaultPM,
      chosen.author,
      CONFIG.defaultTestLead,
      chosen.author, // 差异确认人与模块版本管控人一致
      DATE_STR
    ]);
  }

  // 文件名 + EBUSY 重试
  const y = TODAY.getFullYear();
  const m = pad(TODAY.getMonth() + 1);
  const d = pad(TODAY.getDate());
  const baseName = `${CONFIG.fileBase}_${y}${m}${d}.xlsx`;

  const xlsxBuf = buildXlsx(CONFIG.fileBase, rows, CONFIG.colWidths, true);

  let outPath = path.join(outDir, baseName);
  let written = false;
  for (let i = 2; i <= 10 && !written; i++) {
    try {
      fs.writeFileSync(outPath, xlsxBuf);
      written = true;
    } catch (e) {
      if (e && e.code === 'EBUSY') {
        outPath = path.join(outDir, `${CONFIG.fileBase}_${y}${m}${d}_v${i}.xlsx`);
      } else {
        throw e;
      }
    }
  }
  if (!written) {
    console.error(`错误: 无法写入文件（可能被 Excel 占用），请关闭已打开的 ${baseName} 后重试`);
    process.exit(1);
  }

  console.log(`Total: ${rows.length - 1}, with empty history: ${noHistory}`);
  console.log(`Written: ${outPath}`);
}

main();
