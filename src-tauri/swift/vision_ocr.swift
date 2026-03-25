#!/usr/bin/env swift

import Foundation
import Vision
import AppKit

struct OcrRequest: Codable {
    let image_path: String
    let preset: String
}

struct OcrResult: Codable {
    let raw_text: String
    let normalized_text: String
    let confidence: Double
    let error: String?
}

func runOCR(imagePath: String, languages: [String]) -> OcrResult {
    let url = URL(fileURLWithPath: imagePath)
    guard let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        return OcrResult(raw_text: "", normalized_text: "", confidence: 0, error: "Failed to load image: \(imagePath)")
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = languages
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    do {
        try handler.perform([request])
    } catch {
        return OcrResult(raw_text: "", normalized_text: "", confidence: 0, error: "Vision request failed: \(error)")
    }

    guard let observations = request.results, !observations.isEmpty else {
        return OcrResult(raw_text: "", normalized_text: "", confidence: 0, error: nil)
    }

    var lines: [String] = []
    var totalConfidence: Double = 0
    var count = 0

    for observation in observations {
        if let candidate = observation.topCandidates(1).first {
            lines.append(candidate.string)
            totalConfidence += Double(candidate.confidence)
            count += 1
        }
    }

    let rawText = lines.joined(separator: "\n")
    let avgConfidence = count > 0 ? (totalConfidence / Double(count)) * 100.0 : 0.0

    return OcrResult(
        raw_text: rawText,
        normalized_text: rawText,
        confidence: round(avgConfidence * 100) / 100,
        error: nil
    )
}

// Main: read JSON from stdin line by line, output JSON to stdout
let encoder = JSONEncoder()
let decoder = JSONDecoder()

while let line = readLine() {
    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { continue }

    guard let data = trimmed.data(using: .utf8),
          let request = try? decoder.decode(OcrRequest.self, from: data) else {
        let errorResult = OcrResult(raw_text: "", normalized_text: "", confidence: 0, error: "Invalid JSON input")
        if let json = try? encoder.encode(errorResult),
           let jsonStr = String(data: json, encoding: .utf8) {
            print(jsonStr)
            fflush(stdout)
        }
        continue
    }

    let languages: [String]
    switch request.preset {
    case "english":
        languages = ["en-US"]
    case "japanese":
        languages = ["ja-JP", "en-US"]
    default:
        // default_ui, small_text, dark_bg, light_bg — all use ja+en
        languages = ["ja-JP", "en-US"]
    }

    let result = runOCR(imagePath: request.image_path, languages: languages)

    if let json = try? encoder.encode(result),
       let jsonStr = String(data: json, encoding: .utf8) {
        print(jsonStr)
        fflush(stdout)
    }
}
