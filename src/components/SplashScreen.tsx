// Tela de abertura mostrada por cima do app enquanto ele carrega (ver
// App.tsx). Existe só pra dar uma "cara" de app de verdade ao abrir —
// principalmente quando instalado como PWA no celular, onde a splash do
// sistema operacional é bem básica — e some sozinha assim que os dados
// iniciais terminam de carregar.

interface Props {
  // true assim que o app está pronto: dispara a animação de saída (fade).
  saindo: boolean;
  // Chamado quando a animação de saída termina, pra quem usa remover este
  // componente da árvore (ver App.tsx).
  onSaiu: () => void;
}

export default function SplashScreen({ saindo, onSaiu }: Props) {
  return (
    <div
      className={`splash${saindo ? ' splash-saindo' : ''}`}
      onTransitionEnd={(e) => {
        // Só a transição de opacity marca o fim da saída — evita disparar
        // onSaiu por causa de alguma outra propriedade animada no filho.
        if (e.propertyName === 'opacity' && saindo) onSaiu();
      }}
    >
      <img src="/icon-512.png" alt="" className="splash-logo" />
      <span className="splash-title">
        <span className="topbar-title-bold">Finance</span>
        <span className="topbar-title-light">Control</span>
      </span>
    </div>
  );
}
