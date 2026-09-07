(function () {
  L.HeatLayer = L.Layer.extend({
    initialize: function (points, options) {
      this._points = points || []; // [[lat,lng,intensity], ...]
      this._options = Object.assign({ radius: 22, maxOpacity: 0.85 }, options);
    },
    setPoints: function (points) {
      this._points = points || [];
      this._reset();
    },
    onAdd: function (map) {
      this._map = map;
      if (!this._canvas) this._initCanvas();
      map.getPanes().overlayPane.appendChild(this._canvas);
      map.on('moveend', this._reset, this);
      map.on('resize', this._resize, this);
      if (map.options.zoomAnimation && L.Browser.any3d) {
        map.on('zoomanim', this._animateZoom, this);
      }
      this._reset();
    },
    onRemove: function (map) {
      map.getPanes().overlayPane.removeChild(this._canvas);
      map.off('moveend', this._reset, this);
      map.off('resize', this._resize, this);
      map.off('zoomanim', this._animateZoom, this);
    },
    _initCanvas: function () {
      const canvas = (this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer'));
      const size = this._map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      const animated = this._map.options.zoomAnimation && L.Browser.any3d;
      L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
    },
    _resize: function (e) {
      this._canvas.width = e.newSize.x;
      this._canvas.height = e.newSize.y;
    },
    _reset: function () {
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, topLeft);
      const size = this._map.getSize();
      if (this._canvas.width !== size.x) this._canvas.width = size.x;
      if (this._canvas.height !== size.y) this._canvas.height = size.y;
      this._redraw();
    },
    _getStamp: function (r) {
      if (this._stamp && this._stampR === r) return this._stamp;
      this._stampR = r;
      const s = r * 2;
      const circle = document.createElement('canvas');
      circle.width = circle.height = s;
      const cctx = circle.getContext('2d');
      const grad = cctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, s, s);
      this._stamp = circle;
      return circle;
    },
    _getGradientLUT: function () {
      if (this._lut) return this._lut;
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 256;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, 'rgba(37,99,235,0)');
      grad.addColorStop(0.25, 'rgba(37,99,235,1)');
      grad.addColorStop(0.5, 'rgba(16,185,129,1)');
      grad.addColorStop(0.75, 'rgba(245,158,11,1)');
      grad.addColorStop(1.0, 'rgba(239,68,68,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1, 256);
      this._lut = ctx.getImageData(0, 0, 1, 256).data;
      return this._lut;
    },
    _redraw: function () {
      if (!this._map) return;
      const ctx = this._canvas.getContext('2d');
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      const r = this._options.radius;
      const stamp = this._getStamp(r);
      const bounds = this._map.getBounds().pad(0.25);
      for (const [lat, lng] of this._points) {
        if (!bounds.contains([lat, lng])) continue;
        const p = this._map.latLngToContainerPoint([lat, lng]);
        ctx.drawImage(stamp, p.x - r, p.y - r);
      }
      if (!this._canvas.width || !this._canvas.height) return;
      const imgData = ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
      const pixels = imgData.data;
      const lut = this._getGradientLUT();
      const maxOpacity = this._options.maxOpacity;
      for (let i = 3; i < pixels.length; i += 4) {
        const alpha = pixels[i];
        if (!alpha) continue;
        const idx = alpha * 4;
        pixels[i - 3] = lut[idx];
        pixels[i - 2] = lut[idx + 1];
        pixels[i - 1] = lut[idx + 2];
        pixels[i] = Math.min(255, alpha) * maxOpacity;
      }
      ctx.putImageData(imgData, 0, 0);
    },
    _animateZoom: function (e) {
      const scale = this._map.getZoomScale(e.zoom);
      const offset = this._map._latLngBoundsToNewLayerBounds(this._map.getBounds(), e.zoom, e.center).min;
      L.DomUtil.setTransform(this._canvas, offset, scale);
    },
  });

  L.heatLayer = function (points, options) {
    return new L.HeatLayer(points, options);
  };
})();
