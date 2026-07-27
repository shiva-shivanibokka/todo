(function () {
  'use strict';

  var DEFAULT_SCENE = 'lofi';
  var SCRIM = 0.40;

  var canvas = document.getElementById('bg');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  var current = null, running = true, startTime = 0, lastT = 0;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TAU = Math.PI * 2;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  var CAN_FILTER = (function () {
    try {
      var c = document.createElement('canvas').getContext('2d');
      c.filter = 'blur(2px)';
      return c.filter === 'blur(2px)';
    } catch (e) { return false; }
  })();

  function makeCanvas(w, h, res) {
    var c = document.createElement('canvas');
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
    var x = c.getContext('2d');
    x.setTransform(res, 0, 0, res, 0, 0);
    c._w = w; c._h = h; c._res = res;
    return c;
  }
  function put(c, x, y) { ctx.drawImage(c, x, y, c._w, c._h); }
  function blurCopy(src, px) {
    if (!CAN_FILTER) return src;
    var c = makeCanvas(src._w, src._h, src._res);
    var x = c.getContext('2d');
    x.filter = 'blur(' + px + 'px)';
    x.drawImage(src, 0, 0, src._w, src._h);
    x.filter = 'none';
    return c;
  }

  function rrect(x, px, py, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    x.beginPath();
    x.moveTo(px + r, py);
    x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py);
    x.closePath();
  }
  function radial(x, cx, cy, r, stops) {
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function linear(x, x0, y0, x1, y1, stops) {
    var g = x.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function glowSprite(r, col, res) {
    var c = makeCanvas(r * 2, r * 2, res);
    var x = c.getContext('2d');
    x.fillStyle = radial(x, r, r, r, [[0, rgba(col, 0.9)], [0.4, rgba(col, 0.25)], [1, rgba(col, 0)]]);
    x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  function noiseTile(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    var id = x.createImageData(size, size), d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = 108 + ((Math.random() * 70) | 0);
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  /* =========================================================
     SCENE — LOFI CODING ROOM
     ========================================================= */
  var lofi = (function () {
    var SW = 1600, SH = 900;
    var WIN = { x: 78, y: 88, w: 392, h: 416 };
    var DESK_BACK = 566, DESK_FRONT = 664;
    var MON = { x: 712, y: 282, w: 440, h: 262, shear: 0.046 };
    var GX = 1292;

    var backImg, midImg, foreImg, res = 1, codeRes = 2;
    var rain = [], drips = [], bokeh = [], dustWin = [], dustLamp = [], bulbs = [], steam = [];
    var bokehSprite = null, bulbSprite = null, C = {};
    var sweep = 5;

    /* ---------- the code on screen ---------- */
    var COL = {
      c: '#5b6b8c',  // comment
      k: '#c792ea',  // keyword
      f: '#82aaff',  // function
      s: '#c3e88d',  // string
      n: '#f78c6c',  // number
      v: '#eeffff',  // variable
      d: '#8fa3c4'   // punctuation / plain
    };
    var CODE = [
      [['c', '// rain.js — it never really stops']],
      [['k', 'import'], ['d', ' { '], ['v', 'useState'], ['d', ', '], ['v', 'useEffect'], ['d', ' } '], ['k', 'from'], ['s', " 'react'"]],
      [],
      [['k', 'export function'], ['f', ' useRain'], ['d', '('], ['v', 'intensity'], ['d', ' = '], ['n', '0.6'], ['d', ') {']],
      [['d', '  '], ['k', 'const'], ['d', ' ['], ['v', 'drops'], ['d', ', '], ['v', 'setDrops'], ['d', '] = '], ['f', 'useState'], ['d', '([])']],
      [],
      [['d', '  '], ['f', 'useEffect'], ['d', '(() => {']],
      [['d', '    '], ['k', 'const'], ['d', ' '], ['v', 'id'], ['d', ' = '], ['f', 'setInterval'], ['d', '(() => {']],
      [['d', '      '], ['f', 'setDrops'], ['d', '('], ['v', 'd'], ['d', ' => ['], ['d', '...'], ['v', 'd'], ['d', '.'], ['f', 'slice'], ['d', '('], ['n', '-240'], ['d', '), '], ['f', 'spawn'], ['d', '()])']],
      [['d', '    }, '], ['n', '1000'], ['d', ' / '], ['n', '60'], ['d', ')']],
      [['d', '    '], ['k', 'return'], ['d', ' () => '], ['f', 'clearInterval'], ['d', '('], ['v', 'id'], ['d', ')']],
      [['d', '  }, ['], ['v', 'intensity'], ['d', '])']],
      [],
      [['d', '  '], ['k', 'return'], ['d', ' '], ['v', 'drops']],
      [['d', '}']]
    ];
    var codeCanvas = null, codeShown = -1, curLine = 0, curCol = 0, totalChars = 0;

    function measureCode() {
      totalChars = 0;
      for (var i = 0; i < CODE.length; i++) {
        var n = 0;
        for (var j = 0; j < CODE[i].length; j++) n += CODE[i][j][1].length;
        CODE[i]._len = n;
        totalChars += n + 1;
      }
    }

    function renderCode(shown) {
      var x = codeCanvas.getContext('2d');
      var w = MON.w, h = MON.h;
      x.clearRect(0, 0, w, h);

      // editor background
      x.fillStyle = linear(x, 0, 0, 0, h, [[0, '#141b2c'], [1, '#0e1422']]);
      x.fillRect(0, 0, w, h);

      // title bar
      x.fillStyle = '#1b2338';
      x.fillRect(0, 0, w, 24);
      var dots = ['#e06c75', '#e5c07b', '#98c379'];
      for (var d0 = 0; d0 < 3; d0++) {
        x.fillStyle = dots[d0];
        x.beginPath(); x.arc(16 + d0 * 15, 12, 4.2, 0, TAU); x.fill();
      }
      x.font = '10px ui-monospace, Menlo, Consolas, monospace';
      x.textBaseline = 'middle';
      x.fillStyle = '#7d8bab';
      x.fillText('rain.js', 74, 13);

      var padTop = 34, lh = 14.2, gutter = 40;
      x.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      var chw = x.measureText('0123456789').width / 10;

      // current line highlight
      var remain = shown, li = 0, cl = 0, cc = 0;
      for (li = 0; li < CODE.length; li++) {
        if (remain <= CODE[li]._len) { cl = li; cc = Math.max(0, remain); break; }
        remain -= CODE[li]._len + 1;
      }
      if (li >= CODE.length) { cl = CODE.length - 1; cc = CODE[cl]._len; }
      curLine = cl; curCol = cc;

      x.fillStyle = 'rgba(130,170,255,0.055)';
      x.fillRect(gutter - 6, padTop + cl * lh - lh * 0.5, w - gutter - 4, lh);

      // lines
      remain = shown;
      for (var i = 0; i < CODE.length; i++) {
        var ty = padTop + i * lh;
        var take = clamp(remain, 0, CODE[i]._len);
        // gutter number
        x.fillStyle = (i === cl) ? 'rgba(160,190,240,0.55)' : 'rgba(110,130,175,0.28)';
        x.font = '10px ui-monospace, Menlo, Consolas, monospace';
        var ln = String(i + 1);
        x.fillText(ln, gutter - 12 - ln.length * 5.6, ty);
        x.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

        var col = 0;
        for (var j = 0; j < CODE[i].length; j++) {
          var tok = CODE[i][j], txt = tok[1];
          var vis = clamp(take - col, 0, txt.length);
          if (vis > 0) {
            x.fillStyle = COL[tok[0]] || COL.d;
            x.fillText(txt.slice(0, vis), gutter + col * chw, ty);
          }
          col += txt.length;
        }
        remain -= CODE[i]._len + 1;
        if (remain < 0) remain = 0;
      }

      // status bar
      x.fillStyle = '#1b2338';
      x.fillRect(0, h - 18, w, 18);
      x.font = '9px ui-monospace, Menlo, Consolas, monospace';
      x.fillStyle = '#6b7a9c';
      x.fillText('JavaScript   UTF-8   Ln ' + (cl + 1) + ', Col ' + (cc + 1), 10, h - 9);
      x.fillStyle = '#98c379';
      x.beginPath(); x.arc(w - 16, h - 9, 3, 0, TAU); x.fill();

      codeCanvas._chw = chw; codeCanvas._lh = lh;
      codeCanvas._padTop = padTop; codeCanvas._gutter = gutter;
    }

    function drawMonitor(t) {
      var LOOP = 46, CPS = 15;
      var phase = t % LOOP;
      var shown = Math.floor(clamp(phase * CPS, 0, totalChars));
      if (shown !== codeShown) { codeShown = shown; renderCode(shown); }

      ctx.save();
      ctx.transform(1, MON.shear, 0, 1, MON.x, MON.y);
      ctx.drawImage(codeCanvas, 0, 0, MON.w, MON.h);

      // caret
      var typing = shown < totalChars;
      if (typing || Math.sin(t * 5) > 0) {
        ctx.fillStyle = 'rgba(230,246,255,0.85)';
        ctx.fillRect(codeCanvas._gutter + curCol * codeCanvas._chw,
                     codeCanvas._padTop + curLine * codeCanvas._lh - 6, 2, 12);
      }
      // glass reflection across the panel
      ctx.fillStyle = linear(ctx, 0, 0, MON.w, MON.h, [
        [0, 'rgba(190,225,255,0.07)'], [0.42, 'rgba(190,225,255,0.01)'],
        [0.62, 'rgba(190,225,255,0.045)'], [1, 'rgba(190,225,255,0.01)']
      ]);
      ctx.fillRect(0, 0, MON.w, MON.h);
      // scanline shimmer
      ctx.fillStyle = 'rgba(150,200,255,0.030)';
      var sl = (t * 42) % MON.h;
      ctx.fillRect(0, sl, MON.w, 26);
      ctx.restore();

      // bloom off the panel
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85 + Math.sin(t * 2.6) * 0.06 + Math.sin(t * 23) * 0.015;
      ctx.fillStyle = C.screenBloom;
      ctx.fillRect(MON.x - 420, MON.y - 260, MON.w + 840, MON.h + 700);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- static back plate (gets a DOF blur) ---------- */
    function paintBack(x) {
      x.fillStyle = linear(x, 0, 0, 0, SH, [
        [0, '#14101c'], [0.40, '#1e1626'], [0.70, '#28192a'], [1, '#31202c']
      ]);
      x.fillRect(0, 0, SW, SH);

      // window: sky + skyline
      x.save();
      x.beginPath(); x.rect(WIN.x, WIN.y, WIN.w, WIN.h); x.clip();
      x.fillStyle = linear(x, 0, WIN.y, 0, WIN.y + WIN.h, [
        [0, '#0a1122'], [0.42, '#132139'], [0.76, '#1e3253'], [1, '#2c4266']
      ]);
      x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      var base = WIN.y + WIN.h * 0.84, cx = WIN.x - 12;
      while (cx < WIN.x + WIN.w + 12) {
        var bw = rnd(20, 58), bh = rnd(56, 200);
        x.fillStyle = 'rgba(7,12,26,' + rnd(0.5, 0.85) + ')';
        x.fillRect(cx, base - bh, bw, bh + 50);
        for (var wy = base - bh + 9; wy < base - 6; wy += 10) {
          for (var wx = cx + 4; wx < cx + bw - 4; wx += 7) {
            if (Math.random() > 0.25) continue;
            x.globalAlpha = rnd(0.25, 0.85);
            x.fillStyle = pick(['#ffd79a', '#a8dcff', '#ffb0d8']);
            x.fillRect(wx, wy, 2.5, 3.5);
          }
        }
        x.globalAlpha = 1;
        cx += bw + rnd(3, 15);
      }
      x.restore();
    }

    /* ---------- static mid plate ---------- */
    function paintMid(x) {
      // ---- window glass + frame
      x.save();
      x.beginPath(); x.rect(WIN.x, WIN.y, WIN.w, WIN.h); x.clip();
      x.fillStyle = linear(x, WIN.x, WIN.y, WIN.x + WIN.w, WIN.y + WIN.h, [
        [0, 'rgba(185,215,255,0.085)'], [0.5, 'rgba(185,215,255,0.008)'], [1, 'rgba(185,215,255,0.05)']
      ]);
      x.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      x.restore();
      x.strokeStyle = '#0c0812'; x.lineWidth = 14;
      x.strokeRect(WIN.x, WIN.y, WIN.w, WIN.h);
      x.lineWidth = 8;
      x.beginPath();
      x.moveTo(WIN.x + WIN.w / 2, WIN.y); x.lineTo(WIN.x + WIN.w / 2, WIN.y + WIN.h);
      x.moveTo(WIN.x, WIN.y + WIN.h * 0.5); x.lineTo(WIN.x + WIN.w, WIN.y + WIN.h * 0.5);
      x.stroke();
      x.fillStyle = '#130d1b';
      x.fillRect(WIN.x - 22, WIN.y + WIN.h + 2, WIN.w + 44, 18);

      // small plant on the sill
      x.fillStyle = '#3d2636';
      x.fillRect(WIN.x + 22, WIN.y + WIN.h - 32, 40, 34);
      x.strokeStyle = '#2b4437'; x.lineWidth = 3.4; x.lineCap = 'round';
      for (var lf = 0; lf < 7; lf++) {
        var a0 = -Math.PI / 2 + (lf - 3) * 0.30;
        x.beginPath();
        x.moveTo(WIN.x + 42, WIN.y + WIN.h - 32);
        x.quadraticCurveTo(WIN.x + 42 + Math.cos(a0) * 24, WIN.y + WIN.h - 66,
                           WIN.x + 42 + Math.cos(a0) * 38, WIN.y + WIN.h - 74 - Math.abs(Math.sin(a0)) * 10);
        x.stroke();
      }

      // ---- curtain (right of the window only, opened)
      var g = linear(x, WIN.x + WIN.w + 10, 0, WIN.x + WIN.w + 110, 0, [
        [0, '#251830'], [0.6, '#1a1024'], [1, 'rgba(20,12,28,0)']
      ]);
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(WIN.x + WIN.w + 8, WIN.y - 46);
      x.lineTo(WIN.x + WIN.w + 108, WIN.y - 46);
      x.quadraticCurveTo(WIN.x + WIN.w + 74, WIN.y + WIN.h * 0.5, WIN.x + WIN.w + 100, WIN.y + WIN.h + 70);
      x.lineTo(WIN.x + WIN.w + 8, WIN.y + WIN.h + 70);
      x.closePath(); x.fill();
      x.fillStyle = '#0f0a16';
      x.fillRect(WIN.x - 54, WIN.y - 54, WIN.w + 180, 8);

      // ---- wall clock
      var kx = 596, ky = 152, kr = 40;
      x.fillStyle = '#170f1f';
      x.beginPath(); x.arc(kx, ky, kr, 0, TAU); x.fill();
      x.fillStyle = '#241a2e';
      x.beginPath(); x.arc(kx, ky, kr - 6, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(230,210,200,0.30)'; x.lineWidth = 2;
      for (var m = 0; m < 12; m++) {
        var a1 = m / 12 * TAU;
        x.beginPath();
        x.moveTo(kx + Math.cos(a1) * (kr - 13), ky + Math.sin(a1) * (kr - 13));
        x.lineTo(kx + Math.cos(a1) * (kr - 9), ky + Math.sin(a1) * (kr - 9));
        x.stroke();
      }
      x.strokeStyle = 'rgba(235,220,210,0.55)'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(kx, ky); x.lineTo(kx + 12, ky - 14); x.stroke();  // hour ~ 2am
      x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(kx, ky); x.lineTo(kx - 6, ky - 24); x.stroke();

      // ---- shelf, upper right
      var sx = 1264, sy = 176, sw = 340;
      x.fillStyle = '#1a1121'; x.fillRect(sx, sy, sw, 12);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(sx, sy + 12, sw, 8);
      var bx = sx + 18, cols = ['#5a2f44', '#3a4270', '#6b4a2c', '#2f4f4a', '#54325e', '#7a3f38'];
      for (var b = 0; b < 8; b++) {
        var bwid = rnd(13, 23), bhei = rnd(44, 76);
        x.fillStyle = cols[b % cols.length];
        x.fillRect(bx, sy - bhei, bwid, bhei);
        x.fillStyle = 'rgba(0,0,0,0.30)'; x.fillRect(bx, sy - bhei, bwid, 5);
        x.fillStyle = 'rgba(255,235,210,0.10)'; x.fillRect(bx + 2, sy - bhei * 0.62, bwid - 4, 2);
        bx += bwid + 2;
      }
      // leaning record sleeve
      x.save();
      x.translate(sx + 208, sy); x.rotate(-0.10);
      x.fillStyle = '#2b2038'; x.fillRect(0, -78, 74, 78);
      x.fillStyle = '#c4715c'; x.beginPath(); x.arc(37, -40, 20, 0, TAU); x.fill();
      x.fillStyle = '#2b2038'; x.beginPath(); x.arc(37, -40, 6, 0, TAU); x.fill();
      x.restore();
      // trailing pothos
      x.strokeStyle = '#2e4a3a'; x.lineWidth = 3;
      x.beginPath();
      x.moveTo(sx + 300, sy);
      x.bezierCurveTo(sx + 312, sy + 60, sx + 288, sy + 110, sx + 306, sy + 172);
      x.stroke();
      for (var lv = 0; lv < 7; lv++) {
        var ly = sy + 18 + lv * 22;
        x.fillStyle = 'rgba(58,92,68,0.9)';
        x.beginPath();
        x.ellipse(sx + 300 + (lv % 2 ? 13 : -13), ly, 11, 7, lv % 2 ? 0.5 : -0.5, 0, TAU);
        x.fill();
      }

      // ---- string lights wire
      x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 1.8;
      x.beginPath();
      x.moveTo(-10, 58); x.quadraticCurveTo(760, 172, 1610, 44);
      x.stroke();

      // ---- desk
      x.fillStyle = linear(x, 0, DESK_BACK - 20, 0, DESK_FRONT + 50, [
        [0, '#4a3128'], [0.45, '#3a2620'], [1, '#281a17']
      ]);
      x.beginPath();
      x.moveTo(-40, DESK_FRONT); x.lineTo(SW + 40, DESK_FRONT - 14);
      x.lineTo(SW + 40, DESK_BACK - 12); x.lineTo(-40, DESK_BACK);
      x.closePath(); x.fill();
      x.fillStyle = '#1d1215';
      x.beginPath();
      x.moveTo(-40, DESK_FRONT); x.lineTo(SW + 40, DESK_FRONT - 14);
      x.lineTo(SW + 40, DESK_FRONT + 32); x.lineTo(-40, DESK_FRONT + 48);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,196,150,0.04)'; x.lineWidth = 1.4;
      for (var gr = 0; gr < 18; gr++) {
        var gy = DESK_BACK + rnd(2, 88);
        x.beginPath(); x.moveTo(-40, gy);
        x.bezierCurveTo(SW * 0.3, gy + rnd(-6, 6), SW * 0.7, gy + rnd(-6, 6), SW + 40, gy - 12);
        x.stroke();
      }
      // desk edge catchlight
      x.strokeStyle = 'rgba(255,200,150,0.10)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(-40, DESK_FRONT); x.lineTo(SW + 40, DESK_FRONT - 14); x.stroke();

      // cables draped behind the desk
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 4; x.lineCap = 'round';
      for (var cb = 0; cb < 3; cb++) {
        var cx0 = 880 + cb * 40;
        x.beginPath();
        x.moveTo(cx0, DESK_BACK + 2);
        x.bezierCurveTo(cx0 - 20, DESK_BACK + 60, cx0 + 30, DESK_BACK + 90, cx0 + 6, DESK_FRONT + 120);
        x.stroke();
      }

      // ---- monitor: bezel, stand, sticky notes
      x.save();
      x.transform(1, MON.shear, 0, 1, MON.x, MON.y);
      x.fillStyle = '#100b14';
      rrect(x, -13, -13, MON.w + 26, MON.h + 30, 8); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.05)';
      rrect(x, -13, -13, MON.w + 26, 3, 2); x.fill();
      x.restore();
      // stand
      x.fillStyle = '#150e1a';
      x.beginPath();
      x.moveTo(MON.x + MON.w * 0.44, MON.y + MON.h + 32);
      x.lineTo(MON.x + MON.w * 0.56, MON.y + MON.h + 38);
      x.lineTo(MON.x + MON.w * 0.58, DESK_FRONT - 46);
      x.lineTo(MON.x + MON.w * 0.42, DESK_FRONT - 46);
      x.closePath(); x.fill();
      x.fillStyle = '#120a16';
      x.beginPath(); x.ellipse(MON.x + MON.w * 0.5, DESK_FRONT - 44, 84, 15, 0, 0, TAU); x.fill();
      // sticky notes on the bezel
      var notes = [['#f2d55c', -0.06], ['#8fd8a0', 0.08]];
      for (var nn = 0; nn < notes.length; nn++) {
        x.save();
        x.translate(MON.x + MON.w + 12, MON.y + 54 + nn * 62 + MON.w * MON.shear);
        x.rotate(notes[nn][1]);
        x.fillStyle = notes[nn][0]; x.globalAlpha = 0.82;
        x.fillRect(0, 0, 44, 44);
        x.globalAlpha = 0.35; x.fillStyle = '#000';
        for (var ln2 = 0; ln2 < 3; ln2++) x.fillRect(7, 12 + ln2 * 9, 30 - ln2 * 7, 2);
        x.globalAlpha = 1;
        x.restore();
      }

      // ---- keyboard
      x.save();
      x.translate(870, DESK_FRONT - 62); x.transform(1, -0.03, 0, 1, 0, 0);
      x.fillStyle = '#191220'; rrect(x, 0, 0, 300, 44, 6); x.fill();
      x.fillStyle = 'rgba(150,200,255,0.12)';
      for (var kr = 0; kr < 4; kr++)
        for (var kc = 0; kc < 14; kc++)
          x.fillRect(9 + kc * 20.5, 7 + kr * 9.4, 14, 5.4);
      x.fillStyle = 'rgba(120,180,255,0.20)'; x.fillRect(9, 43, 300 - 18, 2);
      x.restore();

      // ---- mug
      var mx = 690, my = DESK_FRONT - 12;
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.beginPath(); x.ellipse(mx, my + 2, 34, 9, 0, 0, TAU); x.fill();
      x.fillStyle = '#e6dccc';
      rrect(x, mx - 27, my - 58, 54, 58, 8); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.16)'; rrect(x, mx + 12, my - 58, 15, 58, 5); x.fill();
      x.strokeStyle = '#e6dccc'; x.lineWidth = 7.5;
      x.beginPath(); x.arc(mx + 35, my - 34, 15, -1.25, 1.25); x.stroke();
      x.fillStyle = '#31201a';
      x.beginPath(); x.ellipse(mx, my - 58, 27, 8, 0, 0, TAU); x.fill();

      // ---- pen cup
      var px2 = 1176, py2 = DESK_FRONT - 14;
      x.fillStyle = '#2c1f36'; rrect(x, px2 - 20, py2 - 46, 40, 46, 5); x.fill();
      var pens = ['#d8694f', '#4f7fd8', '#d8c14f'];
      for (var pp = 0; pp < 3; pp++) {
        x.strokeStyle = pens[pp]; x.lineWidth = 4; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(px2 - 10 + pp * 10, py2 - 44);
        x.lineTo(px2 - 14 + pp * 13, py2 - 76 - pp * 5);
        x.stroke();
      }

      // ---- book stack far left
      var stCols = ['#4a2b3e', '#2f4260', '#6a4630'];
      for (var s2 = 0; s2 < 3; s2++) {
        x.fillStyle = stCols[s2];
        rrect(x, 512 + s2 * 6, DESK_FRONT - 16 - (s2 + 1) * 15, 118 - s2 * 12, 15, 3); x.fill();
        x.fillStyle = 'rgba(255,240,220,0.14)';
        x.fillRect(515 + s2 * 6, DESK_FRONT - 16 - (s2 + 1) * 15 + 11, 112 - s2 * 12, 2.5);
      }

      // ---- desk lamp, right, arm arcing left
      x.strokeStyle = '#0f0a15'; x.lineWidth = 11; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(1556, DESK_FRONT - 18);
      x.quadraticCurveTo(1560, 300, 1428, 322);
      x.stroke();
      x.fillStyle = '#0f0a15';
      x.beginPath(); x.ellipse(1556, DESK_FRONT - 16, 44, 12, 0, 0, TAU); x.fill();
      x.fillStyle = '#181020';
      x.beginPath();
      x.moveTo(1376, 302); x.lineTo(1470, 322); x.lineTo(1452, 392); x.lineTo(1362, 368);
      x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,198,124,0.9)';
      x.beginPath();
      x.moveTo(1362, 368); x.lineTo(1452, 392); x.lineTo(1446, 403); x.lineTo(1364, 380);
      x.closePath(); x.fill();

      // ---- contact shadows under everything on the desk
      var ao = [[690, 30], [1176, 22], [570, 60], [MON.x + MON.w * 0.5, 96], [1020, 70]];
      for (var a2 = 0; a2 < ao.length; a2++) {
        x.fillStyle = radial(x, ao[a2][0], DESK_FRONT - 12, ao[a2][1] * 1.7, [
          [0, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0)']
        ]);
        x.beginPath();
        x.ellipse(ao[a2][0], DESK_FRONT - 12, ao[a2][1] * 1.7, ao[a2][1] * 0.5, 0, 0, TAU);
        x.fill();
      }
    }

    /* ---------- blurred foreground (depth of field) ---------- */
    function paintFore(x) {
      // out-of-focus frond, bottom left
      x.fillStyle = 'rgba(10,7,14,0.92)';
      x.strokeStyle = 'rgba(10,7,14,0.92)'; x.lineWidth = 10; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(-30, SH + 30);
      x.bezierCurveTo(120, SH - 80, 190, SH - 240, 150, SH - 400);
      x.stroke();
      for (var i = 0; i < 11; i++) {
        var p = i / 10;
        var lx = -30 + (150 + 30) * p * 0.92;
        var ly = SH + 30 - (430) * p;
        var side = i % 2 ? 1 : -1;
        x.save();
        x.translate(lx, ly); x.rotate(side * 0.7 - p * 0.5);
        x.beginPath(); x.ellipse(side * 52, 0, 60, 20, 0, 0, TAU); x.fill();
        x.restore();
      }
      // soft foreground bokeh
      var cols = [[255, 190, 130], [150, 205, 255], [255, 160, 200]];
      for (var b = 0; b < 7; b++) {
        var bx = rnd(0, SW), by = rnd(SH * 0.45, SH), r = rnd(30, 74);
        var c = cols[b % 3];
        x.fillStyle = radial(x, bx, by, r, [
          [0, rgba(c, 0.10)], [0.72, rgba(c, 0.07)], [0.9, rgba(c, 0.13)], [1, rgba(c, 0)]
        ]);
        x.beginPath(); x.arc(bx, by, r, 0, TAU); x.fill();
      }
    }

    /* ---------- build ---------- */
    function build() {
      res = clamp(DPR * Math.max(W / SW, H / SH), 1, 1.7);
      codeRes = clamp(DPR * Math.max(W / SW, H / SH) * 1.15, 1.4, 3);

      var b0 = makeCanvas(SW, SH, res); paintBack(b0.getContext('2d'));
      backImg = blurCopy(b0, 2.4 * res);
      midImg = makeCanvas(SW, SH, res); paintMid(midImg.getContext('2d'));
      var f0 = makeCanvas(SW, SH, res); paintFore(f0.getContext('2d'));
      foreImg = blurCopy(f0, 9 * res);

      codeCanvas = makeCanvas(MON.w, MON.h, codeRes);
      measureCode(); codeShown = -1;

      bokehSprite = glowSprite(26, [255, 255, 255], res);
      bulbSprite = glowSprite(34, [255, 200, 140], res);

      rain = [];
      for (var i = 0; i < 120; i++)
        rain.push({ x: rnd(WIN.x - 60, WIN.x + WIN.w + 40), y: rnd(WIN.y, WIN.y + WIN.h), len: rnd(12, 32), sp: rnd(480, 940), a: rnd(0.08, 0.26) });
      drips = [];
      for (var d = 0; d < 18; d++)
        drips.push({ x: rnd(WIN.x + 8, WIN.x + WIN.w - 8), y: rnd(WIN.y, WIN.y + WIN.h), r: rnd(1.5, 3.6), sp: rnd(12, 54), trail: rnd(18, 74), a: rnd(0.12, 0.38) });
      bokeh = [];
      for (var k = 0; k < 24; k++)
        bokeh.push({
          x: rnd(WIN.x + 6, WIN.x + WIN.w - 6), y: rnd(WIN.y + WIN.h * 0.44, WIN.y + WIN.h * 0.94),
          r: rnd(6, 20), ph: Math.random() * TAU, sp: rnd(0.5, 2.0),
          c: pick(['rgba(255,205,140,', 'rgba(150,215,255,', 'rgba(255,160,205,', 'rgba(190,255,220,'])
        });

      dustWin = [];
      for (var m = 0; m < 34; m++)
        dustWin.push({ x: rnd(180, 900), y: rnd(180, 760), r: rnd(0.7, 2.2), vy: rnd(-9, -2), ph: Math.random() * TAU, sp: rnd(0.5, 1.8) });
      dustLamp = [];
      for (var m2 = 0; m2 < 26; m2++)
        dustLamp.push({ x: rnd(1180, 1560), y: rnd(330, 700), r: rnd(0.7, 2.4), vy: rnd(-8, -2), ph: Math.random() * TAU, sp: rnd(0.6, 2.0) });

      bulbs = [];
      for (var p = 0.05; p < 0.99; p += 0.062) {
        var bxp = (1 - p) * (1 - p) * -10 + 2 * (1 - p) * p * 760 + p * p * 1610;
        var byp = (1 - p) * (1 - p) * 58 + 2 * (1 - p) * p * 172 + p * p * 44;
        bulbs.push({ x: bxp, y: byp + 10, ph: Math.random() * TAU, sp: rnd(0.4, 1.4) });
      }
      steam = [];
      for (var st = 0; st < 3; st++)
        steam.push({ off: rnd(0, 10), amp: rnd(8, 19), sp: rnd(0.45, 0.9), w: rnd(4, 9), a: rnd(0.09, 0.18) });

      // cached stage-space gradients
      C.screenBloom = radial(ctx, MON.x + MON.w * 0.5, MON.y + MON.h * 0.62, 620, [
        [0, 'rgba(110,180,245,0.26)'], [0.32, 'rgba(80,150,215,0.10)'], [1, 'rgba(60,130,200,0)']
      ]);
      C.lampCone = linear(ctx, 1420, 380, 1300, 740, [
        [0, 'rgba(255,184,108,0.32)'], [0.5, 'rgba(255,158,88,0.09)'], [1, 'rgba(255,150,90,0)']
      ]);
      C.lampBulb = radial(ctx, 1408, 390, 165, [[0, 'rgba(255,208,142,0.46)'], [1, 'rgba(255,180,110,0)']]);
      C.lampPool = radial(ctx, 1340, DESK_FRONT - 26, 300, [[0, 'rgba(255,178,108,0.20)'], [1, 'rgba(255,170,100,0)']]);
      C.winShaft = linear(ctx, WIN.x, WIN.y, 900, 820, [
        [0, 'rgba(150,200,255,0.15)'], [0.55, 'rgba(130,180,245,0.045)'], [1, 'rgba(120,170,240,0)']
      ]);
      C.rim = linear(ctx, GX - 236, 0, GX + 236, 0, [
        [0, 'rgba(172,224,255,1)'], [0.19, 'rgba(120,180,228,0.34)'],
        [0.47, 'rgba(0,0,0,0)'], [0.76, 'rgba(255,170,98,0.30)'], [1, 'rgba(255,198,128,1)']
      ]);
      sweep = rnd(6, 13);
    }

    /* ---------- the girl ---------- */
    function silhouette(x, bob, lean) {
      var hx = GX - 32 + lean, hy = 292 + bob;
      x.beginPath();
      x.moveTo(GX + 244, SH + 20);
      x.bezierCurveTo(GX + 230, 764, GX + 200, 600, GX + 166, 524);
      x.bezierCurveTo(GX + 140, 480, GX + 82, 462, GX + 50 + lean * 0.4, 440);
      x.bezierCurveTo(hx + 104, 424, hx + 112, 358, hx + 98, 306);
      x.bezierCurveTo(hx + 88, 230, hx + 50, 190, hx, 190);
      x.bezierCurveTo(hx - 52, 190, hx - 92, 232, hx - 100, 308);
      x.bezierCurveTo(hx - 110, 384, hx - 128, 456, hx - 140, 530);
      x.bezierCurveTo(hx - 150, 592, hx - 144, 632, hx - 154, 678);
      x.bezierCurveTo(GX - 202, 574, GX - 220, 648, GX - 232, 752);
      x.lineTo(GX - 248, SH + 20);
      x.closePath();
    }

    function arm(x, sx, sy, ex, ey, wx, wy, thick) {
      x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = thick;
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(ex, ey, wx, wy); x.stroke();
      x.beginPath(); x.ellipse(wx, wy, thick * 0.46, thick * 0.34, 0, 0, TAU); x.fill();
    }

    function drawGirl(t) {
      var bob = Math.sin(t * 0.82) * 3.6 + Math.sin(t * 2.2) * 1.1;
      var lean = Math.sin(t * 0.29) * 5.5;
      var tL = Math.sin(t * 7.1) * 3.4 + Math.sin(t * 11.7) * 1.5;
      var tR = Math.sin(t * 6.4 + 1.8) * 3.2 + Math.sin(t * 10.4 + 0.6) * 1.6;
      var hx = GX - 32 + lean;

      // chair back
      ctx.fillStyle = '#0a070e';
      rrect(ctx, GX - 300, 636, 600, 300, 46); ctx.fill();
      ctx.save();
      rrect(ctx, GX - 300, 636, 600, 300, 46); ctx.clip();
      rrect(ctx, GX - 300, 636, 600, 300, 46);
      ctx.strokeStyle = 'rgba(255,180,110,0.22)'; ctx.lineWidth = 12; ctx.stroke();
      ctx.restore();

      // far arm behind the torso
      ctx.strokeStyle = '#0b0810'; ctx.fillStyle = '#0b0810';
      arm(ctx, GX - 170, 530 + bob * 0.5, GX - 250, 618, 1010, 606 + tL, 42);

      // body
      ctx.fillStyle = '#0a0710';
      silhouette(ctx, bob, lean); ctx.fill();

      // inner rim light
      ctx.save();
      silhouette(ctx, bob, lean); ctx.clip();
      silhouette(ctx, bob, lean);
      ctx.strokeStyle = C.rim; ctx.lineWidth = 18; ctx.stroke();
      // knit ribbing, only where the rim catches it
      ctx.globalAlpha = 0.30;
      ctx.lineWidth = 2.2;
      for (var rb = 0; rb < 9; rb++) {
        ctx.beginPath();
        ctx.moveTo(GX - 250, 560 + rb * 34);
        ctx.quadraticCurveTo(GX, 548 + rb * 34, GX + 250, 566 + rb * 34);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // hair strands
      for (var s = 0; s < 16; s++) {
        var f = s / 15;
        var offX = -96 + f * 190;
        var swing = Math.sin(t * 0.55 + s * 0.7) * (4 + f * 3);
        ctx.strokeStyle = f < 0.45
          ? 'rgba(150,205,248,' + (0.06 + 0.16 * (1 - f * 2)) + ')'
          : 'rgba(255,178,110,' + (0.05 + 0.13 * ((f - 0.45) * 1.8)) + ')';
        ctx.lineWidth = 1.6 + Math.random() * 0.6;
        ctx.beginPath();
        ctx.moveTo(hx + offX * 0.55, 236 + bob);
        ctx.bezierCurveTo(hx + offX + swing, 390 + bob, hx + offX * 1.18 + swing, 510, hx + offX * 1.2 + swing * 1.5, 646);
        ctx.stroke();
      }
      // crown shine
      ctx.strokeStyle = 'rgba(178,226,255,0.35)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(hx, 300 + bob, 92, Math.PI * 1.06, Math.PI * 1.44); ctx.stroke();

      // headphones
      ctx.strokeStyle = '#150e1d'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(hx, 298 + bob, 106, Math.PI * 1.14, Math.PI * 1.92); ctx.stroke();
      ctx.strokeStyle = 'rgba(184,224,255,0.32)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(hx, 298 + bob, 110, Math.PI * 1.18, Math.PI * 1.58); ctx.stroke();
      ctx.save();
      ctx.translate(hx - 98, 304 + bob); ctx.rotate(-0.12);
      ctx.fillStyle = '#150e1d';
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 32, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(172,224,255,0.38)';
      ctx.beginPath(); ctx.ellipse(-10, -2, 7, 24, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,118,150,' + (0.35 + 0.45 * (Math.sin(t * 2.3) * 0.5 + 0.5)) + ')';
      ctx.beginPath(); ctx.arc(hx - 102, 330 + bob, 3.6, 0, TAU); ctx.fill();
      // cable
      ctx.strokeStyle = 'rgba(12,8,16,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx - 104, 334 + bob);
      ctx.bezierCurveTo(hx - 150 + Math.sin(t * 0.6) * 8, 480, hx - 108, 640, hx - 168, SH + 20);
      ctx.stroke();

      // near arm crossing in front
      ctx.strokeStyle = '#080510'; ctx.fillStyle = '#080510';
      arm(ctx, GX + 166, 534 + bob * 0.5, GX + 188, 652, 1122, 618 + tR, 44);
      ctx.strokeStyle = 'rgba(255,186,116,0.32)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(GX + 186, 522 + bob * 0.5);
      ctx.quadraticCurveTo(GX + 208, 648, 1130, 602 + tR);
      ctx.stroke();
    }

    /* ---------- the cat ---------- */
    function drawCat(t) {
      var cx = 566, cy = DESK_FRONT - 14;
      var breathe = 1 + Math.sin(t * 1.4) * 0.024;
      var tail = Math.sin(t * 0.85) * 0.3 + Math.sin(t * 2.5) * 0.09;
      var twitch = (Math.sin(t * 0.33) > 0.986) ? Math.sin(t * 44) * 0.2 : 0;

      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = '#8a5734'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-54, -14);
      ctx.quadraticCurveTo(-96 - tail * 26, -6 + tail * 16, -58 - tail * 34, 6 + tail * 10);
      ctx.stroke();
      ctx.scale(1, breathe);

      ctx.fillStyle = '#9c6440';
      ctx.beginPath();
      ctx.moveTo(64, 0); ctx.bezierCurveTo(70, -44, 38, -66, -4, -66);
      ctx.bezierCurveTo(-50, -66, -72, -40, -70, 0);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(56, -52, 32, 28, 0.1, 0, TAU); ctx.fill();

      function ear(ex, ey, rot) {
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(rot + twitch);
        ctx.fillStyle = '#9c6440';
        ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(0, -22); ctx.lineTo(13, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d99a86';
        ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(0, -13); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ear(76, -72, 0.22); ear(36, -76, -0.14);

      ctx.fillStyle = 'rgba(246,222,194,0.85)';
      ctx.beginPath(); ctx.ellipse(58, -42, 17, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(88,50,28,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (var s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.moveTo(4 - s * 20, -62 + s * 3);
        ctx.quadraticCurveTo(-4 - s * 20, -46, 0 - s * 20, -32);
        ctx.stroke();
      }
      ctx.strokeStyle = '#3a2116'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(68, -56, 6, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(46, -58, 6, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.fillStyle = '#d0857e';
      ctx.beginPath(); ctx.moveTo(56, -46); ctx.lineTo(64, -46); ctx.lineTo(60, -41); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,225,0.32)'; ctx.lineWidth = 1.4;
      for (var wv = -1; wv <= 1; wv++) {
        ctx.beginPath(); ctx.moveTo(66, -44 + wv * 4); ctx.lineTo(102, -50 + wv * 8); ctx.stroke();
      }
      ctx.restore();

      // rim: cool from the monitor on the right, warm from the string lights above
      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(160,215,255,0.5)'; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(82, -66); ctx.bezierCurveTo(90, -48, 72, -20, 64, -2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,198,128,0.34)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(24, -70); ctx.bezierCurveTo(-24, -70, -62, -46, -70, -6); ctx.stroke();
      ctx.restore();
    }

    /* ---------- lights + atmosphere ---------- */
    function drawWindowLife(t) {
      ctx.save();
      ctx.beginPath(); ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < bokeh.length; k++) {
        var b = bokeh[k];
        var v = 0.4 + 0.6 * (Math.sin(t * b.sp + b.ph) * 0.5 + 0.5);
        ctx.globalAlpha = 0.5 * v;
        ctx.drawImage(bokehSprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      ctx.globalAlpha = 1;
      var sw = (t % sweep) / sweep;
      if (sw < 0.3) {
        var lx = WIN.x - 70 + sw / 0.3 * (WIN.w + 140);
        ctx.globalAlpha = 0.55 * Math.sin(sw / 0.3 * Math.PI);
        ctx.drawImage(bulbSprite, lx - 130, WIN.y + WIN.h * 0.86 - 130, 260, 260);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';

      ctx.lineCap = 'round'; ctx.lineWidth = 1.1;
      for (var i = 0; i < rain.length; i++) {
        var d = rain[i];
        var span = WIN.h + d.len + 40;
        var y = WIN.y + (((d.y - WIN.y) + t * d.sp) % span + span) % span - d.len;
        var x = d.x - (y - WIN.y) * 0.12;
        ctx.strokeStyle = 'rgba(200,224,255,' + d.a + ')';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.len * 0.12, y + d.len); ctx.stroke();
      }
      for (var p = 0; p < drips.length; p++) {
        var q = drips[p];
        var span2 = WIN.h + q.trail + 30;
        var dy = WIN.y + (((q.y - WIN.y) + t * q.sp) % span2 + span2) % span2 - q.trail;
        ctx.strokeStyle = linear(ctx, q.x, dy - q.trail, q.x, dy, [
          [0, 'rgba(212,234,255,0)'], [1, 'rgba(212,234,255,' + (q.a * 0.5) + ')']
        ]);
        ctx.lineWidth = q.r * 1.1;
        ctx.beginPath(); ctx.moveTo(q.x, dy - q.trail); ctx.lineTo(q.x, dy); ctx.stroke();
        ctx.fillStyle = 'rgba(226,242,255,' + q.a + ')';
        ctx.beginPath(); ctx.arc(q.x, dy, q.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    function drawLights(t) {
      ctx.globalCompositeOperation = 'lighter';

      // volumetric shaft from the window
      ctx.globalAlpha = 0.75 + Math.sin(t * 0.5) * 0.08;
      ctx.fillStyle = C.winShaft;
      ctx.beginPath();
      ctx.moveTo(WIN.x + 10, WIN.y + 20); ctx.lineTo(WIN.x + WIN.w - 10, WIN.y + 40);
      ctx.lineTo(1090, 880); ctx.lineTo(330, 880);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;

      // lamp
      var warm = 0.92 + Math.sin(t * 1.6) * 0.045 + Math.sin(t * 5.1) * 0.02;
      ctx.globalAlpha = warm;
      ctx.fillStyle = C.lampCone;
      ctx.beginPath();
      ctx.moveTo(1366, 372); ctx.lineTo(1456, 396);
      ctx.lineTo(1660, 760); ctx.lineTo(1130, 730);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.lampBulb; ctx.fillRect(1240, 220, 340, 340);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.lampPool; ctx.fillRect(1040, 420, 600, 320);

      // string lights
      for (var i = 0; i < bulbs.length; i++) {
        var b = bulbs[i];
        var v = 0.5 + 0.5 * (Math.sin(t * b.sp + b.ph) * 0.5 + 0.5);
        ctx.globalAlpha = 0.62 * v;
        ctx.drawImage(bulbSprite, b.x - 34, b.y - 34, 68, 68);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,238,204,' + (0.75 * v) + ')';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawDust(t, list, tint) {
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        var y = m.y + ((t * m.vy) % 460 + 460) % 460 - 230;
        var x = m.x + Math.sin(t * 0.38 + m.ph) * 24;
        var a = 0.08 + 0.30 * (Math.sin(t * m.sp + m.ph) * 0.5 + 0.5);
        ctx.fillStyle = 'rgba(' + tint + ',' + a + ')';
        ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawSteam(t) {
      var mx = 690, my = DESK_FRONT - 74;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (var i = 0; i < steam.length; i++) {
        var s = steam[i];
        var rise = (t * 25 + s.off * 30) % 130;
        var alpha = s.a * Math.sin((rise / 130) * Math.PI);
        if (alpha <= 0.002) continue;
        ctx.strokeStyle = 'rgba(228,238,255,' + alpha + ')';
        ctx.lineWidth = s.w;
        var x0 = mx - 14 + i * 14;
        ctx.beginPath();
        ctx.moveTo(x0, my - rise * 0.2);
        ctx.bezierCurveTo(
          x0 + Math.sin(t * s.sp + i) * s.amp, my - rise * 0.5,
          x0 - Math.sin(t * s.sp * 1.4 + i) * s.amp, my - rise * 0.8,
          x0 + Math.sin(t * s.sp * 0.7 + i) * s.amp * 0.6, my - rise
        );
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function draw(t) {
      put(backImg, 0, 0);
      drawWindowLife(t);
      put(midImg, 0, 0);
      drawMonitor(t);
      drawLights(t);
      drawCat(t);
      drawGirl(t);
      drawSteam(t);
      drawDust(t, dustWin, '190,220,255');
      drawDust(t, dustLamp, '255,222,180');
      put(foreImg, 0, 0);
    }

    return {
      stage: { w: SW, h: SH, fx: 0.52, fxNarrow: 0.63, fy: 0.52 },
      breathe: true,
      build: build,
      draw: draw,
      setCode: function (lines) { CODE = lines; measureCode(); codeShown = -1; },
      grade: [
        [0, 'rgba(120,180,255,0.07)'],
        [0.5, 'rgba(255,140,70,0.05)'],
        [1, 'rgba(255,150,80,0.09)']
      ]
    };
  })();

  /* =========================================================
     SCENE — NEON CITY
     ========================================================= */
  var neon = (function () {
    var strips = [], rain = [], glows = [];
    var WINC = ['#ffd98a', '#8ae8ff', '#ff8ad4', '#fff3c4', '#9affc9'];
    var SIGN = ['#ff3d81', '#3df0ff', '#b57bff', '#ffd23d', '#4dff9e'];

    function cityStrip(w, h, opt) {
      var c = makeCanvas(w, h, Math.min(DPR, 1.6)), x = c.getContext('2d'), cx = 0;
      while (cx < w) {
        var bw = rnd(opt.minW, opt.maxW);
        if (cx + bw > w) bw = w - cx;
        if (bw < 6) break;
        var bh = rnd(opt.minH, opt.maxH) * h, by = h - bh;
        x.fillStyle = linear(x, cx, by, cx, h, [[0, opt.top], [1, opt.bottom]]);
        x.fillRect(cx, by, bw, bh);
        if (opt.detail && Math.random() < 0.32 && bw > 22) {
          x.fillStyle = opt.top; x.fillRect(cx + bw * 0.5 - 1, by - rnd(10, 30), 2, 30);
        }
        for (var wy = by + opt.winGap * 2; wy < h - opt.winGap; wy += opt.winH + opt.winGap) {
          for (var wx = cx + opt.winGap; wx < cx + bw - opt.winW; wx += opt.winW + opt.winGap) {
            if (Math.random() > opt.lit) continue;
            var col = pick(WINC);
            x.globalAlpha = rnd(0.35, 0.95);
            x.shadowColor = col; x.shadowBlur = opt.glow;
            x.fillStyle = col; x.fillRect(wx, wy, opt.winW, opt.winH);
          }
        }
        x.globalAlpha = 1; x.shadowBlur = 0;
        if (opt.detail && Math.random() < 0.42 && bw > 34 && bh > h * 0.35) {
          var sc = pick(SIGN);
          x.shadowColor = sc; x.shadowBlur = 18; x.fillStyle = sc;
          if (Math.random() < 0.5) x.fillRect(cx + bw * 0.18, by + rnd(24, bh * 0.5), bw * 0.64, rnd(3, 6));
          else x.fillRect(cx + bw * rnd(0.2, 0.7), by + 18, rnd(3, 6), bh * rnd(0.22, 0.44));
          x.shadowBlur = 0;
        }
        cx += bw + rnd(1, 9);
      }
      return c;
    }

    function build() {
      var band = Math.max(180, H * 0.62);
      strips = [
        { img: cityStrip(W, band * 0.62, { minW: 16, maxW: 44, minH: 0.30, maxH: 0.95, top: '#1b1c46', bottom: '#0f0f2c', winGap: 4, winW: 2, winH: 3, lit: 0.30, glow: 4, detail: false }), sp: 3 },
        { img: cityStrip(W, band * 0.80, { minW: 26, maxW: 70, minH: 0.32, maxH: 1.00, top: '#141433', bottom: '#0a0a1e', winGap: 5, winW: 3, winH: 4, lit: 0.34, glow: 6, detail: true }), sp: 8 },
        { img: cityStrip(W, band * 1.00, { minW: 44, maxW: 110, minH: 0.34, maxH: 1.00, top: '#0c0c22', bottom: '#050510', winGap: 7, winW: 4, winH: 6, lit: 0.32, glow: 9, detail: true }), sp: 17 }
      ];
      rain = [];
      var n = Math.round(Math.min(420, W * H / 3400));
      for (var i = 0; i < n; i++)
        rain.push({ x: Math.random() * (W + 200) - 100, y: Math.random() * H, len: rnd(10, 30), sp: rnd(620, 1150), a: rnd(0.10, 0.34) });
      glows = [];
      for (var g = 0; g < 5; g++)
        glows.push({ x: rnd(W * 0.08, W * 0.92), y: rnd(H * 0.42, H * 0.78), r: rnd(60, 160), col: pick(SIGN), ph: Math.random() * TAU, sp: rnd(1.4, 4.5) });
    }

    function draw(t) {
      ctx.fillStyle = linear(ctx, 0, 0, 0, H, [
        [0, '#04040e'], [0.34, '#0d1030'], [0.62, '#241645'], [0.84, '#4a1c4e'], [1, '#6b2350']
      ]);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = radial(ctx, W * 0.62, H * 0.9, H * 0.7, [[0, 'rgba(255,60,140,0.16)'], [1, 'rgba(255,60,140,0)']]);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      for (var i = 0; i < strips.length; i++) {
        var s = strips[i], ox = -((t * s.sp) % W), yp = H - s.img._h + H * 0.02 * i;
        put(s.img, ox, yp); put(s.img, ox + W, yp);
        ctx.fillStyle = linear(ctx, 0, yp, 0, H, [[0, 'rgba(60,40,110,0.16)'], [1, 'rgba(60,40,110,0)']]);
        ctx.fillRect(0, yp, W, H - yp);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (var g = 0; g < glows.length; g++) {
        var q = glows[g];
        var pulse = 0.35 + 0.65 * Math.pow(Math.sin(t * q.sp + q.ph) * 0.5 + 0.5, 2);
        ctx.globalAlpha = 0.16 * pulse;
        ctx.fillStyle = radial(ctx, q.x, q.y, q.r, [[0, q.col], [1, 'rgba(0,0,0,0)']]);
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (var r = 0; r < rain.length; r++) {
        var d = rain[r], span = H + d.len + 40;
        var y = ((d.y + t * d.sp) % span + span) % span - d.len;
        var x = d.x - y * 0.16;
        ctx.strokeStyle = 'rgba(190,215,255,' + d.a + ')';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d.len * 0.16, y + d.len); ctx.stroke();
      }
      var fy = H * 0.72 + Math.sin(t * 0.16) * H * 0.02;
      ctx.fillStyle = linear(ctx, 0, fy - H * 0.12, 0, fy + H * 0.18, [
        [0, 'rgba(90,70,140,0)'], [0.5, 'rgba(90,70,140,0.16)'], [1, 'rgba(90,70,140,0)']
      ]);
      ctx.fillRect(0, fy - H * 0.12, W, H * 0.3);
    }

    return { stage: null, breathe: false, build: build, draw: draw, grade: [[0, 'rgba(120,40,180,0.05)'], [1, 'rgba(10,5,30,0.14)']] };
  })();

  /* ---------- engine ---------- */
  var scenes = { lofi: lofi, neon: neon };
  var grain = null, S = {};

  function buildScreenLayers() {
    if (!grain) grain = noiseTile(180);
    S.vig = radial(ctx, W * 0.52, H * 0.48, Math.max(W, H) * 0.8, [
      [0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.09)'], [1, 'rgba(0,0,0,0.66)']
    ]);
    S.scrim = linear(ctx, 0, 0, W * 0.7, 0, [
      [0, 'rgba(7,5,12,0.88)'], [0.55, 'rgba(7,5,12,0.30)'], [1, 'rgba(7,5,12,0)']
    ]);
    // lifted blacks — the filmic bit
    S.lift = linear(ctx, 0, 0, 0, H, [
      [0, 'rgba(38,44,86,0.10)'], [1, 'rgba(52,32,60,0.13)']
    ]);
    if (current && current.grade) S.grade = linear(ctx, 0, 0, W, H, current.grade);
    // chromatic fringe
    S.ca1 = radial(ctx, W * 0.5, H * 0.5, Math.max(W, H) * 0.72, [
      [0.55, 'rgba(255,60,60,0)'], [1, 'rgba(255,70,60,0.05)']
    ]);
    S.ca2 = radial(ctx, W * 0.5, H * 0.5, Math.max(W, H) * 0.62, [
      [0.5, 'rgba(60,180,255,0)'], [1, 'rgba(60,190,255,0.045)']
    ]);
  }

  function overlay() {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = S.lift; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    if (S.grade) { ctx.fillStyle = S.grade; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';

    if (SCRIM > 0) {
      ctx.globalAlpha = SCRIM;
      ctx.fillStyle = S.scrim; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = S.vig; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = S.ca1; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = S.ca2; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    if (grain) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.06;
      var ox = -Math.floor(Math.random() * 180), oy = -Math.floor(Math.random() * 180);
      for (var gx = ox; gx < W; gx += 180)
        for (var gy = oy; gy < H; gy += 180) ctx.drawImage(grain, gx, gy, 180, 180);
      ctx.restore();
    }
  }

  function applyStage(t) {
    var st = current.stage;
    if (!st) return;
    var breathe = current.breathe ? (1 + (Math.sin(t * 0.11) * 0.5 + 0.5) * 0.009) : 1;
    var s = Math.max(W / st.w, H / st.h) * breathe;
    var dw = st.w * s, dh = st.h * s;
    var k = clamp((W / H - 0.75) / 0.95, 0, 1);
    var fx = st.fxNarrow + (st.fx - st.fxNarrow) * k;
    var ox = Math.min(0, Math.max(W - dw, W / 2 - fx * dw));
    var oy = Math.min(0, Math.max(H - dh, H / 2 - st.fy * dh));
    ctx.setTransform(s * DPR, 0, 0, s * DPR, ox * DPR, oy * DPR);
  }

  function render(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (current.stage) applyStage(t);
    current.draw(t);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    overlay();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    lastT = (now - startTime) / 1000;
    render(lastT);
  }

  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function resize() {
    sizeCanvas();
    if (current) current.build();
    buildScreenLayers();
    if (reduceMotion) render(0);
  }
  function setScene(name) {
    if (!scenes[name]) return;
    current = scenes[name];
    current.build();
    buildScreenLayers();
    if (reduceMotion) render(0);
  }

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 200); });
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) startTime = performance.now() - lastT * 1000;
  });

  sizeCanvas();
  setScene(DEFAULT_SCENE);
  startTime = performance.now();
  if (!reduceMotion) requestAnimationFrame(frame);

  window.AnimeBG = {
    setScene: setScene,
    setScrim: function (v) { SCRIM = clamp(v, 0, 1); },
    setCode: function (lines) { lofi.setCode(lines); },
    pause: function () { running = false; },
    resume: function () { running = true; startTime = performance.now() - lastT * 1000; }
  };
})();
