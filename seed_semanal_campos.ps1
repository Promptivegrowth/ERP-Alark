
# Script: seed_semanal_campos.ps1
# Inserta los campos semanales para los 17 comedores segun la spec

$token = "sbp_3cdcd5b2882c632fa6486fd8b17b20a9455a446e"
$url = "https://api.supabase.com/v1/projects/zuyqjhpiskokhtuuqltu/database/query"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

function Run-SQL($label, $sql) {
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body | Out-Null
        Write-Host "OK: $label"
    } catch {
        $err = $_.ErrorDetails.Message
        Write-Host "FAIL: $label => $err"
    }
}

# Obtener IDs de comedores
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body (@{ query = "SELECT id, nombre FROM comedores ORDER BY nombre" } | ConvertTo-Json -Compress)
Write-Host "Comedores:"
$r | ForEach-Object { Write-Host " - $($_.nombre): $($_.id)" }

# Guardar IDs en hashtable
$ids = @{}
$r | ForEach-Object { $ids[$_.nombre] = $_.id }

# ---- Funcion helper para insertar campos ----
function Insert-Campos($comedorNombre, $campos) {
    $cid = $ids[$comedorNombre]
    if (-not $cid) { Write-Host "WARN: No encontrado comedor '$comedorNombre'"; return }
    
    foreach ($c in $campos) {
        $name = $c.nombre -replace "'", "''"
        $sec  = $c.seccion -replace "'", "''"
        $fact = if ($c.facturable -eq $false) { "false" } else { "true" }
        $cruz = if ($c.cruce) { "'$($c.cruce)'" } else { "NULL" }
        $prec = if ($c.precio) { $c.precio } else { "NULL" }
        $sql = "INSERT INTO reporte_semanal_campos (comedor_id, nombre_campo, seccion, precio_ref, es_facturable, categoria_cruce, orden) VALUES ('$cid', '$name', '$sec', $prec, $fact, $cruz, $($c.orden)) ON CONFLICT (comedor_id, nombre_campo) DO NOTHING"
        Run-SQL "'$name' > $comedorNombre" $sql
    }
}

# =============================================
# TOTTUS CDF
# =============================================
$cdfId = $ids["TOTTUS-CDF"]
if (-not $cdfId) { $cdfId = ($r | Where-Object { $_.nombre -match "CDF" }).id }

$campos_tottus_base = @(
    @{nombre="DESAYUNO ALMARK";seccion="ALMARK";facturable=$true;cruce="DESAYUNO";precio="NULL";orden=1},
    @{nombre="ALMUERZO ALMARK";seccion="ALMARK";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=2},
    @{nombre="MERIENDAS DIA Y NOCHE ALMARK";seccion="ALMARK";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=3},
    @{nombre="BEBIDAS + 2 PANES ALMARK";seccion="ALMARK";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=4},
    @{nombre="SOLO 2 PANES ALMARK";seccion="ALMARK";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=5},
    @{nombre="CENA ALMARK";seccion="ALMARK";facturable=$true;cruce="CENA";precio="NULL";orden=6},
    @{nombre="PANES TOTTUS";seccion="TOTTUS";facturable=$false;cruce=$null;precio="NULL";orden=7},
    @{nombre="BEBIDAS TOTTUS";seccion="TOTTUS";facturable=$false;cruce=$null;precio="NULL";orden=8},
    @{nombre="ALMUERZOS TOTTUS";seccion="TOTTUS";facturable=$false;cruce=$null;precio="NULL";orden=9},
    @{nombre="CENAS TOTTUS";seccion="TOTTUS";facturable=$false;cruce=$null;precio="NULL";orden=10}
)

# CDF, CDS, PPA - misma base
foreach ($cn in @("TOTTUS-CDF","TOTTUS-CDS","TOTTUS-PPA")) {
    Insert-Campos $cn $campos_tottus_base
}

# CDS tiene campo extra
Insert-Campos "TOTTUS-CDS" @(@{nombre="ALMUERZOS RGIS";seccion="TOTTUS";facturable=$false;cruce=$null;precio="NULL";orden=11})

# =============================================
# MACHU PICCHU
# =============================================
Insert-Campos "MACHU PICCHU" @(
    @{nombre="DESAYUNO SOLICITADO";seccion="DESAYUNO";facturable=$true;cruce="DESAYUNO";precio="NULL";orden=1},
    @{nombre="DESAYUNO CONSUMIDO";seccion="DESAYUNO";facturable=$false;cruce="DESAYUNO";precio="NULL";orden=2},
    @{nombre="DESAYUNO QUEBRADO";seccion="DESAYUNO";facturable=$false;cruce=$null;precio="NULL";orden=3},
    @{nombre="ALMUERZO SOLICITADO";seccion="ALMUERZO";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=4},
    @{nombre="ALMUERZO CONSUMIDO";seccion="ALMUERZO";facturable=$false;cruce="ALMUERZO";precio="NULL";orden=5},
    @{nombre="ALMUERZO QUEBRADO";seccion="ALMUERZO";facturable=$false;cruce=$null;precio="NULL";orden=6},
    @{nombre="CENA SOLICITADO";seccion="CENA";facturable=$true;cruce="CENA";precio="NULL";orden=7},
    @{nombre="CENA CONSUMIDO";seccion="CENA";facturable=$false;cruce="CENA";precio="NULL";orden=8},
    @{nombre="CENA QUEBRADO";seccion="CENA";facturable=$false;cruce=$null;precio="NULL";orden=9},
    @{nombre="COFFE BREAK / EVENTOS";seccion="EXTRAS";facturable=$true;cruce=$null;precio="NULL";orden=10},
    @{nombre="PACK DESCARTABLES";seccion="EXTRAS";facturable=$true;cruce=$null;precio="NULL";orden=11}
)

# =============================================
# METALPREN
# =============================================
Insert-Campos "METALPREN" @(
    @{nombre="DESAYUNO (2 PANES + 1 BEBIDA)";seccion="CREDITO";facturable=$true;cruce="DESAYUNO";precio="4.20";orden=1},
    @{nombre="ALMUERZO";seccion="CREDITO";facturable=$true;cruce="ALMUERZO";precio="11.30";orden=2},
    @{nombre="ALMUERZO DIETA";seccion="CREDITO";facturable=$true;cruce="ALMUERZO";precio="11.30";orden=3},
    @{nombre="CENA";seccion="CREDITO";facturable=$true;cruce="CENA";precio="11.30";orden=4},
    @{nombre="CENA DIETA";seccion="CREDITO";facturable=$true;cruce="CENA";precio="11.30";orden=5},
    @{nombre="CALDO DE GALLINA";seccion="CREDITO";facturable=$true;cruce=$null;precio="6.00";orden=6},
    @{nombre="TERMOS DE CAFE (AMANECIDA)";seccion="CREDITO";facturable=$true;cruce=$null;precio="60.00";orden=7},
    @{nombre="VASO DE JUGO";seccion="CREDITO";facturable=$true;cruce=$null;precio="4.00";orden=8},
    @{nombre="CARTA 1";seccion="CARTAS";facturable=$true;cruce=$null;precio="15.00";orden=9},
    @{nombre="CARTA 2";seccion="CARTAS";facturable=$true;cruce=$null;precio="18.00";orden=10},
    @{nombre="CARTA 3";seccion="CARTAS";facturable=$true;cruce=$null;precio="22.00";orden=11},
    @{nombre="PAN / CHICHARRON";seccion="CONTADOS";facturable=$true;cruce=$null;precio="5.00";orden=12},
    @{nombre="PAN";seccion="CONTADOS";facturable=$true;cruce=$null;precio="1.50";orden=13},
    @{nombre="BEBIDAS";seccion="CONTADOS";facturable=$true;cruce=$null;precio="NULL";orden=14},
    @{nombre="HUEVO";seccion="CONTADOS";facturable=$true;cruce=$null;precio="1.50";orden=15},
    @{nombre="COFFE BREAK";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=16}
)

# =============================================
# TECSUR
# =============================================
Insert-Campos "TECSUR" @(
    @{nombre="ALMUERZO";seccion="CREDITO";facturable=$true;cruce="ALMUERZO";precio="12.90";orden=1},
    @{nombre="SEGUNDO SOLO";seccion="CREDITO";facturable=$true;cruce="ALMUERZO";precio="9.00";orden=2},
    @{nombre="PLATO A LA CARTA 18";seccion="CREDITO";facturable=$true;cruce=$null;precio="18.00";orden=3},
    @{nombre="PLATO A LA CARTA 20";seccion="CREDITO";facturable=$true;cruce=$null;precio="20.00";orden=4},
    @{nombre="COMBO 1";seccion="CREDITO";facturable=$true;cruce=$null;precio="5.00";orden=5},
    @{nombre="COMBO 2";seccion="CREDITO";facturable=$true;cruce=$null;precio="6.00";orden=6},
    @{nombre="PANES 1.5";seccion="CREDITO";facturable=$true;cruce="PAN";precio="1.50";orden=7},
    @{nombre="PANES 2";seccion="CREDITO";facturable=$true;cruce="PAN";precio="2.00";orden=8},
    @{nombre="PAN CON CHICHARRON 5";seccion="CREDITO";facturable=$true;cruce=$null;precio="5.00";orden=9},
    @{nombre="BEB. CALIENTES 2";seccion="CREDITO";facturable=$true;cruce=$null;precio="2.00";orden=10},
    @{nombre="BEB. CALIENTES 2.5";seccion="CREDITO";facturable=$true;cruce=$null;precio="2.50";orden=11},
    @{nombre="CAFE 2";seccion="CREDITO";facturable=$true;cruce=$null;precio="2.00";orden=12},
    @{nombre="JUGO 4";seccion="CREDITO";facturable=$true;cruce=$null;precio="4.00";orden=13},
    @{nombre="ENTRADA / SOPA";seccion="CREDITO";facturable=$true;cruce=$null;precio="3.00";orden=14},
    @{nombre="POSTRE";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=15},
    @{nombre="ENSALADA";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=16},
    @{nombre="PORCION DE HUEVO";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=17},
    @{nombre="TAMAL";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=18},
    @{nombre="FRUTA UND";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=19},
    @{nombre="TAPER DESCARTABLES";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=20},
    @{nombre="PACK DESCARTABLES";seccion="CREDITO";facturable=$true;cruce=$null;precio="NULL";orden=21},
    @{nombre="LONCHERAS";seccion="CONTADOS";facturable=$true;cruce=$null;precio="27.50";orden=22},
    @{nombre="COFFE / OTROS";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=23}
)

# =============================================
# RANSA
# =============================================
Insert-Campos "RANSA" @(
    @{nombre="ALMUERZO";seccion="CREDITO RANSA";facturable=$true;cruce="ALMUERZO";precio="13.00";orden=1},
    @{nombre="CENA";seccion="CREDITO RANSA";facturable=$true;cruce="CENA";precio="13.00";orden=2},
    @{nombre="AMANECIDA";seccion="CREDITO RANSA";facturable=$true;cruce="AMANECIDA";precio="13.00";orden=3},
    @{nombre="COMBO 1";seccion="CREDITO RANSA";facturable=$true;cruce=$null;precio="6.60";orden=4},
    @{nombre="COMBO 2";seccion="CREDITO RANSA";facturable=$true;cruce=$null;precio="8.90";orden=5},
    @{nombre="PANES 2";seccion="CREDITO RANSA";facturable=$true;cruce=$null;precio="2.00";orden=6},
    @{nombre="BEB. CALIENTES 2";seccion="CREDITO RANSA";facturable=$true;cruce=$null;precio="2.00";orden=7},
    @{nombre="BEB. CALIENTES 2.5";seccion="CREDITO RANSA";facturable=$true;cruce=$null;precio="2.50";orden=8},
    @{nombre="CAFE 2";seccion="CREDITO RANSA";facturable=$true;cruce=$null;precio="2.00";orden=9},
    @{nombre="DESAYUNO DOBLE (DERCO)";seccion="CREDITO OTROS";facturable=$true;cruce="DESAYUNO";precio="10.50";orden=10},
    @{nombre="ALMUERZO GXO";seccion="CREDITO OTROS";facturable=$true;cruce="ALMUERZO";precio="11.50";orden=11},
    @{nombre="ALMUERZO AC.TAG";seccion="CREDITO OTROS";facturable=$true;cruce="ALMUERZO";precio="11.50";orden=12},
    @{nombre="ALMUERZO ASTARA";seccion="CREDITO OTROS";facturable=$true;cruce="ALMUERZO";precio="15.34";orden=13},
    @{nombre="ALMUERZO CONTADO 12";seccion="CONTADOS";facturable=$true;cruce=$null;precio="12.00";orden=14},
    @{nombre="ALMUERZO CONTADO 13";seccion="CONTADOS";facturable=$true;cruce=$null;precio="13.00";orden=15},
    @{nombre="SEGUNDO SOLO";seccion="CONTADOS";facturable=$true;cruce=$null;precio="10.00";orden=16},
    @{nombre="GASEOSA 1/2";seccion="CONTADOS";facturable=$true;cruce=$null;precio="3.50";orden=17},
    @{nombre="COCA/INCA 600ml";seccion="CONTADOS";facturable=$true;cruce=$null;precio="3.50";orden=18},
    @{nombre="SPORADE";seccion="CONTADOS";facturable=$true;cruce=$null;precio="3.00";orden=19},
    @{nombre="AGUA MINERAL";seccion="CONTADOS";facturable=$true;cruce=$null;precio="3.00";orden=20},
    @{nombre="GASEOSA 3LT";seccion="CONTADOS";facturable=$true;cruce=$null;precio="13.00";orden=21},
    @{nombre="FRUGOS";seccion="CONTADOS";facturable=$true;cruce=$null;precio="2.50";orden=22},
    @{nombre="COFFE BREAK / PAYAM";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=23}
)

# =============================================
# GCI
# =============================================
Insert-Campos "GCI" @(
    @{nombre="DESA. OPERATIVO";seccion="CREDITO GCI";facturable=$true;cruce="DESAYUNO";precio="9.00";orden=1},
    @{nombre="ALM GCI";seccion="CREDITO GCI";facturable=$true;cruce="ALMUERZO";precio="11.70";orden=2},
    @{nombre="JUGOS 2";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="2.00";orden=3},
    @{nombre="PANES 1.5";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="1.50";orden=4},
    @{nombre="PANES 2";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="2.00";orden=5},
    @{nombre="BEB. CALIENTES 2";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="2.00";orden=6},
    @{nombre="JUGO S/4";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="4.00";orden=7},
    @{nombre="HAMBURGUESA / LOMO / POLLO";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=8},
    @{nombre="COMBO 1";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="5.00";orden=9},
    @{nombre="COMBO 2";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=10},
    @{nombre="HUEVO";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=11},
    @{nombre="ENTRADA / SOPA";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=12},
    @{nombre="POSTRE";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=13},
    @{nombre="SEGUNDO SOLO";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=14},
    @{nombre="ENSALADA";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=15},
    @{nombre="CARTA 18";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="18.00";orden=16},
    @{nombre="CARTA 20";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="20.00";orden=17},
    @{nombre="TAPERS";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=18},
    @{nombre="PACK DESCARTABLES";seccion="CREDITO GCI";facturable=$true;cruce=$null;precio="NULL";orden=19},
    @{nombre="ALM FAC TECSUR";seccion="CREDITO TECSUR";facturable=$true;cruce=$null;precio="11.50";orden=20},
    @{nombre="DESA. OPERATIVO TECSUR";seccion="CREDITO TECSUR";facturable=$true;cruce=$null;precio="9.00";orden=21},
    @{nombre="DESAYUNO CANETE";seccion="CREDITO CANETE";facturable=$true;cruce=$null;precio="9.00";orden=22},
    @{nombre="ALMUERZO CANETE";seccion="CREDITO CANETE";facturable=$true;cruce=$null;precio="11.50";orden=23},
    @{nombre="BOX CUMPLEANEROS";seccion="EXTRAS";facturable=$true;cruce=$null;precio="NULL";orden=24},
    @{nombre="COFFE / OTROS";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=25}
)

# =============================================
# ICH
# =============================================
Insert-Campos "ICH" @(
    @{nombre="ALMUERZO";seccion="CREDITO ICH";facturable=$true;cruce="ALMUERZO";precio="12.50";orden=1},
    @{nombre="CENA";seccion="CREDITO ICH";facturable=$true;cruce="CENA";precio="12.50";orden=2},
    @{nombre="ALM NO REGISTRADOS";seccion="INVITADOS";facturable=$true;cruce="ALMUERZO";precio="12.50";orden=3},
    @{nombre="COFFE BREAK";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="1.00";orden=4},
    @{nombre="PANES 1.5";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="1.50";orden=5},
    @{nombre="PANES 2";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="2.00";orden=6},
    @{nombre="BEB. CALIENTES 2";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="2.00";orden=7},
    @{nombre="CAFE 2";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="2.00";orden=8},
    @{nombre="JUGO 4";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="4.00";orden=9},
    @{nombre="TAPER SOPA Y SEGUNDO";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="NULL";orden=10},
    @{nombre="ENTRADA / SOPA";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="NULL";orden=11},
    @{nombre="POSTRE";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="NULL";orden=12},
    @{nombre="PAN CON CHICHARRON 5";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="5.00";orden=13},
    @{nombre="ENSALADA";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="NULL";orden=14},
    @{nombre="TAPERS";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="NULL";orden=15},
    @{nombre="PACK DESCARTABLES";seccion="CREDITO ICH";facturable=$true;cruce=$null;precio="NULL";orden=16},
    @{nombre="LONCHERAS DOBLES";seccion="LONCHERAS";facturable=$true;cruce=$null;precio="27.50";orden=17}
)

# =============================================
# FUNDICION
# =============================================
Insert-Campos "FUNDICION" @(
    @{nombre="DESAYUNO";seccion="CREDITO FUNDICION";facturable=$true;cruce="DESAYUNO";precio="5.50";orden=1},
    @{nombre="ALMUERZO";seccion="CREDITO FUNDICION";facturable=$true;cruce="ALMUERZO";precio="11.50";orden=2},
    @{nombre="CENA";seccion="CREDITO FUNDICION";facturable=$true;cruce="CENA";precio="11.50";orden=3},
    @{nombre="ALM CREDITO (VIGILANTES/ENFERMERIA)";seccion="CREDITO TERCEROS";facturable=$true;cruce="ALMUERZO";precio="11.50";orden=4},
    @{nombre="LONCHE SIMPLE";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="4.50";orden=5},
    @{nombre="LONCHE ESPECIAL";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="5.50";orden=6},
    @{nombre="BEB. CALIENTES 2";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="2.00";orden=7},
    @{nombre="BEB. CALIENTES 2.5";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="2.50";orden=8},
    @{nombre="CAFE 2";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="2.00";orden=9},
    @{nombre="JUGO 4";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="4.00";orden=10},
    @{nombre="ENTRADA / SOPA";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="NULL";orden=11},
    @{nombre="POSTRE";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="NULL";orden=12},
    @{nombre="PAN CON CHICHARRON 5";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="5.00";orden=13},
    @{nombre="ENSALADA";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="NULL";orden=14},
    @{nombre="TAPERS";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="NULL";orden=15},
    @{nombre="PACK DESCARTABLES";seccion="CREDITO FUNDICION";facturable=$true;cruce=$null;precio="NULL";orden=16},
    @{nombre="COFFE";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="1.00";orden=17}
)

# =============================================
# FADESA
# =============================================
Insert-Campos "FADESA" @(
    @{nombre="ALMUERZO SISTEMA";seccion="CREDITO FADESA";facturable=$true;cruce="ALMUERZO";precio="11.00";orden=1},
    @{nombre="CENAS SISTEMA";seccion="CREDITO FADESA";facturable=$true;cruce="CENA";precio="11.00";orden=2},
    @{nombre="ALM. ESPECIAL";seccion="CREDITO FADESA";facturable=$true;cruce="ALMUERZO";precio="33.33";orden=3},
    @{nombre="ALM INVITADOS OTROS";seccion="INVITADOS";facturable=$true;cruce="ALMUERZO";precio="11.00";orden=4},
    @{nombre="CENA INVITADOS OTROS";seccion="INVITADOS";facturable=$true;cruce="CENA";precio="11.00";orden=5},
    @{nombre="LONCHES";seccion="CREDITO FADESA";facturable=$true;cruce=$null;precio="NULL";orden=6},
    @{nombre="COMIDA";seccion="CREDITO FADESA";facturable=$true;cruce=$null;precio="NULL";orden=7},
    @{nombre="PAN";seccion="CREDITO FADESA";facturable=$true;cruce=$null;precio="NULL";orden=8},
    @{nombre="OTROS / COFFE";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="1.00";orden=9}
)

# =============================================
# FITESA
# =============================================
Insert-Campos "FITESA" @(
    @{nombre="DESAYUNO (FITESA)";seccion="CREDITO FITESA";facturable=$true;cruce="DESAYUNO";precio="7.50";orden=1},
    @{nombre="ALMUERZO (FITESA)";seccion="CREDITO FITESA";facturable=$true;cruce="ALMUERZO";precio="14.50";orden=2},
    @{nombre="CENA (FITESA)";seccion="CREDITO FITESA";facturable=$true;cruce="CENA";precio="14.50";orden=3},
    @{nombre="AMANECIDA (FITESA)";seccion="CREDITO FITESA";facturable=$true;cruce="AMANECIDA";precio="14.50";orden=4},
    @{nombre="ALMUERZO INVITADO";seccion="INVITADOS";facturable=$true;cruce="ALMUERZO";precio="7.50";orden=5},
    @{nombre="DESAYUNO TERCERO";seccion="TERCEROS";facturable=$true;cruce="DESAYUNO";precio="7.50";orden=6},
    @{nombre="ALMUERZO TERCERO";seccion="TERCEROS";facturable=$true;cruce="ALMUERZO";precio="14.50";orden=7},
    @{nombre="SEG. DES (SEGURIDAD)";seccion="SEGURIDAD";facturable=$true;cruce="DESAYUNO";precio="7.50";orden=8},
    @{nombre="SEG. ALM (SEGURIDAD)";seccion="SEGURIDAD";facturable=$true;cruce="ALMUERZO";precio="14.50";orden=9},
    @{nombre="CENA SEG. Y AMANECIDA SEG.";seccion="SEGURIDAD";facturable=$true;cruce="CENA";precio="14.50";orden=10},
    @{nombre="ALM FACT (FACTURACION ESPECIAL)";seccion="FACTURACION EXTERNA";facturable=$true;cruce="ALMUERZO";precio="10.00";orden=11},
    @{nombre="COFFE / OTROS";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=12}
)

# =============================================
# MOLICENTRO
# =============================================
Insert-Campos "MOLICENTRO" @(
    @{nombre="DESAYUNO CUPON";seccion="DESAYUNOS";facturable=$true;cruce="DESAYUNO";precio="NULL";orden=1},
    @{nombre="DESAYUNO ESPECIAL";seccion="DESAYUNOS";facturable=$true;cruce="DESAYUNO";precio="6.00";orden=2},
    @{nombre="DESAYUNO NORMAL";seccion="DESAYUNOS";facturable=$true;cruce="DESAYUNO";precio="3.50";orden=3},
    @{nombre="ALMUERZO SUBVENCIONADO";seccion="ALMUERZOS";facturable=$true;cruce="ALMUERZO";precio="6.00";orden=4},
    @{nombre="ALMUERZO NORMAL";seccion="ALMUERZOS";facturable=$true;cruce="ALMUERZO";precio="10.00";orden=5},
    @{nombre="ALMUERZO INVITADO";seccion="ALMUERZOS INVITADOS";facturable=$true;cruce="ALMUERZO";precio="10.00";orden=6},
    @{nombre="ALMUERZO CONTADO / YAPE";seccion="CONTADOS";facturable=$true;cruce=$null;precio="10.00";orden=7},
    @{nombre="ALMUERZO CUMPLEANERO";seccion="EXTRAS";facturable=$true;cruce=$null;precio="20.00";orden=8},
    @{nombre="CENA NORMAL";seccion="CENAS";facturable=$true;cruce="CENA";precio="NULL";orden=9},
    @{nombre="CENA INVITADO";seccion="CENAS INVITADOS";facturable=$true;cruce="CENA";precio="NULL";orden=10},
    @{nombre="CENA CUMPLEANERO";seccion="EXTRAS";facturable=$true;cruce=$null;precio="NULL";orden=11},
    @{nombre="CAFE";seccion="EXTRAS";facturable=$true;cruce=$null;precio="1.50";orden=12},
    @{nombre="HELADOS";seccion="KARDEX";facturable=$true;cruce=$null;precio="2.50";orden=13},
    @{nombre="COFFE BREAK";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=14}
)

# =============================================
# VOLCAN
# =============================================
Insert-Campos "VOLCAN" @(
    @{nombre="DESAYUNO SISTEMA";seccion="CREDITO VOLCAN";facturable=$true;cruce="DESAYUNO";precio="NULL";orden=1},
    @{nombre="ALMUERZO SISTEMA";seccion="CREDITO VOLCAN";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=2},
    @{nombre="ALMUERZO SEGURIDAD";seccion="SEGURIDAD";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=3},
    @{nombre="ALMUERZO TERCEROS";seccion="TERCEROS";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=4},
    @{nombre="CENA SISTEMA";seccion="CREDITO VOLCAN";facturable=$true;cruce="CENA";precio="NULL";orden=5},
    @{nombre="COFFE BREAK";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=6},
    @{nombre="HELADOS / MARCIANOS";seccion="KARDEX";facturable=$true;cruce=$null;precio="NULL";orden=7}
)

# =============================================
# SAN JORGE
# =============================================
Insert-Campos "SAN JORGE" @(
    @{nombre="ALMUERZO OTROS";seccion="CREDITO SAN JORGE";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=1},
    @{nombre="ALMUERZO MANPOWER";seccion="CREDITO SAN JORGE";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=2},
    @{nombre="ALMUERZO CONTADO";seccion="CONTADOS";facturable=$true;cruce=$null;precio="NULL";orden=3},
    @{nombre="ALMUERZO YAPE";seccion="CONTADOS YAPE";facturable=$true;cruce=$null;precio="NULL";orden=4},
    @{nombre="CENA SISTEMA";seccion="CREDITO SAN JORGE";facturable=$true;cruce="CENA";precio="NULL";orden=5},
    @{nombre="CENA OTROS";seccion="CREDITO SAN JORGE";facturable=$true;cruce="CENA";precio="NULL";orden=6},
    @{nombre="DESAYUNO VALES";seccion="CREDITO SAN JORGE";facturable=$true;cruce="DESAYUNO";precio="NULL";orden=7},
    @{nombre="BEBIDA / PAN";seccion="KARDEX";facturable=$true;cruce=$null;precio="NULL";orden=8}
)

# =============================================
# MEDLOG (solo SISTEMA cuenta para cruce, tickets = mismo dato)
# =============================================
Insert-Campos "MEDLOG" @(
    @{nombre="ALMUERZOS SISTEMA";seccion="SISTEMA";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=1},
    @{nombre="ALMUERZOS TICKETS";seccion="SEGUN TICKET";facturable=$false;cruce=$null;precio="NULL";orden=2},
    @{nombre="CENAS SISTEMA";seccion="SISTEMA";facturable=$true;cruce="CENA";precio="NULL";orden=3},
    @{nombre="CENAS TICKETS";seccion="SEGUN TICKET";facturable=$false;cruce=$null;precio="NULL";orden=4}
)

# =============================================
# PAMOLSA (estructura estandar sugerida)
# =============================================
Insert-Campos "PAMOLSA" @(
    @{nombre="ALMUERZOS FAUCETT";seccion="CREDITO PAMOLSA";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=1},
    @{nombre="ALMUERZOS GAMBETTA";seccion="CREDITO PAMOLSA";facturable=$true;cruce="ALMUERZO";precio="NULL";orden=2},
    @{nombre="CENA FAUCETT";seccion="CREDITO PAMOLSA";facturable=$true;cruce="CENA";precio="NULL";orden=3},
    @{nombre="CENA GAMBETTA";seccion="CREDITO PAMOLSA";facturable=$true;cruce="CENA";precio="NULL";orden=4},
    @{nombre="AMANECIDA FAUCETT";seccion="CREDITO PAMOLSA";facturable=$true;cruce="AMANECIDA";precio="NULL";orden=5},
    @{nombre="AMANECIDA GAMBETTA";seccion="CREDITO PAMOLSA";facturable=$true;cruce="AMANECIDA";precio="NULL";orden=6},
    @{nombre="EXTRAS / COFFE";seccion="SERVICIO ESPECIAL";facturable=$true;cruce=$null;precio="NULL";orden=7}
)

Write-Host "`n=== SEED COMPLETADO ==="

# Verificar conteo
$cnt = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body (@{ query = "SELECT COUNT(*) as total FROM reporte_semanal_campos" } | ConvertTo-Json -Compress)
Write-Host "Total campos insertados: $($cnt.total)"
