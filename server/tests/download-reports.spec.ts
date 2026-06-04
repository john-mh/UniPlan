import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API = 'http://localhost:3000/api';
const DOWNLOADS = path.resolve(process.cwd(), 'downloads');

async function login(r: any, u: string, p: string) {
  const res = await r.post(`${API}/auth/login`, { data: { username: u, password: p } });
  try { return (await res.json()).accessToken || ''; } catch { return ''; }
}

function saveFile(filename: string, content: Buffer | string) {
  if (!fs.existsSync(DOWNLOADS)) fs.mkdirSync(DOWNLOADS, { recursive: true });
  const filepath = path.join(DOWNLOADS, filename);
  fs.writeFileSync(filepath, content);
  return filepath;
}

test.describe('Report Downloads', () => {
  let AT: string;

  test.beforeAll(async ({ request }) => {
    AT = await login(request, 'admin@uniplan.co', 'Admin1234');
    expect(AT).toBeTruthy();
  });

  test('Download all report CSVs and Excel', async ({ request }) => {
    const csvEndpoints: Array<{ path: string; filename: string }> = [
      { path: '/statistics/dashboard?format=csv', filename: 'dashboard.csv' },
      { path: '/statistics/faculty-by-event-type?format=csv', filename: 'faculty-by-event-type.csv' },
      { path: '/reports/occupancy?format=csv', filename: 'occupancy.csv' },
      { path: '/reports/engagement?format=csv', filename: 'engagement.csv' },
      { path: '/reports/participation?format=csv', filename: 'participation.csv' },
      { path: '/reports/organizer-performance?format=csv', filename: 'organizer-performance.csv' },
      { path: '/reports/trends?format=csv', filename: 'trends.csv' },
    ];

    const h = { Authorization: `Bearer ${AT}` };

    console.log(`\n📁 Download directory: ${DOWNLOADS}\n`);

    for (const { path: ep, filename } of csvEndpoints) {
      const res = await request.get(`${API}${ep}`, { headers: h });
      expect(res.status()).toBe(200);

      const body = await res.body();
      const filepath = saveFile(filename, body);
      console.log(`   ✅ ${filename.padEnd(32)} ${(body.length / 1024).toFixed(1)} KB  → ${filepath}`);
    }

    const xlsxRes = await request.get(`${API}/reports/export/summary`, { headers: h });
    expect(xlsxRes.status()).toBe(200);

    const xlsxBody = await xlsxRes.body();
    const xlsxPath = saveFile('uniplan-summary.xlsx', Buffer.from(xlsxBody));
    console.log(`   ✅ ${'uniplan-summary.xlsx'.padEnd(32)} ${(xlsxBody.length / 1024).toFixed(1)} KB  → ${xlsxPath}`);

    console.log(`\n📊 ${csvEndpoints.length + 1} files downloaded to ${DOWNLOADS}\n`);
  });
});
