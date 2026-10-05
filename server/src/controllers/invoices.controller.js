const invoiceService = require('../services/invoice.service');
const { success, error } = require('../utils/response');

exports.listInvoices = async (req, res, next) => {
  try {
    const invoices = await invoiceService.listInvoices(req.user.studioId, req.query);
    return success(res, invoices);
  } catch (err) {
    next(err);
  }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoice(req.user.studioId, req.params.id);
    return success(res, invoice);
  } catch (err) {
    next(err);
  }
};

exports.createInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.user.studioId, req.body);
    return success(res, invoice, 'Invoice created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.updateInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.user.studioId, req.params.id, req.body);
    return success(res, invoice, 'Invoice updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.deleteInvoice(req.user.studioId, req.params.id);
    return success(res, result, 'Invoice deleted successfully');
  } catch (err) {
    next(err);
  }
};

exports.generateNextNumber = async (req, res, next) => {
  try {
    const date = req.query.date || new Date();
    const nextNumber = await invoiceService.generateInvoiceNumber(req.user.studioId, date);
    return success(res, { invoiceNumber: nextNumber });
  } catch (err) {
    next(err);
  }
};
