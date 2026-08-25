import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '@/theme/index';

/**
 * A small WordPress-style rich-text editor for the booking-link rules template. It hosts
 * a `contenteditable` surface + formatting toolbar inside a WebView (React Native has no
 * native rich-text control), and bridges to RN:
 *   - emits the current HTML on every edit (`onChangeHtml`),
 *   - asks the app to pick an image when the image button is tapped (`onPickImage`);
 *     the app uploads it and calls `ref.insertImage(url)` to embed it.
 * The HTML is sanitized server-side before it ever renders on the public booking page.
 */
export interface RichTextEditorRef {
  insertImage: (url: string) => void;
}

interface Props {
  initialHtml?: string;
  placeholder?: string;
  onChangeHtml: (html: string) => void;
  onPickImage: () => void;
  height?: number;
}

const PAGE = `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { -webkit-user-select: text; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, "Segoe UI", Tahoma, sans-serif; color: #2b2b3a; background: #fff; }
  .tb { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-bottom: 1px solid #e6e2f0; background: #faf9fe; position: sticky; top: 0; }
  .tb button { min-width: 34px; height: 32px; border: 1px solid #d9d4ea; background: #fff; border-radius: 8px; font-size: 15px; font-weight: 700; color: #4C1D95; }
  .tb button:active { background: #ede8fb; }
  .tb label.clr { display: inline-flex; align-items: center; gap: 3px; height: 32px; padding: 0 6px; border: 1px solid #d9d4ea; background: #fff; border-radius: 8px; font-size: 14px; font-weight: 700; color: #4C1D95; }
  .tb label.clr input { width: 22px; height: 22px; border: 0; background: none; padding: 0; }
  #ed { padding: 12px 14px; min-height: 120px; line-height: 1.7; font-size: 16px; outline: none; }
  #ed.empty::before { content: attr(data-ph); color: #9aa0a6; }
  #ed img { max-width: 100%; height: auto; border-radius: 8px; margin: 6px 0; }
  #ed h2 { font-size: 18px; margin: 10px 0 6px; color: #4C1D95; }
  #ed h3 { font-size: 16px; margin: 8px 0 6px; color: #4C1D95; }
  #ed ul, #ed ol { padding-inline-start: 22px; margin: 6px 0; }
</style></head><body>
<div class="tb">
  <button data-cmd="bold">B</button>
  <button data-cmd="italic" style="font-style:italic;">I</button>
  <button data-cmd="underline" style="text-decoration:underline;">U</button>
  <button data-block="H2">H2</button>
  <button data-block="H3">H3</button>
  <button data-block="P">¶</button>
  <button data-cmd="insertUnorderedList">•</button>
  <button data-cmd="insertOrderedList">1.</button>
  <button id="imgBtn">🖼️</button>
  <label class="clr">A<input type="color" id="fore" value="#4C1D95"></label>
  <label class="clr">🖍️<input type="color" id="hil" value="#fff3a0"></label>
</div>
<div id="ed" contenteditable="true" data-ph=""></div>
<script>
  var ed = document.getElementById('ed');
  var savedRange = null;
  function post(m){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function isEmpty(){ return ed.textContent.replace(/\\s/g,'') === '' && ed.querySelectorAll('img').length === 0; }
  function ph(){ ed.classList.toggle('empty', isEmpty()); }
  function change(){ post({ type:'change', html: isEmpty() ? '' : ed.innerHTML }); ph(); }
  ed.addEventListener('input', change);
  ed.addEventListener('blur', function(){ var s = window.getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0); });
  function restore(){ ed.focus(); if (savedRange){ var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
  function bind(sel, fn){ document.querySelectorAll(sel).forEach(function(b){ b.addEventListener('mousedown', function(e){ e.preventDefault(); ed.focus(); fn(b); change(); }); }); }
  bind('[data-cmd]', function(b){ document.execCommand(b.getAttribute('data-cmd'), false, null); });
  bind('[data-block]', function(b){ document.execCommand('formatBlock', false, b.getAttribute('data-block')); });
  document.getElementById('imgBtn').addEventListener('mousedown', function(e){ e.preventDefault(); post({ type:'pickImage' }); });
  function applyColor(cmd, val){ restore(); document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); change(); }
  document.getElementById('fore').addEventListener('input', function(){ applyColor('foreColor', this.value); });
  document.getElementById('hil').addEventListener('input', function(){ applyColor('hiliteColor', this.value); });
  window.setPlaceholder = function(t){ ed.setAttribute('data-ph', t || ''); ph(); };
  window.setHtmlFromNative = function(h){ ed.innerHTML = h || ''; ph(); };
  window.insertImageFromNative = function(url){ ed.focus(); document.execCommand('insertImage', false, url); change(); };
  ph();
  post({ type:'ready' });
</script></body></html>`;

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(function RichTextEditor(
  { initialHtml = '', placeholder = '', onChangeHtml, onPickImage, height = 300 },
  ref,
) {
  const webRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    insertImage: (url: string) => {
      webRef.current?.injectJavaScript(`window.insertImageFromNative(${JSON.stringify(url)}); true;`);
    },
  }), []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') {
      webRef.current?.injectJavaScript(
        `window.setPlaceholder(${JSON.stringify(placeholder)}); window.setHtmlFromNative(${JSON.stringify(initialHtml)}); true;`,
      );
    } else if (msg.type === 'change') {
      onChangeHtml(typeof msg.html === 'string' ? msg.html : '');
    } else if (msg.type === 'pickImage') {
      onPickImage();
    }
  }, [initialHtml, placeholder, onChangeHtml, onPickImage]);

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: PAGE }}
      onMessage={onMessage}
      hideKeyboardAccessoryView
      keyboardDisplayRequiresUserAction={false}
      style={{ height, backgroundColor: colors.surface, borderRadius: 12, opacity: 0.99 }}
      // The editor manages its own scrolling; let the page scroll host it.
      scrollEnabled
    />
  );
});
