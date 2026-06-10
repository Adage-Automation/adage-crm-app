$key = ""
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
  if ($_ -match '^\s*VITE_ODOO_API_KEY\s*=\s*(.+)\s*$') { $key = $matches[1].Trim().Trim('"').Trim("'") }
}

$headers = @{ "Content-Type" = "application/json"; Authorization = "Bearer $key" }

$stageBody = '{"jsonrpc":"2.0","method":"call","params":{"model":"crm.stage","method":"search_read","args":[[]],"kwargs":{"fields":["name"],"limit":5}},"id":1}'
$stage = Invoke-RestMethod -Uri "http://localhost:5173/api/odoo/web/dataset/call_kw" -Method POST -Headers $headers -Body $stageBody
"STAGES: $($stage | ConvertTo-Json -Depth 5 -Compress)"

$leadBody = '{"jsonrpc":"2.0","method":"call","params":{"model":"crm.lead","method":"search_read","args":[[["type","=","opportunity"],["active","=",true]]],"kwargs":{"fields":["name"],"limit":3}},"id":2}'
$lead = Invoke-RestMethod -Uri "http://localhost:5173/api/odoo/web/dataset/call_kw" -Method POST -Headers $headers -Body $leadBody
"LEADS: $($lead | ConvertTo-Json -Depth 5 -Compress)"
