
$sql = "ALTER TABLE comedor_campos_reporte ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0;"
$body = @{ query = $sql } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/zuyqjhpiskokhtuuqltu/database/query" `
    -Method POST `
    -Headers @{ 
        "Authorization" = "Bearer sbp_2816f9a765e3302a5df6c04d1895e36bbca64bcc"; 
        "Content-Type" = "application/json" 
    } `
    -Body $body
