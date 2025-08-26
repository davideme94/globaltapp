export const formatDate = (d: Date|string) =>
  new Intl.DateTimeFormat('es-AR').format(new Date(d));

export const formatNumber = (n: number) =>
  new Intl.NumberFormat('es-AR').format(n);
