# ================================================
#   FOCUSED TEST SCRIPT - BULLETPROOF VERSION
# ================================================
Write-Host "STARTING FOCUSED TESTS..." -ForegroundColor Cyan

# [0] LẤY TOKEN
Write-Host "`n[0] Getting Access Token..." -ForegroundColor Yellow
$clientSecret = "backend-secret"
try {
    $response = Invoke-RestMethod -Method Post `
        -Uri "http://localhost:8081/realms/cloudapi/protocol/openid-connect/token" `
        -Body "client_id=backend-client&client_secret=$clientSecret&grant_type=client_credentials" `
        -ContentType "application/x-www-form-urlencoded"
    $TOKEN = $response.access_token
    Write-Host "Token retrieved successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to get token." -ForegroundColor Red; exit
}

# [1] CRUD + PERSIST
Write-Host "`n[1] Testing CRUD + Persistence..." -ForegroundColor Yellow

# Tạo email random để tránh lỗi 500 (Trùng lặp email trong DB) ở các lần chạy sau
$randomNum = Get-Random -Minimum 1000 -Maximum 9999
$dynamicEmail = "persist_focus_$randomNum@gmail.com"
$userJson = "{`"email`":`"$dynamicEmail`",`"name`":`"Focus Persist User`",`"role`":`"customer`"}"
$userJson | Out-File -FilePath "temp_payload.json" -Encoding utf8

Write-Host "-> Creating new user ($dynamicEmail):"
curl.exe -s -w "`nHTTP_CODE: %{http_code}`n" -X POST http://localhost:8000/api/v1/users `
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "@temp_payload.json"

Write-Host "`n-> Restarting backend container..." -ForegroundColor Cyan
docker compose restart backend
Start-Sleep -Seconds 12 # Chờ lâu hơn một chút cho Kong và Backend kịp boot

Write-Host "`n-> Fetching users after restart:"
curl.exe -s -w "`nHTTP_CODE: %{http_code}`n" -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/users

# [2] BOLA TEST
Write-Host "`n[2] Testing BOLA..." -ForegroundColor Yellow
Write-Host "-> Seeding dummy order (Order ID 1, belongs to User 999) into DB..." -ForegroundColor DarkGray
# Bơm data vào DB để có đơn hàng mà test 403. Nếu bảng orders bắt buộc có thêm cột nào, bạn hãy bổ sung vào VALUES nhé!
$seedCmd = 'docker exec api-postgres psql -U admin -d cloudapi -c "INSERT INTO orders (id, user_id, status) VALUES (1, 999, ''pending'') ON CONFLICT DO NOTHING;"'
Invoke-Expression $seedCmd | Out-Null

Write-Host "-> User A trying to GET Order 1 (Expect 403 Forbidden):"
curl.exe -s -w "`nHTTP_CODE: %{http_code}`n" -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/orders/1

# [3] WEBHOOK
Write-Host "`n[3] Testing Webhook HMAC Validation..." -ForegroundColor Yellow
$timestamp = [int](Get-Date -UFormat %s)

# Body để hash (không escape) và body để gửi curl (phải có escape)
$bodyForHash = '{"order_id":999,"status":"shipped"}'
$bodyForCurl = '{\"order_id\":999,\"status\":\"shipped\"}'
$secret = "your-super-secret-webhook-key-2026"

$sigInput = "${timestamp}.${bodyForHash}"
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($sigInput))
$sig = [System.BitConverter]::ToString($hash).Replace("-","").ToLower()

Write-Host "-> Case 3.1: Missing Headers (Expect 401):"
curl.exe -s -w "`nHTTP_CODE: %{http_code}`n" -X POST http://localhost:8000/api/v1/orders/webhooks/orders -d $bodyForCurl

Write-Host "`n-> Case 3.2: Wrong Signature (Expect 401):"
curl.exe -s -w "`nHTTP_CODE: %{http_code}`n" -X POST http://localhost:8000/api/v1/orders/webhooks/orders `
    -H "X-Timestamp: $timestamp" -H "X-Signature: invalid_fake" -d $bodyForCurl

Write-Host "`n-> Case 3.3: Correct Signature (Expect 200):"
curl.exe -s -w "`nHTTP_CODE: %{http_code}`n" -X POST http://localhost:8000/api/v1/orders/webhooks/orders `
    -H "X-Timestamp: $timestamp" -H "X-Signature: $sig" -d $bodyForCurl