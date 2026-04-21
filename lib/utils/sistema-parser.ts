// Parser robusto para los Excel de "sistema interno" que envían los
// comedores. Cada comedor maneja un formato distinto; este parser detecta
// el header, mapea columnas por nombre (sinónimos), y extrae las filas
// de datos. También maneja filas de agrupamiento tipo "Nombres: X" /
// "Sub Empresa: Y" / "Apellidos Nombres1: Z" que algunos formatos
// intercalan entre los datos.
//
// Formatos cubiertos (vistos en producción):
//   FADESA       -> columna combinada "Apellidos Nombres" + subheader
//                   "Apellidos Nombres1: X" antes de cada grupo.
//   FUNDICIÓN    -> columnas separadas (Apellidos, Nombres), fecha con hora.
//   ICH          -> igual que FUNDICIÓN, sin columna Precio.
//   MEDLOG       -> igual a FUNDICIÓN + columna "Menus" con plato del día.
//   MOLICENTRO   -> nombre en filas de grupo "Nombres: X, Y", data sin
//                   columna de nombre.

import * as XLSX from 'xlsx';

export interface SistemaRow {
    fecha: string | null;        // ISO yyyy-mm-dd (solo fecha, sin hora)
    apellidos: string | null;
    nombres: string | null;
    dni: string | null;
    servicio: string;            // "ALMUERZOS" / "CENAS" / "DESAYUNOS" / etc.
    servicio_detalle: string | null; // nombre de plato o descripción extendida
    servicio_canonico: string;   // ALMUERZO / CENA / DESAYUNO / AMANECIDA / EXTRA
    cantidad: number;
    tipo_pago: string;           // "Credito" / "Contado"
    valor_empleado: number | null;
    valor_empresa: number | null;
    razon_social: string | null;
    centro_costo: string | null;
    tipo_trabajador: string | null;
}

const HEADER_SYNONYMS: Record<keyof ColMap, string[]> = {
    fecha: ['FECHA', 'FECHA REGISTRO'],
    apellidos_nombres: ['APELLIDOS NOMBRES', 'APELLIDOS Y NOMBRES'],
    apellidos: ['APELLIDOS', 'APELLIDO'],
    nombres: ['NOMBRES', 'NOMBRE'],
    dni: ['DNI', 'DOCUMENTO', 'CEDULA'],
    id_empleado: ['ID EMPLEADO', 'ID-EMPLEADO', 'COD EMPLEADO', 'CODIGO EMPLEADO'],
    fotocheck: ['FOTOCHECK', 'FOTOCHEK'],
    id_registro: ['ID REGISTRO'],
    servicio: ['SERVICIO', 'ARTICULO', 'PRODUCTO', 'DESCRIPCION'],
    detalle: ['MENUS', 'MENU', 'PLATO', 'ARTICULO'],
    cantidad: ['CANTIDAD', 'CANT', 'MENUS'],
    tipo_pago: ['TIPO', 'TIPO PAGO', 'FORMA DE PAGO', 'TIPO COMENSAL', 'CREDITO'],
    valor_empleado: ['VALOR EMPLEADO', 'VALOR_EMPLEADO'],
    valor_empresa: ['VALOR EMPRESA', 'VALOR_EMPRESA', 'VALOR EMPRESA CIGV', 'VALOR EMPRESA SIGV'],
    razon_social: ['RAZON SOCIAL', 'SUB EMPRESA', 'EMPRESA', 'SUBDIVISION', 'UNIDAD'],
    centro_costo: ['CENTRO COSTO', 'CCOSTO', 'ID CCOSTO', 'CENTRO'],
    tipo_trabajador: ['CARGO', 'TIPO TRABAJADOR', 'TIPO-TRABAJADOR'],
    precio: ['PRECIO', 'PRECIO UNIT', 'PRECIO UNITARIO'],
    total: ['TOTAL'],
    articulo_id: ['ID ARTICULO'],
};

interface ColMap {
    fecha?: number;
    apellidos?: number;
    nombres?: number;
    apellidos_nombres?: number;   // columna combinada
    dni?: number;
    id_empleado?: number;
    fotocheck?: number;
    id_registro?: number;
    servicio?: number;
    detalle?: number;
    cantidad?: number;
    tipo_pago?: number;
    valor_empleado?: number;
    valor_empresa?: number;
    razon_social?: number;
    centro_costo?: number;
    tipo_trabajador?: number;
    precio?: number;
    total?: number;
    articulo_id?: number;
}

// Normaliza nombre de servicio a categoría canónica para el cruce
const SERVICE_MAP: Record<string, string> = {
    ALMUERZOS: 'ALMUERZO',
    ALMUERZO: 'ALMUERZO',
    'ALMUERZO SUBVENCIONADO': 'ALMUERZO',
    'ALMUERZO NORMAL': 'ALMUERZO',
    'ALMUERZO DIETA': 'ALMUERZO',
    'ALMUERZO TERCERO': 'ALMUERZO',
    'MENU CAPACITACION': 'ALMUERZO',
    'ALMUERZO INVITADO': 'ALMUERZO',
    'ALMUERZO GXO': 'ALMUERZO',
    DESAYUNOS: 'DESAYUNO',
    DESAYUNO: 'DESAYUNO',
    'DESAYUNO DOBLE': 'DESAYUNO',
    'DESAYUNO TERCERO': 'DESAYUNO',
    'DESAYUNO CUPON': 'DESAYUNO',
    CENAS: 'CENA',
    CENA: 'CENA',
    'CENA SISTEMA': 'CENA',
    'CENA INVITADO': 'CENA',
    AMANECIDAS: 'AMANECIDA',
    AMANECIDA: 'AMANECIDA',
    LONCHE: 'LONCHE',
    LONCHES: 'LONCHE',
    PAN: 'PAN',
    PANES: 'PAN',
    'PAN VARIADO': 'PAN',
    BEBIDA: 'BEBIDA',
    BEBIDAS: 'BEBIDA',
    'REFRIGERIOS CURSOS': 'EXTRA',
    COMBO: 'EXTRA',
    COMBOS: 'EXTRA',
    'COFFE BREAK': 'EXTRA',
};

function canonicalService(name: string): string {
    const n = (name || '').toUpperCase().trim();
    if (SERVICE_MAP[n]) return SERVICE_MAP[n];
    if (n.includes('ALMUERZ')) return 'ALMUERZO';
    if (n.includes('CENA')) return 'CENA';
    if (n.includes('DESAYUN')) return 'DESAYUNO';
    if (n.includes('AMANEC')) return 'AMANECIDA';
    if (n.includes('LONCHE')) return 'LONCHE';
    if (n.includes('PAN') && !n.includes('PANE')) return 'PAN';
    if (n.includes('PAN')) return 'PAN';
    if (n.includes('BEBID') || n.includes('JUGO') || n.includes('CAF')) return 'BEBIDA';
    return 'EXTRA';
}

// Busca índice de columna comparando contra sinónimos. Devuelve -1 si no encuentra.
function findCol(headers: string[], targets: string[]): number {
    const hNorm = headers.map(h => (h || '').toString().toUpperCase().trim());
    // Primero busca match exacto
    for (const t of targets) {
        const i = hNorm.indexOf(t);
        if (i >= 0) return i;
    }
    // Después busca por includes en orden de especificidad (sinónimo más largo primero)
    const sorted = [...targets].sort((a, b) => b.length - a.length);
    for (let i = 0; i < hNorm.length; i++) {
        for (const t of sorted) {
            if (hNorm[i].includes(t)) return i;
        }
    }
    return -1;
}

function buildColMap(headers: string[]): ColMap {
    const map: ColMap = {};
    // Detectamos primero la columna combinada "Apellidos Nombres"
    const combined = findCol(headers, HEADER_SYNONYMS.apellidos_nombres);
    if (combined >= 0) map.apellidos_nombres = combined;
    else {
        const ap = findCol(headers, HEADER_SYNONYMS.apellidos);
        if (ap >= 0) map.apellidos = ap;
        const nom = findCol(headers, HEADER_SYNONYMS.nombres);
        if (nom >= 0 && nom !== ap) map.nombres = nom;
    }
    const fields: (keyof ColMap)[] = [
        'fecha', 'dni', 'id_empleado', 'fotocheck', 'id_registro',
        'servicio', 'detalle', 'cantidad', 'tipo_pago',
        'valor_empleado', 'valor_empresa', 'razon_social', 'centro_costo',
        'tipo_trabajador', 'precio', 'total', 'articulo_id',
    ];
    for (const f of fields) {
        const i = findCol(headers, HEADER_SYNONYMS[f]);
        if (i >= 0) (map as any)[f] = i;
    }
    return map;
}

function parseDate(val: any): string | null {
    if (val === null || val === undefined || val === '') return null;
    // Excel serial date
    if (typeof val === 'number') {
        const d = XLSX.SSF.parse_date_code(val);
        if (d) {
            const m = String(d.m).padStart(2, '0');
            const day = String(d.d).padStart(2, '0');
            return `${d.y}-${m}-${day}`;
        }
    }
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(val).trim();
    // DD/MM/YYYY or DD/MM/YYYY HH:mm[:ss]
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
        let y = Number(m[3]);
        if (y < 100) y += 2000;
        const mm = String(Number(m[2])).padStart(2, '0');
        const dd = String(Number(m[1])).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    }
    // ISO
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return null;
}

function splitApellidosNombres(full: string): { apellidos: string; nombres: string } {
    const t = full.trim();
    if (!t) return { apellidos: '', nombres: '' };
    // Casos:
    //   "ALBORNOZ GIL FRANKLIN FREDDY"  -> no tiene coma, asumir 2 apellidos + resto nombres
    //   "ALBUJAR PINEDA, JESSICA"      -> separado por coma
    if (t.includes(',')) {
        const [ap, nom] = t.split(',');
        return { apellidos: (ap || '').trim(), nombres: (nom || '').trim() };
    }
    const parts = t.split(/\s+/);
    if (parts.length <= 2) return { apellidos: parts[0] || '', nombres: parts.slice(1).join(' ') };
    // Heurística: primeros 2 tokens = apellidos, resto = nombres
    return { apellidos: parts.slice(0, 2).join(' '), nombres: parts.slice(2).join(' ') };
}

function cleanDni(raw: any): string | null {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '').trim();
    if (!digits) return null;
    return digits.substring(0, 12);
}

// Detecta si una fila es un subheader con nombre acumulado para las siguientes filas.
// Devuelve null si no es subheader, sino el nombre extraído.
function detectGroupHeader(row: any[]): string | null {
    const first = String(row[0] || '').toUpperCase();
    // "Nombres: ALBUJAR PINEDA, JESSICA"
    const m1 = first.match(/NOMBRES?\s*:\s*(.+)$/i);
    if (m1) return m1[1].trim();
    // "Apellidos Nombres1: ALBORNOZ GIL FRANKLIN FREDDY"
    const m2 = first.match(/APELLIDOS?\s+NOMBRES?\s*\d*\s*:\s*(.+)$/i);
    if (m2) return m2[1].trim();
    // "Sub Empresa: MOLICENTRO"
    // No es nombre de persona, lo ignoramos.
    if (first.startsWith('SUB EMPRESA:')) return null;
    // "Empresa:" también sólo contexto
    return null;
}

// Las filas totalizadoras (que sólo tienen números en las últimas columnas y
// ningún servicio) se filtran naturalmente más abajo porque no tienen servicio
// asociado. No hace falta una heurística específica.

// Localiza la fila de cabecera: primera fila con >=4 celdas que matcheen sinónimos conocidos
function findHeaderRow(raw: any[][]): number {
    for (let i = 0; i < Math.min(15, raw.length); i++) {
        const row = raw[i];
        if (!row) continue;
        const str = row.map((c: any) => (c || '').toString().toUpperCase());
        const matches = str.filter(c =>
            c.includes('FECHA') || c.includes('DNI') || c.includes('APELLIDO') ||
            c.includes('NOMBRE') || c.includes('SERVICIO') || c.includes('ARTICULO') ||
            c.includes('DESCRIPCION') || c.includes('CANTIDAD') || c.includes('VALOR')
        ).length;
        if (matches >= 3) return i;
    }
    return 0;
}

export interface ParseStats {
    sheetsProcessed: string[];
    totalRows: number;
    skippedGroupHeaders: number;
    skippedTotals: number;
    skippedEmpty: number;
}

// Hoja nombrada de forma rara o hoja metadata que queremos saltarnos
function isSkipSheet(name: string): boolean {
    const n = name.toUpperCase();
    return n.includes('RESUMEN') || n.includes('CARATULA') || n.includes('PORTADA') || n === 'GRAFICO';
}

// Una pestaña (p.ej. en FITESA) puede tener el servicio como parte del nombre
// de la hoja en vez de una columna. Devuelve el servicio inferido o null.
function inferServiceFromSheetName(name: string): string | null {
    const n = name.toUpperCase();
    const tokens = ['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN'];
    for (const t of tokens) if (n.includes(t)) return t + (n.includes('S') && !n.endsWith(t) ? 'S' : '');
    return null;
}

export function parseWorkbook(wb: XLSX.WorkBook): { rows: SistemaRow[]; stats: ParseStats } {
    const rows: SistemaRow[] = [];
    const stats: ParseStats = { sheetsProcessed: [], totalRows: 0, skippedGroupHeaders: 0, skippedTotals: 0, skippedEmpty: 0 };

    for (const sheetName of wb.SheetNames) {
        if (isSkipSheet(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
        if (raw.length < 2) continue;

        const headerIdx = findHeaderRow(raw);
        const headers = (raw[headerIdx] as any[]).map(c => String(c || '').trim());
        const col = buildColMap(headers);
        const sheetService = inferServiceFromSheetName(sheetName);
        stats.sheetsProcessed.push(sheetName);

        // Contexto de grupo (nombre vigente para las siguientes data rows)
        let groupApellidos = '';
        let groupNombres = '';

        for (let i = headerIdx + 1; i < raw.length; i++) {
            const row = raw[i] as any[];
            if (!row || row.every(c => c === '' || c === null || c === undefined)) {
                stats.skippedEmpty++;
                continue;
            }

            // Subheader con nombre → actualiza contexto y salta
            const gh = detectGroupHeader(row);
            if (gh) {
                const split = splitApellidosNombres(gh);
                groupApellidos = split.apellidos;
                groupNombres = split.nombres;
                stats.skippedGroupHeaders++;
                continue;
            }

            const get = (k: keyof ColMap) => col[k] !== undefined ? row[col[k] as number] : undefined;

            // Nombres / apellidos — prioridad: cols separadas > col combinada > grupo
            let apellidos = '';
            let nombres = '';
            if (col.apellidos !== undefined) apellidos = String(get('apellidos') || '').trim();
            if (col.nombres !== undefined) nombres = String(get('nombres') || '').trim();
            if (!apellidos && !nombres && col.apellidos_nombres !== undefined) {
                const combined = String(get('apellidos_nombres') || '').trim();
                if (combined) {
                    const split = splitApellidosNombres(combined);
                    apellidos = split.apellidos;
                    nombres = split.nombres;
                }
            }
            if (!apellidos && !nombres) {
                apellidos = groupApellidos;
                nombres = groupNombres;
            }

            const dni = cleanDni(get('dni') || get('fotocheck') || get('id_registro') || get('id_empleado'));
            const fecha = parseDate(get('fecha'));

            // Servicio: col servicio > col detalle > nombre de hoja (FITESA case)
            let servicioRaw = String(get('servicio') || '').trim();
            if (!servicioRaw) servicioRaw = String(get('detalle') || '').trim();
            if (!servicioRaw && sheetService) servicioRaw = sheetService;
            if (!servicioRaw) continue; // sin servicio no nos sirve la fila

            const detalle = String(get('detalle') || '').trim();
            const cantRaw = Number(get('cantidad') ?? 1);

            const tipo = String(get('tipo_pago') || 'Credito');
            const tipoPago = tipo.toUpperCase().includes('CONTAD') ? 'Contado' : 'Credito';

            const valEmp = Number(get('valor_empleado') ?? 0);
            const valEmpr = Number(get('valor_empresa') ?? 0);

            rows.push({
                fecha,
                apellidos: apellidos || null,
                nombres: nombres || null,
                dni,
                servicio: servicioRaw,
                servicio_detalle: detalle || null,
                servicio_canonico: canonicalService(servicioRaw),
                cantidad: isNaN(cantRaw) ? 1 : cantRaw,
                tipo_pago: tipoPago,
                valor_empleado: isNaN(valEmp) ? null : valEmp,
                valor_empresa: isNaN(valEmpr) ? null : valEmpr,
                razon_social: String(get('razon_social') || '').trim() || null,
                centro_costo: String(get('centro_costo') || '').trim() || null,
                tipo_trabajador: String(get('tipo_trabajador') || '').trim() || null,
            });
            stats.totalRows++;
        }
    }

    return { rows, stats };
}
