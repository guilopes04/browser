// Nome da partição persistente de um espaço: cookies, logins e permissões ficam separados.
export function getPartitionName(spaceId: string): string {
  return `persist:space-${spaceId}`
}
