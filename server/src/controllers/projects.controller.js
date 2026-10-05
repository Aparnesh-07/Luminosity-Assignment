const projectService = require('../services/project.service');
const { success, error } = require('../utils/response');

exports.listProjects = async (req, res, next) => {
  try {
    const projects = await projectService.listProjects(req.user.studioId, req.query);
    return success(res, projects);
  } catch (err) {
    next(err);
  }
};

exports.getProject = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.user.studioId, req.params.id);
    return success(res, project);
  } catch (err) {
    next(err);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(req.user.studioId, req.body);
    return success(res, project, 'Project created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const project = await projectService.updateProject(req.user.studioId, req.params.id, req.body);
    return success(res, project, 'Project updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const result = await projectService.deleteProject(req.user.studioId, req.params.id);
    return success(res, result, 'Project deleted successfully');
  } catch (err) {
    next(err);
  }
};

exports.getFinancials = async (req, res, next) => {
  try {
    const financials = await projectService.getProjectFinancials(req.user.studioId, req.params.id);
    return success(res, financials);
  } catch (err) {
    next(err);
  }
};
