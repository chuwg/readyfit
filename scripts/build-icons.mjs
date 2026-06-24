import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');

const MINT = '#00D4AA';
const DARK = '#0B0F14';

// 레디핏(ReadyFit) 글자 'R'을 사각형 + 대각 다리로 구성 (폰트 의존 없이 렌더 안정).
// 스템 + 상단바 + 보울 우측 + 중간바 = 보울, 그 아래 대각선 다리.
const rGlyph = (m = MINT) => `
  <rect x="322" y="220" width="120" height="584" rx="22" fill="${m}"/>
  <rect x="322" y="220" width="318" height="118" rx="22" fill="${m}"/>
  <rect x="520" y="232" width="120" height="248" rx="22" fill="${m}"/>
  <rect x="322" y="430" width="318" height="116" rx="22" fill="${m}"/>
  <polygon points="520,486 640,486 716,804 596,804" fill="${m}"/>
`;

// 레디핏 메인 아이콘: 다크 그라디언트 배경 + 민트 'R' + 심박파형
const fullIconSvg = (size = 1024) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0F14"/>
      <stop offset="100%" stop-color="#1C242F"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${rGlyph()}
  <!-- 심박파형 -->
  <polyline
    points="180,872 322,872 362,812 412,932 462,792 512,902 562,872 844,872"
    stroke="${MINT}"
    stroke-width="14"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    opacity="0.55"
  />
</svg>
`;

// Android adaptive icon foreground: 안전영역 고려해 중앙 ~66% 영역에 'R' 심볼만
const adaptiveForegroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(60, -30) scale(0.86)">
    ${rGlyph()}
  </g>
</svg>
`;

// 스플래시: 메인 아이콘과 동일 (크게 표시)
const splashIconSvg = fullIconSvg(1024);

// 파비콘: 작은 사이즈에 단순화한 'R'
const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="${DARK}"/>
  <rect x="80" y="55" width="30" height="146" rx="6" fill="${MINT}"/>
  <rect x="80" y="55" width="80" height="30" rx="6" fill="${MINT}"/>
  <rect x="130" y="58" width="30" height="62" rx="6" fill="${MINT}"/>
  <rect x="80" y="108" width="80" height="29" rx="6" fill="${MINT}"/>
  <polygon points="130,122 160,122 179,201 149,201" fill="${MINT}"/>
</svg>
`;

async function svgToPng(svg, outPath, size) {
  const buffer = Buffer.from(svg);
  await sharp(buffer).resize(size, size).png().toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size})`);
}

async function main() {
  await svgToPng(fullIconSvg(), join(ASSETS, 'icon.png'), 1024);
  await svgToPng(adaptiveForegroundSvg, join(ASSETS, 'adaptive-icon.png'), 1024);
  await svgToPng(splashIconSvg, join(ASSETS, 'splash-icon.png'), 1024);
  await svgToPng(faviconSvg, join(ASSETS, 'favicon.png'), 48);
  console.log('\n✅ All icons generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
