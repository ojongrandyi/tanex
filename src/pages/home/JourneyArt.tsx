import React from 'react';
import { LOGO_WORDMARK } from '../../config/brand';
import { JOURNEY_SPRITE_CSS, JOURNEY_SPRITE_SYMBOLS } from './journeySprite';

// The homepage's chapter posters (MOTION_3D_SPEC §5, §8): flat SVG scenes in each chapter's
// lane, drawn from the approved C.1 sprite. Phase H mounts the 3D Stage over these slots and
// keeps them as the reduced-motion / low-end fallback. Every scene is decorative (aria-hidden):
// the section text carries the meaning.

const SYMBOLS = JOURNEY_SPRITE_SYMBOLS.replace('__LOGO__', LOGO_WORDMARK);

/** Injects the symbols once per page (the homepage). */
export const JourneySprite: React.FC = () => (
  <>
    <style>{JOURNEY_SPRITE_CSS}</style>
    <svg className="tx-journey-sprite" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: SYMBOLS }} />
  </>
);

type SceneProps = { className?: string };

const Svg: React.FC<React.SVGProps<SVGSVGElement>> = ({ children, className = '', ...rest }) => (
  <svg className={`tx-scene ${className}`.trim()} aria-hidden="true" focusable="false" {...rest}>{children}</svg>
);

/** Chapter 0: globe with Cameroon lit and the paper plane. */
export const HeroGlobe: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 400 400" className={`tx-scene--globe ${className ?? ''}`}>
    <use href="#globe" x="30" y="40" width="340" height="340" />
    <use href="#mark" x="268" y="66" width="62" height="38" />
  </Svg>
);

/** Chapter 1: the road the bike rides through the services. */
export const ServicesRoad: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 400 900" preserveAspectRatio="xMidYMid meet" className={className}>
    <path d="M200 0C320 120 320 220 200 320S80 520 200 620 320 820 200 900" fill="none" stroke="var(--tx-scene-road, #EDE1DA)" strokeWidth="54" strokeLinecap="round" />
    <path d="M200 0C320 120 320 220 200 320S80 520 200 620 320 820 200 900" fill="none" stroke="#F48800" strokeWidth="2.5" strokeDasharray="10 12" />
    <use href="#bike-side" x="40" y="380" width="220" height="143" />
  </Svg>
);

/** Chapter 2: the bike centre stage, three-quarter view. */
export const BikeHero: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax meet" className={`tx-scene--bike ${className ?? ''}`}>
    <use href="#bike-3q" width="360" height="300" />
  </Svg>
);

/** Chapter 3: Limbe → Buea → Douala road with the truck. City names come from the page. */
export const TruckRoute: React.FC<SceneProps & { beyond: string }> = ({ className, beyond }) => (
  <Svg viewBox="0 0 500 460" className={`tx-scene--truck ${className ?? ''}`}>
    <use href="#mount" x="40" y="40" width="300" height="110" />
    <path d="M80 360C110 280 140 220 180 180S330 250 380 300 450 250 480 200" fill="none" stroke="#D9C2B5" strokeWidth="34" strokeLinecap="round" />
    <path d="M80 360C110 280 140 220 180 180S330 250 380 300" fill="none" stroke="#2A1B16" strokeWidth="2.5" strokeDasharray="8 9" />
    <path d="M380 300C410 330 450 250 480 200" fill="none" stroke="#9C7360" strokeWidth="2.5" strokeDasharray="3 7" />
    <use href="#truck-side" x="214" y="166" width="150" height="75" transform="rotate(20 289 203)" />
    <g className="tx-scene__pins">
      <circle cx="80" cy="360" r="11" fill="#2A1B16" /><path d="M75 360l4 4 7-8" stroke="#FBF6EC" strokeWidth="2" fill="none" /><text x="58" y="395">LIMBE</text>
      <circle cx="180" cy="180" r="11" fill="#2A1B16" /><path d="M175 180l4 4 7-8" stroke="#FBF6EC" strokeWidth="2" fill="none" /><text x="158" y="160">BUEA</text>
      <circle cx="380" cy="300" r="12" fill="#F48800" /><circle cx="380" cy="300" r="18" fill="none" stroke="#F48800" strokeWidth="1.5" /><text x="350" y="340">DOUALA</text>
      <text x="392" y="176" className="tx-scene__muted">{beyond.toUpperCase()}</text>
    </g>
  </Svg>
);

/** Chapter 4: the globe again, the plane on its arc. */
export const WorldGlobe: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 400 400" className={`tx-scene--globe ${className ?? ''}`}>
    <use href="#globe" x="20" y="20" width="360" height="360" />
    <use href="#mark" x="170" y="62" width="48" height="29" />
  </Svg>
);

/** Chapter 5: the parcel with its label. */
export const ParcelLabel: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 300 260" className={className}>
    <use href="#parcel" y="10" width="300" height="240" />
  </Svg>
);

/** Chapter 6: the bike parked beside the contact form. */
export const ParkedBike: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMax meet" className={className}>
    <use href="#bike-side" width="400" height="260" />
  </Svg>
);

/** Chapter 8: the bike stops at a front door with the parcel. */
export const ArrivalDoor: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 440 300" className={`tx-scene--door ${className ?? ''}`}>
    <use href="#door-art" x="250" y="20" width="190" height="280" />
    <use href="#bike-side" x="0" y="118" width="280" height="182" />
    <use href="#parcel" x="292" y="246" width="56" height="45" />
  </Svg>
);

/** Mount Cameroon silhouette under the hero. */
export const Mountain: React.FC<SceneProps> = ({ className }) => (
  <Svg className={className} preserveAspectRatio="none" viewBox="0 0 600 160">
    <use href="#mount" width="600" height="160" />
  </Svg>
);
