import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { normalizeEmbedUrl } from '../lib/media';

type Q = {
  _id: string;
  prompt: string;
  type: 'MC' | 'GAP';
  options?: string[] | null;
  shuffledOptions?: string[];
  imageUrl?: string | null;
  audioUrl?: string | null;
  embedUrl?: string | null;
  unit?: number | null;
};

type Progress = {
  total: number;
  seen: number;
  remaining: number;
};

type Feedback = {
  correct: boolean;
  text: string;
  detail: string;
};

const STUDENT_PRACTICE_INLINE_CSS = `
/* web/src/styles/student-practice.css */

.practice-page-soft *,
.practice-game-shell * {
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}

.practice-page-soft button,
.practice-page-soft select,
.practice-page-soft input,
.practice-page-soft a,
.practice-page-soft audio,
.practice-game-shell button,
.practice-game-shell select,
.practice-game-shell input,
.practice-game-shell a,
.practice-game-shell audio {
  font-family: inherit;
}

.practice-page-soft input,
.practice-page-soft select,
.practice-page-soft textarea,
.practice-game-shell input,
.practice-game-shell select,
.practice-game-shell textarea {
  font-size: 16px;
}

.practice-page-soft img,
.practice-page-soft iframe,
.practice-page-soft video,
.practice-page-soft audio,
.practice-game-shell img,
.practice-game-shell iframe,
.practice-game-shell video,
.practice-game-shell audio {
  max-width: 100%;
}

.practice-page-soft button,
.practice-game-shell button {
  touch-action: manipulation;
}

.practice-page-soft {
  min-height: 100vh;
  padding: 22px;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, .20), transparent 30%),
    radial-gradient(circle at top right, rgba(217, 70, 239, .18), transparent 28%),
    linear-gradient(180deg, #ffffff, #f8fafc 60%, #f5f3ff);
}

.practice-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.practice-hero-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 28px;
  align-items: center;
  border-radius: 42px;
  padding: 34px;
  color: white;
  background: linear-gradient(135deg, #0ea5e9, #7c3aed 54%, #d946ef);
  box-shadow: 0 24px 70px rgba(124, 58, 237, .22);
}

.practice-blob {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  opacity: .55;
  pointer-events: none;
}

.practice-blob-one {
  width: 260px;
  height: 260px;
  right: -70px;
  top: -80px;
  background: #f0abfc;
}

.practice-blob-two {
  width: 240px;
  height: 240px;
  left: -70px;
  bottom: -90px;
  background: #7dd3fc;
}

.practice-hero-copy,
.practice-hero-mascot-wrap {
  position: relative;
  z-index: 1;
}

.practice-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  border: 1px solid rgba(255,255,255,.26);
  border-radius: 999px;
  background: rgba(255,255,255,.16);
  padding: 7px 12px;
  color: white;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.practice-kicker.dark {
  border-color: #ede9fe;
  background: #f5f3ff;
  color: #6d28d9;
}

.practice-hero-copy h1 {
  margin: 14px 0 0;
  max-width: 720px;
  font-size: clamp(38px, 6vw, 68px);
  line-height: .92;
  font-weight: 950;
  letter-spacing: -.06em;
}

.practice-hero-copy p {
  margin: 18px 0 0;
  max-width: 680px;
  color: rgba(255,255,255,.86);
  font-size: 16px;
  line-height: 1.65;
  font-weight: 650;
}

.practice-hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.practice-hero-pills span {
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 999px;
  background: rgba(255,255,255,.14);
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 900;
  backdrop-filter: blur(10px);
}

.practice-hero-mascot-wrap {
  display: grid;
  place-items: center;
}

.practice-hero-mascot {
  display: grid;
  place-items: center;
  width: 230px;
  height: 230px;
  border: 1px solid rgba(255,255,255,.42);
  border-radius: 52px;
  background: rgba(255,255,255,.86);
  font-size: 118px;
  box-shadow: inset 0 -18px 0 rgba(124, 58, 237, .10), 0 22px 70px rgba(15, 23, 42, .24);
  animation: practice-float 3.2s ease-in-out infinite;
}

.practice-speech-bubble {
  margin-top: -20px;
  border: 1px solid #ede9fe;
  border-radius: 999px;
  background: white;
  padding: 12px 18px;
  color: #6d28d9;
  font-size: 14px;
  font-weight: 950;
  box-shadow: 0 16px 35px rgba(15, 23, 42, .14);
}

.practice-mission-card,
.practice-loading-card,
.practice-error-card {
  border: 1px solid #e5e7eb;
  border-radius: 34px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 20px 55px rgba(15, 23, 42, .07);
  backdrop-filter: blur(12px);
}

.practice-mission-card {
  padding: 24px;
}

.practice-mission-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.practice-mission-header h2,
.practice-mission-card h2 {
  margin: 10px 0 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.05;
  font-weight: 950;
  letter-spacing: -.04em;
}

.practice-mission-header p {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 14px;
  font-weight: 650;
}

.practice-mission-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px auto;
  gap: 14px;
  align-items: end;
}

.practice-mission-grid label {
  display: grid;
  gap: 8px;
}

.practice-mission-grid label > span {
  color: #374151;
  font-size: 13px;
  font-weight: 950;
}

.practice-mission-grid select,
.practice-mission-grid input,
.practice-written-row input {
  width: 100%;
  min-height: 58px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #f8fafc;
  padding: 0 16px;
  outline: none;
  color: #111827;
  font-weight: 750;
  transition: .18s ease;
}

.practice-mission-grid select:focus,
.practice-mission-grid input:focus,
.practice-written-row input:focus {
  border-color: #8b5cf6;
  background: white;
  box-shadow: 0 0 0 4px rgba(139, 92, 246, .12);
}

.practice-start-button,
.practice-secondary-button,
.practice-error-card button {
  min-height: 58px;
  border: 0;
  border-radius: 20px;
  padding: 0 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .04em;
  transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
}

.practice-start-button {
  background: linear-gradient(90deg, #0ea5e9, #7c3aed 58%, #d946ef);
  color: white;
  box-shadow: 0 16px 35px rgba(124, 58, 237, .22);
}

.practice-start-button:hover:not(:disabled),
.practice-secondary-button:hover:not(:disabled),
.practice-error-card button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 22px 45px rgba(124, 58, 237, .24);
}

.practice-start-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.practice-secondary-button {
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
}

.practice-empty-state,
.practice-game-empty {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 260px;
  border: 1px dashed #d8b4fe;
  border-radius: 28px;
  background: linear-gradient(180deg, #faf5ff, #ffffff);
  padding: 28px;
  text-align: center;
}

.practice-empty-state > div,
.practice-game-empty > div:first-child {
  font-size: 56px;
}

.practice-empty-state h3,
.practice-game-empty h2 {
  margin: 0;
  color: #111827;
  font-size: 22px;
  font-weight: 950;
}

.practice-empty-state p,
.practice-game-empty p {
  margin: 0;
  max-width: 430px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 650;
}

.practice-loading-card,
.practice-error-card {
  width: min(560px, 100%);
  margin: 10vh auto 0;
  padding: 28px;
  text-align: center;
}

.practice-loading-mascot,
.practice-error-icon {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin: 0 auto 16px;
  border-radius: 30px;
  background: linear-gradient(135deg, #f5f3ff, #e0f2fe);
  font-size: 52px;
  animation: practice-float 3.2s ease-in-out infinite;
}

.practice-loading-card h1,
.practice-error-card h1 {
  margin: 0;
  color: #111827;
  font-size: 26px;
  font-weight: 950;
  letter-spacing: -.04em;
}

.practice-loading-card p,
.practice-error-card p {
  margin: 8px 0 0;
  color: #6b7280;
  font-weight: 700;
}

.practice-error-card {
  border-color: #fecdd3;
  background: #fff1f2;
}

.practice-error-card button {
  margin-top: 18px;
  background: #e11d48;
  color: white;
}

.practice-game-shell {
  position: fixed;
  inset: 0;
  z-index: 9999;
  height: 100dvh;
  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  color: #111827;
  background: #160f2e;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.practice-game-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 12%, rgba(14, 165, 233, .42), transparent 28%),
    radial-gradient(circle at 88% 18%, rgba(217, 70, 239, .36), transparent 32%),
    radial-gradient(circle at 50% 100%, rgba(16, 185, 129, .24), transparent 34%),
    linear-gradient(135deg, #111827, #27115c 54%, #4c1d95);
}

.practice-game-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: .22;
  background-image:
    linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, black, transparent 85%);
}

.practice-game-header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid rgba(255,255,255,.13);
  background: rgba(17, 24, 39, .62);
  backdrop-filter: blur(18px);
}

.practice-exit-button,
.practice-music-button {
  min-height: 46px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 16px;
  background: rgba(255,255,255,.12);
  color: white;
  padding: 0 16px;
  cursor: pointer;
  font-weight: 950;
  transition: .18s ease;
}

.practice-music-button {
  background: rgba(124, 58, 237, .32);
}

.practice-exit-button:hover,
.practice-music-button:hover {
  transform: translateY(-1px);
  background: rgba(255,255,255,.18);
}

.practice-game-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: white;
}

.practice-game-title > span {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: white;
  font-size: 28px;
  box-shadow: inset 0 -6px 0 rgba(124, 58, 237, .12);
}

.practice-game-title b,
.practice-game-title small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.practice-game-title b {
  font-size: 15px;
  font-weight: 950;
}

.practice-game-title small {
  margin-top: 2px;
  color: rgba(255,255,255,.72);
  font-size: 12px;
  font-weight: 800;
}

.practice-header-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(74px, 1fr));
  gap: 8px;
}

.practice-header-stats div {
  min-height: 48px;
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 16px;
  background: rgba(255,255,255,.12);
  color: white;
  padding: 7px 11px;
}

.practice-header-stats small {
  display: block;
  color: rgba(255,255,255,.68);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.practice-header-stats b {
  display: block;
  margin-top: 1px;
  font-size: 15px;
  font-weight: 950;
}

.practice-top-progress {
  position: relative;
  z-index: 2;
  width: min(1280px, calc(100% - 24px));
  margin: 12px auto 0;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 18px;
  background: rgba(255,255,255,.12);
  padding: 10px;
  color: white;
  backdrop-filter: blur(16px);
}

.practice-top-progress > div:first-child,
.practice-progress-card > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 950;
}

.practice-game-main {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 16px;
  width: min(1280px, calc(100% - 24px));
  margin: 16px auto 24px;
}

.practice-game-side {
  position: sticky;
  top: 84px;
  align-self: start;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 32px;
  background: rgba(255,255,255,.10);
  color: white;
  padding: 20px;
  box-shadow: 0 20px 70px rgba(0,0,0,.20);
  backdrop-filter: blur(18px);
}

.practice-mini-mascot {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin-bottom: 16px;
  border-radius: 30px;
  background: white;
  font-size: 56px;
  box-shadow: inset 0 -10px 0 rgba(124, 58, 237, .09), 0 18px 40px rgba(0,0,0,.18);
  animation: practice-float 3.2s ease-in-out infinite;
}

.practice-game-side h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 950;
}

.practice-game-side p {
  margin: 6px 0 0;
  color: rgba(255,255,255,.76);
  font-size: 14px;
  line-height: 1.5;
  font-weight: 650;
}

.practice-side-stats {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.practice-side-stats div {
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 22px;
  background: rgba(255,255,255,.10);
  padding: 13px;
}

.practice-side-stats span {
  display: block;
  color: rgba(255,255,255,.58);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.practice-side-stats b {
  display: block;
  margin-top: 3px;
  font-size: 20px;
  font-weight: 950;
}

.practice-game-card {
  min-height: calc(100vh - 132px);
  border: 1px solid rgba(255,255,255,.16);
  border-radius: 36px;
  background: rgba(255,255,255,.96);
  padding: 22px;
  box-shadow: 0 25px 80px rgba(0,0,0,.25);
  backdrop-filter: blur(12px);
}

.practice-question-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.practice-question-head h2 {
  margin: 10px 0 0;
  color: #111827;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.02;
  font-weight: 950;
  letter-spacing: -.05em;
}

.practice-type-pill {
  height: fit-content;
  border: 1px solid #bae6fd;
  border-radius: 999px;
  background: #f0f9ff;
  color: #0369a1;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.practice-question-content {
  display: grid;
  gap: 16px;
}

.practice-media-card,
.practice-audio-card,
.practice-prompt-card,
.practice-warning-card {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 28px;
  background: #f8fafc;
}

.practice-media-card img {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
}

.practice-media-card iframe,
.practice-media-card video {
  display: block;
  width: 100%;
  height: 360px;
  border: 0;
}

.practice-media-card video {
  object-fit: contain;
  background: #000;
}

.practice-audio-card {
  display: grid;
  gap: 8px;
  border-color: #bae6fd;
  background: #f0f9ff;
  padding: 16px;
}

.practice-audio-card span {
  color: #0369a1;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.practice-audio-card a {
  color: #0369a1;
  font-size: 12px;
  font-weight: 850;
}

.practice-audio-frame {
  width: 100%;
  height: 96px;
  border: 1px solid rgba(14, 165, 233, .22);
  border-radius: 20px;
  background: #ffffff;
}

.practice-audio-note {
  margin: 0;
  color: #0369a1;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.45;
}

.practice-prompt-card {
  border-color: #ddd6fe;
  background: linear-gradient(180deg, #f5f3ff, #ffffff);
  padding: 20px;
}

.practice-prompt-card span {
  display: inline-block;
  margin-bottom: 8px;
  color: #7c3aed;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.practice-prompt-card p {
  margin: 0;
  color: #111827;
  font-size: clamp(22px, 3vw, 36px);
  line-height: 1.2;
  font-weight: 950;
  letter-spacing: -.03em;
}

.practice-feedback {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 24px;
  padding: 16px;
  animation: practice-pop .22s ease-out;
}

.practice-feedback > span {
  font-size: 28px;
}

.practice-feedback b,
.practice-feedback small {
  display: block;
}

.practice-feedback b {
  font-size: 18px;
  font-weight: 950;
}

.practice-feedback small {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 800;
}

.practice-feedback-good {
  border: 1px solid #bbf7d0;
  background: #dcfce7;
  color: #166534;
}

.practice-feedback-bad {
  border: 1px solid #fed7aa;
  background: #fff7ed;
  color: #9a3412;
}

.practice-options-grid {
  display: grid;
  gap: 12px;
}

.practice-answer-button {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  background: white;
  padding: 14px 18px;
  text-align: left;
  color: #1f2937;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .06);
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}

.practice-answer-button:hover:not(.practice-option-locked) {
  transform: translateY(-2px);
  border-color: #c4b5fd;
  background: #f5f3ff;
  box-shadow: 0 14px 30px rgba(124, 58, 237, .14);
}

.practice-answer-button.practice-option-locked {
  cursor: default;
  opacity: .82;
}

.practice-answer-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 950;
}

.practice-answer-has-image .practice-answer-left {
  align-items: flex-start;
}

.practice-answer-left b {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 13px;
}

.practice-answer-left span {
  overflow-wrap: anywhere;
}

.practice-answer-content {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.practice-answer-content.image {
  width: 100%;
}

.practice-option-image {
  display: block;
  width: min(280px, 100%);
  max-height: 180px;
  object-fit: contain;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #f8fafc;
  padding: 8px;
}

.practice-option-label {
  width: fit-content;
  border-radius: 999px;
  background: #f5f3ff;
  color: #6d28d9;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 950;
  letter-spacing: .02em;
}

.practice-answer-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}


.practice-answer-arrow {
  color: #a78bfa;
  font-size: 30px;
  font-weight: 950;
}

.practice-option-right {
  border-color: #86efac !important;
  background: #dcfce7 !important;
  color: #14532d !important;
}

.practice-option-wrong {
  border-color: #fecdd3 !important;
  background: #fff1f2 !important;
  color: #9f1239 !important;
}

.practice-written-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.practice-warning-card {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
  padding: 18px;
  font-size: 14px;
  font-weight: 850;
}

.practice-result-wrap {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.practice-result-card {
  width: min(860px, 100%);
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 42px;
  background: rgba(255,255,255,.96);
  padding: 34px;
  text-align: center;
  box-shadow: 0 30px 90px rgba(0,0,0,.30);
}

.practice-result-trophy {
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  margin: 0 auto 18px;
  border-radius: 34px;
  background: linear-gradient(135deg, #f5f3ff, #e0f2fe);
  font-size: 68px;
  box-shadow: inset 0 -12px 0 rgba(124, 58, 237, .08), 0 18px 40px rgba(15, 23, 42, .10);
}

.practice-result-card h1 {
  margin: 14px 0 0;
  color: #111827;
  font-size: clamp(32px, 5vw, 54px);
  line-height: .95;
  font-weight: 950;
  letter-spacing: -.06em;
}

.practice-result-card > p {
  width: min(620px, 100%);
  margin: 14px auto 0;
  color: #6b7280;
  font-weight: 700;
  line-height: 1.6;
}

.practice-result-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.practice-result-stats div,
.practice-progress-card {
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  background: #f8fafc;
  padding: 16px;
}

.practice-result-stats span {
  display: block;
  color: #6b7280;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.practice-result-stats b {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 26px;
  font-weight: 950;
}

.practice-progress-card {
  margin-top: 16px;
  text-align: left;
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #166534;
}

.practice-progress-card p {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 800;
}

.practice-progress-track {
  overflow: hidden;
  height: 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.68);
}

.practice-progress-track.small {
  height: 9px;
  background: rgba(255,255,255,.22);
}

.practice-progress-track > div {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #34d399, #10b981);
  transition: width .3s ease;
}

.practice-result-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

@keyframes practice-float {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-8px) rotate(1deg); }
}

@keyframes practice-pop {
  from { opacity: 0; transform: scale(.96) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@media (max-width: 1040px) {
  .practice-game-main {
    grid-template-columns: 1fr;
  }

  .practice-game-side {
    position: relative;
    top: auto;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }

  .practice-mini-mascot {
    width: 76px;
    height: 76px;
    margin-bottom: 0;
    border-radius: 24px;
    font-size: 44px;
  }

  .practice-side-stats {
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 880px) {
  .practice-hero-card,
  .practice-mission-grid {
    grid-template-columns: 1fr;
  }

  .practice-hero-mascot {
    width: 190px;
    height: 190px;
    border-radius: 44px;
    font-size: 98px;
  }

  .practice-game-header {
    grid-template-columns: 1fr 1fr;
  }

  .practice-game-title,
  .practice-header-stats {
    grid-column: 1 / -1;
  }

  .practice-result-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .practice-page-soft {
    padding: 12px;
  }

  .practice-hero-card,
  .practice-mission-card,
  .practice-result-card {
    border-radius: 28px;
    padding: 20px;
  }

  .practice-hero-copy h1 {
    font-size: 38px;
  }

  .practice-hero-copy p {
    font-size: 14px;
  }

  .practice-hero-mascot {
    width: 150px;
    height: 150px;
    border-radius: 36px;
    font-size: 78px;
  }

  .practice-game-header {
    gap: 8px;
    padding: 8px;
  }

  .practice-exit-button,
  .practice-music-button {
    min-height: 42px;
    border-radius: 14px;
    padding-inline: 10px;
    font-size: 13px;
  }

  .practice-header-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .practice-header-stats div {
    min-height: 42px;
    padding: 6px 8px;
  }

  .practice-game-main,
  .practice-top-progress {
    width: calc(100% - 14px);
    margin-top: 8px;
  }

  .practice-game-card,
  .practice-game-side {
    border-radius: 26px;
    padding: 14px;
  }

  .practice-question-head {
    flex-direction: column;
  }

  .practice-prompt-card {
    padding: 16px;
  }

  .practice-prompt-card p {
    font-size: 23px;
  }

  .practice-answer-button {
    min-height: 60px;
    border-radius: 18px;
    padding: 12px;
  }

  .practice-answer-left {
    align-items: flex-start;
  }

  .practice-option-image {
    width: 100%;
    max-height: 160px;
  }

  .practice-written-row {
    grid-template-columns: 1fr;
  }

  .practice-media-card iframe {
    height: 250px;
  }

  .practice-side-stats,
  .practice-result-stats {
    grid-template-columns: 1fr;
  }

  .practice-result-wrap {
    padding: 12px;
  }
}

@media (max-height: 520px) and (orientation: landscape) {
  .practice-game-shell {
    overflow-y: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}

`;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function prepareQuestions(questions: Q[]): Q[] {
  return shuffleArray(questions).map(q => ({
    ...q,
    shuffledOptions: q.options ? shuffleArray(q.options) : [],
  }));
}

function getGoogleDriveFileId(u?: string | null) {
  if (!u) return '';

  try {
    const url = new URL(u);

    if (!url.hostname.includes('drive.google.com')) return '';

    if (url.pathname.startsWith('/file/d/')) {
      return url.pathname.split('/')[3] || '';
    }

    return url.searchParams.get('id') || '';
  } catch {
    const match = String(u).match(/\/file\/d\/([^/]+)/);
    return match?.[1] || '';
  }
}

function isGoogleDriveUrl(u?: string | null) {
  if (!u) return false;

  try {
    const url = new URL(u);
    return url.hostname.includes('drive.google.com');
  } catch {
    return String(u).includes('drive.google.com');
  }
}

function getDrivePreviewUrl(u?: string | null) {
  const id = getGoogleDriveFileId(u);
  return id ? `https://drive.google.com/file/d/${id}/preview` : (u || '');
}

function isDirectVideoUrl(u?: string | null) {
  const text = String(u || '').trim();
  if (!text) return false;

  try {
    const url = new URL(text);
    const cleanPath = url.pathname.toLowerCase();
    return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(cleanPath);
  } catch {
    const clean = text.split('?')[0].toLowerCase();
    return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(clean);
  }
}

function getPlayableEmbedUrl(u?: string | null) {
  const normalized = normalizeEmbedUrl(u || '') || u || '';
  if (!normalized) return '';

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    if (host.includes('drive.google.com')) {
      return getDrivePreviewUrl(normalized);
    }

    return normalized;
  } catch {
    return normalized;
  }
}

function normalizeAudioUrl(u?: string | null) {
  if (!u) return '';

  try {
    const url = new URL(u);

    if (url.hostname.includes('drive.google.com')) {
      if (url.pathname.startsWith('/file/d/')) {
        const id = url.pathname.split('/')[3];
        return id ? `https://drive.google.com/uc?export=download&id=${id}` : u;
      }

      const id = url.searchParams.get('id');
      if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  } catch {}

  return u;
}


type ParsedPracticeOption = {
  raw: string;
  isImage: boolean;
  imageUrl: string;
  label: string;
  displayText: string;
};


function isImageUrl(value: string) {
  const text = value.trim();

  if (!text) return false;
  if (/^data:image\//i.test(text)) return true;

  try {
    const url = new URL(text);
    const cleanPath = url.pathname.toLowerCase();

    return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(cleanPath);
  } catch {
    const clean = text.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(clean);
  }
}

function parsePracticeOption(raw: string): ParsedPracticeOption {
  const text = String(raw || '').trim();

  if (text.toLowerCase().startsWith('img:')) {
    const withoutPrefix = text.slice(4).trim();
    const [urlPart, ...labelParts] = withoutPrefix.split('|');
    const imageUrl = (urlPart || '').trim();
    const label = labelParts.join('|').trim();

    return {
      raw,
      isImage: !!imageUrl,
      imageUrl,
      label,
      displayText: label || 'Image option',
    };
  }

  if (isImageUrl(text)) {
    return {
      raw,
      isImage: true,
      imageUrl: text,
      label: '',
      displayText: 'Image option',
    };
  }

  return {
    raw,
    isImage: false,
    imageUrl: '',
    label: text,
    displayText: text,
  };
}

function getAudioContextClass() {
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

function playFeedbackSound(correct: boolean) {
  try {
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = correct ? 740 : 180;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    if (correct) {
      osc.frequency.setValueAtTime(740, ctx.currentTime);
      osc.frequency.setValueAtTime(980, ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.12);
    }

    osc.stop(ctx.currentTime + 0.3);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {}
}


const GAME_MELODY = [
  523.25, 659.25, 783.99, 659.25,
  587.33, 739.99, 880.00, 739.99,
  523.25, 659.25, 783.99, 987.77,
  880.00, 783.99, 659.25, 587.33,
];

const GAME_BASS = [130.81, 146.83, 164.81, 196.00];

function playMusicTone(
  ctx: AudioContext,
  output: AudioNode,
  freq: number,
  duration: number,
  volume: number,
  type: OscillatorType,
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(output);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {}
}

export default function StudentPractice() {
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

  const testerAs = params.get('as') || '';
  const testerSet = params.get('set') || '';
  const testerUnit = params.get('unit') ? Number(params.get('unit')) : undefined;

  const [mySets, setMySets] = useState<{ set: { _id: string; title: string; units?: number }, updatedAt: string }[]>([]);
  const [setId, setSetId] = useState<string>(testerSet || '');
  const [unit, setUnit] = useState<number | ''>(typeof testerUnit === 'number' ? testerUnit : '');
  const [mode, setMode] = useState<'sets' | 'legacy'>(testerSet ? 'sets' : 'legacy');

  const [screen, setScreen] = useState<'choose' | 'game' | 'result'>('choose');

  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [locked, setLocked] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);

  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const musicStepRef = useRef(0);

  const q = qs[idx];
  const playableEmbedUrl = q?.embedUrl ? getPlayableEmbedUrl(q.embedUrl) : '';
  const directVideoUrl = q?.embedUrl && isDirectVideoUrl(q.embedUrl) ? q.embedUrl : '';

  useEffect(() => {
    const styleId = 'student-practice-inline-css';

    const previous = document.getElementById(styleId);
    if (previous) previous.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = STUDENT_PRACTICE_INLINE_CSS;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);


  const selectedSet = useMemo(() => {
    return mySets.find(r => r.set._id === setId)?.set || null;
  }, [mySets, setId]);

  const unitOptions = useMemo(() => {
    const total = selectedSet?.units || 0;
    if (!total || total < 1) return [];
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [selectedSet]);

  const progressPct = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.seen / progress.total) * 100);
  }, [progress]);

  const roundPct = useMemo(() => {
    if (!score.total) return 0;
    return Math.round((score.ok / score.total) * 100);
  }, [score]);

  const gameTitle = mode === 'sets'
    ? selectedSet?.title || 'Practice game'
    : 'General practice';

  function stopGameMusic() {
    if (musicTimerRef.current !== null) {
      window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
    }

    const ctx = musicCtxRef.current;

    musicCtxRef.current = null;
    musicGainRef.current = null;
    musicStepRef.current = 0;

    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }

  function startGameMusic(force = false) {
    if (musicCtxRef.current) return;
    if (musicMuted && !force) return;

    try {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const mainGain = ctx.createGain();

      mainGain.gain.value = 0.035;
      mainGain.connect(ctx.destination);

      musicCtxRef.current = ctx;
      musicGainRef.current = mainGain;
      musicStepRef.current = 0;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const tick = () => {
        if (!musicCtxRef.current || !musicGainRef.current) return;

        const step = musicStepRef.current;
        const melodyFreq = GAME_MELODY[step % GAME_MELODY.length];

        playMusicTone(ctx, mainGain, melodyFreq, 0.12, 0.22, 'square');

        if (step % 4 === 0) {
          const bassFreq = GAME_BASS[Math.floor(step / 4) % GAME_BASS.length];
          playMusicTone(ctx, mainGain, bassFreq, 0.2, 0.16, 'triangle');
        }

        musicStepRef.current = step + 1;
      };

      tick();
      musicTimerRef.current = window.setInterval(tick, 180);
    } catch {}
  }

  function toggleMusic() {
    if (musicMuted) {
      setMusicMuted(false);
      startGameMusic(true);
      return;
    }

    setMusicMuted(true);
    stopGameMusic();
  }

  useEffect(() => {
    (async () => {
      try {
        if (testerAs && testerSet) {
          setMode('sets');
          setSetId(testerSet);
          setScreen('game');
          await loadBatch(testerSet, typeof testerUnit === 'number' ? testerUnit : undefined, testerAs);
          return;
        }

        const r = await api.practice.mySets().catch(() => ({ rows: [] as any[] }));
        const rows = r?.rows || [];

        if (rows.length > 0) {
          setMySets(rows);
          setSetId(rows[0].set._id);
          setMode('sets');
          setScreen('choose');
          return;
        }

        setMode('legacy');
        setScreen('game');
        await loadLegacy();
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopGameMusic();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetRound() {
    setIdx(0);
    setAnswer('');
    setSelectedAnswer('');
    setScore({ ok: 0, total: 0 });
    setPoints(0);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setLocked(false);
  }

  async function loadLegacy() {
    setGameLoading(true);
    setErr(null);

    try {
      const legacy = await api.practice.play();
      setQs(prepareQuestions(legacy.questions || []));
      setIdx(0);
      setAnswer('');
      setSelectedAnswer('');
      setCompleted(false);
      setProgress(null);
    } catch (e: any) {
      stopGameMusic();
      setErr(e.message);
    } finally {
      setGameLoading(false);
    }
  }

  async function loadBatch(currentSetId: string, currentUnit?: number, asStudentId?: string) {
    setGameLoading(true);
    setErr(null);

    try {
      const r = asStudentId
        ? await api.practice.playAs(asStudentId, currentSetId, currentUnit)
        : await api.practice.playSet(currentSetId, currentUnit);

      setQs(prepareQuestions(r.questions || []));
      setIdx(0);
      setAnswer('');
      setSelectedAnswer('');
      setProgress(r.progress || null);
      setCompleted(!!r.completed);
    } catch (e: any) {
      stopGameMusic();
      setErr(e.message);
    } finally {
      setGameLoading(false);
    }
  }

  async function startWithSet() {
    if (!setId) return;

    resetRound();
    setScreen('game');
    startGameMusic();

    await loadBatch(setId, unit ? Number(unit) : undefined, testerAs || undefined);
  }

  async function restartGame() {
    resetRound();
    setScreen('game');
    startGameMusic();

    if (mode === 'sets' && setId) {
      await loadBatch(setId, unit ? Number(unit) : undefined, testerAs || undefined);
    } else {
      await loadLegacy();
    }
  }

  function backToChooser() {
    stopGameMusic();
    setFeedback(null);
    setLocked(false);
    setAnswer('');
    setSelectedAnswer('');

    if (mode === 'sets') {
      setScreen('choose');
      setQs([]);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    setScreen('choose');
  }

  async function submit(a: string) {
    if (!q || locked || !a.trim()) return;

    startGameMusic();
    setLocked(true);
    setSelectedAnswer(a);

    try {
      const res = testerAs
        ? await api.practice.submitAs(testerAs, q._id, a)
        : await api.practice.submit(q._id, a);

      const nextStreak = res.correct ? streak + 1 : 0;
      const gainedPoints = res.correct ? 10 + Math.min(nextStreak * 2, 20) : 0;

      setScore(s => ({
        ok: s.ok + (res.correct ? 1 : 0),
        total: s.total + 1,
      }));

      setStreak(nextStreak);
      setBestStreak(s => Math.max(s, nextStreak));
      setPoints(p => p + gainedPoints);

      setFeedback({
        correct: res.correct,
        text: res.correct ? 'Well done!' : 'Try again!',
        detail: res.correct
          ? `+${gainedPoints} points`
          : 'This question can appear again later.',
      });

      playFeedbackSound(res.correct);

      window.setTimeout(() => {
        setFeedback(null);
        setAnswer('');
        setSelectedAnswer('');
        setLocked(false);

        if (idx + 1 < qs.length) {
          setIdx(i => i + 1);
          return;
        }

        stopGameMusic();
        setScreen('result');
      }, 950);
    } catch (e: any) {
      setLocked(false);
      setFeedback(null);
      setErr(e.message);
    }
  }

  if (loading) {
    return (
      <div className="practice-page-soft">
        <section className="practice-loading-card">
          <div className="practice-loading-mascot">🐉</div>
          <div>
            <h1>Loading your mission...</h1>
            <p>Milo is preparing the game.</p>
          </div>
        </section>
      </div>
    );
  }

  if (err) {
    return (
      <div className="practice-page-soft">
        <section className="practice-error-card">
          <div className="practice-error-icon">⚠️</div>
          <h1>No se pudo cargar la práctica</h1>
          <p>{err}</p>
          <button
            onClick={() => {
              setErr(null);
              if (mode === 'sets') setScreen('choose');
              else restartGame();
            }}
          >
            Volver
          </button>
        </section>
      </div>
    );
  }

  if (screen === 'choose') {
    return (
      <div className="practice-page-soft">
        <div className="practice-shell">
          <section className="practice-hero-card">
            <div className="practice-blob practice-blob-one" />
            <div className="practice-blob practice-blob-two" />

            <div className="practice-hero-copy">
              <span className="practice-kicker">
                🎮 Practice Quest {testerAs ? '· Tester mode' : ''}
              </span>

              <h1>Milo's English Adventure</h1>

              <p>
                Choose your mission, press start, and collect points. Wrong answers are not a problem:
                they can come back so you can master them.
              </p>

              <div className="practice-hero-pills">
                <span>✨ Points</span>
                <span>🔥 Streak</span>
                <span>🎵 Music</span>
                <span>🏆 Replay</span>
              </div>
            </div>

            <div className="practice-hero-mascot-wrap">
              <div className="practice-hero-mascot">🐉</div>
              <div className="practice-speech-bubble">Ready?</div>
            </div>
          </section>

          {mode === 'sets' ? (
            <section className="practice-mission-card">
              <div className="practice-mission-header">
                <div>
                  <span className="practice-kicker dark">Your assigned practice</span>
                  <h2>Choose your mission</h2>
                  <p>The activity opens in a full-screen game view.</p>
                </div>
              </div>

              <div className="practice-mission-grid">
                {!testerAs && (
                  <label>
                    <span>Practice set</span>
                    <select
                      value={setId}
                      onChange={e => {
                        setSetId(e.target.value);
                        setUnit('');
                      }}
                    >
                      {mySets.map(r => (
                        <option key={r.set._id} value={r.set._id}>{r.set.title}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  <span>Unit</span>
                  {unitOptions.length > 0 ? (
                    <select
                      value={unit}
                      onChange={e => setUnit(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">All units</option>
                      {unitOptions.map(n => (
                        <option key={n} value={n}>Unit {n}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      placeholder="Optional"
                      value={unit}
                      onChange={e => setUnit(e.target.value ? Number(e.target.value) : '')}
                    />
                  )}
                </label>

                <button className="practice-start-button" onClick={startWithSet} disabled={!setId}>
                  <span>Start game</span>
                  <b>▶</b>
                </button>
              </div>

              {mySets.length === 0 && !testerAs && (
                <div className="practice-empty-state">
                  <div>📭</div>
                  <h3>No practice sets assigned yet</h3>
                  <p>When your coordinator enables a set, it will appear here.</p>
                </div>
              )}
            </section>
          ) : (
            <section className="practice-mission-card">
              <span className="practice-kicker dark">General practice mode</span>
              <h2>Ready to play?</h2>
              <button className="practice-start-button" onClick={restartGame}>
                <span>Start game</span>
                <b>▶</b>
              </button>
            </section>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'result') {
    return (
      <div className="practice-game-shell">
        <div className="practice-game-bg" />
        <main className="practice-result-wrap">
          <section className="practice-result-card">
            <div className="practice-result-trophy">
              {roundPct === 100 ? '🏆' : roundPct >= 70 ? '🎉' : '💪'}
            </div>

            <span className="practice-kicker dark">Round complete</span>
            <h1>{roundPct === 100 ? 'Perfect score!' : 'Nice work!'}</h1>
            <p>
              {roundPct === 100
                ? 'Excellent! You mastered this round.'
                : 'Good practice. Play again to improve your score and master more questions.'}
            </p>

            <div className="practice-result-stats">
              <div><span>Score</span><b>{score.ok}/{score.total}</b></div>
              <div><span>Points</span><b>{points}</b></div>
              <div><span>Best streak</span><b>{bestStreak}</b></div>
              <div><span>Accuracy</span><b>{roundPct}%</b></div>
            </div>

            {progress && (
              <div className="practice-progress-card">
                <div>
                  <span>Set progress</span>
                  <b>{progressPct}%</b>
                </div>
                <div className="practice-progress-track">
                  <div style={{ width: `${progressPct}%` }} />
                </div>
                <p>Mastered <b>{progress.seen}</b> of <b>{progress.total}</b> questions.</p>
              </div>
            )}

            <div className="practice-result-actions">
              <button className="practice-start-button" onClick={restartGame}>
                <span>Play again</span>
                <b>↻</b>
              </button>
              <button className="practice-secondary-button" onClick={backToChooser}>Back</button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="practice-game-shell">
      <div className="practice-game-bg" />

      <header className="practice-game-header">
        <button onClick={backToChooser} className="practice-exit-button">← Back</button>
        <button onClick={toggleMusic} className="practice-music-button">
          {musicMuted ? '🔇 Music off' : '🎵 Music on'}
        </button>

        <div className="practice-game-title">
          <span>🐉</span>
          <div>
            <b>{gameTitle}</b>
            <small>{q?.unit ? `Unit ${q.unit}` : unit ? `Unit ${unit}` : 'All units'}{completed ? ' · Replay mode' : ''}</small>
          </div>
        </div>

        <div className="practice-header-stats">
          <div><small>Score</small><b>{score.ok}/{score.total}</b></div>
          <div><small>Points</small><b>{points}</b></div>
          <div><small>Streak</small><b>{streak}</b></div>
        </div>
      </header>

      {progress && (
        <div className="practice-top-progress">
          <div>
            <span>Progress</span>
            <b>{progress.seen}/{progress.total}</b>
          </div>
          <div className="practice-progress-track small">
            <div style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <main className="practice-game-main">
        <aside className="practice-game-side">
          <div className="practice-mini-mascot">🐉</div>
          <div>
            <h3>Milo tip</h3>
            <p>Read carefully, listen if there is audio, and choose your best answer.</p>
          </div>
          <div className="practice-side-stats">
            <div><span>Question</span><b>{qs.length ? idx + 1 : 0}/{qs.length}</b></div>
            <div><span>Accuracy</span><b>{roundPct}%</b></div>
            <div><span>Best streak</span><b>{bestStreak}</b></div>
          </div>
        </aside>

        <section className="practice-game-card">
          {gameLoading ? (
            <div className="practice-game-empty">
              <div className="practice-loading-mascot">🐉</div>
              <h2>Loading game...</h2>
              <p>Your mission is almost ready.</p>
            </div>
          ) : qs.length === 0 ? (
            <div className="practice-game-empty">
              <div>📭</div>
              <h2>No questions available</h2>
              <p>This set or unit does not have questions yet.</p>
              <button className="practice-start-button" onClick={backToChooser}>Back</button>
            </div>
          ) : (
            <>
              <div className="practice-question-head">
                <div>
                  <span className="practice-kicker dark">Question {idx + 1} of {qs.length}</span>
                  <h2>{q?.type === 'MC' ? 'Choose the best answer' : 'Write the correct answer'}</h2>
                </div>
                <span className="practice-type-pill">{q?.type === 'MC' ? 'Multiple choice' : 'Written answer'}</span>
              </div>

              <div className="practice-question-content">
                {q?.imageUrl && (
                  <div className="practice-media-card">
                    <img src={q.imageUrl} alt="" />
                  </div>
                )}

                {q?.audioUrl && (
                  <div className="practice-audio-card">
                    <span>🔊 Listen</span>

                    {isGoogleDriveUrl(q.audioUrl) ? (
                      <>
                        <iframe
                          className="practice-audio-frame"
                          src={getDrivePreviewUrl(q.audioUrl)}
                          title="audio-preview"
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                      </>
                    ) : (
                      <audio controls src={normalizeAudioUrl(q.audioUrl)} />
                    )}

                  </div>
                )}

                {q?.embedUrl && (
                  <div className="practice-media-card">
                    {directVideoUrl ? (
                      <video
                        key={directVideoUrl}
                        src={directVideoUrl}
                        controls
                        playsInline
                      />
                    ) : (
                      <iframe
                        key={playableEmbedUrl || q.embedUrl}
                        src={playableEmbedUrl || normalizeEmbedUrl(q.embedUrl)}
                        title="embed"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        sandbox="allow-same-origin allow-scripts allow-popups allow-presentation"
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    )}
                  </div>
                )}

                <div className="practice-prompt-card">
                  <span>Mission</span>
                  <p>{q?.prompt}</p>
                </div>

                {feedback && (
                  <div className={feedback.correct ? 'practice-feedback practice-feedback-good' : 'practice-feedback practice-feedback-bad'}>
                    <span>{feedback.correct ? '✅' : '❌'}</span>
                    <div>
                      <b>{feedback.text}</b>
                      <small>{feedback.detail}</small>
                    </div>
                  </div>
                )}

                {q?.type === 'MC' ? (
                  <div className="practice-options-grid">
                    {(q.shuffledOptions || []).map((opt, optIdx) => {
                      const parsed = parsePracticeOption(opt);
                      const isSelected = selectedAnswer === opt;
                      const cls = [
                        'practice-answer-button',
                        locked ? 'practice-option-locked' : '',
                        parsed.isImage ? 'practice-answer-has-image' : '',
                        isSelected && feedback?.correct ? 'practice-option-right' : '',
                        isSelected && feedback && !feedback.correct ? 'practice-option-wrong' : '',
                      ].filter(Boolean).join(' ');

                      function chooseOption() {
                        if (locked) return;
                        submit(opt);
                      }

                      return (
                        <div
                          key={`${opt}-${optIdx}`}
                          role="button"
                          tabIndex={locked ? -1 : 0}
                          aria-disabled={locked}
                          onClick={chooseOption}
                          onKeyDown={e => {
                            if (locked) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              submit(opt);
                            }
                          }}
                          className={cls}
                        >
                          <span className="practice-answer-left">
                            <b>{String.fromCharCode(65 + optIdx)}</b>

                            {parsed.isImage ? (
                              <span className="practice-answer-content image">
                                <img className="practice-option-image" src={parsed.imageUrl} alt={parsed.label || `Option ${optIdx + 1}`} />
                                {parsed.label && <span className="practice-option-label">{parsed.label}</span>}
                              </span>
                            ) : (
                              <span className="practice-answer-content">
                                <span>{parsed.displayText}</span>
                              </span>
                            )}
                          </span>

                          <span className="practice-answer-actions">

                            <span className="practice-answer-arrow">›</span>
                          </span>
                        </div>
                      );
                    })}

                    {(q.shuffledOptions || []).length === 0 && (
                      <div className="practice-warning-card">
                        This multiple choice question has no options loaded.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="practice-written-row">
                    <input
                      placeholder="Your answer"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      disabled={locked}
                    />
                    <button onClick={() => submit(answer)} disabled={!answer.trim() || locked} className="practice-start-button">
                      <span>Answer</span>
                      <b>✓</b>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
