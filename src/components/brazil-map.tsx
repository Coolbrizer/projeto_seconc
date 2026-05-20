"use client";

import { useMemo } from "react";

import brazilSvgMap from "@/lib/brazil-svg-map";

type SvgMapLocation = {
  name: string;
  id: string;
  path: string;
};

type SvgMapData = {
  label: string;
  viewBox: string;
  locations: SvgMapLocation[];
};

const MAP_DATA = brazilSvgMap as SvgMapData;

/**
 * Paleta de cores usada para destacar cada polo no mapa.
 * Tons distintos o suficiente para diferenciar até 12 polos sem ambiguidade visual.
 */
const POLO_COLORS: readonly string[] = [
  "#a78bfa", // violet-400
  "#f472b6", // pink-400
  "#fbbf24", // amber-400
  "#34d399", // emerald-400
  "#60a5fa", // blue-400
  "#fb7185", // rose-400
  "#818cf8", // indigo-400
  "#2dd4bf", // teal-400
  "#fb923c", // orange-400
  "#a3e635", // lime-400
  "#38bdf8", // sky-400
  "#c084fc", // purple-400
];

export type BrazilMapPolo = {
  id: string;
  label: string;
  members: string[];
};

type BrazilMapProps = {
  /** Polos atualmente configurados. Cada polo recebe uma cor da paleta na ordem em que aparece. */
  polos: BrazilMapPolo[];
  /** Texto exibido em pequeno acima do mapa (ex.: "Cenário X carregado"). */
  caption?: string;
};

/**
 * Mapa simples do Brasil em SVG. Cada UF é um <path> branco com contorno preto;
 * UFs que fazem parte de um polo recebem a cor associada ao polo.
 * O viewBox é fixo (`0 0 613 639`) e a altura responde ao container.
 */
export function BrazilMap({ polos, caption }: BrazilMapProps) {
  const { ufToColor, poloLegend } = useMemo(() => {
    const ufToColor = new Map<string, string>();
    const poloLegend: { label: string; color: string; members: string[] }[] = [];
    polos.forEach((polo, index) => {
      const color = POLO_COLORS[index % POLO_COLORS.length];
      poloLegend.push({ label: polo.label, color, members: polo.members });
      for (const uf of polo.members) {
        ufToColor.set(uf.toUpperCase(), color);
      }
    });
    return { ufToColor, poloLegend };
  }, [polos]);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mapa de polos</h2>
          <p className="text-xs text-slate-500">
            Cada UF agrupada em um polo recebe uma cor. UFs em branco continuam
            como unidades individuais.
          </p>
        </div>
        {caption && (
          <p className="text-xs font-medium text-slate-600">{caption}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:items-start">
        <div className="mx-auto w-full max-w-xl">
          <svg
            viewBox={MAP_DATA.viewBox}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Mapa do Brasil com destaque para polos"
            className="h-auto w-full"
          >
            {MAP_DATA.locations.map((location) => {
              const uf = location.id.toUpperCase();
              const fill = ufToColor.get(uf) ?? "#ffffff";
              return (
                <path
                  key={location.id}
                  d={location.path}
                  fill={fill}
                  stroke="#0f172a"
                  strokeWidth={0.6}
                  strokeLinejoin="round"
                >
                  <title>
                    {location.name} ({uf})
                  </title>
                </path>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Legenda
          </p>
          {poloLegend.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
              Nenhum polo criado. Marque UFs na tabela abaixo e clique em{" "}
              <strong>Criar polo</strong> para vê-las destacadas no mapa.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {poloLegend.map(({ label, color, members }) => (
                <li
                  key={label}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 inline-block h-3 w-3 flex-shrink-0 rounded-sm border border-slate-900/40"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {label}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {members.join(" + ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
