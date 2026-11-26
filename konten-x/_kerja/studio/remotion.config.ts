import { Config } from "@remotion/cli/config";

// PNG frames: JPEG frames put block artefacts into every video before it is even encoded.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
