import { assert, runTests } from './setup.js';
import healthApi from '../api/health-api.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const tests = {
  'Health API: routes integration health through deployable catch-all': async () => {
    const req = { method: 'GET', query: { route: 'integrations' } };
    const res = createResponse();

    healthApi(req, res);

    assert.equal(res.statusCode, 200, 'Health route should return 200');
    assert.equal(res.body.status, 'ok', 'Health route should return ok status');
    assert.truthy(res.body.integrations?.stripe, 'Health route should include Stripe status');
    assert.truthy(res.body.integrations?.quickbooks, 'Health route should include QuickBooks status');
    assert.truthy(res.body.integrations?.procore, 'Health route should include Procore status');
  },

  'Health API: unknown health route returns 404': async () => {
    const req = { method: 'GET', query: { route: 'missing' } };
    const res = createResponse();

    healthApi(req, res);

    assert.equal(res.statusCode, 404, 'Unknown health route should return 404');
  },
};

runTests(tests).then(({ failed }) => {
  process.exit(failed > 0 ? 1 : 0);
});
