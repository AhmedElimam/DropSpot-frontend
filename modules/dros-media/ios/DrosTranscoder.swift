import AVFoundation
import UIKit

/// The pure AVFoundation half of DrosMedia (no Expo types, so it typechecks on its own).
///
/// One pass: read only the kept range, rotate upright, scale so the short side is at most
/// `maxShortSide`, re-encode H.264 at `videoBitrate` + AAC at `audioBitrate`, write an MP4 with
/// the index at the front (streams before it has fully downloaded). A video composition does
/// the rotate + scale, and — because its colour space is pinned to BT.709 — also tone-maps an
/// iPhone HDR (HLG / Dolby Vision) recording to SDR instead of washing it out.
enum DrosTranscodeError: LocalizedError {
  case noVideoTrack
  case badRange
  case cannotRead(String)
  case cannotWrite(String)
  case cancelled

  var errorDescription: String? {
    switch self {
    case .noVideoTrack: return "No video track in the file."
    case .badRange: return "The kept range is empty."
    case .cannotRead(let why): return "Could not read the video: \(why)"
    case .cannotWrite(let why): return "Could not write the video: \(why)"
    case .cancelled: return "Cancelled."
    }
  }
}

struct DrosTranscodeResult {
  let url: URL
  let duration: Double
  let width: Int
  let height: Int
  let size: Double
}

final class DrosTranscodeJob {
  private let source: URL
  private let start: Double
  private let end: Double
  private let maxShortSide: Int
  private let videoBitrate: Int
  private let audioBitrate: Int
  private let lock = NSLock()
  private var cancelledFlag = false
  private var reader: AVAssetReader?

  init(source: URL, start: Double, end: Double, maxShortSide: Int, videoBitrate: Int, audioBitrate: Int) {
    self.source = source
    self.start = start
    self.end = end
    self.maxShortSide = max(240, maxShortSide)
    self.videoBitrate = max(250_000, videoBitrate)
    self.audioBitrate = max(32_000, audioBitrate)
  }

  var isCancelled: Bool {
    lock.lock()
    defer { lock.unlock() }
    return cancelledFlag
  }

  func cancel() {
    lock.lock()
    cancelledFlag = true
    let r = reader
    lock.unlock()
    r?.cancelReading()
  }

  static func even(_ value: CGFloat) -> Int {
    return max(2, Int((value / 2).rounded()) * 2)
  }

  func run(progress: @escaping (Double) -> Void, completion: @escaping (Result<DrosTranscodeResult, Error>) -> Void) {
    let asset = AVURLAsset(url: source, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      completion(.failure(DrosTranscodeError.noVideoTrack))
      return
    }
    let audioTrack = asset.tracks(withMediaType: .audio).first

    let total = CMTimeGetSeconds(asset.duration)
    let from = max(0, min(start, total))
    let to = end > from ? min(end, total) : total
    guard to - from > 0.1 else {
      completion(.failure(DrosTranscodeError.badRange))
      return
    }
    let range = CMTimeRange(
      start: CMTime(seconds: from, preferredTimescale: 600),
      end: CMTime(seconds: to, preferredTimescale: 600)
    )
    let span = to - from

    // Upright size: a portrait phone recording is stored landscape + a 90° transform.
    let t = videoTrack.preferredTransform
    let natural = videoTrack.naturalSize
    let rotated = abs(t.b) > 0.5 && abs(t.c) > 0.5
    let displayW = abs(rotated ? natural.height : natural.width)
    let displayH = abs(rotated ? natural.width : natural.height)
    let shortSide = min(displayW, displayH)
    let scale = shortSide > CGFloat(maxShortSide) ? CGFloat(maxShortSide) / shortSide : 1
    let renderW = DrosTranscodeJob.even(displayW * scale)
    let renderH = DrosTranscodeJob.even(displayH * scale)

    let fpsSource = videoTrack.nominalFrameRate > 1 ? videoTrack.nominalFrameRate : 30
    let fps = Int32(min(30, fpsSource).rounded())

    let composition = AVMutableVideoComposition()
    composition.renderSize = CGSize(width: renderW, height: renderH)
    composition.frameDuration = CMTime(value: 1, timescale: max(1, fps))
    composition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
    composition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
    composition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: asset.duration)
    let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
    layer.setTransform(t.concatenating(CGAffineTransform(scaleX: scale, y: scale)), at: .zero)
    instruction.layerInstructions = [layer]
    composition.instructions = [instruction]

    let output = FileManager.default.temporaryDirectory
      .appendingPathComponent("dros-video-\(UUID().uuidString).mp4")

    let reader: AVAssetReader
    let writer: AVAssetWriter
    do {
      reader = try AVAssetReader(asset: asset)
      writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    } catch {
      completion(.failure(DrosTranscodeError.cannotRead(error.localizedDescription)))
      return
    }
    reader.timeRange = range
    writer.shouldOptimizeForNetworkUse = true

    let videoOut = AVAssetReaderVideoCompositionOutput(
      videoTracks: [videoTrack],
      videoSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange]
    )
    videoOut.videoComposition = composition
    videoOut.alwaysCopiesSampleData = false
    guard reader.canAdd(videoOut) else {
      completion(.failure(DrosTranscodeError.cannotRead("video output")))
      return
    }
    reader.add(videoOut)

    let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: renderW,
      AVVideoHeightKey: renderH,
      AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
      ],
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: videoBitrate,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalDurationKey: 2,
      ],
    ])
    videoIn.expectsMediaDataInRealTime = false
    guard writer.canAdd(videoIn) else {
      completion(.failure(DrosTranscodeError.cannotWrite("video input")))
      return
    }
    writer.add(videoIn)

    var audioOut: AVAssetReaderTrackOutput?
    var audioIn: AVAssetWriterInput?
    if let audioTrack = audioTrack {
      let channels = DrosTranscodeJob.channelCount(of: audioTrack)
      let ao = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: 44_100,
        AVNumberOfChannelsKey: channels,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
      ])
      ao.alwaysCopiesSampleData = false
      let ai = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 44_100,
        AVNumberOfChannelsKey: channels,
        AVEncoderBitRateKey: audioBitrate,
      ])
      ai.expectsMediaDataInRealTime = false
      if reader.canAdd(ao) && writer.canAdd(ai) {
        reader.add(ao)
        writer.add(ai)
        audioOut = ao
        audioIn = ai
      }
    }

    lock.lock()
    self.reader = reader
    let cancelledEarly = cancelledFlag
    lock.unlock()
    if cancelledEarly {
      completion(.failure(DrosTranscodeError.cancelled))
      return
    }

    guard writer.startWriting() else {
      completion(.failure(DrosTranscodeError.cannotWrite(writer.error?.localizedDescription ?? "start")))
      return
    }
    guard reader.startReading() else {
      writer.cancelWriting()
      completion(.failure(DrosTranscodeError.cannotRead(reader.error?.localizedDescription ?? "start")))
      return
    }
    writer.startSession(atSourceTime: range.start)

    let group = DispatchGroup()
    var lastReported = -1.0
    pump(input: videoIn, output: videoOut, label: "dros.transcode.video", group: group) { pts in
      let p = max(0, min(1, (CMTimeGetSeconds(pts) - from) / span))
      if p - lastReported >= 0.01 {
        lastReported = p
        progress(p)
      }
    }
    if let ai = audioIn, let ao = audioOut {
      pump(input: ai, output: ao, label: "dros.transcode.audio", group: group, onSample: nil)
    }

    group.notify(queue: DispatchQueue.global(qos: .userInitiated)) { [weak self] in
      let cancelled = self?.isCancelled ?? true
      let discard = {
        try? FileManager.default.removeItem(at: output)
      }
      if cancelled || reader.status == .cancelled {
        reader.cancelReading()
        writer.cancelWriting()
        discard()
        completion(.failure(DrosTranscodeError.cancelled))
        return
      }
      if reader.status == .failed {
        writer.cancelWriting()
        discard()
        completion(.failure(DrosTranscodeError.cannotRead(reader.error?.localizedDescription ?? "read")))
        return
      }
      if writer.status == .failed {
        reader.cancelReading()
        discard()
        completion(.failure(DrosTranscodeError.cannotWrite(writer.error?.localizedDescription ?? "write")))
        return
      }
      writer.finishWriting {
        if writer.status == .completed {
          let attrs = try? FileManager.default.attributesOfItem(atPath: output.path)
          let size = (attrs?[.size] as? NSNumber)?.doubleValue ?? 0
          completion(.success(DrosTranscodeResult(url: output, duration: span, width: renderW, height: renderH, size: size)))
        } else {
          discard()
          completion(.failure(DrosTranscodeError.cannotWrite(writer.error?.localizedDescription ?? "finish")))
        }
      }
    }
  }

  /// Copies samples from a reader output into a writer input until either runs dry.
  private func pump(
    input: AVAssetWriterInput,
    output: AVAssetReaderOutput,
    label: String,
    group: DispatchGroup,
    onSample: ((CMTime) -> Void)?
  ) {
    group.enter()
    var done = false
    let finish = {
      done = true
      input.markAsFinished()
      group.leave()
    }
    input.requestMediaDataWhenReady(on: DispatchQueue(label: label)) { [weak self] in
      if done { return }
      while input.isReadyForMoreMediaData {
        if self?.isCancelled ?? true {
          finish()
          return
        }
        guard let sample = output.copyNextSampleBuffer() else {
          finish()
          return
        }
        onSample?(CMSampleBufferGetPresentationTimeStamp(sample))
        if !input.append(sample) {
          finish()
          return
        }
      }
    }
  }

  /// Mono stays mono, anything wider is mixed down to stereo (AAC-LC's comfortable range).
  static func channelCount(of track: AVAssetTrack) -> Int {
    for description in track.formatDescriptions {
      let format = description as! CMAudioFormatDescription
      if let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee {
        return asbd.mChannelsPerFrame <= 1 ? 1 : 2
      }
    }
    return 2
  }
}
