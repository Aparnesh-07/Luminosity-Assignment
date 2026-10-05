const paymentService = require('../services/payment.service');
const { success, error } = require('../utils/response');

exports.getProjectPayments = async (req, res, next) => {
  try {
    const payments = await paymentService.getPaymentsByProject(req.user.studioId, req.params.id);
    return success(res, payments);
  } catch (err) {
    next(err);
  }
};

exports.createProjectPayment = async (req, res, next) => {
  try {
    const result = await paymentService.createPayment(req.user.studioId, req.params.id, req.body);
    return success(res, result, 'Payment recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.quickSettleProject = async (req, res, next) => {
  try {
    const result = await paymentService.quickSettle(req.user.studioId, req.params.id);
    return success(res, result, 'Project settled successfully');
  } catch (err) {
    next(err);
  }
};

exports.updatePayment = async (req, res, next) => {
  try {
    const result = await paymentService.updatePayment(req.user.studioId, req.params.id, req.body);
    return success(res, result, 'Payment updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  try {
    const result = await paymentService.deletePayment(req.user.studioId, req.params.id);
    return success(res, result, 'Payment deleted successfully');
  } catch (err) {
    next(err);
  }
};
