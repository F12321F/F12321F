// 使用已擷取的真實網站畫面製作文件；不產生或偽造資料庫成功畫面。
const fs = require('node:fs');
const path = require('node:path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, PageBreak } = require('docx');
const pptxgen = require('pptxgenjs');
const root = path.join(__dirname, '..', '文件');
const p = text => new Paragraph({ children: Array.from(text.matchAll(/.{1,30}/gu), (m, i) => new TextRun({text:m[0], break:i ? 1 : 0, font:{ascii:'Noto Sans CJK TC',hAnsi:'Noto Sans CJK TC',eastAsia:'Noto Sans CJK TC'}, language:{value:'zh-TW',eastAsia:'zh-TW'}})), spacing: { after: 130 } });
const h = text => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const picture = (file, width, height) => new Paragraph({ children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(root, 'screenshots', file)), transformation: { width, height } })] });
async function main() {
  const doc = new Document({ styles: { default: { document: { run: { font: 'Noto Sans CJK TC', size: 22 }, paragraph: { spacing: { line: 300 } } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: [
    new Paragraph({ text: '報修系統操作說明', heading: HeadingLevel.TITLE }),
    p('目前版本：前端與本機驗證完成；遠端 Supabase、Pages 與手機實際送出尚待驗收。'),
    h('1. 登記報修'),
    p('開啟網站後填寫報修人、地點或部門、類別、問題說明、緊急程度。所有欄位必填；請使用虛構資料，不輸入密碼或私人資訊。'),
    p('按「送出報修」。正常連線且資料庫設定完成時，應出現成功訊息、清空表單並更新清單。送出失敗會保留輸入；先確認訊息再重試，避免重複登記。'),
    picture('填寫表單.png', 540, 344),
    p('圖 1（第 1 頁）：實際網頁填寫畫面。示範內容尚未送出，不代表遠端新增成功。'),
    new Paragraph({ children: [new PageBreak()] }),
    h('2. 查看與篩選清單'),
    p('最近報修顯示最新 20 筆；包含地點、說明、報修人、類別、緊急程度、處理狀態及登記時間。按全部／高／中／低，只篩選已載入的 20 筆；高緊急標籤為紅色。'),
    picture('報修清單.png', 540, 139),
    p('圖 2（第 2 頁）：實際清單區。當前雲端網路阻擋 Supabase，所以顯示載入失敗；這不等於資料庫沒有報修紀錄。連線恢復後按「重新整理」。'),
    h('3. 資料安全與功能範圍'),
    p('資料庫設計只允許公開角色讀取及新增五個欄位；狀態預設為待處理。GRANT、RLS、CHECK 限制操作與內容，因此網頁沒有修改、刪除功能。遠端套用結果尚待確認。'),
    p('目前沒有登入、通知、編輯狀態、負責人或照片上傳。公開訪客可讀清單，只適合虛構或去識別資料；公開金鑰不等於後台管理權限。'),
    p('手機測試與正式 Pages 網址須待部署完成；詳見 README 與「設置檢討與驗收」。')
  ] }] });
  fs.writeFileSync(path.join(root, '報修系統操作說明.docx'), await Packer.toBuffer(doc));
  const deck = new pptxgen(); deck.layout = 'LAYOUT_WIDE'; deck.author = '報修專案'; deck.subject = '教材任務 39'; deck.title = '報修登記系統提案'; deck.lang = 'zh-TW';
  deck.theme = { headFontFace: 'Noto Sans CJK TC', bodyFontFace: 'Noto Sans CJK TC', lang: 'zh-TW' };
  const slides = [
    ['問題', '報修資訊需要集中保存', ['口頭或訊息報修容易漏接、缺少一致紀錄。','設備、網路、環境等問題需要共同入口。','此作品使用虛構示範資料，不列真實客戶資訊。']],
    ['目標', '建立可新增、可查閱的報修網站', ['純 HTML / CSS / JavaScript，手機可操作。','資料由 Supabase 保存；以 GitHub Pages 提供固定網址。','驗收目標：手機新增後，電腦可讀回同一筆。']],
    ['已實作功能', '表單、最近清單與緊急程度篩選', ['五欄表單、成功與錯誤提示、失敗保留輸入。','最近 20 筆、資料庫處理狀態與時間。','全部／高／中／低篩選，不額外查詢資料庫。','前端模擬 API 測試通過；遠端成功驗收尚未完成。']],
    ['資料安全', 'GRANT、RLS、CHECK 三層保護', ['GRANT：公開角色只能讀取及新增指定欄位。','RLS：新增狀態必須為待處理。','CHECK：限制類別、緊急程度、文字長度與空白。','本機 SQL 驗證通過；遠端政策仍待確認。']],
    ['尚待確認', '上線前的實際阻礙', ['雲端代理目前阻擋 Supabase 與 GitHub 管理 API。','遠端 SQL 套用狀態、Pages 啟用與部署待確認。','登入、通知、管理流程與防垃圾新增尚未提供。','正式使用的資料隱私、預算與時程：待確認。']],
    ['下一步', '完成遠端與跨裝置驗收', ['環境擁有者放行必要網域，確認 Supabase 後台設定。','公開金鑰正常新增，四項負向測試各一次。','審查 PR 後合併、部署 Pages。','手機與電腦新增讀回，更新成功截圖及驗收紀錄。']]
  ];
  slides.forEach(([eyebrow,title,items],i)=>{const s=deck.addSlide();s.background={color:'F5F7F5'};s.addShape(deck.ShapeType.rect,{x:0,y:0,w:.22,h:7.5,fill:{color:'176B5B'},line:{color:'176B5B'}});s.addText(eyebrow,{x:.7,y:.6,w:11,h:.3,fontSize:14,color:'176B5B',bold:true});s.addText(title,{x:.7,y:1.2,w:11.8,h:.9,fontSize:28,bold:true,color:'233D3A'});items.forEach((t,j)=>s.addText(t,{x:.9,y:2.6+j*.85,w:11.5,h:.65,fontSize:20,color:'344E46',breakLine:false,bullet:{indent:16}}));s.addText('報修登記系統 · 教材作品 / 遠端驗收待完成',{x:.7,y:7,w:10,h:.2,fontSize:10,color:'657672'});s.addText(String(i+1).padStart(2,'0'),{x:12,y:7,w:.5,h:.2,fontSize:10,color:'176B5B'});});
  await deck.writeFile({ fileName: path.join(root,'報修登記系統提案.pptx') });
  console.log('已產生含真實畫面的 Word 與六頁提案。');
}
main().catch(error=>{console.error(error);process.exit(1)});
