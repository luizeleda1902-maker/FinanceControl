// Conjunto de ícones de linha (estilo "outline"), desenhados à mão em SVG
// puro — sem depender de nenhuma biblioteca de ícones externa. Usam
// `stroke="currentColor"`, ou seja, sempre herdam a cor de texto do lugar
// onde são usados (por isso o ícone do menu fica azul quando a aba está
// ativa, sem precisar de nenhuma prop de cor).

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Propriedades repetidas em todos os ícones (linha fina, arredondada).
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Usado na aba "Início" do menu inferior.
export function IconHome({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

// Usado na aba "Lançamentos" do menu inferior.
export function IconWallet({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5V9H4.5A1.5 1.5 0 0 1 3 7.5Z" />
      <path d="M3 7.5V17a1.5 1.5 0 0 0 1.5 1.5H19a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 10H15a2 2 0 0 0 0 4h5.5" />
    </svg>
  );
}

// Usado na aba "Contas" do menu inferior (contas fixas + parcelamentos).
export function IconCalendar({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
    </svg>
  );
}

// Usado na aba "Metas" do menu inferior (orçamentos mensais).
export function IconTarget({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

// Usado na aba "Relatórios" do menu inferior.
export function IconChart({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M4 20h14" />
    </svg>
  );
}

// Olho aberto: mostrado quando o modo privado está DESLIGADO (valores visíveis).
export function IconEye({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

// Olho riscado: mostrado quando o modo privado está LIGADO (valores ocultos).
export function IconEyeOff({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M4 4l16 16" />
      <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a13.4 13.4 0 0 1-3.3 3.9M7.4 7.9C4.6 9.6 2.5 12 2.5 12S6 18 12 18c1 0 1.9-.15 2.75-.42" />
      <path d="M9.6 10.2a2.7 2.7 0 0 0 3.9 3.7" />
    </svg>
  );
}

// Usado na aba "Cartões" da tela de Contas.
export function IconCard({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M6 14.5h5" />
    </svg>
  );
}

// Usado no botão "Exportar relatório em PDF".
export function IconFileText({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 12.5h6M9 15.5h6" />
    </svg>
  );
}

// Engrenagem: usado no botão de Ajustes no topo do app.
export function IconSettings({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.55 1.55M7.85 16.15 6.3 17.7M17.7 17.7l-1.55-1.55M7.85 7.85 6.3 6.3" />
    </svg>
  );
}
