// Hook de resolução para os testes: permite que módulos de lib/ importem outros
// módulos .ts por caminho relativo sem extensão (como o bundler do Next faz).
// Uso: node --experimental-strip-types --import ./scripts/tests/ts-resolve.mjs <teste>
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      const relativo = specifier.startsWith("./") || specifier.startsWith("../");
      if (!relativo || /\.[cm]?[jt]s$/.test(specifier)) throw err;
      return nextResolve(specifier + ".ts", context);
    }
  },
});
