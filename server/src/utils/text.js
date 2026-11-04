/** Remove acentos e converte para minúsculas — usado na busca. */
export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

/** Formata telefone brasileiro: (11) 98765-4321 / (11) 3456-7890. */
export function formatPhone(value = '') {
  const d = onlyDigits(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

/** Escapa caracteres especiais para uso seguro em RegExp. */
export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
