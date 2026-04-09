$sql = "SELECT * FROM comedor_campos_reporte WHERE comedor_id = 'ced94bb0-a566-41cb-a965-9c105c872a0c' AND nombre_campo = 'PAN';"
$body = @{ query = $sql } | ConvertTo-Json -Compress
$response = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/zuyqjhpiskokhtuuqltu/database/query" `
    -Method POST `
    -Headers @{ 
        "Authorization" = "Bearer sbp_2816f9a765e3302a5df6c04d1895e36bbca64bcc"
        "Content-Type" = "application/json"
    } `
    -Body $body

$response | ConvertTo-Json
