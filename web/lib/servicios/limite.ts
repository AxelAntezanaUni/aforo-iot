// cuenta pedidos por clave en ventanas fijas, en la memoria de la funcion
// cada instancia de vercel tiene su propia cuenta, asi que no es exacto, pero corta
// un abuso que viene de un solo lugar antes de que gaste lecturas y escrituras
export type Limitador = (clave: string, ahora: number) => boolean;

export function crearLimitador(maximo: number, ventanaMs: number, maxClaves = 5000): Limitador {
  const cuentas = new Map<string, { inicio: number; n: number }>();
  return (clave, ahora) => {
    let c = cuentas.get(clave);
    if (!c || ahora - c.inicio >= ventanaMs) {
      // para que la memoria no crezca sin fin si llegan muchas claves distintas
      if (!c && cuentas.size >= maxClaves) cuentas.clear();
      c = { inicio: ahora, n: 0 };
      cuentas.set(clave, c);
    }
    c.n += 1;
    return c.n <= maximo;
  };
}

// ip del cliente segun vercel (el primer valor de x-forwarded-for)
export function ipDe(headers: Headers): string {
  const reenviada = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || headers.get("x-real-ip") || "desconocida";
}
