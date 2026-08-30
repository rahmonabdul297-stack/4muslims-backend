import fs from "fs";
import path from "path";

// Strip anything but safe path segment characters to block traversal via job ids
const sanitizeJobId = (jobId: string): string => {
  const clean = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) {
    throw new Error(
      "Invalid jobId: must contain at least one alphanumeric, dash, or underscore character.",
    );
  }
  return clean;
};

export const getJobTempDir = (jobId: string): string => {
  return path.join(process.cwd(), "tmp", sanitizeJobId(jobId));
};

export const ensureJobTempDir = async (jobId: string): Promise<string> => {
  const dir = getJobTempDir(jobId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

export const clearJobTempDir = async (jobId: string): Promise<void> => {
  const dir = getJobTempDir(jobId);
  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
};

/**
 * Empty leftover scratch/upload directories on boot (e.g. files stranded by a
 * crashed job) so disk usage doesn't accumulate across restarts/deploys.
 */
export const clearAllTempDirs = async (): Promise<void> => {
  const dirs = ["tmp", "tmp_uploads"].map((name) =>
    path.join(process.cwd(), name),
  );

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = await fs.promises.readdir(dir);
    await Promise.all(
      entries.map((entry) =>
        fs.promises
          .rm(path.join(dir, entry), { recursive: true, force: true })
          .catch((err) => {
            console.warn(
              `[startupCleanup] Failed to remove ${path.join(dir, entry)}:`,
              (err as Error).message,
            );
          }),
      ),
    );

    if (entries.length > 0) {
      console.log(
        `[startupCleanup] Cleared ${entries.length} leftover item(s) from ${dir}`,
      );
    }
  }
};
