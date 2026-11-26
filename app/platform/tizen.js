/* Cactus — adaptador para Samsung (Tizen).
   Se carga antes de app.js solo en la versión de Samsung.
   - Registra las teclas del control (colores, CH+/−, multimedia, Info) y traduce las propias de Samsung.
   - Ofrece window.CactusNative con el reproductor AVPlay de Samsung (decodificador del TV: MPEG-2,
     H.264, H.265, AC3…), igual que el reproductor nativo de la app Android. ES5. */
(function () {
  if (!window.tizen) return;
  window.CACTUS_TV = true;       // siempre modo televisor
  window.CACTUS_OWN_VIS = true;  // este archivo maneja salir/volver a la app

  // ---- Teclas ----
  var keys = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward', 'Info'];
  try { tizen.tvinputdevice.registerKeyBatch(keys); }
  catch (e) { for (var i = 0; i < keys.length; i++) { try { tizen.tvinputdevice.registerKey(keys[i]); } catch (e2) {} } }
  // Samsung → códigos que usa la app (los de LG webOS)
  var MAP = { 10009: 461, 427: 33, 428: 34, 457: 406 };
  window.addEventListener('keydown', function (e) {
    var k = MAP[e.keyCode];
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (window.__cactusKey) window.__cactusKey(k);
  }, true);

  // ---- Reproductor AVPlay ----
  var av = window.webapis && webapis.avplay;
  var obj = null, active = false, paused = false;
  function emit(ev, n) { try { if (window.__cactusNative) window.__cactusNative(ev, n || 0); } catch (e) {} }
  function ensureObj() {
    if (obj) return;
    obj = document.createElement('object');
    obj.type = 'application/avplayer';
    obj.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:-1;';
    document.body.insertBefore(obj, document.body.firstChild);
  }
  function rect() {
    try { av.setDisplayRect(0, 0, 1920, 1080); } catch (e) {}
    try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch (e) {}
  }
  function stop() {
    if (!av) return;
    active = false; paused = false;
    try { av.stop(); } catch (e) {}
    try { av.close(); } catch (e) {}
  }
  function play(url) {
    stop();
    if (!av) { emit('error', -2100); return; }
    try {
      ensureObj();
      av.open(url);
      rect();
      av.setListener({
        onbufferingstart: function () { if (active) emit('buffering'); },
        onbufferingcomplete: function () { if (active) emit('playing', 1); },
        onstreamcompleted: function () { if (active) emit('ended'); },
        onerror: function () { if (active) emit('error', -2000); },
        oncurrentplaytime: function () {}, onevent: function () {}, onsubtitlechange: function () {}, ondrmevent: function () {}
      });
      try { av.setTimeoutForBuffering(15); } catch (e) {}
      active = true;
      av.prepareAsync(function () {
        if (!active) return;
        try { av.play(); emit('playing', 0); } catch (e) { emit('error', -2002); }
      }, function () { if (active) emit('error', -2001); });
    } catch (e) { active = false; emit('error', -2003); }
  }
  function lang(info) {
    try { var x = JSON.parse(info.extra_info || '{}'); return x.language || x.lang || ''; } catch (e) { return ''; }
  }

  window.CactusNative = {
    nativeName: 'Samsung',
    isTv: function () { return true; },
    exit: function () { stop(); try { tizen.application.getCurrentApplication().exit(); } catch (e) { window.close(); } },
    playNative: function (url) { play(url); },
    stopNative: function () { stop(); },
    pauseNative: function () { try { av.pause(); paused = true; } catch (e) {} },
    resumeNative: function () { try { av.play(); paused = false; } catch (e) {} },
    seekNative: function (ms) { try { av.seekTo(ms); } catch (e) {} },
    nativePosition: function () { try { return active ? av.getCurrentTime() : 0; } catch (e) { return 0; } },
    nativeDuration: function () { try { return active ? av.getDuration() : 0; } catch (e) { return 0; } },
    // Idiomas: mismo formato que la app Android: "actual\nid\tnombre..." (type 0 = audio).
    // Los subtítulos no están disponibles en Samsung por ahora.
    nativeTracks: function (type) {
      if (!active || type !== 0) return '';
      try {
        var all = av.getTotalTrackInfo() || [], cur = -1, out = [], i;
        var now = av.getCurrentStreamInfo() || [];
        for (i = 0; i < now.length; i++) if (now[i].type === 'AUDIO') cur = now[i].index;
        for (i = 0; i < all.length; i++) {
          if (all[i].type !== 'AUDIO') continue;
          var l = lang(all[i]);
          out.push(all[i].index + '\t' + (l ? '[' + l + ']' : ''));
        }
        return out.length ? cur + '\n' + out.join('\n') : '';
      } catch (e) { return ''; }
    },
    setNativeTrack: function (type, id) { if (type === 0) { try { av.setSelectTrack('AUDIO', id); } catch (e) {} } }
  };

  // Al salir o volver a la app
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (window.__cactusStop) window.__cactusStop(); else stop(); }
    else if (window.__cactusResume) window.__cactusResume();
  });
})();
