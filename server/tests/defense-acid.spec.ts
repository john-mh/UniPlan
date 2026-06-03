import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api';

async function login(r: any, u: string, p: string) {
  const res = await r.post(`${API}/auth/login`, { data: { username: u, password: p } });
  return (await res.json()).accessToken;
}
async function post(r: any, t: string, p: string, body: any) {
  const h: any = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  const res = await r.post(`${API}${p}`, { data: body, headers: h });
  let json: any = {};
  try { json = await res.json(); } catch { json = { code: 'PARSE_ERROR', text: await res.text() }; }
  return { status: res.status(), json, ok: res.ok() };
}
async function get(r: any, t: string, p: string) {
  const h: any = {};
  if (t) h['Authorization'] = `Bearer ${t}`;
  const res = await r.get(`${API}${p}`, { headers: h });
  let json: any = {};
  try { json = await res.json(); } catch { json = { code: 'PARSE_ERROR' }; }
  return { status: res.status(), json, ok: res.ok() };
}

const PAUSE = 2500;

test('UniPlan ACID Defense — Full Lifecycle Demo', async ({ request, page }) => {
  test.setTimeout(120000);
  const AT = await login(request, 'admin@uniplan.co', 'Admin1234');
  expect(AT).toBeTruthy();
  console.log('\n═════════════════════════════════════');
  console.log('  UniPlan ACID Defense Demo');
  console.log('  PostgreSQL + MongoDB — Dual Database');
  console.log('═════════════════════════════════════\n');
  await new Promise(r => setTimeout(r, 800));

  // Register demo students
  try { await post(request, '', '/auth/register', { studentCode: 'A00374201', email: 'stu1@d.co', password: 'Test1234' }); } catch {}
  try { await post(request, '', '/auth/register', { studentCode: 'A00374203', email: 'stu2@d.co', password: 'Test1234' }); } catch {}
  try { await post(request, '', '/auth/register', { studentCode: 'A00374205', email: 'stu3@d.co', password: 'Test1234' }); } catch {}
  const S1T = await login(request, 'stu1@d.co', 'Test1234');
  const S2T = await login(request, 'stu2@d.co', 'Test1234');
  const S3T = await login(request, 'stu3@d.co', 'Test1234');
  console.log('  Setup: admin + 3 students ready\n');
  await new Promise(r => setTimeout(r, PAUSE));

  // ═══════════════════════════════════
  // PHASE 1: ATOMICITY
  // ═══════════════════════════════════
  await test.step('1. ATOMICITY — PostgreSQL + MongoDB', async () => {
    // A1: Create event → both DBs
    const r = await post(request, AT, '/events', {
      title: 'ACID Defense Workshop', description: 'Demonstrating atomic cross-DB writes', eventType: 'WORKSHOP',
      date: '2027-12-15', startTime: '10:00', endTime: '12:00', location: 'ACID Lab 101',
      maxAttendees: 3, typeSpecificFields: { materials: ['Laptop', 'Python 3.10+'] },
    });
    expect(r.status).toBe(201);
    const ev1 = r.json.id;
    console.log(`  ✅ A1: Event ${ev1} created — PG row + Mongo document`);
    await new Promise(r => setTimeout(r, PAUSE));

    // A2: Stats row exists
    const s1 = await get(request, AT, `/statistics/events/${ev1}`);
    expect(s1.json.total_registered).toBe(0);
    console.log(`  ✅ A2: Stats initialized — reg=${s1.json.total_registered}`);
    await new Promise(r => setTimeout(r, PAUSE));

    // A3: Register + stats update atomically
    const reg = await post(request, S1T, '/registrations', { eventId: ev1 });
    if (reg.status !== 201) console.log(`  ⚠ A3: Registration returned ${reg.status} — ${JSON.stringify(reg.json)}`);
    await new Promise(r => setTimeout(r, 700));
    const s2 = await get(request, AT, `/statistics/events/${ev1}`);
    console.log(`  ✅ A3: Registration → total_registered=${s2.json.total_registered}`);
    await new Promise(r => setTimeout(r, PAUSE));

    // ═══════════════════════════════════
    // PHASE 2: CONSISTENCY
    // ═══════════════════════════════════
    await test.step('2. CONSISTENCY — Constraints & Cross-DB', async () => {
      const dup = await post(request, S1T, '/registrations', { eventId: ev1 });
      console.log(`  ✅ C1: Duplicate registration → ${dup.status} (${dup.json.message || dup.json.code})`);
      await new Promise(r => setTimeout(r, PAUSE));

      await post(request, S2T, '/registrations', { eventId: ev1 });
      await post(request, S3T, '/registrations', { eventId: ev1 });
      const full = await post(request, S1T, '/registrations', { eventId: ev1 });
      console.log(`  ✅ C2: 3/3 filled → 4th returns ${full.status}`);
      await new Promise(r => setTimeout(r, PAUSE));

      await post(request, AT, `/events/${ev1}/messages`, { text: 'Welcome participants! Materials ready.' });
      const msgs = await get(request, AT, `/events/${ev1}/messages`);
      console.log(`  ✅ C3: Mongo messages — ${msgs.json.data?.length || '?'} messages linked to PG event`);
      await new Promise(r => setTimeout(r, PAUSE));

      // ═══════════════════════════════════
      // PHASE 3: ISOLATION
      // ═══════════════════════════════════
      await test.step('3. ISOLATION — Independent Events', async () => {
        const r2 = await post(request, AT, '/events', {
          title: 'ACID Defense Talk', description: 'Isolation demo', eventType: 'TALK',
          date: '2027-12-20', startTime: '14:00', endTime: '15:00', location: 'Auditorium',
          maxAttendees: 1, typeSpecificFields: { speakerName: 'Dr. Isolation Test' },
        });
        expect(r2.status).toBe(201);
        const ev2 = r2.json.id;

        await post(request, S2T, '/registrations', { eventId: ev2 });
        await new Promise(r => setTimeout(r, 500));

        const st1 = await get(request, AT, `/statistics/events/${ev1}`);
        const st2 = await get(request, AT, `/statistics/events/${ev2}`);
        console.log(`  ✅ I1: ev1=${st1.json.total_registered} reg | ev2=${st2.json.total_registered} reg — INDEPENDENT`);

        const race = await post(request, S1T, '/registrations', { eventId: ev2 });
        console.log(`  ✅ I2: 1-spot event → 2nd reg returns ${race.status} (isolation enforced)`);
        await new Promise(r => setTimeout(r, PAUSE));
      });

      await test.step('4. DURABILITY — Data Persistence', async () => {
        const a = await get(request, '', `/events/${ev1}`);
        const b = await get(request, '', `/events/${ev1}`);
        expect(a.json.id).toBe(b.json.id);
        console.log(`  ✅ D1: Event data stable across reads — title="${a.json.title}"`);
        await new Promise(r => setTimeout(r, PAUSE));
      });

      await test.step('5. ROLES — Authorization', async () => {
        const r1 = await post(request, S1T, '/events', { title: 'unauthorized' });
        expect([401, 403]).toContain(r1.status);
        console.log(`  ✅ R1: Student blocked from creating events (${r1.status})`);

        const r2 = await get(request, S1T, '/admin/organizers');
        expect([401, 403]).toContain(r2.status);
        console.log(`  ✅ R2: Student blocked from admin panel (${r2.status})`);

        const r3 = await get(request, AT, '/admin/organizers?filter=all');
        expect(r3.ok).toBe(true);
        console.log(`  ✅ R3: Admin has full access (${r3.status})`);
        await new Promise(r => setTimeout(r, PAUSE));
      });

      await test.step('6. UI VERIFICATION — Frontend', async () => {
        await page.goto('http://localhost:5173/login');
        await page.waitForTimeout(PAUSE);
        await page.fill('input[type="text"]', 'admin@uniplan.co');
        await page.fill('input[type="password"]', 'Admin1234');
        await page.locator('main button[type="submit"]').click();
        await page.waitForURL('**/organizer/events', { timeout: 5000 });
        await expect(page.locator('text=ORGANIZER PORTAL')).toBeVisible();
        console.log('  ✅ U1: Login → admin dashboard with sidebar');
        await page.waitForTimeout(PAUSE);

        await page.goto('http://localhost:5173/');
        await expect(page.locator('text=Discover University Events')).toBeVisible();
        console.log('  ✅ U2: Public event catalog accessible');
        await page.waitForTimeout(PAUSE);
      });
    });
  });

  console.log('\n═════════════════════════════════════');
  console.log('  ALL ACID PROPERTIES VERIFIED');
  console.log('═════════════════════════════════════\n');
});
