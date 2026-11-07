/* TanEx design direction (C.1): shared SVG sprite, injected into the page.
   Flat vector illustrations in the brand palette (BRAND_GUIDE §8): style references for the
   3D artist and for the 2D poster fallbacks. Colours come from CSS custom properties so the same
   drawing can sit on cream or chocolate. Icons follow lucide (stroke 1.75). */
(function () {
  var css = [
    '.b-tyre{fill:var(--tyre,#1C120E)}', '.b-rim{fill:none;stroke:var(--metal,#BF9C8A);stroke-width:3}',
    '.b-hub{fill:var(--metal,#BF9C8A)}', '.b-frame{fill:var(--frame,#2A1B16)}',
    '.b-frame-s{fill:none;stroke:var(--frame,#2A1B16);stroke-linecap:round}',
    '.b-metal-s{fill:none;stroke:var(--metal,#BF9C8A);stroke-linecap:round}',
    '.b-engine{fill:var(--engine,#4A3128)}', '.b-seat{fill:var(--seat,#1C120E)}',
    '.b-cowl{fill:var(--cowl,#38241D)}', '.b-light{fill:var(--lamp,#FFFCF7)}', '.b-ind{fill:var(--ind,#FFB55C)}',
    '.b-box{fill:var(--box,#F48800)}', '.b-box-top{fill:var(--box-top,#FF9F2E)}', '.b-box-dark{fill:var(--box-dark,#C76A00)}',
    '.b-box-line{fill:none;stroke:var(--box-dark,#C76A00);stroke-width:2}',
    '.b-vest{fill:var(--vest,#38241D)}', '.b-vest-line{fill:none;stroke:var(--vest-line,#1C120E);stroke-width:1.5;opacity:.55}',
    '.b-shirt{fill:var(--shirt,#141010)}', '.b-trouser{fill:var(--trouser,#1C120E)}', '.b-shoe{fill:var(--shoe,#0F0A08)}',
    '.b-skin{fill:var(--skin,#6B4330)}', '.b-skin-s{fill:none;stroke:var(--skin,#6B4330);stroke-linecap:round;stroke-linejoin:round}',
    '.b-band{fill:var(--band,#EDDFC4)}', '.b-helmet{fill:var(--helmet,#4A3128)}', '.b-visor{fill:var(--visor,#1C120E);opacity:.9}',
    '.b-dark-s{fill:none;stroke:var(--bar,#1C120E);stroke-linecap:round}', '.b-dark{fill:var(--bar,#1C120E)}',
    '.b-logo{fill:var(--logo,#F48800)}', '.b-logo2{fill:var(--logo2,#FBF6EC)}',
    '.b-speed{fill:none;stroke:var(--speed,#F48800);stroke-width:2.2;stroke-linecap:round}',
    '.b-shadow{fill:var(--shadow,rgb(28 18 14 / .16))}',
    '.m-plane{fill:var(--mark,#F48800)}', '.m-fold{fill:var(--mark-fold,#C76A00)}',
    '.m-speed{fill:none;stroke:var(--mark,#F48800);stroke-width:3.2;stroke-linecap:round}',
    '.t-body{fill:var(--truck-body,#FFFCF7)}', '.t-edge{fill:none;stroke:var(--truck-edge,#D9C2B5);stroke-width:1.5}',
    '.t-cab{fill:var(--truck-cab,#2A1B16)}', '.t-glass{fill:var(--truck-glass,#D9C2B5)}', '.t-stripe{fill:var(--truck-stripe,#F48800)}',
    '.g-sea{fill:var(--globe,#F5ECDB)}', '.g-grid{fill:none;stroke:var(--globe-grid,#D9C2B5);stroke-width:1}',
    '.g-land{fill:url(#tx-dots)}', '.g-arc{fill:none;stroke:var(--arc,#F48800);stroke-width:2;stroke-dasharray:5 5;stroke-linecap:round}',
    '.g-base{fill:var(--arc,#F48800)}', '.g-ring{fill:none;stroke:var(--arc,#F48800);stroke-width:1.5}',
    '.g-hub{fill:var(--hub,#2A1B16)}', '.g-rim{fill:none;stroke:var(--globe-rim,#D9C2B5);stroke-width:1.5}',
    '.d-wall{fill:var(--wall,#F5ECDB)}', '.d-frame{fill:var(--door-frame,#38241D)}', '.d-door{fill:var(--door,#5F4034)}',
    '.d-panel{fill:none;stroke:var(--door-line,#38241D);stroke-width:2}', '.d-step{fill:var(--step,#D9C2B5)}',
    '.d-knob{fill:var(--knob,#EDDFC4)}', '.d-lamp{fill:var(--lamp,#FFFCF7)}',
    '.p-top{fill:var(--kraft-top,#EDDFC4)}', '.p-front{fill:var(--kraft,#E2CFA8)}', '.p-side{fill:var(--kraft-side,#BF9C8A)}',
    '.p-tape{fill:var(--tape,#D9C2B5)}', '.p-label{fill:#FFFFFF}', '.p-ink{fill:#1C120E}',
    '.mt{fill:var(--mount,#4A3128)}', '.mt2{fill:var(--mount2,#38241D)}'
  ].join('');
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var I = function (id, body) { return '<symbol id="i-' + id + '" viewBox="0 0 24 24">' + body + '</symbol>'; };
  var icons = [
    I('plane', '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'),
    I('ship', '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.4 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.3 2.8 7.8"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6M12 10v4M12 2v3"/>'),
    I('train', '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1M9 15l-1-1M15 15l1-1M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5ZM8 19l-2 3M16 19l2 3"/>'),
    I('truck', '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
    I('warehouse', '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12M6 14h12"/><rect x="6" y="10" width="12" height="12"/>'),
    I('moto', '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17h5l3-5h3.5l1.5 5M14.5 6.5h2.5l1.5 5.5M8 12h5.5"/>'),
    I('search', '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    I('arrow', '<path d="M5 12h14M13 6l6 6-6 6"/>'),
    I('check', '<path d="M20 6 9 17l-5-5"/>'),
    I('pin', '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
    I('phone', '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2Z"/>'),
    I('mail', '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
    I('clock', '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    I('pause', '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
    I('chev', '<path d="m6 9 6 6 6-6"/>'),
    I('plus', '<path d="M12 5v14M5 12h14"/>'),
    I('alert', '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
    I('camera', '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'),
    I('wallet', '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
    I('users', '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
    I('nav', '<path d="M3 11 22 2l-9 19-2-8-8-2z"/>'),
    I('box', '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>'),
    I('menu', '<path d="M4 6h16M4 12h16M4 18h16"/>'),
    I('globe', '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>'),
    I('scan', '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8"/>')
  ].join('');

  /* Paper-plane mark with speed lines (drawn from the logo for illustrations only; the site uses Public/brand/mark.png) */
  var mark = '<symbol id="mark" viewBox="0 0 72 44">' +
    '<path class="m-speed" d="M4 22h13M7 28h10M10 34h7"/>' +
    '<path class="m-plane" d="M20 24 70 2 46 42 38 30Z"/><path class="m-fold" d="M38 30 70 2 33 27Z"/></symbol>';

  /* Bike + rider, side view, facing right */
  var bikeSide = '<symbol id="bike-side" viewBox="0 0 400 260">' +
    '<ellipse class="b-shadow" cx="200" cy="236" rx="172" ry="8"/>' +
    '<circle class="b-tyre" cx="95" cy="196" r="37"/><circle class="b-rim" cx="95" cy="196" r="23"/><circle class="b-hub" cx="95" cy="196" r="6"/>' +
    '<line class="b-frame-s" x1="95" y1="196" x2="178" y2="186" stroke-width="10"/>' +
    '<rect class="b-engine" x="148" y="158" width="64" height="44" rx="11"/>' +
    '<path class="b-frame" d="M110 150C110 138 124 132 140 132L232 128C252 127 268 116 280 104L294 112C286 140 262 166 236 172L176 178C150 180 126 172 114 162Z"/>' +
    '<rect class="b-hub" x="58" y="126" width="84" height="6" rx="3"/>' +
    '<rect class="b-box" x="50" y="62" width="84" height="66" rx="9"/><path class="b-box-line" d="M50 82H134"/>' +
    '<rect class="b-box-dark" x="82" y="56" width="20" height="6" rx="3"/>' +
    '<use href="#mark" x="72" y="90" width="44" height="27" style="--mark:#1C120E;--mark-fold:#38241D"/>' +
    '<path class="b-seat" d="M126 130C126 120 138 116 150 116L206 116C214 116 218 122 214 128L206 132 132 134Z"/>' +
    '<line class="b-metal-s" x1="306" y1="196" x2="282" y2="110" stroke-width="7"/>' +
    '<circle class="b-tyre" cx="306" cy="196" r="37"/><circle class="b-rim" cx="306" cy="196" r="23"/><circle class="b-hub" cx="306" cy="196" r="6"/>' +
    '<path class="b-frame-s" d="M274 176A40 40 0 0 1 338 180" stroke-width="7"/>' +
    '<path class="b-metal-s" d="M184 212 120 216" stroke-width="10"/><circle class="b-hub" cx="118" cy="216" r="5"/>' +
    '<path class="b-cowl" d="M278 100 300 90C310 104 308 124 298 134L286 130Z"/><ellipse class="b-light" cx="303" cy="110" rx="4" ry="10"/>' +
    /* rider */
    '<path class="b-trouser" d="M150 112 174 106 232 128 224 148 160 136Z"/><path class="b-trouser" d="M210 134 230 138 224 188 206 188Z"/>' +
    '<path class="b-shoe" d="M200 186H232C237 186 239 192 235 195H200Z"/>' +
    '<path class="b-skin-s" d="M188 64 184 82" stroke-width="6"/>' +
    '<path class="b-vest" d="M148 122 158 64C160 55 169 50 180 50L196 52C207 54 213 63 211 73L196 126Z"/>' +
    '<path class="b-vest-line" d="M160 86H184V104H158M182 52 176 124"/>' +
    '<path class="b-band" d="M153 103 202 109 200 117 151 111Z"/>' +
    '<rect class="b-logo" x="192" y="72" width="10" height="4" rx="1"/>' +
    '<path class="b-shirt" d="M188 56C200 52 213 60 215 71L208 88 190 81Z"/>' +
    '<path class="b-skin-s" d="M206 82 230 100 256 90" stroke-width="11"/><circle class="b-dark" cx="258" cy="90" r="6.5"/>' +
    '<path class="b-dark-s" d="M276 92 256 86" stroke-width="6"/><path class="b-dark-s" d="M272 90 266 66" stroke-width="3"/><ellipse class="b-dark" cx="265" cy="63" rx="7" ry="4.5"/>' +
    '<circle class="b-helmet" cx="196" cy="34" r="20"/><path class="b-visor" d="M199 23C212 23 217 33 215 43L199 44Z"/>' +
    '<path class="b-speed" d="M178 30h9M180 35h7M182 40h5"/>' +
    '</symbol>';

  /* Bike + rider, front view */
  var bikeFront = '<symbol id="bike-front" viewBox="0 0 260 300">' +
    '<ellipse class="b-shadow" cx="130" cy="288" rx="78" ry="7"/>' +
    '<rect class="b-box" x="74" y="112" width="112" height="66" rx="9"/><path class="b-box-line" d="M74 132H186"/>' +
    '<rect class="b-tyre" x="117" y="210" width="26" height="76" rx="13"/>' +
    '<path class="b-metal-s" d="M120 214 116 160M140 214 144 160" stroke-width="6"/>' +
    '<path class="b-frame-s" d="M110 216C110 196 150 196 150 216" stroke-width="8"/>' +
    '<path class="b-trouser" d="M106 148 128 158 104 236H84Z"/><path class="b-trouser" d="M154 148 132 158 156 236H176Z"/>' +
    '<ellipse class="b-shoe" cx="92" cy="239" rx="12" ry="6"/><ellipse class="b-shoe" cx="168" cy="239" rx="12" ry="6"/>' +
    '<rect class="b-skin" x="123" y="42" width="14" height="14"/>' +
    '<path class="b-vest" d="M96 72C96 59 108 52 130 52S164 59 164 72L160 140H100Z"/>' +
    '<path class="b-shirt" d="M119 53 130 78 141 53Z"/>' +
    '<path class="b-vest-line" d="M130 78V140M104 96h16v14h-16zM140 96h16v14h-16z"/>' +
    '<rect class="b-band" x="99" y="116" width="62" height="7"/>' +
    '<rect class="b-logo2" x="139" y="83" width="9" height="5" rx="1"/><rect class="b-logo" x="148" y="83" width="8" height="5" rx="1"/>' +
    '<circle class="b-shirt" cx="96" cy="68" r="12"/><circle class="b-shirt" cx="164" cy="68" r="12"/>' +
    '<path class="b-skin-s" d="M92 74 80 106 74 126M168 74 180 106 186 126" stroke-width="11"/>' +
    '<path class="b-cowl" d="M98 150C98 128 162 128 162 150L156 206C150 214 110 214 104 206Z"/>' +
    '<ellipse class="b-light" cx="130" cy="160" rx="14" ry="10"/><circle class="b-ind" cx="104" cy="150" r="4"/><circle class="b-ind" cx="156" cy="150" r="4"/>' +
    '<path class="b-dark-s" d="M66 128H194" stroke-width="6"/><circle class="b-dark" cx="72" cy="128" r="7"/><circle class="b-dark" cx="188" cy="128" r="7"/>' +
    '<path class="b-dark-s" d="M86 126 78 96M174 126 182 96" stroke-width="3"/><ellipse class="b-dark" cx="76" cy="92" rx="10" ry="6.5"/><ellipse class="b-dark" cx="184" cy="92" rx="10" ry="6.5"/>' +
    '<circle class="b-helmet" cx="130" cy="30" r="25"/><path class="b-visor" d="M109 26C109 15 151 15 151 26L149 41C141 46 119 46 111 41Z"/>' +
    '</symbol>';

  /* Bike + rider, three-quarter front view (front toward the viewer's left) */
  var bike3q = '<symbol id="bike-3q" viewBox="0 0 360 300">' +
    '<ellipse class="b-shadow" cx="190" cy="270" rx="156" ry="15"/>' +
    '<ellipse class="b-tyre" cx="262" cy="226" rx="22" ry="37"/><ellipse class="b-rim" cx="262" cy="226" rx="13" ry="24"/>' +
    '<path class="b-box-top" d="M222 84 286 96 304 110 240 98Z"/>' +
    '<path class="b-box" d="M240 98 304 110 304 168 240 156Z"/>' +
    '<path class="b-box-dark" d="M222 84 240 98 240 156 222 142Z"/>' +
    '<path class="b-box-line" d="M240 116 304 128"/>' +
    '<g transform="translate(252 130) skewY(10.6)"><use href="#mark" width="40" height="24" style="--mark:#1C120E;--mark-fold:#38241D"/></g>' +
    '<path class="b-frame" d="M302 168C292 182 252 190 222 192L172 196C152 196 142 186 140 172L132 140 152 128 182 158 262 150C278 148 294 154 302 168Z"/>' +
    '<rect class="b-engine" x="182" y="184" width="58" height="36" rx="11"/>' +
    '<path class="b-seat" d="M200 146 268 138C280 137 284 146 276 152L208 160Z"/>' +
    '<path class="b-metal-s" d="M248 214 290 210" stroke-width="9"/>' +
    '<path class="b-skin-s" d="M198 70 176 92 150 92" stroke-width="9"/>' +
    '<path class="b-trouser" d="M222 132 178 142 174 162 228 150Z"/><path class="b-trouser" d="M174 146 192 150 188 206 170 206Z"/>' +
    '<path class="b-shoe" d="M162 204H194V214H158Z"/>' +
    '<rect class="b-skin" x="210" y="52" width="13" height="12"/>' +
    '<path class="b-vest" d="M190 70C194 58 206 54 222 56L246 62C256 66 258 76 254 86L240 142H198Z"/>' +
    '<path class="b-shirt" d="M204 58 210 76 220 57Z"/>' +
    '<path class="b-vest-line" d="M206 76 202 142M214 96h18v14h-20"/>' +
    '<path class="b-band" d="M197 121 246 125 244 133 196 129Z"/>' +
    '<g transform="skewY(4)"><rect class="b-logo2" x="191" y="70" width="7" height="5" rx="1"/><rect class="b-logo" x="198" y="70" width="6" height="5" rx="1"/></g>' +
    '<circle class="b-shirt" cx="244" cy="70" r="12"/><circle class="b-shirt" cx="196" cy="68" r="9"/>' +
    '<path class="b-metal-s" d="M114 222 132 138" stroke-width="7"/>' +
    '<ellipse class="b-tyre" cx="112" cy="224" rx="26" ry="45"/><ellipse class="b-rim" cx="112" cy="224" rx="15" ry="28"/><ellipse class="b-hub" cx="112" cy="224" rx="4" ry="6"/>' +
    '<path class="b-frame-s" d="M92 196C96 172 128 170 136 190" stroke-width="8"/>' +
    '<path class="b-cowl" d="M118 92C132 84 152 88 158 100L162 150C152 166 128 168 118 156Z"/>' +
    '<ellipse class="b-light" cx="135" cy="122" rx="9" ry="13"/><circle class="b-ind" cx="122" cy="102" r="3.5"/>' +
    '<path class="b-skin-s" d="M244 76 214 104 168 102" stroke-width="11"/><circle class="b-dark" cx="166" cy="102" r="6.5"/>' +
    '<path class="b-dark-s" d="M140 90 176 104" stroke-width="6"/>' +
    '<path class="b-dark-s" d="M146 92 136 64M174 102 180 74" stroke-width="3"/><ellipse class="b-dark" cx="135" cy="61" rx="8" ry="5"/><ellipse class="b-dark" cx="181" cy="71" rx="7" ry="4.5"/>' +
    '<circle class="b-helmet" cx="214" cy="38" r="21"/><path class="b-visor" d="M194 33C196 23 212 21 221 27L219 48H198Z"/>' +
    '<path class="b-speed" d="M228 32h8M229 37h6M230 42h4"/>' +
    '</symbol>';

  /* Truck, side view facing right. Wordmark is the real logo file, never redrawn. */
  var truck = '<symbol id="truck-side" viewBox="0 0 440 220">' +
    '<ellipse class="b-shadow" cx="220" cy="206" rx="200" ry="7"/>' +
    '<rect class="t-body" x="18" y="28" width="272" height="142" rx="8"/><rect class="t-edge" x="18.75" y="28.75" width="270.5" height="140.5" rx="7.5"/>' +
    '<rect class="t-stripe" x="18" y="136" width="272" height="10"/>' +
    '<image href="../Public/brand/logo-wordmark.png" x="46" y="62" width="160" height="40"/>' +
    '<path class="t-cab" d="M292 66H360C372 66 380 72 386 84L406 124V172H292Z"/>' +
    '<path class="t-glass" d="M306 80H356C363 80 367 84 371 92L384 120H306Z"/>' +
    '<rect class="b-light" x="398" y="138" width="8" height="14" rx="2"/><rect class="t-stripe" x="292" y="136" width="114" height="6"/>' +
    '<rect class="b-tyre" x="18" y="168" width="388" height="10" rx="3"/>' +
    '<circle class="b-tyre" cx="88" cy="182" r="24"/><circle class="b-rim" cx="88" cy="182" r="11"/>' +
    '<circle class="b-tyre" cx="148" cy="182" r="24"/><circle class="b-rim" cx="148" cy="182" r="11"/>' +
    '<circle class="b-tyre" cx="352" cy="182" r="24"/><circle class="b-rim" cx="352" cy="182" r="11"/>' +
    '</symbol>';

  /* Globe: orthographic around West/Central Africa; illustrative continents, Cameroon marked */
  var globe = '<symbol id="globe" viewBox="0 0 300 300">' +
    '<circle class="g-sea" cx="150" cy="150" r="132"/>' +
    '<ellipse class="g-grid" cx="150" cy="150" rx="132" ry="44"/><ellipse class="g-grid" cx="150" cy="150" rx="132" ry="96"/>' +
    '<ellipse class="g-grid" cx="150" cy="150" rx="44" ry="132"/><ellipse class="g-grid" cx="150" cy="150" rx="96" ry="132"/>' +
    '<g clip-path="url(#tx-globe-clip)">' +
    '<path class="g-land" d="M118 92C140 84 168 86 186 96 196 104 206 112 214 128 210 140 200 146 198 160 196 182 186 204 170 222 160 232 150 230 146 218 142 200 138 186 132 170 124 162 106 158 96 146 90 134 94 116 102 104 106 98 112 94 118 92Z"/>' +
    '<path class="g-land" d="M116 40C134 30 170 30 192 40 202 48 198 62 188 70 172 78 150 80 130 76 116 72 106 62 108 52Z"/>' +
    '<path class="g-land" d="M10 112C26 100 46 108 52 126 56 148 48 172 40 196 34 212 22 208 18 190 14 166 8 136 10 112Z"/>' +
    '<path class="g-land" d="M218 86C240 80 266 90 278 110 282 126 270 134 254 132 238 130 226 120 216 104Z"/>' +
    '<path class="g-land" d="M240 40C262 40 284 56 292 74 288 84 270 82 256 76 244 70 234 56 240 40Z"/>' +
    '</g>' +
    '<circle class="g-rim" cx="150" cy="150" r="132"/>' +
    '<path class="g-arc" d="M162 150C150 100 150 70 152 56"/>' +
    '<path class="g-arc" d="M162 150C110 130 60 130 34 150"/>' +
    '<path class="g-arc" d="M162 150C200 120 230 106 250 104"/>' +
    '<circle class="g-hub" cx="152" cy="56" r="4"/><circle class="g-hub" cx="34" cy="150" r="4"/><circle class="g-hub" cx="250" cy="104" r="4"/>' +
    '<circle class="g-ring" cx="162" cy="150" r="9"/><circle class="g-base" cx="162" cy="150" r="4.5"/>' +
    '</symbol>';

  /* A front door in Buea: wall, frame, panelled door, step, lamp */
  var door = '<symbol id="door" viewBox="0 0 200 240">' +
    '<rect class="d-wall" x="0" y="0" width="200" height="226"/>' +
    '<rect class="d-frame" x="52" y="40" width="96" height="186" rx="3"/>' +
    '<rect class="d-door" x="62" y="50" width="76" height="176"/>' +
    '<rect class="d-panel" x="72" y="62" width="56" height="60" rx="2"/><rect class="d-panel" x="72" y="134" width="56" height="78" rx="2"/>' +
    '<circle class="d-knob" cx="126" cy="132" r="4"/>' +
    '<rect class="d-frame" x="160" y="70" width="14" height="22" rx="3"/><rect class="d-lamp" x="163" y="74" width="8" height="12" rx="2"/>' +
    '<rect class="d-step" x="38" y="222" width="124" height="10" rx="2"/><rect class="d-step" x="28" y="230" width="144" height="10" rx="2"/>' +
    '</symbol>';

  /* Parcel box with a TanEx label (barcode pattern is illustrative) */
  var bars = '';
  var w = [2,1,3,1,1,2,1,3,2,1,1,3,1,2,2,1,3,1,1,2,1,1,3,2,1,2,1,3,1,1,2,3,1,2];
  for (var i = 0, x = 124; i < w.length; i++) { if (i % 2 === 0) bars += '<rect class="p-ink" x="' + x.toFixed(1) + '" y="128" width="' + (w[i] * 1.2).toFixed(1) + '" height="34"/>'; x += w[i] * 1.2 + .15; }
  var parcel = '<symbol id="parcel" viewBox="0 0 300 240">' +
    '<ellipse class="b-shadow" cx="150" cy="222" rx="128" ry="10"/>' +
    '<path class="p-top" d="M40 70 160 44 262 70 142 98Z"/>' +
    '<path class="p-front" d="M40 70 142 98V218L40 190Z"/>' +
    '<path class="p-side" d="M142 98 262 70V190L142 218Z"/>' +
    '<path class="p-tape" d="M96 58 216 84 202 88 82 61Z"/>' +
    '<g transform="matrix(1 -.2333 0 1 36 34)">' +
    '<rect class="p-label" x="114" y="104" width="100" height="88" rx="3"/>' +
    '<use href="#mark" x="120" y="110" width="22" height="13"/>' +
    '<rect class="p-ink" x="146" y="113" width="40" height="3" rx="1"/><rect class="p-ink" x="146" y="119" width="26" height="2" rx="1" style="opacity:.5"/>' +
    bars +
    '<text x="164" y="176" text-anchor="middle" style="font:600 9px var(--tx-font-mono);fill:#1C120E;letter-spacing:.08em">TX7K2M9P</text>' +
    '</g>' +
    '</symbol>';

  /* Mount Cameroon silhouette (Buea sits on its slopes) */
  var mount = '<symbol id="mount" viewBox="0 0 600 160" preserveAspectRatio="none">' +
    '<path class="mt" d="M0 160V122C60 110 120 92 180 70 230 50 262 28 300 22 330 18 352 30 384 46 440 74 520 104 600 118V160Z"/>' +
    '<path class="mt2" d="M0 160V140C80 132 150 124 220 112 300 98 380 106 460 118 520 126 560 132 600 134V160Z"/>' +
    '</symbol>';

  var defs = '<defs>' +
    '<pattern id="tx-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.35" style="fill:var(--land,#5F4034)"/></pattern>' +
    '<clipPath id="tx-globe-clip"><circle cx="150" cy="150" r="132"/></clipPath>' +
    '</defs>';

  var holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + defs + icons + mark + bikeSide + bikeFront + bike3q + truck + globe + door + parcel + mount + '</svg>';
  (document.body || document.documentElement).insertBefore(holder, document.body ? document.body.firstChild : null);
})();
