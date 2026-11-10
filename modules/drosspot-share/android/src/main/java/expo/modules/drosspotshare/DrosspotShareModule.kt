package expo.modules.drosspotshare

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.webkit.MimeTypeMap
import androidx.core.app.Person
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

/** One teacher the family owes by transfer — a contact in the phone's share sheet. */
class ShareTarget : Record {
  @Field var id: String = ""
  @Field var name: String = ""
  /** A local file (file:// or a path) with the teacher's logo; initials are drawn without one. */
  @Field var iconPath: String? = null
  /** #RRGGBB behind the initials. */
  @Field var color: String? = null
}

/**
 * Receipts shared from InstaPay / Vodafone Cash straight to a teacher (founder 2026-11-11).
 *
 * - setTargets(): the teachers the family owes, published as long-lived sharing shortcuts in
 *   the category the manifest's share-target declares, so Android lists them in the share
 *   sheet the way it lists WhatsApp chats. An empty list removes them all.
 * - getPendingShare(): the share that opened (or re-entered) the app — the chosen teacher when
 *   it came through one of those contacts, the text, and the shared image copied into the
 *   app's cache (a content:// grant does not outlive the intent). Read once.
 */
class DrosspotShareModule : Module() {
  private var pending: Intent? = null

  override fun definition() = ModuleDefinition {
    Name("DrosspotShare")
    Events("onShare")

    OnCreate {
      appContext.currentActivity?.intent?.let { if (isShare(it)) pending = it }
    }

    OnNewIntent { intent ->
      if (isShare(intent)) {
        pending = intent
        sendEvent("onShare", mapOf<String, Any>())
      }
    }

    AsyncFunction("getPendingShare") {
      val intent = pending ?: appContext.currentActivity?.intent?.takeIf { isShare(it) }
      pending = null
      if (intent == null) return@AsyncFunction null
      // Mark the activity's intent read, so a reload or remount does not offer it again.
      intent.putExtra(CONSUMED, true)
      read(intent)
    }

    AsyncFunction("setTargets") { targets: List<ShareTarget> ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      publish(ctx, targets)
      true
    }
  }

  private fun isShare(intent: Intent): Boolean =
    (intent.action == Intent.ACTION_SEND) && !intent.getBooleanExtra(CONSUMED, false)

  private fun read(intent: Intent): Map<String, Any?> {
    val ctx = appContext.reactContext
    val shortcut = intent.getStringExtra(ShortcutManagerCompat.EXTRA_SHORTCUT_ID)
    val teacherId = shortcut?.takeIf { it.startsWith(PREFIX) }?.removePrefix(PREFIX)
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    val stream: Uri? = if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
    val file = if (ctx != null && stream != null) copyToCache(ctx, stream, intent.type) else null
    return mapOf(
      "teacherId" to teacherId,
      "text" to text,
      "file" to file,
    )
  }

  private fun copyToCache(ctx: Context, uri: Uri, declared: String?): Map<String, Any?>? = try {
    val mime = ctx.contentResolver.getType(uri) ?: declared ?: "image/jpeg"
    val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "jpg"
    val dir = File(ctx.cacheDir, "shared-receipts").apply { mkdirs() }
    // Keep only the latest few receipts on the phone.
    dir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(4)?.forEach { it.delete() }
    val out = File(dir, "receipt-${System.currentTimeMillis()}.$ext")
    ctx.contentResolver.openInputStream(uri)?.use { input -> out.outputStream().use { input.copyTo(it) } }
    if (out.length() == 0L) null else mapOf("uri" to Uri.fromFile(out).toString(), "mimeType" to mime, "size" to out.length())
  } catch (e: Exception) {
    null
  }

  private fun publish(ctx: Context, targets: List<ShareTarget>) {
    val launch = (ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent())
      .setAction(Intent.ACTION_VIEW)
    val max = ShortcutManagerCompat.getMaxShortcutCountPerActivity(ctx).coerceIn(1, 4)
    val shortcuts = targets.filter { it.id.isNotBlank() && it.name.isNotBlank() }.take(max).mapIndexed { rank, t ->
      val id = PREFIX + t.id
      val icon = IconCompat.createWithBitmap(avatar(t))
      ShortcutInfoCompat.Builder(ctx, id)
        .setShortLabel(t.name)
        .setLongLabel(t.name)
        .setIcon(icon)
        .setIntent(launch)
        .setLongLived(true)
        .setRank(rank)
        .setCategories(setOf(CATEGORY))
        .setPerson(Person.Builder().setName(t.name).setKey(id).setIcon(icon).build())
        .build()
    }
    val keep = shortcuts.map { it.id }.toSet()
    val stale = ShortcutManagerCompat.getDynamicShortcuts(ctx).map { it.id }
      .plus(ShortcutManagerCompat.getShortcuts(ctx, ShortcutManagerCompat.FLAG_MATCH_CACHED).map { it.id })
      .filter { it.startsWith(PREFIX) && it !in keep }
      .distinct()
    if (stale.isNotEmpty()) {
      // A paid-up teacher leaves the share sheet now, not when Android next tidies its cache.
      ShortcutManagerCompat.removeLongLivedShortcuts(ctx, stale)
      ShortcutManagerCompat.removeDynamicShortcuts(ctx, stale)
    }
    if (shortcuts.isEmpty()) {
      ShortcutManagerCompat.removeAllDynamicShortcuts(ctx)
    } else {
      ShortcutManagerCompat.setDynamicShortcuts(ctx, shortcuts)
    }
  }

  /** The teacher's logo in a circle, or their first letter on their colour. */
  private fun avatar(t: ShareTarget): Bitmap {
    val size = 192
    val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val logo = t.iconPath?.let { p ->
      val path = if (p.startsWith("file://")) Uri.parse(p).path else p
      path?.let { BitmapFactory.decodeFile(it) }
    }
    if (logo != null) {
      val side = minOf(logo.width, logo.height)
      val square = Bitmap.createBitmap(logo, (logo.width - side) / 2, (logo.height - side) / 2, side, side)
      val scaled = Bitmap.createScaledBitmap(square, size, size, true)
      canvas.drawColor(Color.WHITE)
      paint.shader = BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
      canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
      return out
    }
    paint.color = try { Color.parseColor(t.color ?: "#2F5BEA") } catch (e: Exception) { Color.parseColor("#2F5BEA") }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
    val letter = t.name.trim().firstOrNull()?.toString() ?: "؟"
    val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = size * 0.46f
      typeface = Typeface.DEFAULT_BOLD
      textAlign = Paint.Align.CENTER
    }
    val y = size / 2f - (text.descent() + text.ascent()) / 2f
    canvas.drawText(letter, size / 2f, y, text)
    return out
  }

  companion object {
    const val PREFIX = "teacher:"
    /** Must match the category in res/xml/drosspot_share_targets.xml (written by the config plugin). */
    const val CATEGORY = "com.drosspot.share.TEACHER_RECEIPT"
    const val CONSUMED = "drosspot.share.consumed"
  }
}
