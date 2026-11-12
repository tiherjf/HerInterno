import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { countReadsByNews } = await import(pathToFileURL(path.resolve("lib/news/read-counts.ts")).href);

// Cliente falso no formato do supabase-js: from().select(col, opts).eq(col, val) → Promise<{count}>
const TOTALS: Record<string, number> = { a: 1500, b: 3, c: 0 };
const calls: { table: string; opts: unknown; eq: [string, string] }[] = [];
const fake = {
  from(table: string) {
    return {
      select(_col: string, opts: unknown) {
        return {
          eq(col: string, val: string) {
            calls.push({ table, opts, eq: [col, val] });
            return Promise.resolve(val === "erro" ? { count: null, error: { message: "x" } } : { count: TOTALS[val], error: null });
          },
        };
      },
    };
  },
};

const res = await countReadsByNews(fake, ["a", "b", "c", "erro"]);
// conta no banco (sem trazer linhas): não sofre o limite de 1000 linhas
assert.deepEqual(res, { a: 1500, b: 3, c: 0, erro: 0 });
assert.ok(calls.every((c) => c.table === "news_reads"));
assert.ok(calls.every((c) => JSON.stringify(c.opts) === JSON.stringify({ count: "exact", head: true })));
assert.deepEqual(calls.map((c) => c.eq[0]), ["news_id", "news_id", "news_id", "news_id"]);
assert.deepEqual(await countReadsByNews(fake, []), {});

console.log("news-read-counts ok");
