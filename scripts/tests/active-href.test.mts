import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { activeHref } = await import(pathToFileURL(path.resolve("lib/menu/active.ts")).href);
const hrefs = ["/intranet", "/intranet/chamados", "/admin", "/admin/chamados", "/admin/chamados/preventivas", "/admin/usuarios"];

// Só o item mais específico fica aceso
assert.equal(activeHref("/admin/chamados", hrefs), "/admin/chamados");
assert.equal(activeHref("/admin/chamados/preventivas", hrefs), "/admin/chamados/preventivas");
assert.equal(activeHref("/admin/chamados/123", hrefs), "/admin/chamados");
assert.equal(activeHref("/admin", hrefs), "/admin");
assert.equal(activeHref("/intranet", hrefs), "/intranet");
assert.equal(activeHref("/intranet/chamados/ti", hrefs), "/intranet/chamados");
// Prefixo de texto não é prefixo de rota
assert.equal(activeHref("/admin/usuarios-x", hrefs), null);
// Raízes (Início, Dashboard) só acendem na própria página
assert.equal(activeHref("/intranet/perfil", hrefs), null);
assert.equal(activeHref("/admin/pacientes", hrefs), null);
assert.equal(activeHref("/outra", hrefs), null);
console.log("active-href: ok");
