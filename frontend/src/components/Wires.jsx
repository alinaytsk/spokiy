// Decorative wireframe: a few dozen contour lines bent into a soft swell, the "terrain"
// motif behind the hero. Purely visual, hidden from screen readers, computed once.

const WIDTH = 800;
const LINES = 30;

function contour(i) {
  const points = [];
  for (let x = 0; x <= WIDTH; x += 10) {
    const swell = Math.exp(-(((x - 430) / 230) ** 2));
    const y =
      110 +
      i * 4.2 +
      58 * swell * Math.sin(x / 110 + i * 0.16) +
      9 * Math.sin(x / 38 + i * 0.45) * swell;
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M${points.join(' L')}`;
}

const PATHS = Array.from({ length: LINES }, (_, i) => contour(i));

export function Wires({ className = 'wires' }) {
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} 300`} aria-hidden="true" focusable="false">
      {PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default Wires;
