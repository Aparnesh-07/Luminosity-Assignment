const analyticsService = require('../services/analytics.service');
const { success } = require('../utils/response');

exports.getOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getOverview(req.user.studioId, req.query);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.getPaymentsOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getPaymentsOverview(req.user.studioId);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};
