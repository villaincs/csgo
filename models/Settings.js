module.exports = class Settings {
  constructor(dpi, sensitivity, zoomSensitivity, resolution, scalingMode, crosshairCode) {
    this.dpi = dpi;
    this.sensitivity = sensitivity;
    this.zoomSensitivity = zoomSensitivity;
    this.resolution = resolution;
    this.scalingMode = scalingMode;
    this.crosshairCode = crosshairCode;
  }
};
