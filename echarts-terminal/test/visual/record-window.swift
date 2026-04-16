import Foundation
import AVFoundation
import CoreMedia
import ScreenCaptureKit

enum RecorderError: Error {
    case missingWindow(CGWindowID)
    case cannotAddWriterInput
}

final class WindowRecorder: NSObject, SCStreamOutput {
    private let writer: AVAssetWriter
    private let writerInput: AVAssetWriterInput
    private let stream: SCStream
    private var didStartWriting = false

    init(windowID: CGWindowID, outputURL: URL, fps: Int32) async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let window = content.windows.first(where: { $0.windowID == windowID }) else {
            throw RecorderError.missingWindow(windowID)
        }

        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        config.width = Int(window.frame.width)
        config.height = Int(window.frame.height)
        config.minimumFrameInterval = CMTime(value: 1, timescale: fps)
        config.queueDepth = 8
        config.capturesAudio = false

        self.writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
        self.writerInput = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: config.width,
                AVVideoHeightKey: config.height
            ]
        )
        self.writerInput.expectsMediaDataInRealTime = true
        guard self.writer.canAdd(self.writerInput) else {
            throw RecorderError.cannotAddWriterInput
        }
        self.writer.add(self.writerInput)
        self.stream = SCStream(filter: filter, configuration: config, delegate: nil)
        super.init()
        try self.stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: DispatchQueue(label: "echarts-terminal.record-window"))
    }

    func start() async throws {
        try await stream.startCapture()
    }

    func stop() async throws {
        try await stream.stopCapture()
        writerInput.markAsFinished()
        await withCheckedContinuation { continuation in
            writer.finishWriting {
                continuation.resume()
            }
        }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .screen else {
            return
        }
        guard CMSampleBufferIsValid(sampleBuffer) else {
            return
        }

        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        if !didStartWriting {
            writer.startWriting()
            writer.startSession(atSourceTime: timestamp)
            didStartWriting = true
        }

        if writerInput.isReadyForMoreMediaData {
            writerInput.append(sampleBuffer)
        }
    }
}

guard CommandLine.arguments.count >= 5 else {
    fatalError("Usage: swift record-window.swift <windowId> <outputPath> <fps> <durationSeconds>")
}

let windowID = CGWindowID(UInt32(CommandLine.arguments[1])!)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let fps = Int32(CommandLine.arguments[3]) ?? 12
let durationSeconds = Double(CommandLine.arguments[4]) ?? 16

Task {
    do {
        let recorder = try await WindowRecorder(windowID: windowID, outputURL: outputURL, fps: fps)
        try await recorder.start()
        try await Task.sleep(nanoseconds: UInt64(durationSeconds * 1_000_000_000))
        try await recorder.stop()
        exit(0)
    }
    catch {
        fputs("\(error)\n", stderr)
        exit(1)
    }
}

RunLoop.main.run()
