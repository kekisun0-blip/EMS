/**
 * 博物馆外设桥接：TouchDesigner / Leap Motion 等经 WebSocket 推送 JSON 控制展台
 *
 * TouchDesigner 侧建议：
 * - WebSocket Server DAT → 本页连接 ws://展机IP:端口
 * - Leap CHOP/数据 → 归一化后写入 JSON 发送
 *
 * 消息示例（单行 JSON）：
 *   {"orbitSpeed":1.8}              // 3D 自动环绕速度（仅 eg-scene OrbitControls）
 *   {"autoRotate":false}            // 暂停自动转台
 *   {"sceneHour":15.25}             // 仅更新 3D 场景日钟（0–23.99），不改动仿真逻辑
 *   {"type":"gesture","name":"pinch_open"}  // 自定义：监听 window 'ems-museum-gesture'
 *
 * URL 参数：?museum_ws=ws://127.0.0.1:9980
 * 或 localStorage：ems_museum_ws
 */
(function(){
  'use strict';

  function qs(name){
    try{
      var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    }catch(e){ return ''; }
  }

  function pill(text, live){
    var el = document.getElementById('museum-bridge-pill');
    if(!el){
      el = document.createElement('div');
      el.id = 'museum-bridge-pill';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle('live', !!live);
  }

  function applyPayload(data){
    if(!data || typeof data !== 'object') return;
    if(typeof window.__emsApplyMuseumPayload === 'function'){
      window.__emsApplyMuseumPayload(data);
      return;
    }
    try{
      window.dispatchEvent(new CustomEvent('ems-museum-payload', { detail: data }));
    }catch(e){}
  }

  function connect(url){
    if(!url || !window.WebSocket) return;
    var ws;
    try{ ws = new WebSocket(url); }catch(e){ pill('WS 无效', false); return; }

    ws.onopen = function(){
      pill('外设已连接', true);
    };
    ws.onclose = function(){
      pill('外设未连接', false);
    };
    ws.onerror = function(){
      pill('WS 错误', false);
    };
    ws.onmessage = function(ev){
      var raw = ev.data;
      if(typeof raw !== 'string') return;
      var data;
      try{ data = JSON.parse(raw); }catch(e){ return; }
      if(data.type === 'ping'){ try{ ws.send(JSON.stringify({ type:'pong', t:Date.now() })); }catch(e2){} return; }
      if(data.type === 'gesture'){
        try{ window.dispatchEvent(new CustomEvent('ems-museum-gesture', { detail: data })); }catch(e3){}
      }
      applyPayload(data);
    };

    window.__emsMuseumBridgeClose = function(){
      try{ ws.close(); }catch(e){}
    };
  }

  function boot(){
    var u = qs('museum_ws');
    if(!u){
      try{ u = localStorage.getItem('ems_museum_ws') || ''; }catch(e){ u = ''; }
    }
    if(u) connect(u);
    else pill('', false);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
