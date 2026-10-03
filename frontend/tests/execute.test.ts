import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/execute/route.js';

test('invalid requests return 400 before opening a Temporal connection', async () => {
  for (const body of ['{', 'null', '{}', '[]', '{"taskInput":1}', '{"taskInput":"   "}', '{"taskInput":"ab"}']) {
    const request = new NextRequest('http://localhost/api/execute', { method: 'POST', body, headers: {'Content-Type':'application/json'} });
    const response = await POST(request);
    assert.equal(response.status, 400, body);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});
