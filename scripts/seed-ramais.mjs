/**
 * Popula a tabela extensions com os ramais do hospital.
 * Uso: node scripts/seed-ramais.mjs
 *
 * A tabela precisa existir. Se não existir, execute este SQL no Supabase Dashboard:
 *
 * CREATE TABLE IF NOT EXISTS public.extensions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   sector TEXT NOT NULL,
 *   extension TEXT NOT NULL,
 *   name TEXT NOT NULL,
 *   unit TEXT NOT NULL DEFAULT 'Hospital Evandro Ribeiro',
 *   mobile TEXT,
 *   email TEXT,
 *   active BOOLEAN DEFAULT TRUE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "leitura" ON public.extensions FOR SELECT TO authenticated USING (active = TRUE);
 * CREATE POLICY "gestao" ON public.extensions FOR ALL TO authenticated
 *   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','ti') AND active = TRUE));
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Arquivo .env.local não encontrado.");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const RAMAIS = [
  // Térreo
  { sector: "Térreo", extension: "4912", name: "Recepção Térreo" },
  { sector: "Térreo", extension: "4932", name: "Recepção 2" },
  { sector: "Térreo", extension: "4953", name: "Enfermagem Ambulatório" },
  { sector: "Térreo", extension: "4968", name: "Triagem (Andréia)" },
  { sector: "Térreo", extension: "4956", name: "Exames" },
  { sector: "Térreo", extension: "4987", name: "Laboratório Carlos Chagas" },
  { sector: "Térreo", extension: "4966", name: "Estacionamento (Ronaldo)" },
  { sector: "Térreo", extension: "4955", name: "Ouvidoria (Laura)" },
  { sector: "Térreo", extension: "4851", name: "Líder de Atendimento (Fran)" },
  { sector: "Térreo", extension: "4908", name: "Otorrino Consultório 1 — Dr. Evandro" },
  { sector: "Térreo", extension: "4904", name: "Otorrino Consultório 2 — Dra. Regina" },
  { sector: "Térreo", extension: "4909", name: "Otorrino Consultório 3 — Dr. Pedro" },
  { sector: "Térreo", extension: "4906", name: "Otorrino Consultório 4" },
  { sector: "Térreo", extension: "4931", name: "Otorrino Consultório 5 — Dr. Lindomar" },
  { sector: "Térreo", extension: "4945", name: "Otorrino Consultório 6" },
  { sector: "Térreo", extension: "4922", name: "Otorrino Consultório 7" },
  { sector: "Térreo", extension: "4925", name: "Otorrino Consultório 8" },
  { sector: "Térreo", extension: "4985", name: "Otorrino Consultório 9" },
  { sector: "Térreo", extension: "4854", name: "Otorrino Consultório 10" },
  { sector: "Térreo", extension: "4850", name: "Otorrino Consultório 11" },
  { sector: "Térreo", extension: "4986", name: "Otorrino Consultório 12" },

  // 1º Andar
  { sector: "1º Andar", extension: "4921", name: "Recepção Centro Cirúrgico" },
  { sector: "1º Andar", extension: "4941", name: "Recepção Centro Cirúrgico 2" },
  { sector: "1º Andar", extension: "4919", name: "Conforto Médico" },
  { sector: "1º Andar", extension: "4914", name: "Agendamento Cirúrgico (Rhayane)" },
  { sector: "1º Andar", extension: "4937", name: "Apartamento 1" },
  { sector: "1º Andar", extension: "4938", name: "Apartamento 2" },
  { sector: "1º Andar", extension: "4939", name: "Apartamento 3" },
  { sector: "1º Andar", extension: "4957", name: "Apartamento 5" },
  { sector: "1º Andar", extension: "4970", name: "Apartamento 6" },
  { sector: "1º Andar", extension: "4972", name: "Apartamento 7" },
  { sector: "1º Andar", extension: "4917", name: "Apartamento 8" },
  { sector: "1º Andar", extension: "4965", name: "Apartamento 9" },

  // 2º Andar
  { sector: "2º Andar", extension: "4967", name: "Recepção Audiometria 1" },
  { sector: "2º Andar", extension: "4902", name: "Recepção Audiometria 2" },
  { sector: "2º Andar", extension: "4907", name: "Audiometria 2" },
  { sector: "2º Andar", extension: "4995", name: "Internação (Glaubert)" },
  { sector: "2º Andar", extension: "4975", name: "Setor de Guias (Lara e Rozane)" },
  { sector: "2º Andar", extension: "4982", name: "Dermatologia e Rinoplastia (Leonardo)" },
  { sector: "2º Andar", extension: "4976", name: "Plástica (Elaine e Rafael)" },
  { sector: "2º Andar", extension: "4997", name: "Recepção Dermatologia (Emilaine e Giulia)" },
  { sector: "2º Andar", extension: "4983", name: "Recepção Oftalmo (Maria Izabel)" },
  { sector: "2º Andar", extension: "4963", name: "Oftalmo (Dra. Márcia)" },
  { sector: "2º Andar", extension: "4964", name: "Recepção Oftalmo (Dra. Márcia)" },

  // 3º Andar
  { sector: "3º Andar", extension: "4969", name: "Centro de Estudos" },
  { sector: "3º Andar", extension: "4924", name: "RH (Sabrina e Igor)" },
  { sector: "3º Andar", extension: "4905", name: "Farmácia (Ana Paula, Andressa e Tais)" },
  { sector: "3º Andar", extension: "4936", name: "TI (Alexandre, Gabriel, Mateus)" },
  { sector: "3º Andar", extension: "4920", name: "Lavanderia / Copa (Michelle)" },
  { sector: "3º Andar", extension: "9970", name: "SHL / SND (Michelle e Marco)" },
  { sector: "3º Andar", extension: "4990", name: "Recepção 3º Andar (Greicielly)" },
  { sector: "3º Andar", extension: "4991", name: "Consultório 21" },
  { sector: "3º Andar", extension: "4992", name: "Consultório 22" },
  { sector: "3º Andar", extension: "4993", name: "Consultório 23" },

  // Ed. Milan
  { sector: "Ed. Milan", extension: "4903", name: "Direção (Virgínia)" },
  { sector: "Ed. Milan", extension: "4911", name: "Financeiro (Raquel)" },
  { sector: "Ed. Milan", extension: "4923", name: "Manutenção (Brenio)" },
  { sector: "Ed. Milan", extension: "4913", name: "Faturamento Ambulatório (Tayná)" },
  { sector: "Ed. Milan", extension: "4934", name: "Faturamento Cirúrgico (Vivian)" },
  { sector: "Ed. Milan", extension: "4935", name: "Gerência (Camila)" },
  { sector: "Ed. Milan", extension: "4977", name: "Marketing e Comunicação (Laura)" },
  { sector: "Ed. Milan", extension: "4930", name: "Qualidade (Mariana)" },
  { sector: "Ed. Milan", extension: "4910", name: "Custos (Claudia Guerra)" },
  { sector: "Ed. Milan", extension: "4949", name: "Custos (Matheus Dutra)" },
  { sector: "Ed. Milan", extension: "4915", name: "Comercial (Natália)" },
  { sector: "Ed. Milan", extension: "4943", name: "Telefonia 1" },
  { sector: "Ed. Milan", extension: "4944", name: "Telefonia 2" },
  { sector: "Ed. Milan", extension: "4901", name: "Telefonia 3 (Gislaine)" },
  { sector: "Ed. Milan", extension: "4959", name: "Telefonia 4" },
  { sector: "Ed. Milan", extension: "4996", name: "Telefonia 5" },

  // Saúde Auditiva
  { sector: "Saúde Auditiva", extension: "4856", name: "Recepção (Vanessa)" },
  { sector: "Saúde Auditiva", extension: "4857", name: "Recepção (Gabriela)" },
  { sector: "Saúde Auditiva", extension: "4928", name: "Fonoaudióloga (Roberta)" },
  { sector: "Saúde Auditiva", extension: "4946", name: "Assistente Social (Vanessa)" },
  { sector: "Saúde Auditiva", extension: "4947", name: "Fonoaudióloga (Susana)" },
  { sector: "Saúde Auditiva", extension: "4958", name: "Arquivo (Erica)" },
  { sector: "Saúde Auditiva", extension: "4960", name: "Psicologia (Rogério)" },
  { sector: "Saúde Auditiva", extension: "4948", name: "Faturamento (Liliane)" },
  { sector: "Saúde Auditiva", extension: "4929", name: "Faturamento Saúde Auditiva" },

  // Instituto
  { sector: "Instituto", extension: "9978", name: "Recepção" },
  { sector: "Instituto", extension: "4940", name: "Financeiro" },
  { sector: "Instituto", extension: "4861", name: "Agendamento" },
  { sector: "Instituto", extension: "4939", name: "Coordenação" },

  // Clínica Exame
  { sector: "Clínica Exame", extension: "4898",           name: "Recepção Clínica Exame" },
  { sector: "Clínica Exame", extension: "(32) 3257-6464", name: "Clínica Exame" },

  // Instituto Levy
  { sector: "Instituto Levy", extension: "4863", name: "Recepção Levy" },
  { sector: "Instituto Levy", extension: "4864", name: "Consultório 1" },
  { sector: "Instituto Levy", extension: "4865", name: "Consultório 2" },
];

const rows = RAMAIS.map((r) => ({
  sector: r.sector,
  extension: r.extension,
  name: r.name,
  unit: "Hospital Evandro Ribeiro",
  active: true,
}));

const { error } = await sb.from("extensions").insert(rows);

if (error) {
  console.error("Erro ao inserir:", error.message);
  console.log("\n==> Execute o SQL do cabeçalho deste arquivo no Supabase Dashboard primeiro.");
} else {
  console.log(`✓ ${rows.length} ramais inseridos na tabela extensions.`);
}
