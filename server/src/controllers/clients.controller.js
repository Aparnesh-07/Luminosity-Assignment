const clientService = require('../services/client.service');
const { success, error } = require('../utils/response');

exports.listClients = async (req, res, next) => {
  try {
    const clients = await clientService.listClients(req.user.studioId, req.query);
    return success(res, clients);
  } catch (err) {
    next(err);
  }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.user.studioId, req.params.id);
    return success(res, client);
  } catch (err) {
    next(err);
  }
};

exports.createClient = async (req, res, next) => {
  try {
    const client = await clientService.createClient(req.user.studioId, req.body);
    return success(res, client, 'Client created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.updateClient = async (req, res, next) => {
  try {
    const client = await clientService.updateClient(req.user.studioId, req.params.id, req.body);
    return success(res, client, 'Client updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const result = await clientService.deleteClient(req.user.studioId, req.params.id);
    return success(res, result, 'Client deleted successfully');
  } catch (err) {
    next(err);
  }
};
