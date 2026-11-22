import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimecode,
  formatRulerTime,
  getCanvasDimensions,
} from './timecode';
import {
  computeAnimationState,
  computeProjectDuration,
  createDefaultAdjustments,
  createDefaultAnimation,
  createDefaultTransform,
  deleteClipsByIds,
  deleteLeftOfPlayhead,
  deleteRightOfPlayhead,
  generateBeatMarkerTimes,
  getActiveClipsAtTime,
  mergeAdjacentClip,
  snapTime,
  splitClipAtTime,
  trimClipEdge,
} from './timelineOps';
import {
  detachAudioFromClip,
  evaluateKeyframesAtTime,
  parseSrt,
  remapSpeedCurveTime,
  removeKeyframeAt,
  serializeSrt,
  upsertKeyframe,
} from './nleFeatures';
import type { TimelineClip, TimelineTrack } from '../types/editor';

function makeVideoClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip-1',
    trackId: 'track-video-main',
    kind: 'video',
    name: 'Sample.mp4',
    startTime: 0,
    duration: 10,
    trimStart: 0,
    sourceDuration: 20,
    speed: 1,
    transform: createDefaultTransform(),
    adjustments: createDefaultAdjustments(),
    animation: createDefaultAnimation(),
    ...overrides,
  };
}

test('formatTimecode formats hours, minutes, seconds, and frames accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00:00');
  assert.equal(formatTimecode(9 + 4 / 30, 30), '00:00:09:04');
  assert.equal(formatTimecode(65.5, 30), '00:01:05:15');
  assert.equal(formatRulerTime(75), '01:15');
});

test('getCanvasDimensions returns exact resolutions per aspect ratio', () => {
  assert.deepEqual(getCanvasDimensions('16:9', '1080p'), {
    width: 1920,
    height: 1080,
  });
  assert.deepEqual(getCanvasDimensions('9:16', '1080p'), {
    width: 1080,
    height: 1920,
  });
  assert.deepEqual(getCanvasDimensions('1:1', '720p'), {
    width: 720,
    height: 720,
  });
  assert.deepEqual(getCanvasDimensions('16:9', '4k'), {
    width: 3840,
    height: 2160,
  });
  assert.deepEqual(getCanvasDimensions('9:16', '4k'), {
    width: 2160,
    height: 3840,
  });
});

test('splitClipAtTime splits a clip cleanly and preserves trimStart offset', () => {
  const clip = makeVideoClip({ startTime: 2, duration: 10, trimStart: 1, speed: 1.5 });
  let counter = 0;
  const result = splitClipAtTime([clip], 'clip-1', 6, () => `clip-split-${++counter}`);

  assert.equal(result.length, 2);
  assert.equal(result[0].duration, 4);
  assert.equal(result[0].trimStart, 1);
  assert.equal(result[1].startTime, 6);
  assert.equal(result[1].duration, 6);
  assert.equal(result[1].trimStart, 7); // 1 + 4 * 1.5
});

test('splitClipAtTime refuses splits too close to clip edges', () => {
  const clip = makeVideoClip({ startTime: 0, duration: 10 });
  const result = splitClipAtTime([clip], 'clip-1', 0.1, () => 'new-id');
  assert.equal(result.length, 1);
});

test('deleteLeftOfPlayhead and deleteRightOfPlayhead crop clip accurately', () => {
  const clip = makeVideoClip({ startTime: 2, duration: 10, trimStart: 0 });
  const leftTrimmed = deleteLeftOfPlayhead([clip], 'clip-1', 5);
  assert.equal(leftTrimmed[0].startTime, 5);
  assert.equal(leftTrimmed[0].duration, 7);
  assert.equal(leftTrimmed[0].trimStart, 3);

  const rightTrimmed = deleteRightOfPlayhead([clip], 'clip-1', 6);
  assert.equal(rightTrimmed[0].startTime, 2);
  assert.equal(rightTrimmed[0].duration, 4);
});

test('deleteClipsByIds compacts main track when rippleMainTrack is enabled', () => {
  const c1 = makeVideoClip({ id: 'c1', startTime: 0, duration: 5 });
  const c2 = makeVideoClip({ id: 'c2', startTime: 5, duration: 4 });
  const c3 = makeVideoClip({ id: 'c3', startTime: 9, duration: 6 });

  const after = deleteClipsByIds([c1, c2, c3], ['c2'], true, 'track-video-main');
  assert.equal(after.length, 2);
  assert.equal(after[0].startTime, 0);
  assert.equal(after[1].startTime, 5);
});

test('trimClipEdge respects minimum duration and source media bounds', () => {
  const clip = makeVideoClip({ startTime: 4, duration: 6, trimStart: 2, sourceDuration: 12 });
  const shorter = trimClipEdge(clip, 'left', 4);
  assert.equal(shorter.startTime, 8);
  assert.equal(shorter.duration, 2);
  assert.equal(shorter.trimStart, 6);

  const extended = trimClipEdge(clip, 'right', 20);
  assert.equal(extended.duration, 10); // 12 - 2
});

test('snapTime snaps to playhead and neighbor clip edges within threshold', () => {
  const c1 = makeVideoClip({ id: 'c1', startTime: 0, duration: 5 });
  const c2 = makeVideoClip({ id: 'c2', startTime: 8, duration: 4 });
  assert.equal(snapTime(5.12, [c1], 12, 'c2', true, 0.25), 5);
  assert.equal(snapTime(11.9, [c1, c2], 12, 'other', true, 0.25), 12);
  assert.equal(snapTime(5.12, [c1], 12, 'c2', false, 0.25), 5.12);
});

test('computeProjectDuration and getActiveClipsAtTime layer non-hidden tracks properly', () => {
  const tracks: TimelineTrack[] = [
    { id: 't-text', type: 'overlay', label: 'Text', locked: false, hidden: false, muted: false },
    { id: 't-main', type: 'video', label: 'Video', locked: false, hidden: false, muted: false, isMain: true },
  ];
  const video = makeVideoClip({ id: 'v1', trackId: 't-main', startTime: 0, duration: 12 });
  const text = makeVideoClip({
    id: 'txt1',
    trackId: 't-text',
    kind: 'text',
    startTime: 2,
    duration: 4,
  });

  assert.equal(computeProjectDuration([video, text]), 12);
  const activeAt3 = getActiveClipsAtTime(tracks, [video, text], 3);
  assert.equal(activeAt3.length, 2);
  assert.equal(activeAt3[0].id, 'v1'); // main video drawn first
  assert.equal(activeAt3[1].id, 'txt1'); // text drawn on top
});

test('computeAnimationState interpolates fadeIn and zoomIn smoothly', () => {
  const clip = makeVideoClip({
    startTime: 0,
    duration: 4,
    animation: { inPreset: 'zoomIn', inDuration: 1, outPreset: 'none', outDuration: 0 },
  });
  const startState = computeAnimationState(clip, 0);
  const midState = computeAnimationState(clip, 0.5);
  const settledState = computeAnimationState(clip, 2);
  assert.equal(startState.opacityMul, 0);
  assert.ok(midState.opacityMul > 0.5 && midState.opacityMul < 1);
  assert.ok(midState.scaleMul > 0.65 && midState.scaleMul < 1);
  assert.equal(settledState.opacityMul, 1);
  assert.equal(settledState.scaleMul, 1);
});

test('mergeAdjacentClip combines two adjacent clips on the same track into one continuous clip', () => {
  const c1 = makeVideoClip({ id: 'c1', name: 'Intro', startTime: 0, duration: 5 });
  const c2 = makeVideoClip({ id: 'c2', name: 'Outro', startTime: 5, duration: 4 });
  const c3 = makeVideoClip({ id: 'c3', name: 'Tag', startTime: 9, duration: 2 });

  const { clips, mergedId } = mergeAdjacentClip([c1, c2, c3], 'c1');
  assert.equal(mergedId, 'c1');
  assert.equal(clips.length, 2);
  assert.equal(clips[0].duration, 9);
  assert.equal(clips[0].name, 'Intro + Outro');
  assert.equal(clips[1].id, 'c3');
});

test('upsertKeyframe, removeKeyframeAt, and evaluateKeyframesAtTime interpolate transform values', () => {
  let kfs = upsertKeyframe(undefined, 0, { scale: 1, x: 0, y: 0, rotation: 0, opacity: 100 });
  kfs = upsertKeyframe(kfs, 4, { scale: 2, x: 200, y: -100, rotation: 90, opacity: 50 });
  assert.equal(kfs.length, 2);

  const clip = makeVideoClip({ startTime: 2, duration: 8, keyframes: kfs });
  const atStart = evaluateKeyframesAtTime(clip, 2);
  assert.equal(atStart.scale, 1);
  assert.equal(atStart.x, 0);

  const atMid = evaluateKeyframesAtTime(clip, 4); // rel = 2 => t=0.5 => smoothstep=0.5
  assert.equal(atMid.scale, 1.5);
  assert.equal(atMid.x, 100);
  assert.equal(atMid.rotation, 45);
  assert.equal(atMid.opacity, 75);

  const afterRemove = removeKeyframeAt(kfs, 4);
  assert.equal(afterRemove.length, 1);
});

test('remapSpeedCurveTime handles uniform speed, reversed playback, and hero curve', () => {
  const normalClip = makeVideoClip({ duration: 10, trimStart: 2, sourceDuration: 20, speed: 1 });
  assert.equal(remapSpeedCurveTime(normalClip, 3), 5);

  const reversedClip = makeVideoClip({
    duration: 10,
    trimStart: 2,
    sourceDuration: 20,
    speed: 1,
    reversed: true,
  });
  assert.equal(remapSpeedCurveTime(reversedClip, 0), 12);
  assert.equal(remapSpeedCurveTime(reversedClip, 4), 8);

  const heroClip = makeVideoClip({
    duration: 10,
    trimStart: 0,
    sourceDuration: 20,
    speed: 1,
    speedCurve: 'hero',
  });
  const startPos = remapSpeedCurveTime(heroClip, 0);
  const earlyPos = remapSpeedCurveTime(heroClip, 2);
  const latePos = remapSpeedCurveTime(heroClip, 9);
  assert.equal(startPos, 0);
  assert.ok(earlyPos > 2.5); // starts fast (1.8x)
  assert.ok(latePos > earlyPos); // monotonically increases
});

test('detachAudioFromClip extracts synced audio clip and mutes source video', () => {
  const vid = makeVideoClip({ id: 'v1', startTime: 1, duration: 6, speed: 1 });
  const { clips, detachedClipId } = detachAudioFromClip([vid], 'v1', () => 'aud-detached-1');
  assert.equal(detachedClipId, 'aud-detached-1');
  assert.equal(clips.length, 2);
  assert.equal(clips[0].audioDetached, true);
  assert.equal(clips[0].audio?.muted, true);
  assert.equal(clips[1].kind, 'audio');
  assert.equal(clips[1].trackId, 'track-audio-main');
  assert.equal(clips[1].startTime, 1);
  assert.equal(clips[1].duration, 6);
});

test('parseSrt and serializeSrt round-trip subtitle cues accurately', () => {
  const sample = `1\n00:00:01,500 --> 00:00:03,750\nHola KlipFrame\n\n2\n00:00:04,000 --> 00:00:06,250\nSegunda línea`;
  const cues = parseSrt(sample);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 1.5);
  assert.equal(cues[0].end, 3.75);
  assert.equal(cues[0].text, 'Hola KlipFrame');

  const capClips = cues.map((cue, idx) =>
    makeVideoClip({
      id: `cap-${idx}`,
      kind: 'caption',
      startTime: cue.start,
      duration: cue.end - cue.start,
      text: {
        content: cue.text,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 42,
        fontWeight: 600,
        italic: false,
        underline: false,
        uppercase: false,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 0,
        bgColor: '#000000',
        bgOpacity: 75,
        bgRadius: 10,
        shadowBlur: 0,
        shadowColor: '#000000',
        align: 'center',
        letterSpacing: 0,
        lineHeight: 1.2,
      },
    }),
  );

  const serialized = serializeSrt(capClips);
  assert.ok(serialized.includes('00:00:01,500 --> 00:00:03,750'));
  assert.ok(serialized.includes('Segunda línea'));
});

test('splitClipAtTime partitions keyframes and shifts right-half keyframe offsets cleanly', () => {
  const clip = makeVideoClip({
    startTime: 0,
    duration: 10,
    keyframes: [
      { timeOffset: 1, scale: 1 },
      { timeOffset: 7, scale: 2 },
    ],
  });
  const split = splitClipAtTime([clip], 'clip-1', 4, () => 'clip-right');
  assert.equal(split.length, 2);
  assert.deepEqual(split[0].keyframes, [{ timeOffset: 1, scale: 1 }]);
  assert.deepEqual(split[1].keyframes, [{ timeOffset: 3, scale: 2 }]);

  const merged = mergeAdjacentClip(split, 'clip-1');
  assert.equal(merged.clips.length, 1);
  assert.deepEqual(merged.clips[0].keyframes, [
    { timeOffset: 1, scale: 1 },
    { timeOffset: 7, scale: 2 },
  ]);
});

test('generateBeatMarkerTimes produces beat timestamps within audio clip bounds', () => {
  const beats = generateBeatMarkerTimes(2, 8, 120); // beatStep = 1.0s
  assert.ok(beats.length >= 6);
  assert.equal(beats[0], 3);
  assert.ok(beats.every((t) => t > 2 && t < 10));
});
