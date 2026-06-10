$ErrorActionPreference = "Stop"
$proj = $PSScriptRoot
Set-Location $proj

Write-Host "Node: $(node -v)"
Write-Host "npm: $(npm -v)"

if (-not (Test-Path "node_modules")) {
  npm install
}

$job = Start-Job -ScriptBlock {
  Set-Location $using:proj
  npm run dev 2>&1
}

Start-Sleep -Seconds 10
$out = Receive-Job $job
$out | Select-Object -Last 15 | ForEach-Object { Write-Host $_ }

$key = ""
Get-Content ".env" | ForEach-Object {
  if ($_ -match '^\s*VITE_ODOO_API_KEY\s*=\s*(.+)\s*$') {
    $key = $matches[1].Trim().Trim('"').Trim("'")
  }
}

$body = '{"jsonrpc":"2.0","method":"call","params":{"model":"crm.stage","method":"search_read","args":[[]],"kwargs":{"fields":["name"],"limit":1}},"id":1}'
try {
  $resp = Invoke-RestMethod -Uri "http://localhost:5173/api/odoo/web/dataset/call_kw" -Method POST `
    -Headers @{ "Content-Type" = "application/json"; Authorization = "Bearer $key" } -Body $body
  Write-Host "API OK: $($resp.result.Count) stage(s) returned"
} catch {
  Write-Host "API test failed: $($_.Exception.Message)"
}

Write-Host "Open http://localhost:5173"
