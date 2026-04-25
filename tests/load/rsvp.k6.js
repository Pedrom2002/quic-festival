// k6 load test — RSVP submission burst.
//
// Run locally:
//   k6 run -e BASE_URL=http://localhost:3000 tests/load/rsvp.k6.js
//
// Configure target rate via env: K6_VUS, K6_DURATION.
//
// CI: este script NÃO corre no test pipeline standard porque exige Supabase
// real e Upstash configurados. Correr manualmente antes de cada evento ou via
// um workflow `workflow_dispatch` opcional.

import http from "k6/http";
import { check, sleep } from "k6";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    rsvp_burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 50 }, // ~5x peak previsto (10/min/IP * N IPs)
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // p95 abaixo de 1s, taxa de erro real (5xx) abaixo de 1%.
    http_req_duration: ["p(95)<1000"],
    "http_req_failed{type:server}": ["rate<0.01"],
  },
};

// eslint-disable-next-line import/no-anonymous-default-export
export default function () {
  const email = `loadtest-${randomString(12)}@example.com`;
  const payload = JSON.stringify({
    name: "Load Tester",
    email,
    phone: "912345678",
    acompanhante: "nao",
  });

  const res = http.post(`${BASE_URL}/api/rsvp`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { type: "client" },
  });

  check(res, {
    "status is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "no 5xx": (r) => r.status < 500,
  });

  sleep(1);
}
