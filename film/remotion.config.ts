import { Config } from '@remotion/cli/config';
import { webpackOverride } from './webpack-override.mjs';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(94);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(14);
Config.setConcurrency(null);

Config.overrideWebpackConfig(webpackOverride);
