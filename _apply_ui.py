#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('/Users/keyuesun/ems-sandbox/sandbox.html')
s = p.read_text('utf-8')
orig_len = len(s)
changes = []

# 1. Font
old_f = "family=Exo+2:ital,wght@0,300;0,400;0,500;0,600;0,700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600&display=swap"
new_f = "family=Exo+2:ital,wght@0,300;0,400;0,500;0,600;0,700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600&family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700&display=swap"
if old_f in s:
    s = s.replace(old_f, new_f, 1); changes.append("font")

# 2. CSS vars
old_r = ":root{--xiaowei-violet:#5ec8ff;--xiaowei-cyan:#00e8ff;--xiaowei-ring:rgba(0,232,255,0.38);--ems-left-w:300px;}"
if old_r in s:
    new_r = ":root{\n  --xiaowei-violet:#5ec8ff;--xiaowei-cyan:#00e8ff;--xiaowei-ring:rgba(0,232,255,0.38);--ems-left-w:320px;\n  --ems-bg:#050a18;--ems-panel:rgba(8,14,28,0.88);--ems-border:rgba(0,232,255,0.10);\n  --ems-glow:0 0 20px rgba(0,232,255,0.12);--ems-radius:12px;\n  --ems-cyan:#00e8ff;--ems-purple:#818cf8;--ems-rose:#f472b6;\n  --ems-text:#e2e8f0;--ems-muted:#64748b;\n}"
    s = s.replace(old_r, new_r, 1); changes.append("vars")

old_b = "body{font-family:'Inter',sans-serif;background:#070a12;color:#e8eaf0;min-height:100vh;overflow-x:hidden;}"
if old_b in s:
    new_b = "body{font-family:'Inter','IBM Plex Sans',system-ui,sans-serif;background:var(--ems-bg);color:var(--ems-text);min-height:100vh;overflow-x:hidden;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}"
    s = s.replace(old_b, new_b, 1); changes.append("body")

# Header CSS
old_hc = "#header{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(7,10,18,0.96);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.08);padding:8px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:8px;}"
if old_hc in s:
    s = s.replace(old_hc, "#header{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(5,10,24,0.97);backdrop-filter:blur(16px);border-bottom:1px solid var(--ems-border);padding:8px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;row-gap:8px;height:56px;}", 1)
    changes.append("hdr-css")

if "padding-top:52px;}" in s:
    s = s.replace("padding-top:52px;}", "padding-top:56px;}", 1); changes.append("grid")

# Boot CSS
bc_start = "\u5168\u5c4f\u52a0\u8f7d\u9875\uff08\u8fdb\u5165 127.0.0.1:8766 \u7b49\u540c\u6e90\u9875\u9762\u65f6\u9996\u5c4f\uff09"
bc_end_str = "#ems-boot-loader .boot-bar{animation:none;width:100%;opacity:0.6}\n}"
i1 = s.find(bc_start)
i2 = s.find(bc_end_str)
if i1 >= 0 and i2 > i1:
    # go back to start of comment
    comment_start = s.rfind("/*", 0, i1)
    new_bc = """/* Landing page */
#ems-boot-loader{
  position:fixed;inset:0;z-index:100000;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;
  background:#020610;
  background-image:
    radial-gradient(ellipse 120% 50% at 50% -10%, rgba(0,232,255,0.14), transparent 60%),
    radial-gradient(ellipse 80% 40% at 50% 110%, rgba(99,102,241,0.12), transparent 50%);
  transition:opacity .48s ease, visibility .48s ease;
}
#ems-boot-loader.out{opacity:0;visibility:hidden;pointer-events:none;}
.landing-title{
  font-family:'Orbitron','Exo 2',system-ui,sans-serif;
  font-size:clamp(18px,4vw,28px);font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
  color:#e8fbff;text-shadow:0 0 24px rgba(0,232,255,0.3);text-align:center;
}
.landing-sub{font-size:12px;color:rgba(180,230,255,0.5);letter-spacing:0.06em;text-align:center;}
.landing-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:720px;width:100%;}
@media(max-width:560px){.landing-grid{grid-template-columns:1fr;}}
.landing-card{
  position:relative;padding:24px 20px;border-radius:16px;cursor:pointer;
  border:1px solid rgba(0,232,255,0.12);
  background:linear-gradient(165deg,rgba(8,14,28,0.92),rgba(15,23,42,0.85));
  backdrop-filter:blur(12px);min-height:130px;display:flex;flex-direction:column;gap:8px;
  transition:all .25s cubic-bezier(.22,1,.36,1);box-shadow:0 2px 20px rgba(0,0,0,0.35);
}
.landing-card:hover{border-color:rgba(0,232,255,0.45);transform:translateY(-4px);box-shadow:0 8px 32px rgba(0,232,255,0.15),0 2px 20px rgba(0,0,0,0.4);}
.landing-card:active{transform:translateY(-1px);}
.landing-card-tag{
  position:absolute;top:12px;right:12px;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
  padding:3px 8px;border-radius:999px;background:rgba(0,232,255,0.12);border:1px solid rgba(0,232,255,0.3);color:#7dd3fc;
}
.landing-card-tag.demo{background:rgba(139,92,246,0.15);border-color:rgba(139,92,246,0.35);color:#c4b5fd;}
.landing-card-id{font-family:'Orbitron',monospace;font-size:15px;font-weight:600;color:#f0fdff;letter-spacing:0.04em;}
.landing-card-spec{font-size:11px;color:#94a3b8;line-height:1.5;}
.landing-card-desc{font-size:10px;color:#64748b;line-height:1.45;margin-top:auto;}
.landing-card .lc-icon{font-size:28px;margin-bottom:2px;}
#ems-boot-loader .boot-corner{position:absolute;width:48px;height:48px;border:2px solid rgba(0,232,255,0.25);pointer-events:none;}
#ems-boot-loader .boot-corner-tl{top:16px;left:16px;border-right:none;border-bottom:none;}
#ems-boot-loader .boot-corner-tr{top:16px;right:16px;border-left:none;border-bottom:none;}
#ems-boot-loader .boot-corner-bl{bottom:16px;left:16px;border-right:none;border-top:none;}
#ems-boot-loader .boot-corner-br{bottom:16px;right:16px;border-left:none;border-top:none;}
@media(prefers-reduced-motion:reduce){.landing-card:hover{transform:none}}"""
    s = s[:comment_start] + new_bc + s[i2+len(bc_end_str):]
    changes.append("boot-css")

# Boot HTML
old_bh = '<div id="ems-boot-loader" role="status" aria-live="polite" aria-busy="true" aria-label="\u52a0\u8f7d\u4e2d">'
if old_bh in s:
    boot_end = '<div class="boot-bar-wrap" aria-hidden="true"><div class="boot-bar"></div></div>\n</div>'
    bi1 = s.find(old_bh)
    bi2 = s.find(boot_end, bi1)
    if bi2 > bi1:
        new_bh = '<div id="ems-boot-loader" role="status" aria-live="polite" aria-label="\u9009\u62e9\u7535\u7ad9">\n'
        new_bh += '  <span class="boot-corner boot-corner-tl" aria-hidden="true"></span>\n'
        new_bh += '  <span class="boot-corner boot-corner-tr" aria-hidden="true"></span>\n'
        new_bh += '  <span class="boot-corner boot-corner-bl" aria-hidden="true"></span>\n'
        new_bh += '  <span class="boot-corner boot-corner-br" aria-hidden="true"></span>\n'
        new_bh += '  <div class="landing-title">AIWEI \xb7 EMS Digital Twin</div>\n'
        new_bh += '  <div class="landing-sub">\u9009\u62e9\u7535\u7ad9\u5f00\u59cb \xb7 Select a station to begin</div>\n'
        new_bh += '  <div class="landing-grid">\n'

        cards = [
            ("5156341", "REAL", "\u26a1", "5156341", "10 kWh + 8 kWp \xb7 \u4e39\u9ea6 DK1", "\u4e0d\u89c4\u5f8b\u7528\u7535 \xb7 \u9ad8\u8017\u80fd\u504f\u591a \xb7 4/1\u20134/14"),
            ("5161154", "REAL", "\U0001f3e0", "5161154", "6 kWp + 10 kWh \xb7 \u4e39\u9ea6 DK1", "\u4e0d\u5728\u5bb6 \xb7 \u6d88\u8017\u5c11 \xb7 \u5356\u7535\u591a\u8d5a\u94b1"),
            ("5137884", "REAL", "\U0001f50b", "5137884", "7 kWp + 7.68 kWh \xb7 \u4e39\u9ea6 DK1", "\u6bcf\u5929\u9ad8\u8017\u80fd \xb7 4/8\u20134/9 \u7a81\u51fa \xb7 \u63a8\u8350\u4e70\u7535\u6c60"),
            ("demo", "demo", "\U0001f9ea", "\u6a21\u62df\u7535\u7ad9", "6 kWp + 20 kWh \xb7 \u5317\u6b27\u57ce\u5e02\u5bb6\u5ead", "\u6a21\u578b\u9a71\u52a8 \xb7 \u53ef\u8c03\u53c2\u6570 \xb7 \u7528\u4e8e\u6f14\u793a\u6d4b\u8bd5"),
        ]
        for sid, tag_class, icon, display_id, spec, desc in cards:
            tag_cls = ' demo' if tag_class == 'demo' else ''
            tag_label = 'DEMO' if tag_class == 'demo' else 'REAL'
            new_bh += f'    <div class="landing-card" onclick="selectLandingStation(\'{sid}\')" role="button" tabindex="0">\n'
            new_bh += f'      <span class="landing-card-tag{tag_cls}">{tag_label}</span>\n'
            new_bh += f'      <div class="lc-icon">{icon}</div>\n'
            new_bh += f'      <div class="landing-card-id">{display_id}</div>\n'
            new_bh += f'      <div class="landing-card-spec">{spec}</div>\n'
            new_bh += f'      <div class="landing-card-desc">{desc}</div>\n'
            new_bh += f'    </div>\n'
        new_bh += '  </div>\n</div>'
        s = s[:bi1] + new_bh + s[bi2+len(boot_end):]
        changes.append("boot-html")

# Left panel
old_lp_marker = '<div class="section-title" id="sec-title-family">\u5bb6\u5ead\u4e0e\u573a\u666f</div>'
lp_end_marker = '<div id="preset-summary-react-root" class="ems-react-mount"></div>'
lpi1 = s.find(old_lp_marker)
lpi2 = s.find(lp_end_marker, lpi1 if lpi1 >= 0 else 0)
if lpi1 >= 0 and lpi2 > lpi1:
    # find the indentation start
    line_start = s.rfind('\n', 0, lpi1) + 1
    new_lp = '    <div class="section-title" id="sec-title-family" style="font-family:\'Orbitron\',system-ui,sans-serif;font-size:10px;letter-spacing:0.12em;">\u7535\u7ad9\u9009\u62e9</div>\n'
    station_cards = [
        ("5156341", "\u26a1 5156341", "10kWh+8kWp \xb7 \u4e0d\u89c4\u5f8b"),
        ("5161154", "\U0001f3e0 5161154", "6kWp+10kWh \xb7 \u4e0d\u5728\u5bb6"),
        ("5137884", "\U0001f50b 5137884", "7kWp+7.68kWh \xb7 \u9ad8\u8017\u80fd"),
        ("demo", "\U0001f9ea \u6a21\u62df\u7535\u7ad9", "6kWp+20kWh \xb7 Demo"),
    ]
    new_lp += '    <div id="station-card-row" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">\n'
    for sid, label, spec in station_cards:
        new_lp += f'      <button type="button" class="station-card-btn" data-station="{sid}" onclick="switchStation(\'{sid}\')">\n'
        new_lp += f'        <span class="scb-id">{label}</span><span class="scb-spec">{spec}</span>\n'
        new_lp += f'      </button>\n'
    new_lp += '    </div>\n'
    new_lp += '    <select id="sel-real-plant" class="lp-select" style="display:none">\n'
    new_lp += '      <option value="">\u2014</option>\n'
    new_lp += '      <option value="5156341">5156341</option>\n'
    new_lp += '      <option value="5161154">5161154</option>\n'
    new_lp += '      <option value="5137884">5137884</option>\n'
    new_lp += '    </select>\n'
    new_lp += '    <div id="station-preset-chips" style="display:none"></div>\n'
    new_lp += '    <div id="preset-summary-react-root" class="ems-react-mount" style="display:none"></div>\n'
    new_lp += '    <div id="lbl-preset-station" style="display:none"></div>\n'
    new_lp += '    <div id="left-date-strip" style="margin-bottom:10px;">\n'
    new_lp += '      <div class="section-title" style="font-size:9px;margin-bottom:6px;">\u67e5\u770b\u65e5\u671f</div>\n'
    new_lp += '      <div id="left-date-chips" class="touch-chip-strip" role="tablist" style="gap:6px;"></div>\n'
    new_lp += '    </div>\n'
    new_lp += '    <div id="left-weather-card" class="left-info-card" style="margin-bottom:10px;">\n'
    new_lp += '      <div class="lic-head">\U0001f324 \u5929\u6c14</div>\n'
    new_lp += '      <div class="lic-body" id="left-weather-body">\u9009\u62e9\u7535\u7ad9\u540e\u663e\u793a</div>\n'
    new_lp += '    </div>\n'
    new_lp += '    <div id="left-price-card" class="left-info-card" style="margin-bottom:10px;">\n'
    new_lp += '      <div class="lic-head">\u20ac \u7535\u4ef7</div>\n'
    new_lp += '      <div class="lic-body" id="left-price-body">\u9009\u62e9\u7535\u7ad9\u540e\u663e\u793a</div>\n'
    new_lp += '    </div>'
    s = s[:line_start] + new_lp + s[lpi2+len(lp_end_marker):]
    changes.append("left-panel")

# New CSS block
if ".station-card-btn" not in s.split("</style>")[0]:
    css = """
.station-card-btn{display:flex;align-items:center;gap:10px;width:100%;padding:14px;border-radius:var(--ems-radius);cursor:pointer;border:1px solid var(--ems-border);background:linear-gradient(165deg,rgba(8,14,28,0.9),rgba(15,23,42,0.8));backdrop-filter:blur(8px);font-family:inherit;font-size:12px;color:var(--ems-text);text-align:left;min-height:56px;transition:all .2s ease;}
.station-card-btn:hover{border-color:rgba(0,232,255,0.4);box-shadow:var(--ems-glow);transform:translateY(-1px);}
.station-card-btn.on{border-color:var(--ems-cyan);background:rgba(0,232,255,0.08);box-shadow:0 0 16px rgba(0,232,255,0.18);}
.scb-id{font-weight:700;white-space:nowrap;}
.scb-spec{font-size:10px;color:var(--ems-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.left-info-card{padding:12px 14px;border-radius:var(--ems-radius);border:1px solid var(--ems-border);background:var(--ems-panel);backdrop-filter:blur(8px);}
.lic-head{font-size:9px;font-weight:700;color:var(--ems-cyan);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;}
.lic-body{font-size:11px;color:var(--ems-text);line-height:1.55;}
.lic-body .lic-muted{color:var(--ems-muted);font-style:italic;}
.chart-tabs button{min-height:44px;padding:10px 16px;font-size:12px;border-radius:var(--ems-radius);}
.post-sim-tab{min-height:44px;padding:10px 16px;font-size:11px;}
.touch-chip{min-height:44px;padding:10px 14px;font-size:10px;}
#run-btn{min-height:52px;font-size:14px;font-weight:700;letter-spacing:0.06em;border-radius:var(--ems-radius);border:1px solid rgba(0,232,255,0.45);background:linear-gradient(135deg,rgba(0,232,255,0.18),rgba(99,102,241,0.12));color:#e0fffe;cursor:pointer;font-family:inherit;width:100%;box-shadow:0 0 20px rgba(0,232,255,0.08);transition:all .2s ease;}
#run-btn:hover{border-color:var(--ems-cyan);box-shadow:0 0 28px rgba(0,232,255,0.22);transform:translateY(-1px);}
#left-panel{background:var(--ems-panel);backdrop-filter:blur(16px);border-right:1px solid var(--ems-border);}
#right-panel{background:var(--ems-panel);backdrop-filter:blur(16px);border-left:1px solid var(--ems-border);}
#center{background:var(--ems-bg);}
#bottom-bar{background:rgba(8,12,22,0.92);border-top:1px solid var(--ems-border);}
#kpi-strip{background:linear-gradient(180deg,rgba(0,232,255,0.06),transparent);border-bottom:1px solid var(--ems-border);}
.kpi-cell{background:var(--ems-panel);border:1px solid var(--ems-border);border-radius:var(--ems-radius);}
"""
    s = s.replace("</style>", css + "</style>", 1)
    changes.append("new-css")

# drawChart canvas -> ECharts
pat = re.compile(r"function drawChart\(\)\{\s*\n\s*const canvas = document\.getElementById\('chart-canvas'\);[\s\S]*?\n\}", re.M)
ms = list(pat.finditer(s))
if ms:
    echart_fn = """function drawChart(){
  var host = document.getElementById('chart-echarts-host');
  if(!host) return;
  if(typeof echarts === 'undefined'){
    host.innerHTML = '<p style="color:#64748b;padding:24px;text-align:center;font-size:12px;">' + emsT('\\u56fe\\u8868\\u5e93\\u52a0\\u8f7d\\u5931\\u8d25','Chart lib failed') + '</p>';
    return;
  }
  var wrap = host.parentElement;
  var h = Math.max(220, (wrap && wrap.clientHeight) ? (wrap.clientHeight - 42) : 260);
  host.style.width = '100%';
  host.style.height = h + 'px';
  if(!simResult){
    disposeEmsMainChart();
    emsEchartsMain = echarts.init(host, null, { renderer: 'canvas' });
    emsEchartsMain.setOption({
      title: { text: emsT('\\u8fd0\\u884c\\u4eff\\u771f\\u540e\\u663e\\u793a\\u66f2\\u7ebf','Run sim for charts'), left:'center', top:'center', textStyle:{ color:'#64748b', fontSize:14, fontWeight:500 } }
    });
    return;
  }
  if(chartTab === 'predsoc' || chartTab === 'actsoc') chartTab = 'soc';
  var reveal = getChartRevealSteps();
  var simRef = simResult;
  if(!emsEchartsMain) emsEchartsMain = echarts.init(host, null, { renderer: 'canvas' });
  try{ emsEchartsMain.resize(); }catch(e){}
  if(emsEchartsMain && simRef &&
      reveal === emsChartDrawStamp.reveal &&
      chartTab === emsChartDrawStamp.tab &&
      simRef === emsChartDrawStamp.sim){
    if(Math.abs(h - emsChartDrawStamp.h) >= 2){ emsEchartsMain.resize(); emsChartDrawStamp.h = h; }
    return;
  }
  if(emsEchartsMain && Math.abs(h - emsChartDrawStamp.h) >= 2) emsEchartsMain.resize();
  try{
    emsEchartsMain.setOption(buildMainEchartsOption(), { notMerge: true, lazyUpdate: false });
    try{ requestAnimationFrame(function(){ try{ emsEchartsMain && emsEchartsMain.resize(); }catch(e){} }); }catch(e){}
  }catch(e){
    try{ console.error('[EMS] chart setOption failed', e); }catch(e2){}
    host.innerHTML = '<div style="color:#fca5a5;font-size:11px;padding:18px;line-height:1.5;">'+
      emsT('\\u56fe\\u8868\\u6e32\\u67d3\\u5931\\u8d25\\uff1a','Chart render failed: ')+escapeHtml(String(e&&e.message?e.message:e))+'</div>';
    try{ emsEchartsMain && emsEchartsMain.dispose(); }catch(e3){}
    emsEchartsMain = null;
    return;
  }
  emsChartDrawStamp = { reveal: reveal, tab: chartTab, h: h, sim: simRef };
}"""
    s = pat.sub(echart_fn, s)
    changes.append("drawChart")

# scheduleDismissBootLoader
old_sched = "function scheduleDismissBootLoader(){\n  const t0 = window.__emsBootT0 || 0;\n  const minMs = 520;\n  const elapsed = (typeof performance !== 'undefined' && performance.now) ? (performance.now() - t0) : minMs;\n  const wait = Math.max(0, minMs - elapsed);\n  requestAnimationFrame(function(){\n    requestAnimationFrame(function(){\n      setTimeout(dismissBootLoader, wait);\n    });\n  });\n}"
if old_sched in s:
    new_sched = "function scheduleDismissBootLoader(){\n  // Landing page stays until user picks station\n}"
    s = s.replace(old_sched, new_sched, 1)
    changes.append("sched")

# Header title JS
old_tj = "if(ht) ht.textContent = emsT('EMS \xb7 \u6570\u5b57\u5b5e\u751f','EMS \xb7 Digital Twin');"
if old_tj in s:
    s = s.replace(old_tj, "if(ht) ht.textContent = 'AIWEI \\xb7 EMS';", 1)
    changes.append("title-js")

# Wire date chips
wire_old = "  drawChart();\n  updateAnalysis();\n  redrawAiAnalysisPriceSpark();\n  updateAiPriceDaySummary();\n}"
if wire_old in s:
    wire_new = "  drawChart();\n  updateAnalysis();\n  redrawAiAnalysisPriceSpark();\n  updateAiPriceDaySummary();\n  try{buildLeftDateChips();}catch(e){}\n  try{if(marathon14Run&&marathon14Run.days&&marathon14Run.days[0]){updateLeftWeatherCard(marathon14Run.days[0].date);updateLeftPriceCard(marathon14Run.days[0].date);}}catch(e){}\n}"
    s = s.replace(wire_old, wire_new, 1)
    changes.append("wire")

# Sanity
print("Changes:", ", ".join(changes))
c = s.count("chart-canvas")
d = len(re.findall(r"function drawChart\(\)\{", s))
b = len(re.findall(r"function buildMainEchartsOption\(\)", s))
print(f"chart-canvas={c}, drawChart={d}, buildMainEchartsOption={b}")
print(f"landing-grid={'landing-grid' in s}, station-card-btn={'station-card-btn' in s}")
print(f"selectLandingStation={'selectLandingStation' in s}, AIWEI={'AIWEI' in s}")
print(f"touch-action={'touch-action:manipulation' in s}")
print(f"Size: {orig_len} -> {len(s)} ({len(s)-orig_len:+d})")
p.write_text(s, 'utf-8')
print("Done!")
