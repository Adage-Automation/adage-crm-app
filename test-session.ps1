$key = ""
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
  if ($_ -match '^\s*VITE_ODOO_API_KEY\s*=\s*(.+)\s*$') { $key = $matches[1].Trim().Trim('"').Trim("'") }
}

$base = "https://crm-adage-5.odoo.com"
$dbs = @("crm-adage-5", "adage-automation-private-ltd", "crm-adage-5-main")

foreach ($db in $dbs) {
  foreach ($login in @("admin", "info@adage-automation.com")) {
    $body = @{
      jsonrpc = "2.0"
      method  = "call"
      params  = @{ db = $db; login = $login; password = $key }
      id      = 1
    } | ConvertTo-Json -Depth 5
    try {
      $r = Invoke-WebRequest -Uri "$base/web/session/authenticate" -Method POST `
        -ContentType "application/json" -Body $body -SessionVariable sess
      $json = $r.Content | ConvertFrom-Json
      if ($json.result.uid) {
        "OK db=$db login=$login uid=$($json.result.uid)"
        $kw = @{
          jsonrpc = "2.0"
          method  = "call"
          params  = @{
            model  = "crm.stage"
            method = "search_read"
            args   = @(,@())
            kwargs = @{ fields = @("name"); limit = 2 }
          }
          id = 2
        } | ConvertTo-Json -Depth 8
        $r2 = Invoke-WebRequest -Uri "$base/web/dataset/call_kw" -Method POST `
          -WebSession $sess -ContentType "application/json" -Body $kw
        "call_kw: $($r2.Content.Substring(0, [Math]::Min(300, $r2.Content.Length)))"
        exit 0
      } else {
        "FAIL db=$db login=$login : $($json.error.message)"
      }
    } catch {
      "ERR db=$db login=$login : $($_.Exception.Message)"
    }
  }
}
