"use client";

import { useState, useMemo } from "react";
import { Search, Phone, Copy, Check, Download, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Ramal {
  ramal: string;
  descricao: string;
  localizacao: string;
}

interface Setor {
  id: string;
  label: string;
  icon: string;
  headerClass: string;
  chipClass: string;
  ramais: Ramal[];
}

const SETORES: Setor[] = [
  {
    id: "terreo",
    label: "Térreo",
    icon: "🏥",
    headerClass: "bg-blue-600 text-white",
    chipClass: "bg-blue-50 border-blue-200 text-blue-700",
    ramais: [
      { ramal: "4912", descricao: "Recepção Térreo",                       localizacao: "Térreo" },
      { ramal: "4932", descricao: "Recepção 2",                             localizacao: "Térreo" },
      { ramal: "4953", descricao: "Enfermagem Ambulatório",                 localizacao: "Térreo" },
      { ramal: "4968", descricao: "Triagem (Andréia)",                      localizacao: "Térreo" },
      { ramal: "4956", descricao: "Exames",                                 localizacao: "Térreo" },
      { ramal: "4987", descricao: "Laboratório Carlos Chagas",              localizacao: "Térreo" },
      { ramal: "4966", descricao: "Estacionamento (Ronaldo)",               localizacao: "Térreo" },
      { ramal: "4955", descricao: "Ouvidoria (Laura)",                      localizacao: "Térreo" },
      { ramal: "4851", descricao: "Líder de Atendimento (Fran)",            localizacao: "Térreo" },
      { ramal: "4908", descricao: "Otorrino Consultório 1 — Dr. Evandro",  localizacao: "Térreo" },
      { ramal: "4904", descricao: "Otorrino Consultório 2 — Dra. Regina",  localizacao: "Térreo" },
      { ramal: "4909", descricao: "Otorrino Consultório 3 — Dr. Pedro",    localizacao: "Térreo" },
      { ramal: "4906", descricao: "Otorrino Consultório 4",                 localizacao: "Térreo" },
      { ramal: "4931", descricao: "Otorrino Consultório 5 — Dr. Lindomar", localizacao: "Térreo" },
      { ramal: "4945", descricao: "Otorrino Consultório 6",                 localizacao: "Térreo" },
      { ramal: "4922", descricao: "Otorrino Consultório 7",                 localizacao: "Térreo" },
      { ramal: "4925", descricao: "Otorrino Consultório 8",                 localizacao: "Térreo" },
      { ramal: "4985", descricao: "Otorrino Consultório 9",                 localizacao: "Térreo" },
      { ramal: "4854", descricao: "Otorrino Consultório 10",                localizacao: "Térreo" },
      { ramal: "4850", descricao: "Otorrino Consultório 11",                localizacao: "Térreo" },
      { ramal: "4986", descricao: "Otorrino Consultório 12",                localizacao: "Térreo" },
    ],
  },
  {
    id: "primeiro",
    label: "1º Andar",
    icon: "🔼",
    headerClass: "bg-purple-600 text-white",
    chipClass: "bg-purple-50 border-purple-200 text-purple-700",
    ramais: [
      { ramal: "4921", descricao: "Recepção Centro Cirúrgico",             localizacao: "1º Andar" },
      { ramal: "4941", descricao: "Recepção Centro Cirúrgico 2",           localizacao: "1º Andar" },
      { ramal: "4919", descricao: "Conforto Médico",                       localizacao: "1º Andar" },
      { ramal: "4914", descricao: "Agendamento Cirúrgico (Rhayane)",       localizacao: "1º Andar" },
      { ramal: "4937", descricao: "Apartamento 1",                         localizacao: "1º Andar" },
      { ramal: "4938", descricao: "Apartamento 2",                         localizacao: "1º Andar" },
      { ramal: "4939", descricao: "Apartamento 3",                         localizacao: "1º Andar" },
      { ramal: "N/A",  descricao: "Apartamento 4",                         localizacao: "1º Andar" },
      { ramal: "4957", descricao: "Apartamento 5",                         localizacao: "1º Andar" },
      { ramal: "4970", descricao: "Apartamento 6",                         localizacao: "1º Andar" },
      { ramal: "4972", descricao: "Apartamento 7",                         localizacao: "1º Andar" },
      { ramal: "4917", descricao: "Apartamento 8",                         localizacao: "1º Andar" },
      { ramal: "4965", descricao: "Apartamento 9",                         localizacao: "1º Andar" },
    ],
  },
  {
    id: "segundo",
    label: "2º Andar",
    icon: "🔼",
    headerClass: "bg-teal-600 text-white",
    chipClass: "bg-teal-50 border-teal-200 text-teal-700",
    ramais: [
      { ramal: "4967", descricao: "Recepção Audiometria 1",                           localizacao: "2º Andar" },
      { ramal: "4902", descricao: "Recepção Audiometria 2",                           localizacao: "2º Andar" },
      { ramal: "4907", descricao: "Audiometria 2",                                    localizacao: "2º Andar" },
      { ramal: "4995", descricao: "Internação (Glaubert)",                            localizacao: "2º Andar" },
      { ramal: "4975", descricao: "Setor de Guias (Lara e Rozane)",                   localizacao: "2º Andar" },
      { ramal: "4982", descricao: "Dermatologia e Rinoplastia (Leonardo)",            localizacao: "2º Andar" },
      { ramal: "4976", descricao: "Plástica (Elaine e Rafael)",                       localizacao: "2º Andar" },
      { ramal: "4997", descricao: "Recepção Dermatologia (Emilaine e Giulia)",        localizacao: "2º Andar" },
      { ramal: "4983", descricao: "Recepção Oftalmo (Maria Izabel)",                  localizacao: "2º Andar" },
      { ramal: "4963", descricao: "Oftalmo (Dra. Márcia)",                            localizacao: "2º Andar" },
      { ramal: "4964", descricao: "Recepção Oftalmo (Dra. Márcia)",                   localizacao: "2º Andar" },
    ],
  },
  {
    id: "terceiro",
    label: "3º Andar",
    icon: "🔼",
    headerClass: "bg-orange-600 text-white",
    chipClass: "bg-orange-50 border-orange-200 text-orange-700",
    ramais: [
      { ramal: "4969", descricao: "Centro de Estudos",                                localizacao: "3º Andar" },
      { ramal: "4924", descricao: "RH (Sabrina e Igor)",                               localizacao: "3º Andar" },
      { ramal: "4905", descricao: "Farmácia (Ana Paula, Andressa e Tais)",             localizacao: "3º Andar" },
      { ramal: "4936", descricao: "TI (Alexandre, Gabriel, Mateus)",                   localizacao: "3º Andar" },
      { ramal: "4920", descricao: "Lavanderia / Copa (Michelle)",                      localizacao: "3º Andar" },
      { ramal: "9970", descricao: "SHL / SND (Michelle e Marco)",                      localizacao: "3º Andar" },
      { ramal: "4990", descricao: "Recepção 3º Andar (Greicielly)",                    localizacao: "3º Andar" },
      { ramal: "4991", descricao: "Consultório 21",                                    localizacao: "3º Andar" },
      { ramal: "4992", descricao: "Consultório 22",                                    localizacao: "3º Andar" },
      { ramal: "4993", descricao: "Consultório 23",                                    localizacao: "3º Andar" },
    ],
  },
  {
    id: "milan",
    label: "Ed. Milan",
    icon: "🏢",
    headerClass: "bg-indigo-600 text-white",
    chipClass: "bg-indigo-50 border-indigo-200 text-indigo-700",
    ramais: [
      { ramal: "4903", descricao: "Direção (Virgínia)",                                localizacao: "Ed. Milan" },
      { ramal: "4911", descricao: "Financeiro (Raquel)",                               localizacao: "Ed. Milan" },
      { ramal: "4923", descricao: "Manutenção (Brenio)",                               localizacao: "Ed. Milan" },
      { ramal: "4913", descricao: "Faturamento Ambulatório (Tayná)",                   localizacao: "Ed. Milan" },
      { ramal: "4934", descricao: "Faturamento Cirúrgico (Vivian)",                    localizacao: "Ed. Milan" },
      { ramal: "4935", descricao: "Gerência (Camila)",                                 localizacao: "Ed. Milan" },
      { ramal: "4977", descricao: "Marketing e Comunicação (Laura)",                   localizacao: "Ed. Milan" },
      { ramal: "4930", descricao: "Qualidade (Mariana)",                               localizacao: "Ed. Milan" },
      { ramal: "4910", descricao: "Custos (Claudia Guerra)",                           localizacao: "Ed. Milan" },
      { ramal: "4949", descricao: "Custos (Matheus Dutra)",                            localizacao: "Ed. Milan" },
      { ramal: "4915", descricao: "Comercial (Natália)",                               localizacao: "Ed. Milan" },
      { ramal: "4943", descricao: "Telefonia 1",                                       localizacao: "Ed. Milan" },
      { ramal: "4944", descricao: "Telefonia 2",                                       localizacao: "Ed. Milan" },
      { ramal: "4901", descricao: "Telefonia 3 (Gislaine)",                            localizacao: "Ed. Milan" },
      { ramal: "4959", descricao: "Telefonia 4",                                       localizacao: "Ed. Milan" },
      { ramal: "4996", descricao: "Telefonia 5",                                       localizacao: "Ed. Milan" },
    ],
  },
  {
    id: "saudeAuditiva",
    label: "Saúde Auditiva",
    icon: "👂",
    headerClass: "bg-green-600 text-white",
    chipClass: "bg-green-50 border-green-200 text-green-700",
    ramais: [
      { ramal: "4856", descricao: "Recepção (Vanessa)",                                localizacao: "Saúde Auditiva" },
      { ramal: "4857", descricao: "Recepção (Gabriela)",                               localizacao: "Saúde Auditiva" },
      { ramal: "4928", descricao: "Fonoaudióloga (Roberta)",                           localizacao: "Saúde Auditiva" },
      { ramal: "4946", descricao: "Assistente Social (Vanessa)",                       localizacao: "Saúde Auditiva" },
      { ramal: "4947", descricao: "Fonoaudióloga (Susana)",                            localizacao: "Saúde Auditiva" },
      { ramal: "4958", descricao: "Arquivo (Erica)",                                   localizacao: "Saúde Auditiva" },
      { ramal: "4960", descricao: "Psicologia (Rogério)",                              localizacao: "Saúde Auditiva" },
      { ramal: "4948", descricao: "Faturamento (Liliane)",                             localizacao: "Saúde Auditiva" },
      { ramal: "4929", descricao: "Faturamento Saúde Auditiva",                        localizacao: "Saúde Auditiva" },
    ],
  },
  {
    id: "instituto",
    label: "Instituto",
    icon: "🏛️",
    headerClass: "bg-rose-600 text-white",
    chipClass: "bg-rose-50 border-rose-200 text-rose-700",
    ramais: [
      { ramal: "9978", descricao: "Instituto — Recepção",                              localizacao: "Instituto" },
      { ramal: "4940", descricao: "Instituto — Financeiro",                            localizacao: "Instituto" },
      { ramal: "4861", descricao: "Instituto — Agendamento",                           localizacao: "Instituto" },
      { ramal: "4939", descricao: "Instituto — Coordenação",                           localizacao: "Instituto" },
    ],
  },
  {
    id: "clinicaExame",
    label: "Clínica Exame",
    icon: "🔬",
    headerClass: "bg-cyan-600 text-white",
    chipClass: "bg-cyan-50 border-cyan-200 text-cyan-700",
    ramais: [
      { ramal: "4898",           descricao: "Recepção Clínica Exame", localizacao: "Clínica Exame" },
      { ramal: "(32) 3257-6464", descricao: "Clínica Exame",          localizacao: "Clínica Exame" },
    ],
  },
  {
    id: "institutoLevy",
    label: "Instituto Levy",
    icon: "🏥",
    headerClass: "bg-amber-600 text-white",
    chipClass: "bg-amber-50 border-amber-200 text-amber-700",
    ramais: [
      { ramal: "4863", descricao: "Recepção Levy",  localizacao: "Instituto Levy" },
      { ramal: "4864", descricao: "Consultório 1",  localizacao: "Instituto Levy" },
      { ramal: "4865", descricao: "Consultório 2",  localizacao: "Instituto Levy" },
    ],
  },
];

const TOTAL = SETORES.reduce((acc, s) => acc + s.ramais.length, 0);

export default function RamaisPage() {
  const [search, setSearch] = useState("");
  const [setorAtivo, setSetorAtivo] = useState<string>("todos");
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(ramal: string) {
    if (ramal === "N/A") return;
    await navigator.clipboard.writeText(ramal);
    setCopiado(ramal);
    setTimeout(() => setCopiado(null), 1500);
  }

  const setoresFiltrados = useMemo(() => {
    const termo = search.toLowerCase().trim();
    return SETORES.filter((s) => {
      if (setorAtivo !== "todos" && s.id !== setorAtivo) return false;
      if (!termo) return true;
      return s.ramais.some(
        (r) => r.ramal.toLowerCase().includes(termo) || r.descricao.toLowerCase().includes(termo)
      );
    }).map((s) => ({
      ...s,
      ramais: termo
        ? s.ramais.filter(
            (r) => r.ramal.toLowerCase().includes(termo) || r.descricao.toLowerCase().includes(termo)
          )
        : s.ramais,
    }));
  }, [search, setorAtivo]);

  const totalFiltrado = setoresFiltrados.reduce((acc, s) => acc + s.ramais.length, 0);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="brand-gradient rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg shrink-0">
              <Phone size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Lista de Ramais</h2>
              <p className="text-blue-100 text-sm">
                {SETORES.length} setores · {TOTAL} ramais cadastrados
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30 border no-print self-start sm:self-auto"
            onClick={() => window.print()}
          >
            <Download size={14} className="mr-1.5" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Busca sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por ramal, nome ou setor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white shadow-sm"
          />
          {search && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {totalFiltrado} resultado{totalFiltrado !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Filtros por setor */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSetorAtivo("todos")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            setorAtivo === "todos"
              ? "bg-[#1e40af] text-white border-[#1e40af]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#1e40af]"
          }`}
        >
          Todos ({TOTAL})
        </button>
        {SETORES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSetorAtivo(setorAtivo === s.id ? "todos" : s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              setorAtivo === s.id
                ? "bg-[#1e40af] text-white border-[#1e40af]"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#1e40af]"
            }`}
          >
            {s.icon} {s.label} ({s.ramais.length})
          </button>
        ))}
      </div>

      {setoresFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Phone size={40} className="mb-3 opacity-20" />
          <p>Nenhum ramal encontrado para &quot;{search}&quot;</p>
        </div>
      )}

      {/* Listas por setor */}
      <div className="space-y-5">
        {setoresFiltrados.map((setor) => (
          <div key={setor.id} className="rounded-xl border bg-white shadow-sm overflow-hidden print:break-inside-avoid">
            {/* Header colorido do setor */}
            <div className={`flex items-center justify-between px-4 py-3 ${setor.headerClass}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{setor.icon}</span>
                <h3 className="font-bold text-sm">{setor.label}</h3>
                <span className="text-xs opacity-75 bg-white/20 px-2 py-0.5 rounded-full">
                  {setor.ramais.length} ramal{setor.ramais.length !== 1 ? "is" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs opacity-75">
                <MapPin size={11} />
                {setor.ramais[0]?.localizacao}
              </div>
            </div>

            {/* Grid de ramais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x-0">
              {setor.ramais.map((r, idx) => {
                const semRamal = r.ramal === "N/A";
                const isCopiado = copiado === r.ramal;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 sm:nth-[2n]:border-l sm:nth-[2n+1]:border-l-0 lg:nth-[3n+2]:border-l lg:nth-[3n+3]:border-l"
                  >
                    {/* Número bem visível */}
                    <div
                      className={`shrink-0 flex items-center justify-center min-w-18 h-12 rounded-lg font-bold tabular-nums text-base px-2 ${
                        semRamal
                          ? "bg-gray-100 text-gray-400 text-sm"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {semRamal ? "—" : r.ramal}
                    </div>

                    {/* Descrição */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-tight">{r.descricao}</p>
                    </div>

                    {/* Botões de ação — sempre visíveis */}
                    {!semRamal && (
                      <div className="shrink-0 flex gap-1 no-print">
                        <a
                          href={`tel:${r.ramal}`}
                          title="Ligar"
                          aria-label={`Ligar para ${r.descricao}`}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors border border-green-200"
                        >
                          <Phone size={14} />
                        </a>
                        <button
                          onClick={() => copiar(r.ramal)}
                          title="Copiar ramal"
                          aria-label={`Copiar ramal ${r.ramal}`}
                          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors border ${
                            isCopiado
                              ? "bg-green-50 text-green-600 border-green-200"
                              : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                          }`}
                        >
                          {isCopiado ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
