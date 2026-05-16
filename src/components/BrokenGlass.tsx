import { motion } from 'framer-motion';

interface Shard {
  id: number;
  x: number;
  y: number;
  rotation: number;
  spin: number;
  size: number;
  polygon: string;
}

function seededValue(seed: string | number, offset: number) {
  let hash = 0;
  const input = `${seed}-${offset}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (Math.sin(hash) + 1) / 2;
}

export const BrokenGlass = ({ x, y, width = 100, color }: { x: number, y: number, width?: number, color: string }) => {
  const shardSeed = `${x}-${y}-${width}-${color}`;
  const shards: Shard[] = Array.from({ length: 15 }).map((_, i) => {
    const angle = seededValue(shardSeed, i) * Math.PI * 2;
    const speed = seededValue(shardSeed, i + 100) * 80 + 20;
    const size = seededValue(shardSeed, i + 200) * 20 + 10;

    return {
      id: i,
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
      rotation: seededValue(shardSeed, i + 300) * 360,
      spin: (seededValue(shardSeed, i + 400) - 0.5) * 720,
      size,
      polygon: [
        [seededValue(shardSeed, i + 500) * size, 0],
        [size, seededValue(shardSeed, i + 600) * size],
        [seededValue(shardSeed, i + 700) * size, size],
        [0, seededValue(shardSeed, i + 800) * size]
      ].map(point => `${point[0]}px ${point[1]}px`).join(', ')
    };
  });

  return (
    <div style={{ position: 'absolute', left: x - width/2, top: y - width/2, width, height: width }} className="pointer-events-none z-10">
      {/* Liquid spill */}
      <motion.div 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: 0.6 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[100%] blur-sm"
        style={{ width: width * 1.5, height: width * 0.4, backgroundColor: color }}
      />
      
      {/* Shards */}
      {shards.map(shard => (
        <motion.div
          key={shard.id}
          initial={{ x: 0, y: 0, rotate: shard.rotation, opacity: 1 }}
          animate={{ 
            x: shard.x, 
            y: Math.abs(shard.y) + 30, // Gravity pull
            rotate: shard.rotation + shard.spin,
            opacity: 0
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/40 border border-white/60 shadow-sm backdrop-blur-sm"
          style={{
            width: shard.size,
            height: shard.size,
            clipPath: `polygon(${shard.polygon})`
          }}
        />
      ))}
    </div>
  );
};
