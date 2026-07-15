import { ImageResponse } from "next/og";

export const runtime = "edge";

// Ícones do PWA (192 e 512) gerados dinamicamente: fundo azul com "HER".
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = params.size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e3a8a",
          color: "#ffffff",
          fontSize: Math.round(size * 0.32),
          fontWeight: 800,
          letterSpacing: -2,
          fontFamily: "sans-serif",
        }}
      >
        HER
      </div>
    ),
    { width: size, height: size },
  );
}
