$port = 5500
$root = (Get-Location).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    $port = 8080
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
}

Write-Output "Server running at http://localhost:$port/"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".mp4"  = "video/mp4"
}

function Get-GalleriesData {
    $galleryMap = @{}
    $baseDirs = @("Argentique", "Concerts", "Courts-metrages")
    
    foreach ($baseDir in $baseDirs) {
        $basePath = [System.IO.Path]::Combine($root, $baseDir)
        if ([System.IO.Directory]::Exists($basePath)) {
            $subDirs = [System.IO.Directory]::GetDirectories($basePath)
            foreach ($subDir in $subDirs) {
                $folderName = [System.IO.Path]::GetFileName($subDir)
                $key = "$baseDir/$folderName"
                
                $files = [System.IO.Directory]::GetFiles($subDir) | Where-Object {
                    $ext = [System.IO.Path]::GetExtension($_).ToLower()
                    $name = [System.IO.Path]::GetFileName($_)
                    ($ext -in @(".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")) -and -not ($name.StartsWith("."))
                } | Sort-Object
                
                $relFiles = @()
                foreach ($f in $files) {
                    $fileName = [System.IO.Path]::GetFileName($f)
                    $relFiles += "./$baseDir/$folderName/$fileName"
                }
                
                $galleryMap[$key] = $relFiles
            }
        }
    }
    
    # Mettre à jour aussi galleries.json pour le mode statique / hors-ligne
    try {
        $jsonStr = $galleryMap | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText([System.IO.Path]::Combine($root, "galleries.json"), $jsonStr, [System.Text.Encoding]::UTF8)
    } catch {}
    
    return $galleryMap
}

# Génération initiale de galleries.json
Get-GalleriesData | Out-Null

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    # Headers CORS
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")

    $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)

    if ($urlPath -eq "/api/galleries") {
        $data = Get-GalleriesData
        $json = $data | ConvertTo-Json -Depth 5
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $response.ContentType = "application/json; charset=utf-8"
        $response.ContentLength64 = $bytes.Length
        $response.StatusCode = 200
        if ($request.HttpMethod -ne "HEAD") {
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        try { $response.OutputStream.Close() } catch {}
        continue
    }

    if ($urlPath -eq "/" -or [string]::IsNullOrWhiteSpace($urlPath)) {
        $urlPath = "/index.html"
    }

    $relative = $urlPath.TrimStart("/").Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $filePath = [System.IO.Path]::Combine($root, $relative)

    if ([System.IO.File]::Exists($filePath)) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        if ($mimeTypes.ContainsKey($ext)) {
            $response.ContentType = $mimeTypes[$ext]
        } else {
            $response.ContentType = "application/octet-stream"
        }

        if ($request.HttpMethod -eq "HEAD") {
            $response.ContentLength64 = (New-Object System.IO.FileInfo($filePath)).Length
            $response.StatusCode = 200
        } else {
            try {
                $fileStream = [System.IO.File]::OpenRead($filePath)
                $response.ContentLength64 = $fileStream.Length
                $fileStream.CopyTo($response.OutputStream)
                $fileStream.Close()
            } catch {
                Write-Output "Error serving file: $_"
                $response.StatusCode = 500
            }
        }
    } else {
        $response.StatusCode = 404
        $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
        $response.ContentType = "text/plain; charset=utf-8"
        $response.ContentLength64 = $notFoundMsg.Length
        if ($request.HttpMethod -ne "HEAD") {
            $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
        }
    }

    try {
        $response.OutputStream.Close()
    } catch {}
}
