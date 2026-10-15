import { InsecureIcon } from './icons'

// "Não seguro": o endereço é http, sem criptografia. Ícone e texto em cor secundária, sem alarme
export function InsecureMark({ small = false }: { small?: boolean }) {
  return (
    <span
      class="insecure"
      data-small={small}
      title="A conexão com este site não é criptografada"
    >
      <InsecureIcon size={small ? 11 : 12} />
      <span class="insecure-text">Não seguro</span>
    </span>
  )
}
