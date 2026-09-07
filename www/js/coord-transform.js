(function () {
  // Standard 2D affine georeferencing from N>=3 control points (least squares).
  // Solves lat = a1*x + b1*y + c1, lng = a2*x + b2*y + c2 independently.

  function solveLinear3(A, b) {
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < 3; col++) {
      let pivot = col;
      for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      [M[col], M[pivot]] = [M[pivot], M[col]];
      const div = M[col][col];
      if (Math.abs(div) < 1e-12) return null;
      for (let c = col; c < 4; c++) M[col][c] /= div;
      for (let r = 0; r < 3; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        for (let c = col; c < 4; c++) M[r][c] -= factor * M[col][c];
      }
    }
    return [M[0][3], M[1][3], M[2][3]];
  }

  function solveAffineDim(points, targetKey) {
    let Sxx = 0, Sxy = 0, Sx = 0, Syy = 0, Sy = 0, S1 = 0, Sxt = 0, Syt = 0, St = 0;
    for (const p of points) {
      const x = p.x, y = p.y, t = p[targetKey];
      Sxx += x * x; Sxy += x * y; Sx += x;
      Syy += y * y; Sy += y; S1 += 1;
      Sxt += x * t; Syt += y * t; St += t;
    }
    const A = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, S1]];
    const b = [Sxt, Syt, St];
    return solveLinear3(A, b);
  }

  function computeTransform(points) {
    if (!points || points.length < 3) return null;
    const latCoef = solveAffineDim(points, 'lat');
    const lngCoef = solveAffineDim(points, 'lng');
    if (!latCoef || !lngCoef) return null;
    return { latCoef, lngCoef };
  }

  function applyTransform(transform, x, y) {
    if (!transform) return null;
    const [a1, b1, c1] = transform.latCoef;
    const [a2, b2, c2] = transform.lngCoef;
    return { lat: a1 * x + b1 * y + c1, lng: a2 * x + b2 * y + c2 };
  }

  window.CoordTransform = { computeTransform, applyTransform };
})();
