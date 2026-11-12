import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { readingMinutes, topRead, topFromCounts } = await import(
  pathToFileURL(path.resolve("lib/news/reading.ts")).href
);

assert.equal(readingMinutes(null), 1);
assert.equal(readingMinutes(""), 1);
assert.equal(readingMinutes("<p>" + "palavra ".repeat(401) + "</p>"), 3);
assert.equal(readingMinutes("<p>um<br>dois</p>"), 1);

assert.deepEqual(
  topRead([{ news_id: "a" }, { news_id: "b" }, { news_id: "b" }, { news_id: "c" }], 2, 2),
  [{ news_id: "b", count: 2 }, { news_id: "a", count: 1 }]
);
assert.deepEqual(topRead([{ news_id: "a" }], 5, 2), []);
assert.deepEqual(topRead([], 5, 2), []);

// Ranking a partir de contagens do banco: ignora zeros, desc, empate na ordem de entrada
assert.deepEqual(topFromCounts({ a: 1, b: 1500, c: 0, d: 3 }, 2, 2), [{ news_id: "b", count: 1500 }, { news_id: "d", count: 3 }]);
assert.deepEqual(topFromCounts({ a: 2, b: 2 }, 5, 2), [{ news_id: "a", count: 2 }, { news_id: "b", count: 2 }]);
assert.deepEqual(topFromCounts({ a: 5, b: 0 }, 5, 2), []);

console.log("news-reading ok");
