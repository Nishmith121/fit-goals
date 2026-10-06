import React, { useId } from 'react';
import './Dog.css';

export const MOOD_LABEL = {
  happy: 'Happy',
  okay: 'Okay',
  hungry: 'Hungry',
  sick: 'Sick',
  dead: 'Passed out'
};

const STAGE_SCALE = [0.76, 0.87, 0.98, 1.06];

// A golden retriever puppy, shaded with gradients and fur strokes.
// Mood drives the pose, face and motion:
//   happy  - sits up, jumps, flaps its ears and plays with a ball
//   okay   - sits calmly, wags, blinks
//   hungry - sits and keeps looking at the bowl
//   sick   - lies down with its chin on its paws, sad eyes, then dozes off
//   dead   - fast asleep and unwell (worst day)
export default function Dog({ mood = 'okay', stageIndex = 0, fed = false, showBowl = true }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name) => `${name}-${uid}`;
  const url = (name) => `url(#${id(name)})`;

  const scale = STAGE_SCALE[Math.min(stageIndex, STAGE_SCALE.length - 1)];
  const collar = stageIndex >= 3 ? '#c9a13f' : '#b8423c';
  const line = { stroke: '#7a4a1c', strokeWidth: 1.1, strokeLinejoin: 'round', strokeLinecap: 'round', strokeOpacity: 0.75 };
  const lying = mood === 'sick' || mood === 'dead';
  const sad = mood === 'sick' || mood === 'hungry';
  const eyesOpen = mood === 'happy' || mood === 'okay' || mood === 'hungry';
  const lookDown = mood === 'hungry' || mood === 'sick';

  const Eye = ({ cx }) => (
    <g>
      <ellipse cx={cx} cy="75" rx="7.6" ry="6.8" fill="#1a110b" />
      <circle cx={cx} cy={lookDown ? 76.2 : 75} r="5.4" fill={url('iris')} />
      <circle cx={cx} cy={lookDown ? 76.6 : 75} r="3" fill="#0b0705" />
      <circle cx={cx + 2} cy={lookDown ? 74.6 : 72.8} r="1.7" fill="#ffffff" />
      <circle cx={cx - 2.2} cy={lookDown ? 78 : 77} r="0.8" fill="rgba(255,255,255,0.7)" />
      {/* upper lid */}
      <path d={`M${cx - 8} 73 Q${cx} ${mood === 'happy' ? 65.5 : 66.5} ${cx + 8} 73`} fill="none" stroke="#5a3513" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );

  return (
    <svg
      className={`dog-svg dog-${mood}`}
      viewBox={showBowl ? '0 0 264 232' : '10 14 220 218'}
      role="img"
      aria-label={`Dog, ${MOOD_LABEL[mood] || mood}`}
    >
      <defs>
        <radialGradient id={id('body')} cx="50%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#f2c36f" />
          <stop offset="55%" stopColor="#dd9a43" />
          <stop offset="100%" stopColor="#b9752a" />
        </radialGradient>
        <radialGradient id={id('head')} cx="50%" cy="38%" r="68%">
          <stop offset="0%" stopColor="#f7d08a" />
          <stop offset="60%" stopColor="#e2a04a" />
          <stop offset="100%" stopColor="#c07c2f" />
        </radialGradient>
        <linearGradient id={id('ear')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cf8a38" />
          <stop offset="100%" stopColor="#9c5d1d" />
        </linearGradient>
        <radialGradient id={id('muzzle')} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff3dc" />
          <stop offset="100%" stopColor="#f0cf94" />
        </radialGradient>
        <linearGradient id={id('chest')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbe6b8" />
          <stop offset="100%" stopColor="#efc47a" />
        </linearGradient>
        <linearGradient id={id('leg')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d9963f" />
          <stop offset="50%" stopColor="#f0bd68" />
          <stop offset="100%" stopColor="#d18d38" />
        </linearGradient>
        <radialGradient id={id('nose')} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#5a4740" />
          <stop offset="100%" stopColor="#120d0b" />
        </radialGradient>
        <radialGradient id={id('iris')} cx="50%" cy="65%" r="70%">
          <stop offset="0%" stopColor="#a66a2c" />
          <stop offset="100%" stopColor="#3a210e" />
        </radialGradient>
        <linearGradient id={id('tongue')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9788a" />
          <stop offset="100%" stopColor="#f6a3ae" />
        </linearGradient>
        <radialGradient id={id('shadow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <ellipse className="dog-shadow" cx={lying ? 112 : 120} cy="212" rx={(lying ? 98 : 78) * scale} ry="10" fill={url('shadow')} />

      <g transform={`translate(120 210) scale(${scale}) translate(-120 -210)`}>
        <g className="dog-tint">
          <g className="dog-all">
            {lying && (
              <g>
                {/* tail resting on the ground */}
                <g className="dog-tail">
                  <path d="M54 197 C40 187 20 189 11 202 C22 210 40 211 58 208 Z" fill={url('ear')} {...line} />
                  <g fill="none" stroke="#f1c377" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
                    <path d="M24 198 q8 1 14 6" />
                    <path d="M36 194 q8 2 12 8" />
                  </g>
                </g>
                {/* curled-up body */}
                <g className="dog-body">
                  <path d="M46 208 C38 176 64 148 112 148 C152 148 178 170 180 208 Z" fill={url('body')} {...line} />
                  <g fill="none" stroke="#a5661f" strokeWidth="1.3" strokeLinecap="round" opacity="0.45">
                    <path d="M70 170 q-5 8 -6 18" />
                    <path d="M84 160 q-4 8 -5 16" />
                    <path d="M100 154 q-3 7 -3 14" />
                  </g>
                  {/* haunch */}
                  <ellipse cx="68" cy="186" rx="26" ry="22" fill={url('body')} {...line} />
                </g>
                <ellipse cx="52" cy="205" rx="17" ry="6.5" fill={url('leg')} {...line} />
                <g fill="none" stroke="#7a4a1c" strokeWidth="1.1" strokeLinecap="round" opacity="0.7">
                  <path d="M44 203 q-1 4 0 6 M51 202 q-1 5 0 7" />
                </g>
                {/* front paws stretched out, the chin rests on them */}
                <ellipse cx="108" cy="205" rx="18" ry="7.5" fill="#f6d79a" {...line} />
                <ellipse cx="164" cy="205" rx="18" ry="7.5" fill="#f6d79a" {...line} />
                <g fill="none" stroke="#7a4a1c" strokeWidth="1.2" strokeLinecap="round" opacity="0.8">
                  <path d="M100 203 q1 4 0 7 M106 202 q1 5 0 8" />
                  <path d="M172 203 q-1 4 0 7 M166 202 q-1 5 0 8" />
                </g>
              </g>
            )}

            {!lying && (
              <g>
            {/* tail: feathered plume */}
            <g className="dog-tail">
              <path
                d="M84 190 C66 178 40 175 22 185 C13 190 11 198 15 203 C19 198 23 198 26 204 C31 198 36 199 38 206 C44 199 50 201 53 207 C61 201 71 203 86 207 Z"
                fill={url('ear')}
                {...line}
              />
              <g fill="none" stroke="#f1c377" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
                <path d="M34 188 q10 2 16 10" />
                <path d="M48 184 q10 3 16 12" />
                <path d="M62 184 q8 4 12 12" />
              </g>
            </g>

            {/* haunches and hind paws */}
            <ellipse cx="73" cy="186" rx="21" ry="25" fill={url('body')} {...line} />
            <ellipse cx="167" cy="186" rx="21" ry="25" fill={url('body')} {...line} />
            <ellipse cx="72" cy="205" rx="20" ry="8.5" fill={url('leg')} {...line} />
            <ellipse cx="168" cy="205" rx="20" ry="8.5" fill={url('leg')} {...line} />
            <g fill="none" stroke="#7a4a1c" strokeWidth="1.1" strokeLinecap="round" opacity="0.7">
              <path d="M62 203 q1 4 0 7 M70 202 q1 5 0 8" />
              <path d="M178 203 q-1 4 0 7 M170 202 q-1 5 0 8" />
            </g>

            {/* torso */}
            <g className="dog-body">
              <path
                d="M88 116 C72 132 64 160 65 186 C65 198 69 205 77 208 L163 208 C171 205 175 198 175 186 C176 160 168 132 152 116 Z"
                fill={url('body')}
                {...line}
              />
              <g fill="none" stroke="#a5661f" strokeWidth="1.3" strokeLinecap="round" opacity="0.45">
                <path d="M76 150 q4 8 2 18" />
                <path d="M82 134 q4 7 3 15" />
                <path d="M72 170 q3 8 1 16" />
                <path d="M164 150 q-4 8 -2 18" />
                <path d="M158 134 q-4 7 -3 15" />
                <path d="M168 170 q-3 8 -1 16" />
              </g>
            </g>

            {/* front legs */}
            <g className="dog-flegs">
            <path d="M96 148 Q92 178 94 198 Q94 209 106 209 Q118 209 118 198 Q119 178 117 148 Z" fill={url('leg')} />
            <path d="M123 148 Q121 178 122 198 Q122 209 134 209 Q146 209 146 198 Q148 178 144 148 Z" fill={url('leg')} />
            <g fill="none" {...line}>
              <path d="M94 166 Q93 184 94 198 Q94 209 106 209 Q118 209 118 198 Q119 186 118 172" />
              <path d="M122 172 Q121 186 122 198 Q122 209 134 209 Q146 209 146 198 Q147 184 146 166" />
            </g>
            {/* paws */}
            <ellipse cx="106" cy="205" rx="14.5" ry="7.5" fill="#f6d79a" {...line} />
            <ellipse cx="134" cy="205" rx="14.5" ry="7.5" fill="#f6d79a" {...line} />
            <g fill="none" stroke="#7a4a1c" strokeWidth="1.2" strokeLinecap="round" opacity="0.8">
              <path d="M101 203 q1 4 0 7 M106 202 q1 5 0 8 M111 203 q1 4 0 7" />
              <path d="M129 203 q1 4 0 7 M134 202 q1 5 0 8 M139 203 q1 4 0 7" />
            </g>

            </g>

            {/* chest ruff */}
            <path
              d="M96 120 C90 138 92 154 99 167 L103 158 L108 173 L114 160 L120 180 L126 160 L132 173 L137 158 L141 167 C148 154 150 138 144 120 C134 130 106 130 96 120 Z"
              fill={url('chest')}
            />
            <g fill="none" stroke="#d9a650" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
              <path d="M108 134 q2 12 0 22" />
              <path d="M120 136 q1 14 0 26" />
              <path d="M132 134 q-2 12 0 22" />
              <path d="M114 132 q2 10 1 18" />
              <path d="M126 132 q-2 10 -1 18" />
            </g>

              </g>
            )}

            {/* head (lowered onto the paws when lying) */}
            <g transform={lying ? 'translate(16 74) rotate(-5 120 130)' : undefined}>
            <g className="dog-head">
              <g className="dog-ear dog-ear-l">
                <path
                  d="M92 50 C75 50 63 62 59 82 C56 100 58 116 64 126 C66 131 70 129 72 124 C74 129 78 128 80 122 C83 126 87 122 87 116 C90 100 93 78 97 58 Z"
                  fill={url('ear')}
                  {...line}
                />
                <g fill="none" stroke="#e0a352" strokeWidth="1.2" strokeLinecap="round" opacity="0.55">
                  <path d="M72 72 q-4 18 -2 38" />
                  <path d="M80 70 q-3 18 -1 36" />
                </g>
              </g>
              <g className="dog-ear dog-ear-r">
                <path
                  d="M148 50 C165 50 177 62 181 82 C184 100 182 116 176 126 C174 131 170 129 168 124 C166 129 162 128 160 122 C157 126 153 122 153 116 C150 100 147 78 143 58 Z"
                  fill={url('ear')}
                  {...line}
                />
                <g fill="none" stroke="#e0a352" strokeWidth="1.2" strokeLinecap="round" opacity="0.55">
                  <path d="M168 72 q4 18 2 38" />
                  <path d="M160 70 q3 18 1 36" />
                </g>
              </g>

              {/* skull with cheek fur */}
              <path
                d="M120 36 C100 36 84 48 80 68 C78 78 79 88 83 96 L76 103 L86 103 L82 112 L93 109 C96 114 99 117 102 120 C108 127 114 130 120 130 C126 130 132 127 138 120 C141 117 144 114 147 109 L158 112 L154 103 L164 103 L157 96 C161 88 162 78 160 68 C156 48 140 36 120 36 Z"
                fill={url('head')}
                {...line}
              />
              {/* crown tuft */}
              <path d="M109 39 Q111 29 117 35 Q121 26 125 34 Q131 30 131 39 Z" fill="#eab25c" {...line} />
              <path d="M110 40 Q120 37 130 40" fill="none" stroke="#efba66" strokeWidth="5" strokeLinecap="round" />
              {/* light blaze down the nose bridge and brow highlights */}
              <ellipse cx="120" cy="70" rx="8" ry="17" fill="#fbe2ae" opacity="0.45" />
              <ellipse cx="103" cy="64" rx="8" ry="4" fill="#fbe2ae" opacity="0.35" />
              <ellipse cx="137" cy="64" rx="8" ry="4" fill="#fbe2ae" opacity="0.35" />
              <g fill="none" stroke="#b06f25" strokeWidth="1.2" strokeLinecap="round" opacity="0.4">
                <path d="M92 60 q-4 8 -4 18" />
                <path d="M148 60 q4 8 4 18" />
                <path d="M104 46 q-3 5 -4 10" />
                <path d="M136 46 q3 5 4 10" />
              </g>

              {!lying && (
                <g>
              {/* collar */}
              <path d="M95 123 Q120 138 145 123 L145 131 Q120 146 95 131 Z" fill={collar} {...line} />
              <circle cx="120" cy="141" r="5.2" fill="#e9c75f" {...line} />
              <circle cx="118.6" cy="139.6" r="1.4" fill="rgba(255,255,255,0.7)" />
                </g>
              )}

              {/* muzzle */}
              <path
                d="M120 84 C108 84 99 94 99 106 C99 118 108 127 120 127 C132 127 141 118 141 106 C141 94 132 84 120 84 Z"
                fill={url('muzzle')}
              />
              <g fill="#b98a55" opacity="0.6">
                <circle cx="108" cy="104" r="0.9" /><circle cx="112" cy="108" r="0.9" /><circle cx="106" cy="109" r="0.9" />
                <circle cx="132" cy="104" r="0.9" /><circle cx="128" cy="108" r="0.9" /><circle cx="134" cy="109" r="0.9" />
              </g>

              {/* nose */}
              <path d="M109 90 C109 85.5 114 83.5 120 83.5 C126 83.5 131 85.5 131 90 C131 96.5 125.5 100.5 120 100.5 C114.5 100.5 109 96.5 109 90 Z" fill={url('nose')} />
              <ellipse cx="115.5" cy="93" rx="2.2" ry="1.6" fill="#050302" />
              <ellipse cx="124.5" cy="93" rx="2.2" ry="1.6" fill="#050302" />
              <ellipse cx="117" cy="87" rx="4.5" ry="1.8" fill="rgba(255,255,255,0.35)" />

              {/* eyes */}
              {eyesOpen && (
                <g className={`dog-eyes ${mood === 'happy' ? '' : 'dog-blink'}`}>
                  <Eye cx={103} />
                  <Eye cx={137} />
                </g>
              )}
              {mood === 'sick' && (
                <g>
                  {/* awake but miserable: heavy lids, a tear */}
                  <g className="dog-eyes-awake">
                    <Eye cx={103} />
                    <Eye cx={137} />
                    <g fill="#e2a04a" stroke="#5a3513" strokeWidth="1.4" strokeLinejoin="round">
                      <path d="M94.5 76 A8.5 8 0 0 1 111.5 76 Z" />
                      <path d="M128.5 76 A8.5 8 0 0 1 145.5 76 Z" />
                    </g>
                    <path className="dog-tear dog-tear-l" d="M101 83 q5 9 0 12 q-5 -3 0 -12 z" fill="#8fd0f5" />
                  </g>
                  {/* dozing off */}
                  <g className="dog-eyes-asleep" fill="none" stroke="#2a1a0f" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M96 75 q7 6 14 0" />
                    <path d="M130 75 q7 6 14 0" />
                  </g>
                </g>
              )}
              {mood === 'dead' && (
                <g fill="none" stroke="#2a1a0f" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M96 75 q7 6 14 0" />
                  <path d="M130 75 q7 6 14 0" />
                </g>
              )}

              {/* worried brows */}
              {sad && (
                <g fill="none" stroke="#8a5622" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M94 65 q7 -6 15 -5" />
                  <path d="M146 65 q-7 -6 -15 -5" />
                </g>
              )}

              {/* mouth */}
              {mood === 'happy' ? (
                <g>
                  <path d="M103 105 C107 125 133 125 137 105 C128 111 112 111 103 105 Z" fill="#4a1d1a" stroke="#2a1410" strokeWidth="1" />
                  <g className="dog-tongue">
                    <path d="M111 111 C110 131 130 131 129 111 C124 108 116 108 111 111 Z" fill={url('tongue')} />
                    <path d="M120 112 v12" stroke="#d2647a" strokeWidth="1.4" strokeLinecap="round" />
                  </g>
                  <path d="M120 100.5 V105 M120 105 C116 109 108 109 103 105 M120 105 C124 109 132 109 137 105" fill="none" stroke="#2a1a0f" strokeWidth="1.8" strokeLinecap="round" />
                </g>
              ) : (
                <g fill="none" stroke="#2a1a0f" strokeWidth="1.9" strokeLinecap="round">
                  <path d="M120 100.5 V106" />
                  {mood === 'okay' && <path d="M120 106 C116 112 109 112 106 107 M120 106 C124 112 131 112 134 107" />}
                  {mood === 'hungry' && <path d="M120 106 C116 109 110 110 106 113 M120 106 C124 109 130 110 134 113" />}
                  {mood === 'sick' && <path d="M120 106 C116 108 110 110 105 115 M120 106 C124 108 130 110 135 115" />}
                  {mood === 'dead' && <path d="M107 109 Q120 105 133 109" />}
                </g>
              )}
            </g>
            </g>
          </g>
        </g>

        {/* sleep marks while the dog is lying down */}
        {lying && (
          <g className="dog-zzz" fill="#cfd6e4" fontFamily="Outfit, sans-serif" fontWeight="800">
            <text className="dog-z dog-z-1" x="186" y="112" fontSize="13">z</text>
            <text className="dog-z dog-z-2" x="197" y="94" fontSize="17">z</text>
            <text className="dog-z dog-z-3" x="210" y="72" fontSize="22">Z</text>
          </g>
        )}
      </g>

      {/* bowl */}
      {showBowl && (
        <g className="dog-bowl">
          <path d="M202 192 h52 l-7 16 h-38 z" fill="#3a3e48" />
          <ellipse cx="228" cy="192" rx="26" ry="6" fill="#4a4f5b" />
          {fed ? (
            <path d="M208 192 q20 -17 40 0 z" fill="#9c6a3a" />
          ) : (
            <ellipse cx="228" cy="192" rx="19" ry="3.5" fill="#23262d" />
          )}
        </g>
      )}

      {/* ball to play with when happy */}
      {mood === 'happy' && (
        <g className="dog-ball">
          <circle cx="28" cy="202" r="10" fill="#cfe24a" stroke="#8a9a22" strokeWidth="1" />
          <path d="M20 196 q8 6 4 14 M36 196 q-8 6 -4 14" fill="none" stroke="#f4f8d2" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}

      {/* hearts when happy */}
      {mood === 'happy' && (
        <g className="dog-hearts" fill="#ef6f86">
          <path className="dog-heart dog-heart-1" d="M40 70 c-6 -8 -18 0 -9 10 l9 8 l9 -8 c9 -10 -3 -18 -9 -10 z" />
          <path className="dog-heart dog-heart-2" d="M204 52 c-4 -6 -13 0 -6 7 l6 6 l6 -6 c7 -7 -2 -13 -6 -7 z" />
        </g>
      )}
    </svg>
  );
}
