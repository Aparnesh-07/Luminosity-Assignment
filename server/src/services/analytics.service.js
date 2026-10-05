const { query } = require('../config/database');

/**
 * Authoritative overview analytics aggregated in MySQL
 */
exports.getOverview = async (studioId, filters = {}) => {
  const { startDate, endDate } = filters;

  let whereClause = `WHERE p.studio_id = ?`;
  const params = [studioId];

  if (startDate) {
    whereClause += ` AND (p.start_date >= ? OR p.end_date >= ?)`;
    params.push(startDate, startDate);
  }
  if (endDate) {
    whereClause += ` AND (p.start_date <= ? OR p.end_date <= ?)`;
    params.push(endDate, endDate);
  }

  // 1. Projects aggregation
  const [projectStats] = await query(
    `SELECT 
       COUNT(*) as totalProjects,
       SUM(CASE WHEN p.status = 'upcoming' THEN 1 ELSE 0 END) as upcomingCount,
       SUM(CASE WHEN p.status = 'ongoing' THEN 1 ELSE 0 END) as ongoingCount,
       SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
       SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
       COALESCE(SUM(p.budget), 0) as totalRevenue
     FROM projects p 
     ${whereClause}`,
    params
  );

  const stats = projectStats[0];
  const totalProjects = parseInt(stats.totalProjects, 10) || 0;
  const totalRevenue = parseFloat(stats.totalRevenue) || 0;
  const upcomingCount = parseInt(stats.upcomingCount, 10) || 0;
  const ongoingCount = parseInt(stats.ongoingCount, 10) || 0;
  const pendingCount = parseInt(stats.pendingCount, 10) || 0;
  const completedCount = parseInt(stats.completedCount, 10) || 0;

  // 2. Expenses aggregation for matching projects
  const [expenseStats] = await query(
    `SELECT COALESCE(SUM(e.amount), 0) as totalExpenses
     FROM expenses e
     JOIN projects p ON e.project_id = p.id
     ${whereClause}`,
    params
  );
  const totalExpenses = parseFloat(expenseStats[0].totalExpenses) || 0;

  // 3. Payments aggregation for matching projects
  const [paymentStats] = await query(
    `SELECT COALESCE(SUM(py.amount), 0) as totalPaid
     FROM payments py
     JOIN projects p ON py.project_id = p.id
     ${whereClause}`,
    params
  );
  const totalPaid = parseFloat(paymentStats[0].totalPaid) || 0;

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const expenseRatio = totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100) : 0;
  const pendingMoney = Math.max(0, totalRevenue - totalPaid);
  const avgRevenue = totalProjects > 0 ? totalRevenue / totalProjects : 0;
  const avgExpense = totalProjects > 0 ? totalExpenses / totalProjects : 0;

  const totalBase = totalProjects || 1;
  const statusPercentages = {
    upcoming: { count: upcomingCount, pct: Math.round((upcomingCount / totalBase) * 100) },
    ongoing: { count: ongoingCount, pct: Math.round((ongoingCount / totalBase) * 100) },
    pending: { count: pendingCount, pct: Math.round((pendingCount / totalBase) * 100) },
    completed: { count: completedCount, pct: Math.round((completedCount / totalBase) * 100) }
  };

  return {
    totalProjects,
    totalRevenue,
    totalExpenses,
    totalPaid,
    netProfit,
    profitMargin,
    expenseRatio,
    pendingMoney,
    avgRevenue,
    avgExpense,
    statusCounts: {
      upcoming: upcomingCount,
      ongoing: ongoingCount,
      pending: pendingCount,
      completed: completedCount
    },
    statusPercentages,
    timeframe: {
      startDate: startDate || null,
      endDate: endDate || null
    }
  };
};

/**
 * Payments window breakdown: pending vs settled
 */
exports.getPaymentsOverview = async (studioId) => {
  const [projects] = await query(
    `SELECT p.id, p.title, p.budget, p.status,
            COALESCE(SUM(py.amount), 0) as paid
     FROM projects p
     LEFT JOIN payments py ON py.project_id = p.id
     WHERE p.studio_id = ?
     GROUP BY p.id`,
    [studioId]
  );

  let totalPendingSum = 0;
  let totalCollectedSum = 0;
  let pendingCount = 0;
  let settledCount = 0;

  projects.forEach((p) => {
    const budget = parseFloat(p.budget) || 0;
    const paid = parseFloat(p.paid) || 0;
    totalCollectedSum += paid;

    if (budget > paid) {
      totalPendingSum += budget - paid;
      pendingCount++;
    } else if (budget > 0 && paid >= budget) {
      settledCount++;
    }
  });

  return {
    totalPendingSum,
    totalCollectedSum,
    pendingProjectsCount: pendingCount,
    settledProjectsCount: settledCount,
    totalProjects: projects.length
  };
};
