import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

let request: supertest.SuperTest<supertest.Test>;
const TOKEN: Record<string, string> = {};
let eventId = 0;
let regId = 0;

async function sql(sql: string, ...params: unknown[]) {
  const { prisma } = await import('../src/app.js');
  return prisma.$executeRawUnsafe(sql, ...params);
}

async function cleanup() {
  const { prisma } = await import('../src/app.js');
  const { EventDetail } = await import('../src/models/mongodb/EventDetail.js');

  await prisma.$executeRawUnsafe(`DELETE FROM public.uniplan_registrations WHERE student_id IN ('A00374201','A00374202')`);
  await prisma.$executeRawUnsafe(`DELETE FROM public.uniplan_statistics WHERE event_id IN (SELECT id FROM public.uniplan_events WHERE title IN ('Test Workshop', 'Updated Title'))`);
  await prisma.$executeRawUnsafe(`DELETE FROM public.uniplan_events WHERE title IN ('Test Workshop', 'Updated Title')`);
  await prisma.$executeRawUnsafe(`DELETE FROM public.uniplan_organizers WHERE student_id IN ('A00374201','A00374202')`);
  await prisma.$executeRawUnsafe(`DELETE FROM public.users WHERE username IN ('ts@u.edu.co','to@u.edu.co')`);
  await EventDetail.deleteMany({});
}

before(async () => {
  const { app, prisma } = await import('../src/app.js');
  request = supertest(app);
  await prisma.$connect();
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/uniplan');
  await cleanup();
});

after(async () => {
  await cleanup();
  const { prisma } = await import('../src/app.js');
  const mongoose = await import('mongoose');
  await prisma.$disconnect();
  await mongoose.default.disconnect();
});

describe('1. Auth — M2.8', () => {
  it('rejects unknown student code', async () => {
    const res = await request.post('/api/auth/register')
      .send({ studentCode: 'A00999999', email: 'unk@u.edu.co', password: '12345678' });
    assert.equal(res.status, 404, `Expected 404 got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, 'STUDENT_NOT_FOUND');
  });

  it('register + login student', async () => {
    let res = await request.post('/api/auth/register')
      .send({ studentCode: 'A00374201', email: 'ts@u.edu.co', password: '12345678' });
    assert.equal(res.status, 201, `Register: ${JSON.stringify(res.body)}`);

    res = await request.post('/api/auth/login')
      .send({ username: 'ts@u.edu.co', password: '12345678' });
    assert.equal(res.status, 200, `Login: ${JSON.stringify(res.body)}`);
    TOKEN.student = res.body.accessToken;
  });
});

describe('2. Event CRUD — B1, B3, B4', () => {
  before(async () => {
    let res = await request.post('/api/auth/register')
      .send({ studentCode: 'A00374202', email: 'to@u.edu.co', password: '12345678' });
    res = await request.post('/api/auth/login')
      .send({ username: 'to@u.edu.co', password: '12345678' });
    TOKEN.org = res.body.accessToken;

    await request.post('/api/organizers/apply')
      .set('Authorization', `Bearer ${TOKEN.org}`)
      .send({ organizerType: 'STUDENT_LEADER', semester: 5, studentGroup: 'Club' });

    await sql(`UPDATE public.uniplan_organizers SET approved_by_admin = true WHERE student_id = 'A00374202'`);
    await sql(`UPDATE public.users SET role = 'ORGANIZER' WHERE student_id = 'A00374202'`);

    res = await request.post('/api/auth/login')
      .send({ username: 'to@u.edu.co', password: '12345678' });
    TOKEN.org = res.body.accessToken;
    assert.equal(res.body.user.role, 'ORGANIZER', `Role: ${JSON.stringify(res.body)}`);
  });

  it('B1: create event + stats in correct table', async () => {
    const res = await request.post('/api/events')
      .set('Authorization', `Bearer ${TOKEN.org}`)
      .send({
        title: 'Test Workshop', description: 'Test', eventType: 'WORKSHOP',
        date: '2027-12-15', startTime: '10:00', endTime: '12:00',
        location: 'Room 101', maxAttendees: 25,
        typeSpecificFields: { materials: ['Laptop'] },
      });
    assert.equal(res.status, 201, `Create: ${JSON.stringify(res.body)}`);
    eventId = res.body.id;

    const { prisma } = await import('../src/app.js');
    const stats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM public.uniplan_statistics WHERE event_id = $1`, eventId
    );
    assert.equal(stats.length, 1, 'B1 FAIL: no stats row');
  });

  it('B4: partial update', async () => {
    assert.ok(eventId);
    await request.put(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${TOKEN.org}`)
      .send({ title: 'Updated Title' })
      .expect(200);

    const get = await request.get(`/api/events/${eventId}`);
    assert.equal(get.body.title, 'Updated Title');
  });

  it('B3: status filter', async () => {
    // Our test event (2027-12-15) should be UPCOMING
    const u = await request.get('/api/events?status=UPCOMING');
    assert.equal(u.status, 200);
    const ourEvent = u.body.data.find((e: any) => e.id === eventId);
    assert.ok(ourEvent, 'B3: test event not in UPCOMING results');
    assert.equal(ourEvent.status, 'UPCOMING');
  });

  it('duplicate', async () => {
    const res = await request.post(`/api/events/${eventId}/duplicate`)
      .set('Authorization', `Bearer ${TOKEN.org}`)
      .send({ newDate: '2027-08-01' });
    assert.equal(res.status, 201, `Duplicate: ${JSON.stringify(res.body)}`);
    await sql(`DELETE FROM public.uniplan_statistics WHERE event_id = $1`, res.body.id).catch(() => {});
    await sql(`DELETE FROM public.uniplan_events WHERE id = $1`, res.body.id).catch(() => {});
  });

  it('rejects past dates', async () => {
    const res = await request.post('/api/events')
      .set('Authorization', `Bearer ${TOKEN.org}`)
      .send({ title:'P', description:'X', eventType:'TALK', date:'2020-01-01', startTime:'10:00', endTime:'12:00', location:'X', maxAttendees:10 });
    assert.notEqual(res.status, 201, 'Should reject past date');
  });
});

describe('3. Registration & Observer — M2.6', () => {
  it('register + observer stats', async () => {
    assert.ok(eventId);
    const res = await request.post('/api/registrations')
      .set('Authorization', `Bearer ${TOKEN.student}`)
      .send({ eventId });
    assert.equal(res.status, 201, `Reg: ${JSON.stringify(res.body)}`);

    await new Promise(r => setTimeout(r, 600));
    const { prisma } = await import('../src/app.js');
    let stats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT total_registered FROM public.uniplan_statistics WHERE event_id = $1`, eventId
    );
    assert.equal(stats[0].total_registered, 1, `M2.6 reg=${stats[0].total_registered}`);

    const mine = await request.get('/api/registrations/mine')
      .set('Authorization', `Bearer ${TOKEN.student}`);
    const myReg = mine.body.data.find((r: any) => r.eventId === eventId);
    assert.ok(myReg);
    regId = myReg.id;

    await request.delete(`/api/registrations/${regId}`)
      .set('Authorization', `Bearer ${TOKEN.student}`)
      .expect(200);

    await new Promise(r => setTimeout(r, 600));
    stats = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT total_cancelled FROM public.uniplan_statistics WHERE event_id = $1`, eventId
    );
    assert.equal(stats[0].total_cancelled, 1, `M2.6 canc=${stats[0].total_cancelled}`);
  });

  it('CSV export', async () => {
    const csv = await request.get(`/api/registrations/event/${eventId}/csv`)
      .set('Authorization', `Bearer ${TOKEN.student}`);
    assert.ok(csv.text.includes('Name'));
  });
});

describe('4. Reports — M2.7', () => {
  it('engagement report', async () => {
    const res = await request.get('/api/reports/engagement')
      .set('Authorization', `Bearer ${TOKEN.student}`);
    // Reports are admin-only, verify endpoint exists (not 500/404)
    assert.ok([200, 401, 403].includes(res.status), `Unexpected status: ${res.status}`);
  });

  it('occupancy report', async () => {
    const res = await request.get('/api/reports/occupancy')
      .set('Authorization', `Bearer ${TOKEN.student}`);
    assert.ok([200, 401, 403].includes(res.status));
  });
});

describe('5. Messaging — M2.9', () => {
  it('send + get with sender name', async () => {
    assert.ok(eventId);
    const sendRes = await request.post(`/api/events/${eventId}/messages`)
      .set('Authorization', `Bearer ${TOKEN.org}`)
      .send({ text: 'Hello!' });
    assert.equal(sendRes.status, 200, `Send msg: ${JSON.stringify(sendRes.body)}`);

    const get = await request.get(`/api/events/${eventId}/messages`)
      .set('Authorization', `Bearer ${TOKEN.student}`);
    assert.equal(get.status, 200);
    const msgs = get.body.data;
    assert.ok(msgs.length > 0);
    assert.ok(msgs[0].senderName, 'M2.9: senderName missing');
    assert.notEqual(msgs[0].senderName, msgs[0].sentBy, 'M2.9: name not resolved');
  });
});
