// Campo de categoria em texto livre: o usuário digita qualquer nome, sem
// estar preso a uma lista fixa (Saúde, Lazer...). As categorias já
// existentes aparecem como sugestão de autocompletar (via <datalist>), mas
// digitar um nome novo é permitido — a categoria correspondente só é
// criada de fato no banco quando o formulário é salvo (ver
// buscarOuCriarCategoria em db.ts), então navegar sem salvar não deixa
// categorias "fantasma" pra trás.

import { useEffect, useId, useState } from 'react';
import { listarCategorias, type TipoTransacao } from '../db';

interface Props {
  tipo: TipoTransacao;
  value: string;
  onChange: (nome: string) => void;
  placeholder?: string;
}

export default function CategoriaInput({ tipo, value, onChange, placeholder }: Props) {
  const listId = useId();
  const [sugestoes, setSugestoes] = useState<string[]>([]);

  // Recarrega as sugestões sempre que o tipo (receita/despesa) mudar —
  // não faz sentido sugerir "Salário" num campo de despesa.
  useEffect(() => {
    listarCategorias(tipo).then((lista) => setSugestoes(lista.map((c) => c.nome)));
  }, [tipo]);

  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Ex: Educação'}
      />
      <datalist id={listId}>
        {sugestoes.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>
    </>
  );
}
