import urllib.request

xml = '''<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>crm-adage-5</string></value></param>
    <param><value><string>adarsh@adage-automation.com</string></value></param>
    <param><value><string>09f29548ce28d93c12edfa18528e2e780e19ad76</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>'''

req = urllib.request.Request(
    'https://crm-adage-5.odoo.com/xmlrpc/2/common',
    data=xml.encode('utf-8'),
    headers={'Content-Type': 'text/xml'},
)
try:
  with urllib.request.urlopen(req) as resp:
    print('STATUS:', resp.status)
    print('CONTENT-TYPE:', resp.headers.get('Content-Type'))
    body = resp.read().decode('utf-8', errors='replace')
    print('BODY:')
    print(body)
except urllib.error.HTTPError as e:
  print('HTTP ERROR:', e.code)
  try:
    body = e.read().decode('utf-8', errors='replace')
    print('BODY:')
    print(body)
  except Exception:
    print('No body')
