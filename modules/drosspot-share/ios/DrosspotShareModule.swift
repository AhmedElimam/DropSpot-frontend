import ExpoModulesCore

/// iPhone side of «share a receipt to the teacher» (founder 2026-11-11).
///
/// Phase 1 ships Android only: the iPhone share sheet needs a Share Extension target plus an
/// App Group, which need Apple-portal setup first. Until then these answer «nothing», so the
/// same JavaScript runs on both platforms.
public class DrosspotShareModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DrosspotShare")
    Events("onShare")

    AsyncFunction("getPendingShare") { () -> [String: Any]? in
      return nil
    }

    AsyncFunction("setTargets") { (_: [[String: Any]]) -> Bool in
      return false
    }
  }
}
