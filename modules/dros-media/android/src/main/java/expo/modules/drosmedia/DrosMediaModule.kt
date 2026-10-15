package expo.modules.drosmedia

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.AudioEncoderSettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.UUID

/** The options `transcodeAsync` takes from JS (src/lib/drosMedia.ts). */
class DrosTranscodeOptions : Record {
  @Field
  var uri: String = ""

  /** Kept range in milliseconds; endMs <= startMs means "to the end". */
  @Field
  var startMs: Double = 0.0

  @Field
  var endMs: Double = 0.0

  @Field
  var maxShortSide: Int = 720

  @Field
  var videoBitrate: Int = 2_000_000

  @Field
  var audioBitrate: Int = 96_000
}

/**
 * DrosMedia — the app's own small native module (modules/dros-media, autolinked from ./modules).
 *
 * `transcodeAsync` trims + downscales + re-encodes a video ON THE PHONE before a حكاوي upload
 * (the server only stores — no ffmpeg on the host), with Google's Media3 Transformer: hardware
 * MediaCodec, rotation handled, H.264 + AAC in an MP4. Same Media3 version as expo-video.
 *
 * Android cannot tell an app that the screen is being recorded; FLAG_SECURE (expo-screen-capture)
 * already turns such a recording black. `isScreenCapturedAsync` is therefore always false here,
 * and `onScreenCaptureChanged` never fires — the iOS module is the one that reports.
 */
@UnstableApi
class DrosMediaModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var transformer: Transformer? = null
  private var pending: Promise? = null
  private var poller: Runnable? = null

  override fun definition() = ModuleDefinition {
    Name("DrosMedia")

    Events("onTranscodeProgress", "onScreenCaptureChanged")

    OnDestroy {
      main.post { cancelCurrent() }
    }

    AsyncFunction("isScreenCapturedAsync") {
      false
    }

    AsyncFunction("transcodeAsync") { options: DrosTranscodeOptions, promise: Promise ->
      // Transformer must be built, started and cancelled on one Looper thread: the main one.
      main.post { start(options, promise) }
    }

    AsyncFunction("cancelTranscodeAsync") {
      main.post { cancelCurrent() }
    }
  }

  private fun start(options: DrosTranscodeOptions, promise: Promise) {
    val context: Context = appContext.reactContext ?: run {
      promise.reject("ERR_CONTEXT", "No React context.", null)
      return
    }
    if (transformer != null) {
      promise.reject("ERR_BUSY", "Another video is being prepared.", null)
      return
    }
    val uri = Uri.parse(options.uri)

    // Only scale DOWN: a 480p clip stays 480p.
    val shortSide = shortSideOf(context, uri)
    val videoEffects = mutableListOf<Effect>()
    if (shortSide > options.maxShortSide) {
      videoEffects.add(Presentation.createForShortSide(options.maxShortSide))
    }

    val clipping = MediaItem.ClippingConfiguration.Builder()
      .setStartPositionMs(options.startMs.toLong().coerceAtLeast(0L))
    if (options.endMs > options.startMs) {
      clipping.setEndPositionMs(options.endMs.toLong())
    }
    val item = MediaItem.Builder()
      .setUri(uri)
      .setClippingConfiguration(clipping.build())
      .build()
    val edited = EditedMediaItem.Builder(item)
      .setEffects(Effects(emptyList(), videoEffects))
      .build()

    val encoders = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(
        VideoEncoderSettings.Builder().setBitrate(options.videoBitrate).build()
      )
      .setRequestedAudioEncoderSettings(
        AudioEncoderSettings.Builder().setBitrate(options.audioBitrate).build()
      )
      .setEnableFallback(true)
      .build()

    val output = File(context.cacheDir, "dros-video-${UUID.randomUUID()}.mp4")
    val built = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .setEncoderFactory(encoders)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          finish()
          sendEvent("onTranscodeProgress", mapOf("progress" to 1.0))
          promise.resolve(
            mapOf(
              "uri" to "file://${output.absolutePath}",
              "durationMs" to exportResult.durationMs.toDouble(),
              "width" to exportResult.width,
              "height" to exportResult.height,
              "size" to output.length().toDouble()
            )
          )
        }

        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          finish()
          output.delete()
          promise.reject("ERR_TRANSCODE", "${exportException.message} (${exportException.errorCodeName})", exportException)
        }
      })
      .build()

    transformer = built
    pending = promise
    try {
      built.start(edited, output.absolutePath)
      startPolling(built)
    } catch (e: Exception) {
      finish()
      promise.reject("ERR_TRANSCODE", e.message ?: "start", e)
    }
  }

  private fun cancelCurrent() {
    val current = transformer ?: return
    val promise = pending
    finish()
    current.cancel()
    promise?.reject("ERR_CANCELLED", "Cancelled.", null)
  }

  private fun finish() {
    poller?.let { main.removeCallbacks(it) }
    poller = null
    transformer = null
    pending = null
  }

  private fun startPolling(current: Transformer) {
    val holder = ProgressHolder()
    val tick = object : Runnable {
      override fun run() {
        if (transformer !== current) return
        if (current.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) {
          sendEvent("onTranscodeProgress", mapOf("progress" to holder.progress / 100.0))
        }
        main.postDelayed(this, 250L)
      }
    }
    poller = tick
    main.postDelayed(tick, 250L)
  }

  /** The upright frame's short side in pixels, or 0 when unknown (then nothing is scaled). */
  private fun shortSideOf(context: Context, uri: Uri): Int {
    val retriever = MediaMetadataRetriever()
    return try {
      retriever.setDataSource(context, uri)
      val w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      if (w > 0 && h > 0) minOf(w, h) else 0
    } catch (e: Exception) {
      0
    } finally {
      try {
        retriever.release()
      } catch (e: Exception) {
        // ignore
      }
    }
  }
}
