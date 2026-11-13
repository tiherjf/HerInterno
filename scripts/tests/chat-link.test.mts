import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { linkConversa } = await import(pathToFileURL(path.resolve("lib/chat-interno/link.ts")).href);

assert.equal(linkConversa("abc"), "/intranet/chat?com=abc");
assert.equal(linkConversa("a b"), "/intranet/chat?com=a%20b");
assert.equal(linkConversa("x&y=1"), "/intranet/chat?com=x%26y%3D1");

console.log("chat-link: ok");
