// Texto curto de ajuda usado logo abaixo do título (h2) de cada tela,
// explicando em 1-2 frases o que o usuário deve fazer ali. Existe como
// componente (em vez de <p> solto repetido em cada página) só pra manter
// a mesma aparência e facilidade de estilizar tudo de uma vez, se um dia
// precisar mudar (ex: virar um texto que pode ser fechado).

interface Props {
  children: React.ReactNode;
}

export default function AjudaTela({ children }: Props) {
  return <p className="ajuda-tela">{children}</p>;
}
