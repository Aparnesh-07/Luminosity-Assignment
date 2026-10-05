const settingsService = require('../services/settings.service');
const { success, error } = require('../utils/response');

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings(req.user.studioId);
    return success(res, settings);
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateSettings(req.user.studioId, req.body);
    return success(res, settings, 'Settings updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return error(res, 'No image file uploaded', 400);
    }
    const result = await settingsService.updateLogo(req.user.studioId, req.file.filename);
    return success(res, result, 'Logo uploaded successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteLogo = async (req, res, next) => {
  try {
    const result = await settingsService.deleteLogo(req.user.studioId);
    return success(res, result, 'Logo removed successfully');
  } catch (err) {
    next(err);
  }
};

exports.resetSequence = async (req, res, next) => {
  try {
    const result = await settingsService.resetSequence(req.user.studioId, req.body.yearMonth);
    return success(res, result, 'Invoice sequence counter reset to 0');
  } catch (err) {
    next(err);
  }
};
