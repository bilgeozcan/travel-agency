<#
.SYNOPSIS
    Sandbox API Gateway'inin invoke URL'ini AWS CLI ile otomatik bulur ve
    Postman'e tek tikla import edilebilir bir Environment dosyasi uretir.

.DESCRIPTION
    Postman masaustu uygulamasi disaridan komut satiriyla dogrudan kontrol
    edilemiyor (collection variable'i "canli" guncelleyemeyiz). Bu yuzden
    en pratik otomasyon: URL'i kendimiz buluyoruz, bir Postman Environment
    JSON dosyasi uretiyoruz - tek yapman gereken bu dosyayi Postman'de
    import etmek (File > Import, ya da dosyaya cift tikla).

    Boylece: URL'i elle console'dan kopyalama, Collection Variables
    sekmesine elle yapistirma adimlari ortadan kalkiyor - sadece "Import"
    butonuna basman yeterli.

.PARAMETER NamePattern
    API Gateway adinda aranacak alt string (varsayilan: 'ahmet-sandbox').

.PARAMETER Region
    AWS region (varsayilan: eu-west-3).

.PARAMETER OutFile
    Uretilecek Postman environment dosyasinin adi/yolu.

.EXAMPLE
    .\generate-postman-env.ps1
    # 'ahmet-sandbox' iceren API Gateway'i bulur, postman-environment.json uretir.

.EXAMPLE
    .\generate-postman-env.ps1 -NamePattern "ahmet-sandbox" -Region "eu-west-3" -OutFile "sandbox.postman_environment.json"
#>

param(
    [string]$NamePattern = "ahmet-sandbox",
    [string]$Region = "eu-west-3",
    [string]$OutFile = "sandbox.postman_environment.json"
)

$ErrorActionPreference = "Stop"

Write-Host "API Gateway araniyor (isminde '$NamePattern' gecen)..." -ForegroundColor Yellow

$apiId = aws apigateway get-rest-apis --query "items[?contains(name, '$NamePattern')].id" --output text

if (-not $apiId -or $apiId -eq "None") {
    Write-Error "Pattern '$NamePattern' ile eslesen API Gateway bulunamadi. Deploy edilmis mi kontrol et: syn deploy --replace-output"
    exit 1
}

if ($apiId -match '\s') {
    Write-Host "BIRDEN FAZLA eslesme bulundu:" -ForegroundColor Red
    aws apigateway get-rest-apis --query "items[?contains(name, '$NamePattern')].{id:id,name:name}" --output table
    Write-Error "Hangisini kullanacagini netlestirmek icin -NamePattern'i daha spesifik yap."
    exit 1
}

Write-Host "Bulundu: $apiId" -ForegroundColor Green

Write-Host "Stage araniyor..." -ForegroundColor Yellow
$stage = aws apigateway get-stages --rest-api-id $apiId --query "item[0].stageName" --output text

if (-not $stage -or $stage -eq "None") {
    Write-Error "Bu API Gateway'de hicbir stage bulunamadi."
    exit 1
}

$baseUrl = "https://$apiId.execute-api.$Region.amazonaws.com/$stage"
Write-Host "Base URL: $baseUrl" -ForegroundColor Green

# Postman environment format (v2.1)
$envJson = @{
    id     = [guid]::NewGuid().ToString()
    name   = "Travel Agency - $NamePattern (auto-generated $(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
    values = @(
        @{ key = "base_url"; value = $baseUrl; type = "default"; enabled = $true }
    )
    _postman_variable_scope = "environment"
} | ConvertTo-Json -Depth 10

Set-Content -Path $OutFile -Value $envJson -Encoding utf8
Write-Host "`nPostman environment dosyasi uretildi: $OutFile" -ForegroundColor Green
Write-Host "Postman'de: File > Import > bu dosyayi sec (ya da dosyaya cift tikla)." -ForegroundColor Yellow
Write-Host "Import ettikten sonra sag ustteki environment secicisinden bu environment'i AKTIF ET." -ForegroundColor Yellow

try { $baseUrl | Set-Clipboard; Write-Host "(URL ayrica panoya da kopyalandi.)" -ForegroundColor DarkGray } catch {}