
import { redisClient } from "../../config/redis.js";


const TASK_TTL_SECONDS = 15 * 60;

function taskKey(taskId) {
  return `skin-analysis:task:${taskId}`;
}


export async function cacheTask(task) {
  await redisClient.set(
    taskKey(task.id),
    JSON.stringify(task),
    { EX: TASK_TTL_SECONDS },
  );
}


export async function getCachedTask(taskId) {
  const value = await redisClient.get(taskKey(taskId));

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    await redisClient.del(taskKey(taskId));
    return null;
  }
}


export async function removeCachedTask(taskId) {
//   await redisClient.del(taskKey(taskId));
}


export async function acquireTaskLock(taskId, token) {
  const result = await redisClient.set(
    `skin-analysis:lock:${taskId}`,
    token,
    { NX: true, PX: 30_000 },
  );

  return result === "OK";
}

export async function releaseTaskLock(taskId, token) {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  await redisClient.eval(script, {
    keys: [`skin-analysis:lock:${taskId}`],
    arguments: [token],
  });
}
