/**
 * Moldura das telas de acesso (login, esqueci a senha, nova senha):
 * fundo claro com um toque do azul HER, logo oficial e rodapé de aviso.
 */
export function AuthShell({
  subtitle,
  children,
  footer = "Acesso restrito a colaboradores. Em caso de problemas, contate o suporte de TI.",
}: {
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#eaf0fd] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-horizontal.png"
            alt="Hospital Evandro Ribeiro"
            className="mx-auto h-14 w-auto"
          />
          <p className="mt-3 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="[&>div]:rounded-2xl [&>div]:border-border [&>div]:shadow-xl [&>div]:shadow-slate-200/60">
          {children}
        </div>
        {footer && <p className="text-center text-slate-400 text-xs mt-6">{footer}</p>}
      </div>
    </div>
  );
}
