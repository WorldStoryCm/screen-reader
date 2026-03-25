# Windows OCR using Windows.Media.Ocr (built into Windows 10+)
# Protocol: reads JSON lines from stdin, writes JSON lines to stdout
# Requires: Japanese language pack for Japanese OCR
#   Settings > Time & Language > Language > Add language > Japanese

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Load WinRT assemblies
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

# Helper to await WinRT async operations
$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}
$asTaskGeneric = $asTaskMethods[0]

function Await-Operation($asyncOp, [Type]$resultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $task = $asTask.Invoke($null, @($asyncOp))
    $task.Wait() | Out-Null
    return $task.Result
}

function Run-Ocr($imagePath, $preset) {
    try {
        # Determine language preference
        $langCodes = @("ja", "en-US")
        if ($preset -eq "english") { $langCodes = @("en-US") }

        # Open image via StorageFile
        $asyncFile = [Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)
        $file = Await-Operation $asyncFile ([Windows.Storage.StorageFile])

        $asyncStream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
        $stream = Await-Operation $asyncStream ([Windows.Storage.Streams.IRandomAccessStream])

        $asyncDecoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
        $decoder = Await-Operation $asyncDecoder ([Windows.Graphics.Imaging.BitmapDecoder])

        $asyncBitmap = $decoder.GetSoftwareBitmapAsync()
        $bitmap = Await-Operation $asyncBitmap ([Windows.Graphics.Imaging.SoftwareBitmap])

        # Try each language until we get results
        $allLines = @()
        $totalConfidence = 0.0

        foreach ($langCode in $langCodes) {
            try {
                $language = [Windows.Globalization.Language]::new($langCode)
                if (-not [Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($language)) {
                    continue
                }
                $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
                if ($null -eq $engine) { continue }

                $asyncResult = $engine.RecognizeAsync($bitmap)
                $result = Await-Operation $asyncResult ([Windows.Media.Ocr.OcrResult])

                foreach ($line in $result.Lines) {
                    $allLines += $line.Text
                }

                if ($allLines.Count -gt 0) { break }
            }
            catch { }
        }

        # If no language-specific engine worked, try the default engine
        if ($allLines.Count -eq 0) {
            try {
                $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
                if ($null -ne $engine) {
                    $asyncResult = $engine.RecognizeAsync($bitmap)
                    $result = Await-Operation $asyncResult ([Windows.Media.Ocr.OcrResult])
                    foreach ($line in $result.Lines) {
                        $allLines += $line.Text
                    }
                }
            }
            catch { }
        }

        $stream.Dispose()

        $rawText = $allLines -join "`n"

        # Windows OCR Japanese engine inserts spaces between CJK characters.
        # Strip spaces that sit between two CJK/kana characters.
        $cjk = '[\p{IsCJKUnifiedIdeographs}\p{IsHiragana}\p{IsKatakana}\p{IsCJKUnifiedIdeographsExtensionA}\p{IsCJKCompatibilityIdeographs}\u30FC\uFF01-\uFF5E]'
        $normalizedText = [regex]::Replace($rawText, "(?<=$cjk)\s+(?=$cjk)", '')

        $confidence = if ($allLines.Count -gt 0) { 85.0 } else { 0.0 }

        return @{
            raw_text       = $rawText
            normalized_text = $normalizedText
            confidence     = $confidence
            error          = $null
        }
    }
    catch {
        return @{
            raw_text       = ""
            normalized_text = ""
            confidence     = 0.0
            error          = $_.Exception.Message
        }
    }
}

# Main loop: read JSON from stdin, process, write JSON to stdout
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ($line -eq "") { continue }

    try {
        $request = $line | ConvertFrom-Json
        $result = Run-Ocr $request.image_path $request.preset
    }
    catch {
        $result = @{
            raw_text       = ""
            normalized_text = ""
            confidence     = 0.0
            error          = "Invalid request: $($_.Exception.Message)"
        }
    }

    $json = $result | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
}
