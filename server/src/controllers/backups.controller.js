const backupService = require('../services/backup.service');
const { success, error } = require('../utils/response');

exports.exportBackup = async (req, res, next) => {
  try {
    const backupData = await backupService.exportStudioBackup(req.user.studioId);
    return success(res, backupData);
  } catch (err) {
    next(err);
  }
};

exports.importBackup = async (req, res, next) => {
  try {
    const { mode = 'merge', data } = req.body;
    if (!data) {
      return error(res, 'Backup payload data is required', 400);
    }
    const result = await backupService.importStudioBackup(req.user.studioId, data, mode);
    return success(res, result, 'Backup imported successfully');
  } catch (err) {
    next(err);
  }
};
