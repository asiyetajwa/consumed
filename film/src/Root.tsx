import React from 'react';
import { Composition } from 'remotion';
import { FPS } from './components/Film';
import { consumedFilm } from './consumed/ConsumedFilm';

export const Root: React.FC = () => (
  <Composition
    id="ConsumedLandscape"
    component={consumedFilm.Component}
    durationInFrames={consumedFilm.durationInFrames}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={consumedFilm.defaultProps}
    calculateMetadata={consumedFilm.calculateMetadata}
  />
);
