// Reglas especiales de totalización por comedor.
//
// - MACHU PICCHU: Solo los campos "CONSUMIDO" (singular/plural) entran al total
//   de ALMUERZO / CENA / DESAYUNO. Los demás (SOLICITADO, QUEBRADO) se siguen
//   registrando en el detalle con cantidad y precio pero no suman al total.
// - MEDLOG: Solo los campos "TICKETS" entran al total de ALMUERZO / CENA. Los
//   campos SISTEMA se envían en el detalle pero no suman al total.

export const MACHU_PICCHU_ID = '7aa14f4e-b005-445e-a51f-b0f298c26d7a';
export const MEDLOG_ID = '12ad1853-0e56-4390-809f-027dd792f12c';

export type CategoriaComida = 'DESAYUNO' | 'ALMUERZO' | 'CENA' | string;

// Devuelve true si el campo debe contarse en el TOTAL para ese comedor/categoría.
export function campoSumaEnTotal(
    comedorId: string | null | undefined,
    categoria: string,
    nombreCampo: string
): boolean {
    if (!comedorId) return true;
    const nombre = (nombreCampo || '').toUpperCase();

    if (comedorId === MACHU_PICCHU_ID) {
        if (categoria === 'ALMUERZO' || categoria === 'CENA' || categoria === 'DESAYUNO') {
            return nombre.includes('CONSUMIDO');
        }
        // Extras (coffe break, pack descartables) sí suman
        return true;
    }

    if (comedorId === MEDLOG_ID) {
        if (categoria === 'ALMUERZO' || categoria === 'CENA') {
            return nombre.includes('TICKETS') || nombre.includes('TICKET');
        }
        return true;
    }

    return true;
}

// Mismo criterio pero aplicado al cruce (daily vs weekly).
// Para MACHU PICCHU y MEDLOG el acumulado diario debe considerar únicamente los
// campos que efectivamente entran al total, para que cuadre con el semanal.
export function campoEntraAlCruce(
    comedorId: string | null | undefined,
    categoria: string,
    nombreCampo: string
): boolean {
    return campoSumaEnTotal(comedorId, categoria, nombreCampo);
}
