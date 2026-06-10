$key = ""
$db = "crm-adage-5"
$login = ""
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
  if ($_ -match '^\s*VITE_ODOO_API_KEY\s*=\s*(.+)\s*$') { $key = $matches[1].Trim().Trim('"').Trim("'") }
  if ($_ -match '^\s*VITE_ODOO_DB\s*=\s*(.+)\s*$') { $db = $matches[1].Trim().Trim('"').Trim("'") }
  if ($_ -match '^\s*VITE_ODOO_LOGIN\s*=\s*(.+)\s*$') { $login = $matches[1].Trim().Trim('"').Trim("'") }
}

$base = "https://crm-adage-5.odoo.com"

# Try JSON/2 API with bearer
try {
  $r = Invoke-RestMethod -Uri "$base/json/2/crm.stage/search_read" -Method POST `
    -Headers @{ Authorization = "bearer $key"; "Content-Type" = "application/json" } `
    -Body '{"limit":2,"fields":["name"]}'
  "JSON2: $($r | ConvertTo-Json -Compress -Depth 4)"
} catch {
  "JSON2 failed: $($_.Exception.Message)"
}

# Try xmlrpc authenticate
$authBody = @"
<?xml version='1.0'?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>$db</string></value></param>
    <param><value><string>$login</string></value></param>
    <param><value><string>$key</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>
"@

if ($login) {
  try {
    $auth = Invoke-WebRequest -Uri "$base/xmlrpc/2/common" -Method POST -ContentType "text/xml" -Body $authBody
    "XMLRPC auth response (first 500 chars): $($auth.Content.Substring(0, [Math]::Min(500, $auth.Content.Length)))"
  } catch {
    "XMLRPC auth failed: $($_.Exception.Message)"
  }
} else {
  "SKIP XMLRPC: set VITE_ODOO_LOGIN in .env"
}

# List databases via jsonrpc
try {
  $listBody = '{"jsonrpc":"2.0","method":"call","params":{"service":"db","method":"list","args":[]},"id":1}'
  $dbs = Invoke-RestMethod -Uri "$base/jsonrpc" -Method POST -ContentType "application/json" -Body $listBody
  "DB LIST: $($dbs.result | ConvertTo-Json -Compress)"
} catch {
  "DB list failed: $($_.Exception.Message)"
}
