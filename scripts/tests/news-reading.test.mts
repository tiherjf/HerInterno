import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { readingMinutes, topRead } = await import(
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

console.log("news-reading ok");
