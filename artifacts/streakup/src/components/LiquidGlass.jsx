import { useEffect, useMemo, useRef, useState } from "react";

const LENS_MAP_CACHE = new Map();
const MAX_LENS_MAP_DIMENSION = 256;

function lgSmoothStep(a, b, t) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function lgRoundedRectSDF(x, y, width, height, radius) {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - radius;
}

function buildLensDisplacementMap(width, height) {
  const scale = Math.min(1, MAX_LENS_MAP_DIMENSION / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const cacheKey = `${w}x${h}`;
  const cached = LENS_MAP_CACHE.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const data = new Uint8ClampedArray(w * h * 4);
  const rawValues = [];
  let maxScale = 0;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ix = i / w - 0.5;
      const iy = j / h - 0.5;
      const distanceToEdge = lgRoundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
      const displacement = lgSmoothStep(0.8, 0, distanceToEdge - 0.15);
      const scaled = lgSmoothStep(0, 1, displacement);
      const tx = ix * scaled + 0.5;
      const ty = iy * scaled + 0.5;
      const dx = tx * w - i;
      const dy = ty * h - j;
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
      rawValues.push(dx, dy);
    }
  }

  maxScale *= 0.5;
  let idx = 0;
  for (let p = 0; p < w * h; p++) {
    const r = rawValues[idx++] / (maxScale || 1) + 0.5;
    const g = rawValues[idx++] / (maxScale || 1) + 0.5;
    const base = p * 4;
    data[base] = Math.round(Math.max(0, Math.min(255, r * 255)));
    data[base + 1] = Math.round(Math.max(0, Math.min(255, g * 255)));
    data[base + 2] = 0;
    data[base + 3] = 255;
  }

  ctx.putImageData(new ImageData(data, w, h), 0, 0);
  const url = canvas.toDataURL();
  LENS_MAP_CACHE.set(cacheKey, url);
  return url;
}

const LIQUID_GLASS_SHADOW = [
  "1px -1px 2px hsl(0 0% 100% / 0.5) inset",
  "0px -1px 2px hsl(0 0% 100% / 0.5) inset",
  "-1px -1px 2px hsl(0 0% 100% / 0.5) inset",
  "1px 1px 2px hsl(0 0% 30% / 0.5) inset",
  "-8px 4px 10px -6px hsl(0 0% 30% / 0.25) inset",
  "-1px 1px 6px hsl(0 0% 30% / 0.25) inset",
  "-1px -1px 8px hsl(0 0% 60% / 0.15)",
  "1px 1px 2px hsl(0 0% 30% / 0.15)",
  "2px 2px 6px hsl(0 0% 30% / 0.15)",
  "-2px -1px 2px hsl(0 0% 100% / 0.25) inset",
  "3px 6px 16px -6px hsl(0 0% 30% / 0.5)",
].join(", ");

function AdvancedGlassOverlay({
  blur,
  bevelDepth,
  bevelWidth,
  children,
  edgeHighlight,
  isStaticRenderer,
  magnify,
  shadowOffset,
  specular,
  rainbow,
  refraction,
  radius,
  saturation,
  tintColor,
  tintOpacity,
  style,
}) {
  const filterId = useMemo(() => `advanced-glass-${Math.random().toString(36).slice(2, 8)}`, []);
  const lensFilterId = useMemo(() => `lens-disp-${Math.random().toString(36).slice(2, 8)}`, []);
  const containerRef = useRef(null);
  const [lensDataUrl, setLensDataUrl] = useState("");
  const [lensScale, setLensScale] = useState(0);
  const pendingSizeRef = useRef(null);
  const resizeTimerRef = useRef(null);

  useEffect(() => {
    if (isStaticRenderer) return;
    const el = containerRef.current;
    if (!el) return;

    const rebuild = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      pendingSizeRef.current = { width: rect.width, height: rect.height };
      if (resizeTimerRef.current != null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = window.setTimeout(() => {
        const next = pendingSizeRef.current;
        if (!next) return;
        setLensDataUrl(buildLensDisplacementMap(next.width, next.height));
        setLensScale(Math.min(next.width, next.height) * 0.18);
        resizeTimerRef.current = null;
      }, 80);
    };

    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (resizeTimerRef.current != null) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
    };
  }, [isStaticRenderer]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        isolation: "isolate",
        ...style,
      }}
    >
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="noise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={Math.min(refraction * 2, 120)}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feOffset dx={rainbow * 3} dy={0} in="displaced" result="redShift" />
            <feOffset dx={-rainbow * 3} dy={0} in="displaced" result="blueShift" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              in="redShift"
              result="redChannel"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              in="displaced"
              result="greenChannel"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              in="blueShift"
              result="blueChannel"
            />
            <feBlend mode="screen" in="redChannel" in2="greenChannel" result="rgBlend" />
            <feBlend mode="screen" in="rgBlend" in2="blueChannel" result="chromatic" />
            <feComponentTransfer in="chromatic" result="magnified">
              <feFuncR type="linear" slope={1 + magnify} />
              <feFuncG type="linear" slope={1 + magnify} />
              <feFuncB type="linear" slope={1 + magnify} />
            </feComponentTransfer>
            <feSpecularLighting
              in="SourceAlpha"
              surfaceScale={bevelDepth * 5}
              specularConstant={specular}
              specularExponent="60"
              lightingColor="#ffffff"
              result="highlightRaw"
            >
              <fePointLight x="50" y="-50" z="100" />
            </feSpecularLighting>
            <feColorMatrix
              in="highlightRaw"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.35 0"
              result="highlight"
            />
            <feDropShadow
              dx="0"
              dy={shadowOffset}
              stdDeviation={shadowOffset * 0.8}
              floodOpacity="0.25"
              result="shadow"
            />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="magnified" />
              <feMergeNode in="highlight" />
            </feMerge>
          </filter>

          {lensDataUrl && (
            <filter
              id={lensFilterId}
              x="0"
              y="0"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
              filterUnits="userSpaceOnUse"
            >
              <feImage href={lensDataUrl} preserveAspectRatio="none" result="lensMap" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="lensMap"
                scale={lensScale}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          )}
        </defs>
      </svg>

      {!isStaticRenderer && lensDataUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            zIndex: 0,
            backdropFilter: `blur(${blur * 0.25}px) url(#${lensFilterId}) contrast(1.1) brightness(1) saturate(1.05)`,
            WebkitBackdropFilter: `blur(${blur * 0.25}px) url(#${lensFilterId}) contrast(1.1) brightness(1) saturate(1.05)`,
            boxShadow: "0 4px 8px rgba(0,0,0,0.25), 0 -10px 25px inset rgba(0,0,0,0.15)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          zIndex: 1,
          backdropFilter: isStaticRenderer
            ? `blur(${blur}px) saturate(${saturation}%)`
            : `blur(${blur}px) saturate(${saturation}%) url(#${filterId})`,
          WebkitBackdropFilter: isStaticRenderer
            ? `blur(${blur}px) saturate(${saturation}%)`
            : `blur(${blur}px) saturate(${saturation}%) url(#${filterId})`,
          boxShadow: [
            `inset 0 ${bevelDepth * 2}px ${bevelWidth * 10}px rgba(255,255,255,0.22)`,
            `inset 0 0 0 1px rgba(255,255,255,${Math.max(0, Math.min(1, specular * 0.22))})`,
            `inset 0 0 0 ${Math.max(0, edgeHighlight * 2)}px rgba(255,255,255,${edgeHighlight * 0.12})`,
          ].join(","),
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background: tintColor,
          opacity: tintOpacity,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 3 }}>{children}</div>
    </div>
  );
}

export function LiquidGlass({
  glassMode = "liquid",
  blur = 20,
  saturation = 160,
  tintColor = "#ffffff",
  tintOpacity = 0.08,
  glassTint = "rgba(255,255,255,0.15)",
  edgeHighlight = 0.85,
  refraction = 60,
  cornerRadius = 24,
  shadowOpacity = 0,
  shadowSize = 24,
  bevelDepth = 0.5,
  bevelWidth = 0.5,
  magnify = 0,
  shadowOffset = 10,
  specularIntensity = 1,
  rainbowIntensity = 0.5,
  style,
  children,
}) {
  const isStaticRenderer = false;
  const blurPx = blur;
  const shadow =
    shadowOpacity > 0 ? `0 ${shadowSize * 0.15}px ${shadowSize}px rgba(0,0,0,${shadowOpacity})` : undefined;

  const outerStyle = {
    position: "relative",
    overflow: "hidden",
    borderRadius: cornerRadius,
    boxShadow: shadow,
    ...style,
  };

  if (glassMode === "liquid") {
    return (
      <div
        style={{
          ...outerStyle,
          background: glassTint,
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
          boxShadow: shadow ? `${LIQUID_GLASS_SHADOW}, ${shadow}` : LIQUID_GLASS_SHADOW,
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    );
  }

  if (glassMode === "lowres") {
    return (
      <div style={outerStyle}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: `blur(${blurPx}px)`,
            WebkitBackdropFilter: `blur(${blurPx}px)`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: tintColor, opacity: tintOpacity }} />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    );
  }

  if (glassMode === "css") {
    return (
      <AdvancedGlassOverlay
        blur={blurPx}
        bevelDepth={bevelDepth}
        bevelWidth={bevelWidth}
        edgeHighlight={edgeHighlight}
        isStaticRenderer={isStaticRenderer}
        magnify={magnify}
        shadowOffset={shadowOffset}
        specular={specularIntensity}
        rainbow={rainbowIntensity}
        refraction={refraction}
        radius={cornerRadius}
        saturation={saturation}
        tintColor={tintColor}
        tintOpacity={tintOpacity}
        style={outerStyle}
      >
        {children}
      </AdvancedGlassOverlay>
    );
  }

  return null;
}

export default LiquidGlass;
