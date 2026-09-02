function requireRecord(value, recordType, label) {
  if (!value || value.recordType !== recordType) {
    throw new TypeError(`${label} must be a ${recordType} record`);
  }
}

function enemyCounts(enemies = []) {
  const result = new Map();
  for (const enemy of enemies) {
    result.set(enemy.npcId, (result.get(enemy.npcId) ?? 0) + enemy.count);
  }
  return result;
}

function compareEnemies(planned = [], observed = []) {
  const plannedCounts = enemyCounts(planned);
  const observedCounts = enemyCounts(observed);
  return [...new Set([...plannedCounts.keys(), ...observedCounts.keys()])]
    .sort((left, right) => left - right)
    .map((npcId) => ({
      npcId,
      plannedCount: plannedCounts.get(npcId) ?? 0,
      observedCount: observedCounts.get(npcId) ?? 0,
      delta: (observedCounts.get(npcId) ?? 0) - (plannedCounts.get(npcId) ?? 0),
    }))
    .filter((enemy) => enemy.delta !== 0);
}

function elapsedMs(timestamp, startedAt) {
  return Number.isInteger(timestamp) ? (timestamp - startedAt) * 1000 : null;
}

export function compareRunToRoute(route, observation) {
  requireRecord(route, "route", "route");
  requireRecord(observation, "run-observation", "observation");

  if (route.challengeMapId !== observation.run?.challengeMapId) {
    throw new Error(`challengeMapId mismatch: route ${route.challengeMapId}, observation ${observation.run?.challengeMapId}`);
  }
  if (observation.run.routePlanId && observation.run.routePlanId !== route.id) {
    throw new Error(`routePlanId mismatch: expected ${route.id}, observed ${observation.run.routePlanId}`);
  }

  const plannedById = new Map(route.pulls.map((pull) => [pull.id, pull]));
  const matchedObserved = new Set();
  const warnings = [];
  let inferredMatches = 0;

  const observedByPlannedId = new Map();
  for (const pull of observation.pulls ?? []) {
    if (!pull.plannedPullId) continue;
    if (observedByPlannedId.has(pull.plannedPullId)) {
      throw new Error(`multiple observed pulls reference planned pull ${pull.plannedPullId}`);
    }
    observedByPlannedId.set(pull.plannedPullId, pull);
  }

  const pulls = route.pulls.map((planned) => {
    let observed = observedByPlannedId.get(planned.id);
    let matchBasis = observed ? "planned-pull-id" : null;
    if (!observed) {
      const byOrder = (observation.pulls ?? []).find((candidate) =>
        candidate.order === planned.order && !candidate.plannedPullId,
      );
      if (byOrder) {
        observed = byOrder;
        matchBasis = "order-inferred";
        inferredMatches += 1;
      }
    }
    if (!observed) {
      return {
        plannedPullId: planned.id,
        plannedOrder: planned.order,
        status: "missing",
        matchBasis: null,
        observedOrder: null,
        plannedEnemyForces: planned.enemyForces,
        observedEnemyForces: null,
        enemyForcesDelta: null,
        durationMs: null,
        deaths: null,
        enemyCountDrift: [],
      };
    }
    matchedObserved.add(observed);
    return {
      plannedPullId: planned.id,
      plannedOrder: planned.order,
      status: "matched",
      matchBasis,
      observedOrder: observed.order,
      plannedEnemyForces: planned.enemyForces,
      observedEnemyForces: observed.enemyForces,
      enemyForcesDelta: observed.enemyForces - planned.enemyForces,
      durationMs: observed.durationMs,
      deaths: observed.deaths,
      enemyCountDrift: compareEnemies(planned.enemies, observed.enemies),
    };
  });

  const extraPulls = (observation.pulls ?? [])
    .filter((pull) => !matchedObserved.has(pull))
    .map((pull) => ({
      observedOrder: pull.order,
      plannedPullId: pull.plannedPullId ?? null,
      enemyForces: pull.enemyForces,
      durationMs: pull.durationMs,
      deaths: pull.deaths,
      reason: pull.plannedPullId && !plannedById.has(pull.plannedPullId)
        ? "unknown-planned-pull-id"
        : "unmatched-observed-pull",
    }));

  if (inferredMatches > 0) {
    warnings.push(`${inferredMatches} pull match(es) were inferred by order; plannedPullId is more reliable when pulls split, merge, or reorder.`);
  }
  if (!observation.pulls?.length) warnings.push("The observation has no pull summaries, so pull-level comparison is unavailable.");
  warnings.push("This report describes one observed run; it is evidence for review, not proof that the route is strategically optimal.");

  const checkpoints = route.pulls
    .filter((pull) => pull.afterEncounterId)
    .map((pull) => {
      const candidates = (observation.encounters ?? []).filter((encounter) => encounter.encounterId === pull.afterEncounterId);
      const encounter = candidates.at(-1);
      return {
        encounterId: pull.afterEncounterId,
        afterPlannedPullId: pull.id,
        observed: Boolean(encounter),
        success: encounter?.success ?? null,
        encounterDurationMs: encounter?.durationMs ?? null,
        completedElapsedMs: encounter ? elapsedMs(encounter.completedAt, observation.run.startedAt) : null,
      };
    });

  const observedEnemyForces = (observation.pulls ?? []).reduce((sum, pull) => sum + pull.enemyForces, 0);
  const observedDeaths = (observation.pulls ?? []).reduce((sum, pull) => sum + pull.deaths, 0);
  return {
    $schema: "https://whelp.dev/schemas/route-run-comparison.schema.json",
    reportVersion: 1,
    reportType: "route-run-comparison",
    routeId: route.id,
    challengeMapId: route.challengeMapId,
    observation: {
      gameVersion: observation.game?.version ?? null,
      gameBuild: observation.game?.build ?? null,
      collectorVersion: observation.collector?.version ?? null,
      keystoneLevel: observation.run.keystoneLevel ?? null,
      affixIds: observation.run.affixIds ?? [],
      startedAt: observation.run.startedAt,
      status: observation.run.status ?? null,
    },
    matchQuality: {
      explicitPullIdMatches: pulls.filter((pull) => pull.matchBasis === "planned-pull-id").length,
      orderInferredMatches: inferredMatches,
      missingPlannedPulls: pulls.filter((pull) => pull.status === "missing").length,
      extraObservedPulls: extraPulls.length,
    },
    summary: {
      plannedPullCount: route.pulls.length,
      observedPullCount: observation.pulls?.length ?? 0,
      plannedEnemyForces: route.targetEnemyForces,
      observedEnemyForces,
      enemyForcesDelta: observedEnemyForces - route.targetEnemyForces,
      runDurationMs: observation.run.durationMs ?? null,
      runDeaths: observation.run.deathCount ?? 0,
      pullAttributedDeaths: observedDeaths,
      unattributedDeaths: Math.max(0, (observation.run.deathCount ?? 0) - observedDeaths),
    },
    pulls,
    extraPulls,
    checkpoints,
    warnings,
  };
}
