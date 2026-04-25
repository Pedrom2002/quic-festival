import { vi } from "vitest";

type QueryResult<T = unknown> = { data: T | null; error: { message: string } | null };

export type FakeSupabase = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signInWithOtp: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

type TableHandlers = {
  select?: (args: { columns: string; eq?: Record<string, unknown> }) => QueryResult<unknown>;
  insert?: (rows: unknown) => QueryResult<unknown>;
  update?: (patch: unknown, eq?: Record<string, unknown>) => QueryResult<unknown>;
  delete?: (eq?: Record<string, unknown>) => QueryResult<unknown>;
  count?: number;
};

export function createFakeSupabase(tables: Record<string, TableHandlers> = {}): FakeSupabase {
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: "u1", email: "x@x.pt" }, session: {} }, error: null })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
  };

  const from = vi.fn((table: string) => {
    const handlers = tables[table] ?? {};
    const eq: Record<string, unknown> = {};
    let columns = "*";

    const builder: Record<string, unknown> = {
      select: vi.fn(function (this: unknown, cols: string = "*", opts?: { count?: string }) {
        columns = cols;
        const result = handlers.select?.({ columns, eq }) ?? { data: [], error: null };
        if (opts?.count === "exact") {
          return Promise.resolve({ ...result, count: handlers.count ?? 0 });
        }
        return builder;
      }),
      insert: vi.fn(function (this: unknown, rows: unknown) {
        const result = handlers.insert?.(rows) ?? { data: null, error: null };
        return Object.assign(Promise.resolve(result), builder);
      }),
      update: vi.fn(function (this: unknown, patch: unknown) {
        const result = handlers.update?.(patch, eq) ?? { data: null, error: null };
        return Object.assign(Promise.resolve(result), builder);
      }),
      delete: vi.fn(function (this: unknown) {
        const result = handlers.delete?.(eq) ?? { data: null, error: null };
        return Object.assign(Promise.resolve(result), builder);
      }),
      eq: vi.fn(function (this: unknown, col: string, val: unknown) {
        eq[col] = val;
        return builder;
      }),
      in: vi.fn(function () { return builder; }),
      order: vi.fn(function () { return builder; }),
      limit: vi.fn(function () { return builder; }),
      range: vi.fn(function () { return builder; }),
      maybeSingle: vi.fn(async function () {
        const result = handlers.select?.({ columns, eq }) ?? { data: null, error: null };
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
        return { data, error: result.error };
      }),
      single: vi.fn(async function () {
        const result = handlers.select?.({ columns, eq }) ?? { data: null, error: null };
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
        return { data, error: result.error };
      }),
      then: undefined,
    };

    return builder;
  });

  return { auth, from } as FakeSupabase;
}
