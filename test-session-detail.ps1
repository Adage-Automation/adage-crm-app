$key = ""
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
  if ($_ -match '^\s*VITE_ODOO_API_KEY\s*=\s*(.+)\s*$') { $key = $matches[1].Trim().Trim('"').Trim("'") }
}

$body = '{"jsonrpc":"2.0","method":"call","params":{"db":"crm-adage-5","login":"admin","password":"' + $key + '"},"id":1}'
$r = Invoke-WebRequest -Uri "https://crm-adage-5.odoo.com/web/session/authenticate" -Method POST -ContentType "application/json" -Body $body
$r.Content | Out-File "$PSScriptRoot\session-detail.json" -Encoding utf8
