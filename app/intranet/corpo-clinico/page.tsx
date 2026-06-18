"use client";

import { useState, useMemo } from "react";
import { Search, AlertTriangle, Clock, CalendarDays, Stethoscope, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Profissional {
  nome: string;
  especialidade: string;
  dias: string;
  horarios: string;
  observacoes?: string;
  semAgenda?: boolean;
}

interface Especialidade {
  nome: string;
  profissionais: Profissional[];
}

const ESPECIALIDADES: Especialidade[] = [
  {
    nome: "Pediatria",
    profissionais: [
      { nome: "Adriana da Motta Caiafa", especialidade: "Pediatra", dias: "Quarta-feira", horarios: "08:00 às 13:00" },
      { nome: "Adriana Maria Vieira Rezende", especialidade: "Pediatra", dias: "Segunda, Quarta e Quinta-feira", horarios: "09:00 às 14:00" },
      { nome: "Cynthia de Oliveira Macedo", especialidade: "Pediatra", dias: "Segunda / Terça / Quinta-feira", horarios: "09:00 às 15:30 / 13:30 às 14:30 / 09:00 às 15:30" },
      { nome: "Cyntia Vidal Merula", especialidade: "Pediatra", dias: "Segunda e Terça (15 em 15d) / Quinta (plantão)", horarios: "13:30 às 16:30 / 13:30 às 18:30" },
      { nome: "Dorian Ricardo Domingues", especialidade: "Pediatra", dias: "Seg / Ter, Qua e Qui / Sex / Sáb", horarios: "18:00 às 19:00 / 15:00 às 18:40 / 09:00 às 14:00 / 09:00 às 12:00" },
      { nome: "Edson de Lucca Marcílio", especialidade: "Pediatra", dias: "Segunda a Sexta / Sábado", horarios: "09:00 às 19:00 (intervalo 12:00–14:00) / 09:00 às 12:30" },
      { nome: "Guilherme da Silva Matos", especialidade: "Pediatra", dias: "Quinta-feira / Sábado", horarios: "09:00 às 13:00 / 09:00 às 12:30", observacoes: "Agendamento somente com ele" },
      { nome: "Lara Lobão Campos Bignoto", especialidade: "Pediatra e Hebiatra", dias: "Sexta e Sábado (1x/mês)", horarios: "09:00 às 11:00", observacoes: "Especialista em medicina do adolescente" },
      { nome: "Lucia Elena Gasparetto Bittar", especialidade: "Pediatra", dias: "Seg, Qua e Qui / Terça-feira", horarios: "14:00 às 17:30 / 09:00 às 12:00" },
      { nome: "Luciana Calderano Fiorilo", especialidade: "Pediatra", dias: "Segunda-feira", horarios: "13:00 às 17:00" },
      { nome: "Maria Fernanda Vizani Nogueira", especialidade: "Pediatra", dias: "Quarta-feira / Sábado (1x/mês)", horarios: "16:30 às 19:00" },
      { nome: "Maria Zélia Tavares Moreira", especialidade: "Pediatra", dias: "Seg e Ter / Qua e Qui", horarios: "08:00 às 13:00 / 13:00 às 16:00" },
      { nome: "Marilia Borborema Aguiar", especialidade: "Pediatra", dias: "Segunda / Terça / Quarta-feira", horarios: "13:00 às 16:00 / 13:00 às 17:00 / 09:00 às 13:00" },
      { nome: "Mirian Estevina Braga Silva", especialidade: "Pediatra", dias: "Quarta-feira / Sexta-feira", horarios: "13:00 às 19:00 / 08:00 às 11:30" },
      { nome: "Paolla Seixas Salgado", especialidade: "Pediatra", dias: "Segunda / Quinta (15 em 15d) / Sexta", horarios: "14:00 às 16:00 / 09:00 às 13:00 / 13:00 às 16:00" },
      { nome: "Renato Darcio Camilo Junior", especialidade: "Pediatra e Alergologista", dias: "Seg a Qui / Sexta / Sábado", horarios: "09:00 às 12:00 e 14:30 às 17:30 / 16:00 às 18:00 / 09:00 às 12:00" },
      { nome: "Rosane Rodrigues Rosa", especialidade: "Pediatra", dias: "Segunda / Terça / Sexta (15 em 15d)", horarios: "16:00 às 18:00 / 16:00 às 19:00 / 16:00 às 19:00" },
      { nome: "Walkyria Ferreira", especialidade: "Pediatra", dias: "Quarta / Quinta / Sexta / Sáb (15 em 15d)", horarios: "09:30 às 12:00 / 13:00 às 16:00 / 13:00 às 17:00 / 09:00 às 13:00" },
    ],
  },
  {
    nome: "Otorrinolaringologia",
    profissionais: [
      { nome: "Aparecida Regina Brum", especialidade: "Otorrino – Adulto e Infantil", dias: "Segunda-feira / Sábado", horarios: "09:00 às 13:00 / 09:00 às 12:30" },
      { nome: "Joziene Aparecida Carvalho", especialidade: "Otorrino – Adulto e Infantil", dias: "Terça-feira", horarios: "16:00 às 17:30" },
      { nome: "Maria Clara Souza Schettini", especialidade: "Otorrino – Adulto e Infantil", dias: "Quinta-feira", horarios: "08:00 às 09:45" },
      { nome: "André Costa Pinto Ribeiro", especialidade: "Otorrinolaringologista", dias: "—", horarios: "—", semAgenda: true },
      { nome: "Daniel Ferreira Lana", especialidade: "Otorrinolaringologista", dias: "—", horarios: "—", semAgenda: true },
      { nome: "Laura Rodrigues Sefair", especialidade: "Otorrino Pediatra", dias: "—", horarios: "—", semAgenda: true },
    ],
  },
  {
    nome: "Cirurgia",
    profissionais: [
      { nome: "Aimeé Cabral Ramalhete", especialidade: "Cirurgiã Pediátrica", dias: "Quarta-feira", horarios: "15:20 às 17:00" },
      { nome: "Matheus Mousinho", especialidade: "Cirurgião Cabeça e Pescoço", dias: "Sexta-feira", horarios: "09:00 às 10:30" },
    ],
  },
  {
    nome: "Dermatologia",
    profissionais: [
      { nome: "Alexandre Francisco Caniato Serdeira", especialidade: "Dermatologista – Adulto e Infantil", dias: "Quinta-feira", horarios: "09:00 às 10:45" },
    ],
  },
  {
    nome: "Alergia e Imunologia",
    profissionais: [
      { nome: "Christiane Mendonça Valente", especialidade: "Alergologia e Imunologia – Adulto e Infantil", dias: "Quinta-feira", horarios: "09:00 às 11:30" },
      { nome: "Renato Darcio Camilo Junior", especialidade: "Pediatra e Alergologista", dias: "Seg a Qui / Sexta / Sábado", horarios: "09:00 às 12:00 e 14:30 às 17:30 / 16:00 às 18:00 / 09:00 às 12:00", observacoes: "Também listado em Pediatria" },
    ],
  },
  {
    nome: "Urologia",
    profissionais: [
      { nome: "José Murilo Bastos Netto", especialidade: "Urologia Infantil", dias: "Terça-feira", horarios: "13:00 às 15:00" },
    ],
  },
  {
    nome: "Ortopedia",
    profissionais: [
      { nome: "Thalles Bregalda Reis", especialidade: "Ortopedia – Adulto e Infantil / Pediátrico", dias: "Terça-feira", horarios: "16:00 às 18:20" },
    ],
  },
  {
    nome: "Psicologia",
    profissionais: [
      { nome: "Luane Viera dos Santos", especialidade: "Psicóloga", dias: "Segunda e Quarta / Terça (15 em 15d)", horarios: "09:00 às 18:00 / 09:00 às 11:00" },
    ],
  },
  {
    nome: "Fonoaudiologia",
    profissionais: [
      { nome: "Mariana Barbosa de Carvalho", especialidade: "Fonoaudióloga", dias: "Terça-feira", horarios: "09:00 às 15:30" },
    ],
  },
  {
    nome: "Nutrição",
    profissionais: [
      { nome: "Regiane Faia", especialidade: "Nutricionista", dias: "Sexta-feira / Sábado", horarios: "14:30 às 17:30 / 09:00 às 11:00" },
    ],
  },
];

const TOTAL_PROFISSIONAIS = ESPECIALIDADES.reduce((acc, e) => acc + e.profissionais.length, 0);

export default function CorpoClinicoPage() {
  const [busca, setBusca] = useState("");
  const [especialidadeAtiva, setEspecialidadeAtiva] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set(ESPECIALIDADES.map((e) => e.nome)));

  const toggleExpandida = (nome: string) => {
    setExpandidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(nome)) novo.delete(nome);
      else novo.add(nome);
      return novo;
    });
  };

  const especialidadesFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return ESPECIALIDADES.filter((esp) => {
      if (especialidadeAtiva && esp.nome !== especialidadeAtiva) return false;
      if (!termo) return true;
      if (esp.nome.toLowerCase().includes(termo)) return true;
      return esp.profissionais.some(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          p.especialidade.toLowerCase().includes(termo) ||
          p.dias.toLowerCase().includes(termo)
      );
    }).map((esp) => ({
      ...esp,
      profissionais: termo
        ? esp.profissionais.filter(
            (p) =>
              p.nome.toLowerCase().includes(termo) ||
              p.especialidade.toLowerCase().includes(termo) ||
              p.dias.toLowerCase().includes(termo)
          )
        : esp.profissionais,
    }));
  }, [busca, especialidadeAtiva]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <Stethoscope size={28} />
          <h2 className="text-2xl font-bold">Corpo Clínico por Especialidade</h2>
        </div>
        <p className="text-blue-100 text-sm">
          Clínica da Criança — {ESPECIALIDADES.length} especialidades · {TOTAL_PROFISSIONAIS} profissionais
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, especialidade ou dia..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Chips de especialidade */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEspecialidadeAtiva(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            especialidadeAtiva === null
              ? "bg-[#1e40af] text-white border-[#1e40af]"
              : "bg-white text-gray-600 border-gray-300 hover:border-[#1e40af] hover:text-[#1e40af]"
          }`}
        >
          Todas ({ESPECIALIDADES.length})
        </button>
        {ESPECIALIDADES.map((esp) => (
          <button
            key={esp.nome}
            onClick={() => setEspecialidadeAtiva(especialidadeAtiva === esp.nome ? null : esp.nome)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              especialidadeAtiva === esp.nome
                ? "bg-[#1e40af] text-white border-[#1e40af]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#1e40af] hover:text-[#1e40af]"
            }`}
          >
            {esp.nome} ({esp.profissionais.length})
          </button>
        ))}
      </div>

      {/* Resultados */}
      {especialidadesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Stethoscope size={32} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum profissional encontrado para &quot;{busca}&quot;.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {especialidadesFiltradas.map((esp) => (
            <Card key={esp.nome} className="overflow-hidden">
              {/* Cabeçalho da especialidade */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                onClick={() => toggleExpandida(esp.nome)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[#1e40af] text-base">{esp.nome}</span>
                  <Badge variant="secondary" className="text-xs">
                    {esp.profissionais.length} profissional{esp.profissionais.length !== 1 ? "is" : ""}
                  </Badge>
                  {esp.profissionais.some((p) => p.semAgenda) && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <AlertTriangle size={13} />
                      {esp.profissionais.filter((p) => p.semAgenda).length} sem agenda
                    </span>
                  )}
                </div>
                {expandidas.has(esp.nome) ? (
                  <ChevronUp size={18} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400 shrink-0" />
                )}
              </button>

              {/* Tabela de profissionais */}
              {expandidas.has(esp.nome) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-5 py-2.5 font-medium">Profissional</th>
                        <th className="text-left px-5 py-2.5 font-medium hidden md:table-cell">Especialidade</th>
                        <th className="text-left px-5 py-2.5 font-medium">
                          <span className="flex items-center gap-1"><CalendarDays size={12} /> Dias</span>
                        </th>
                        <th className="text-left px-5 py-2.5 font-medium hidden lg:table-cell">
                          <span className="flex items-center gap-1"><Clock size={12} /> Horários</span>
                        </th>
                        <th className="text-left px-5 py-2.5 font-medium hidden xl:table-cell">Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {esp.profissionais.map((prof, idx) => (
                        <tr
                          key={idx}
                          className={`border-b last:border-0 transition-colors ${
                            prof.semAgenda
                              ? "bg-amber-50 hover:bg-amber-100"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-gray-800">
                            <div className="flex items-center gap-2">
                              {prof.semAgenda && (
                                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                              )}
                              {prof.nome}
                            </div>
                            {/* Mobile: mostra especialidade e horário inline */}
                            <div className="md:hidden text-xs text-muted-foreground mt-0.5">{prof.especialidade}</div>
                            <div className="lg:hidden text-xs text-muted-foreground mt-0.5">
                              {prof.semAgenda ? (
                                <span className="text-amber-600">Sem agenda cadastrada</span>
                              ) : (
                                prof.horarios
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{prof.especialidade}</td>
                          <td className="px-5 py-3 text-gray-700">
                            {prof.semAgenda ? (
                              <span className="text-amber-600 text-xs font-medium">Sem agenda</span>
                            ) : (
                              prof.dias
                            )}
                          </td>
                          <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{prof.horarios}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs hidden xl:table-cell">
                            {prof.semAgenda ? (
                              <span className="text-amber-600 font-medium">Não liberou horário</span>
                            ) : (
                              prof.observacoes || "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
        <span>Profissionais marcados em amarelo ainda não liberaram seus horários de atendimento.</span>
      </div>
    </div>
  );
}
