import ExpoModulesCore
import UIKit

/// The options `transcodeAsync` takes from JS (src/lib/drosMedia.ts).
struct DrosTranscodeOptions: Record {
  @Field var uri: String = ""
  /// Kept range in milliseconds; endMs <= startMs means "to the end".
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
  @Field var maxShortSide: Int = 720
  @Field var videoBitrate: Int = 2_000_000
  @Field var audioBitrate: Int = 96_000
}

/**
 * DrosMedia — the app's own small native module (modules/dros-media, autolinked from ./modules).
 *
 * 1. `transcodeAsync`: trim + downscale + re-encode a video ON THE PHONE before a حكاوي upload
 *    (the server only stores — no ffmpeg on the host). AVFoundation; see DrosTranscoder.swift.
 * 2. `isScreenCapturedAsync` + `onScreenCaptureChanged`: iOS's own truth about screen
 *    recording / mirroring (UIScreen.isCaptured). expo-screen-capture 8 blanks the picture
 *    while the screen is captured but tells JS nothing, so the player could never report a
 *    recording attempt — this is the missing half.
 */
public class DrosMediaModule: Module {
  private var job: DrosTranscodeJob?
  private var captureObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("DrosMedia")

    Events("onTranscodeProgress", "onScreenCaptureChanged")

    OnStartObserving("onScreenCaptureChanged") {
      DispatchQueue.main.async { self.observeCapture(true) }
    }

    OnStopObserving("onScreenCaptureChanged") {
      DispatchQueue.main.async { self.observeCapture(false) }
    }

    OnDestroy {
      self.job?.cancel()
      if let observer = self.captureObserver {
        NotificationCenter.default.removeObserver(observer)
      }
    }

    AsyncFunction("isScreenCapturedAsync") { () -> Bool in
      return UIScreen.main.isCaptured
    }.runOnQueue(.main)

    AsyncFunction("transcodeAsync") { (options: DrosTranscodeOptions, promise: Promise) in
      if self.job != nil {
        promise.reject("ERR_BUSY", "Another video is being prepared.")
        return
      }
      guard let url = DrosMediaModule.fileURL(options.uri) else {
        promise.reject("ERR_URI", "Not a local video file.")
        return
      }
      let job = DrosTranscodeJob(
        source: url,
        start: options.startMs / 1000,
        end: options.endMs / 1000,
        maxShortSide: options.maxShortSide,
        videoBitrate: options.videoBitrate,
        audioBitrate: options.audioBitrate
      )
      self.job = job
      // The asset's tracks and duration load synchronously — off the main thread.
      DispatchQueue.global(qos: .userInitiated).async {
        job.run(progress: { [weak self] value in
          self?.sendEvent("onTranscodeProgress", ["progress": value])
        }, completion: { [weak self] result in
          // Free the slot BEFORE answering, so a retry right after a cancel is never «busy».
          DispatchQueue.main.async {
            if self?.job === job { self?.job = nil }
            switch result {
            case .success(let out):
              promise.resolve([
                "uri": out.url.absoluteString,
                "durationMs": out.duration * 1000,
                "width": out.width,
                "height": out.height,
                "size": out.size,
              ])
            case .failure(let error):
              if case DrosTranscodeError.cancelled = error {
                promise.reject("ERR_CANCELLED", "Cancelled.")
              } else {
                promise.reject("ERR_TRANSCODE", error.localizedDescription)
              }
            }
          }
        })
      }
    }.runOnQueue(.main)

    AsyncFunction("cancelTranscodeAsync") {
      self.job?.cancel()
    }.runOnQueue(.main)
  }

  private func observeCapture(_ on: Bool) {
    if on, captureObserver == nil {
      captureObserver = NotificationCenter.default.addObserver(
        forName: UIScreen.capturedDidChangeNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onScreenCaptureChanged", ["captured": UIScreen.main.isCaptured])
      }
    } else if !on, let observer = captureObserver {
      NotificationCenter.default.removeObserver(observer)
      captureObserver = nil
    }
  }

  static func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      return URL(string: uri)
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    return nil
  }
}
