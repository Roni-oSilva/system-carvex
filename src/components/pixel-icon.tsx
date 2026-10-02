// Ícones pixel art 16×16 desenhados em texto. '.' = transparente.
const PAL: Record<string, string> = {
  k: "#000000", w: "#ffffff", g: "#808080", l: "#c0c0c0", d: "#404040", b: "#0000a8", c: "#00c8c8",
  y: "#ffd800", r: "#c00000", n: "#008000", o: "#e87800", s: "#ffa8a8", p: "#a000a0",
};

const ICONS = {
  dashboard: [
    "................", "..kkkkkkkkkkkk..", "..kllllllllllk..", "..klbbbbbbbblk..", "..klbccccbbblk..", "..klbbbbbbbblk..",
    "..klbcccbbbblk..", "..klbbbbbbbblk..", "..kllllllllllk..", "..kkkkkkkkkkkk..", ".....kllllk.....", "..kkkkkkkkkkkk..",
    ".kllllllllllllk.", ".klllllllllgnlk.", ".kkkkkkkkkkkkkk.", "................",
  ],
  globe: [
    "................", "....kkkkkkkk....", "..kkbbnnnbbbkk..", ".kbbnnnnbbbbbbk.", ".kbnnnnnbbbnnbk.", "kbbnnnnbbbbnnnbk",
    "kbbbnnbbbbbnnnbk", "kbbbbbbbbbbbnbbk", "kbbbbnnbbbbbbbbk", "kbbbnnnnbbbbbbbk", "kbbbnnnnbbbbnbbk", ".kbbbnnbbbbnnbk.",
    ".kbbbbbbbbbnbbk.", "..kkbbbbbbbbkk..", "....kkkkkkkk....", "................",
  ],
  folder: [
    "................", "................", ".kkkkkk.........", ".kyyyyyk........", ".kyyyyyykkkkkkk.", ".kywwwwwyyyyyyk.",
    ".kywyyyyyyyyyyk.", ".kyyyyyyyyyyyyk.", ".kyyyyyyyyyyyyk.", ".kyyyyyyyyyyyyk.", ".kyyyyyyyyyyyok.", ".kyyyyyyyyyyook.",
    ".kooooooooooook.", ".kkkkkkkkkkkkkk.", "................", "................",
  ],
  users: [
    "................", "...kkkk...kkkk..", "..kssssk.kssssk.", "..kssssk.kssssk.", "..kssssk.kssssk.", "...kkkk...kkkk..",
    "..kbbbbk.kppppk.", ".kbbbbbbkkppppck", ".kbbbbbbkkpppppk", ".kbbbbbbk.kppppk.", ".kbbbbbbk.kppppk.", ".kkkkkkkk.kkkkkk.",
    "................", "................", "................", "................",
  ],
  note: [
    "................", "..k.k.k.k.k.k...", ".kkkkkkkkkkkkk..", ".kwwwwwwwwwwwk..", ".kwbbbbbbbwwwk..", ".kwwwwwwwwwwwk..",
    ".kwbbbbbbbbbwk..", ".kwwwwwwwwwwwk..", ".kwbbbbbbwwwwk..", ".kwwwwwwwwwwwk..", ".kwbbbbbbbbwwk..", ".kwwwwwwwwwwwk..",
    ".kkkkkkkkkkkkk..", "................", "................", "................",
  ],
  bag: [
    "................", ".....kkkkkk.....", "....k......k....", "....k......k....", "..kkkkkkkkkkkk..", "..krrrrrrrrrrk..",
    "..krrrrrrrrrrk..", "..krrrrwwrrrrk..", "..krrrwrrrrrrk..", "..krrrrwwrrrrk..", "..krrrrrrwrrrk..", "..krrrwwwrrrrk..",
    "..krrrrrrrrrrk..", "..kkkkkkkkkkkk..", "................", "................",
  ],
  window: [
    "................", ".kkkkkkkkkkkkkk.", ".kbbbbbbbbbblkk.", ".kbbbbbbbbbbllk.", ".kkkkkkkkkkkkkk.", ".kllllllllllllk.",
    ".klwwwwwwwwwwlk.", ".klwcccwwwwwwlk.", ".klwwwwwwwwwwlk.", ".klwcccccwwwwlk.", ".klwwwwwwwwwwlk.", ".kllllllllllllk.",
    ".kkkkkkkkkkkkkk.", "................", "................", "................",
  ],
  money: [
    "................", "................", ".kkkkkkkkkkkkkk.", ".knnnnnnnnnnnnk.", ".knnnnnwwnnnnnk.", ".knnwnwwwwwnwnk.",
    ".knnnnwnwnnnnnk.", ".knnnnwwwwwnnnk.", ".knnnnnnwnwnnnk.", ".knnwnwwwwwnwnk.", ".knnnnnwwnnnnnk.", ".knnnnnnnnnnnnk.",
    ".kkkkkkkkkkkkkk.", "................", "................", "................",
  ],
  gear: [
    "................", "......kkkk......", "...k..klllk..k..", "..klk.kllllk.kk.", "..kllkkllllkklk.", "...kllllllllllk.",
    "..kkllkkkkllkkk.", ".kllllk..kllllk.", ".kllllk..kllllk.", "..kkllkkkkllkkk.", "...kllllllllllk.", "..kllkkllllkklk.",
    "..klk.kllllk.kk.", "...k..klllk..k..", "......kkkk......", "................",
  ],
  robot: [
    "................", ".......k........", ".......r........", "..kkkkkkkkkkkk..", "..kllllllllllk..", "..klccllllcclk..",
    "..klccllllcclk..", "..kllllllllllk..", "..klkkkkkkkklk..", "..kllllllllllk..", "..kkkkkkkkkkkk..", "...kkllllllkk...",
    "...kllllllllk...", "...kkkkkkkkkk...", "................", "................",
  ],
  chart: [
    "................", "..k.............", "..k.........rr..", "..k.........rr..", "..k....bb...rr..", "..k....bb...rr..",
    "..k....bb.nnrr..", "..k.yy.bb.nnrr..", "..k.yy.bb.nnrr..", "..k.yy.bb.nnrr..", "..k.yy.bb.nnrr..", "..kkkkkkkkkkkkk.",
    "................", "................", "................", "................",
  ],
  sliders: [
    "................", "................", ".kkkkkkkkkkkkkk.", ".......kk.......", "......kllk......", ".kkkkkkllkkkkkk.",
    "................", ".kkkkkkkkkkkkkk.", ".kkkkk..........", ".kkkkkkkkkkkkkk.", ".....kllk.......", ".....kllk.......", ".kkkkkkkkkkkkkk.",
    "................", "................", "................",
  ],
  bell: [
    "................", ".......kk.......", "......kyyk......", ".....kyyyyk.....", ".....kywyyk.....", "....kywyyyyk....",
    "....kywyyyyk....", "...kywyyyyyyk...", "...kywyyyyyok...", "..kyyyyyyyyyok..", "..kkkkkkkkkkkk..", "......kooko.....",
    ".......kk.......", "................", "................", "................",
  ],
  start: [
    "................", "................", "...krrrk.knnnk..", "..krrrrk.knnnnk.", "..krrrrk.knnnnk.", "..krrrk..knnnk..",
    "................", "..kbbbk..kyyyk..", ".kbbbbk.kyyyyk..", ".kbbbbk.kyyyyk..", "..kbbbk..kyyk...", "................",
    "................", "................", "................", "................",
  ],
  lock: [
    "................", "....kkkkkkk.....", "...kgggggggk....", "...kg.....gk....", "...kg.....gk....", "..kkkkkkkkkkk...",
    "..kyyyyyyyyyk...", "..kyyyykyyyyk...", "..kyyyykyyyyk...", "..kyyyyyyyyyk...", "..kkkkkkkkkkk...", "................",
    "................", "................", "................", "................",
  ],
} as const;

export type IconName = keyof typeof ICONS;

export function PixelIcon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const rects: React.ReactNode[] = [];
  ICONS[name].forEach((row, y) => {
    const r = row.padEnd(16, ".").slice(0, 16);
    let x = 0;
    while (x < 16) {
      const ch = r[x]!;
      let e = x;
      while (e < 16 && r[e] === ch) e++;
      if (ch !== "." && PAL[ch]) rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={e - x} height={1} fill={PAL[ch]} />);
      x = e;
    }
  });
  return <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className}>{rects}</svg>;
}
