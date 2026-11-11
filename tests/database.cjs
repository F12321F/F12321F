const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const schema = fs.readFileSync(require('node:path').join(__dirname, '../supabase/schema.sql'), 'utf8');
  await db.exec(schema);
  await db.exec("SET ROLE anon; INSERT INTO public.repair_requests (reporter_name,location,category,description,urgency) VALUES ('測試同事','示範區','設備','虛構測試','高'); RESET ROLE;");
  await db.exec(schema); // 可重複套用且保留資料。
  let rows = await db.query('SELECT * FROM public.repair_requests');
  assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].status, '待處理'); assert(rows.rows[0].created_at);
  await db.exec('SET ROLE anon');
  assert.equal((await db.query('SELECT * FROM public.repair_requests')).rows.length, 1);
  const tests = [
    ["INSERT INTO public.repair_requests (reporter_name,location,category,description,urgency,status) VALUES ('測試','示範','設備','測試','中','已完成')", '42501', 'GRANT: status'],
    ["INSERT INTO public.repair_requests (reporter_name,location,category,description,urgency) VALUES ('測試','示範','亂寫','測試','中')", '23514', 'CHECK: category'],
    ["UPDATE public.repair_requests SET reporter_name='別人'", '42501', 'GRANT: UPDATE'],
    ['DELETE FROM public.repair_requests', '42501', 'GRANT: DELETE'],
    ["INSERT INTO public.repair_requests (reporter_name,location,category,description) VALUES ('  ','示範','設備','測試')", '23514', 'CHECK: whitespace']
  ];
  for (const [sql, code, label] of tests) {
    await assert.rejects(db.exec(sql), error => error.code === code);
    console.log('PASS ' + label + ' / ' + code);
  }
  await db.exec('RESET ROLE; BEGIN; GRANT INSERT(status) ON public.repair_requests TO anon; SET ROLE anon;');
  await assert.rejects(db.exec(tests[0][0]), error => error.code === '42501' && /row-level security/.test(error.message));
  await db.exec('ROLLBACK');
  console.log('PASS RLS: relaxed column grant still rejects completed status (rolled back)');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.repair_requests')).rows[0].n, 1);
  console.log('PASS defaults, SELECT, repeatable schema, existing record preserved');
  await db.close();
})().catch(error => { console.error(error); process.exit(1); });
